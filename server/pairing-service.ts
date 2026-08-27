/**
 * TVm Pairing Service
 * Executes the Android TV Remote Service v2 TLS pairing protocol on port 6467.
 * Triggers the TV's official pairing PIN display, verifies secret challenge, and saves credentials.
 */

import tls from 'tls';
import { CertificateManager } from './crypto-manager';
import { ATVRemoteV2Messages, ProtobufReader } from './protobuf-codec';
import { ConnectionState, PAIRING_PORT, TVCertificatePair, TVDevice } from './types';

export interface PairingEvents {
  onStateChange: (state: ConnectionState, message?: string) => void;
  onPinPrompt: (tv: TVDevice) => void;
  onPairingSuccess: (tv: TVDevice, clientCerts: TVCertificatePair) => void;
  onPairingError: (tv: TVDevice, error: string) => void;
  onLog: (level: 'info' | 'warn' | 'error' | 'debug', msg: string, data?: Record<string, unknown>) => void;
}

export enum PairingStage {
  IDLE = 'IDLE',
  WAITING_REQUEST_ACK = 'WAITING_REQUEST_ACK',
  WAITING_CONFIG_ACK = 'WAITING_CONFIG_ACK',
  WAITING_FOR_USER_PIN = 'WAITING_FOR_USER_PIN',
  WAITING_SECRET_ACK = 'WAITING_SECRET_ACK',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export class PairingService {
  private certManager: CertificateManager;
  private currentSocket: tls.TLSSocket | null = null;
  private activeTv: TVDevice | null = null;
  private activeClientCerts: TVCertificatePair | null = null;
  private serverCertPem: string | null = null;
  private serverCertDer: Buffer | null = null;
  private pendingResolve: ((success: boolean) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;
  private stage: PairingStage = PairingStage.IDLE;

  constructor(certManager: CertificateManager) {
    this.certManager = certManager;
  }

  public getStage(): PairingStage {
    return this.stage;
  }

  /**
   * Initiates pairing with a target TV. Triggers the TV to display its official pairing PIN.
   */
  public async startPairing(tv: TVDevice, events: PairingEvents): Promise<boolean> {
    this.cleanup();
    this.activeTv = tv;
    this.stage = PairingStage.IDLE;

    events.onLog('info', `[PairingService] Initiating TLS pairing handshake with ${tv.name} (${tv.host}:${tv.pairingPort || PAIRING_PORT})`);
    events.onStateChange(ConnectionState.PAIRING, `Connecting to pairing service on ${tv.name}...`);

    // Obtain or generate client certificate
    this.activeClientCerts = this.certManager.getOrCreateMasterIdentity();

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      const socketOptions: tls.ConnectionOptions = {
        host: tv.host,
        port: tv.pairingPort || PAIRING_PORT,
        rejectUnauthorized: false, // Android TVs use self-signed local certs
        cert: this.activeClientCerts!.certPem,
        key: this.activeClientCerts!.privateKeyPem,
        minVersion: 'TLSv1.2',
        timeout: 15000,
      };

      try {
        const socket = tls.connect(socketOptions, () => {
          events.onLog('debug', '[PairingService] TLS connection established with TV pairing port');

          // Extract TV's peer certificate
          const peerCert = socket.getPeerCertificate(true);
          if (peerCert && peerCert.raw) {
            this.serverCertDer = peerCert.raw;
            this.serverCertPem = `-----BEGIN CERTIFICATE-----\n${peerCert.raw.toString('base64').match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
            events.onLog('debug', '[PairingService] Extracted TV peer certificate for cryptographic verification');
          }

          // Step 1: Send PairingRequest
          this.stage = PairingStage.WAITING_REQUEST_ACK;
          events.onLog('debug', '[PairingService] Sending PairingRequest (service: TVm, client: TVm Controller)');
          const pairingReq = ATVRemoteV2Messages.buildPairingRequest('TVm', 'TVm Controller');
          socket.write(pairingReq);
        });

        this.currentSocket = socket;

        let incomingBuffer = Buffer.alloc(0);

        socket.on('data', (chunk) => {
          incomingBuffer = Buffer.concat([incomingBuffer, chunk]);

          try {
            const { packets, remaining } = ProtobufReader.unframePackets(incomingBuffer);
            incomingBuffer = remaining;

            for (const payload of packets) {
              this.handlePairingPacket(payload, socket, events);
            }
          } catch (err) {
            events.onLog('warn', '[PairingService] Parsing incoming pairing frame:', { err: String(err) });
          }
        });

        socket.on('timeout', () => {
          events.onLog('error', '[PairingService] Pairing socket timeout');
          events.onStateChange(ConnectionState.PAIRING_FAILED, 'Pairing connection timed out');
          events.onPairingError(tv, 'Connection timed out while waiting for TV response');
          this.cleanup();
          resolve(false);
        });

        socket.on('error', (err) => {
          events.onLog('error', `[PairingService] Socket error: ${err.message}`);
          events.onStateChange(ConnectionState.PAIRING_FAILED, `Pairing failed: ${err.message}`);
          events.onPairingError(tv, err.message);
          this.cleanup();
          resolve(false);
        });

        socket.on('close', () => {
          events.onLog('debug', `[PairingService] Pairing socket closed (current stage: ${this.stage})`);
          if (this.stage === PairingStage.WAITING_FOR_USER_PIN) {
            // Keep status message until user enters PIN or cancels
          }
        });

      } catch (err) {
        events.onLog('error', `[PairingService] Failed to establish pairing socket: ${err}`);
        events.onStateChange(ConnectionState.PAIRING_FAILED, `Pairing setup error: ${String(err)}`);
        events.onPairingError(tv, String(err));
        this.cleanup();
        resolve(false);
      }
    });
  }

  private handlePairingPacket(payload: Buffer, socket: tls.TLSSocket, events: PairingEvents): void {
    const payloadReader = new ProtobufReader(payload);
    const fields = payloadReader.readFields();

    const statusField = fields.find(f => f.fieldNumber === 2);
    const status = statusField?.varintValue !== undefined ? Number(statusField.varintValue) : 1;

    events.onLog('debug', `[PairingService] Received pairing response at stage [${this.stage}] (status: ${status}, ${fields.length} fields)`);

    if (status !== 1 && status !== 0) {
      // Non-OK status from TV
      events.onLog('error', `[PairingService] TV returned error status: ${status}`);
      events.onStateChange(ConnectionState.PAIRING_FAILED, `Pairing failed: TV reported error (${status})`);
      if (this.activeTv) events.onPairingError(this.activeTv, `Pairing error code: ${status}`);
      this.stage = PairingStage.FAILED;
      if (this.pendingResolve) this.pendingResolve(false);
      this.cleanup();
      return;
    }

    switch (this.stage) {
      case PairingStage.WAITING_REQUEST_ACK: {
        // Step 2 -> Step 3: We received PairingRequestAck. Now send PairingConfiguration to tell TV to show PIN.
        events.onLog('info', '[PairingService] Received PairingRequestAck -> Sending PairingConfiguration (HEXADECIMAL, 6-digit)');
        this.stage = PairingStage.WAITING_CONFIG_ACK;
        const configMsg = ATVRemoteV2Messages.buildPairingConfiguration(1, 6);
        socket.write(configMsg);
        break;
      }

      case PairingStage.WAITING_CONFIG_ACK: {
        // Step 4: We received PairingConfigurationAck from the TV!
        // The TV is now actively displaying the 6-character PIN on its screen!
        events.onLog('info', `[PairingService] Received PairingConfigurationAck! TV is displaying PIN code on screen.`);
        this.stage = PairingStage.WAITING_FOR_USER_PIN;
        events.onStateChange(ConnectionState.PAIRING_CODE_REQUIRED, `Enter the 6-digit code shown on ${this.activeTv?.name}`);
        if (this.activeTv) {
          events.onPinPrompt(this.activeTv);
        }
        break;
      }

      case PairingStage.WAITING_SECRET_ACK: {
        // Step 6: We received PairingSecretAck after submitting the challenge!
        events.onLog('info', `[PairingService] Received PairingSecretAck from TV (status: ${status})`);
        if (status === 1 || status === 0) {
          this.stage = PairingStage.COMPLETED;
          events.onLog('info', `[PairingService] Pairing SUCCESS for TV: ${this.activeTv?.name}`);
          if (this.activeTv && this.activeClientCerts) {
            this.certManager.saveDeviceCredentials(this.activeTv.id, this.activeClientCerts, this.serverCertPem || undefined);
            events.onStateChange(ConnectionState.PAIRED, `Successfully paired with ${this.activeTv.name}`);
            events.onPairingSuccess(this.activeTv, this.activeClientCerts);
          }
          if (this.pendingResolve) this.pendingResolve(true);
        } else {
          this.stage = PairingStage.FAILED;
          events.onLog('error', `[PairingService] Invalid pairing PIN entered`);
          events.onStateChange(ConnectionState.PAIRING_FAILED, 'Invalid pairing PIN entered. Please try again.');
          if (this.activeTv) events.onPairingError(this.activeTv, 'Incorrect PIN or pairing expired');
          if (this.pendingResolve) this.pendingResolve(false);
        }
        this.cleanup();
        break;
      }

      default:
        events.onLog('debug', `[PairingService] Unhandled packet during stage ${this.stage}`);
        break;
    }
  }

  /**
   * Called when user submits the 6-digit PIN shown on the TV screen
   */
  public async submitPin(pinCode: string, events: PairingEvents): Promise<boolean> {
    if (!this.currentSocket || !this.currentSocket.writable || !this.activeClientCerts) {
      events.onLog('error', '[PairingService] Cannot submit PIN: Pairing socket is not active or closed');
      events.onStateChange(ConnectionState.PAIRING_FAILED, 'Pairing session expired. Please start pairing again.');
      return false;
    }

    events.onLog('info', `[PairingService] Computing cryptographic secret challenge for PIN`);
    events.onStateChange(ConnectionState.VERIFYING_PAIRING, 'Verifying cryptographic challenge with TV...');

    try {
      const secretHash = this.certManager.calculatePairingSecret(
        this.activeClientCerts.certPem,
        this.serverCertDer || this.serverCertPem || this.activeClientCerts.certPem,
        pinCode
      );

      this.stage = PairingStage.WAITING_SECRET_ACK;
      events.onLog('debug', `[PairingService] Transmitting PairingSecret payload (${secretHash.length} bytes)`);
      const secretPacket = ATVRemoteV2Messages.buildPairingSecret(secretHash);
      this.currentSocket.write(secretPacket);
      return true;
    } catch (err) {
      events.onLog('error', `[PairingService] Failed to generate/send pairing secret: ${err}`);
      events.onStateChange(ConnectionState.PAIRING_FAILED, `Secret calculation error: ${String(err)}`);
      return false;
    }
  }

  public cancel(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.currentSocket) {
      try {
        this.currentSocket.destroy();
      } catch {
        // Ignore
      }
      this.currentSocket = null;
    }
    this.stage = PairingStage.IDLE;
    this.pendingResolve = null;
    this.pendingReject = null;
  }
}
