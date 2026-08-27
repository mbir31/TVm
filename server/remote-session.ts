/**
 * TVm Remote Control Session
 * Maintains persistent TLS/mTLS connection to Google TV / Android TV on port 6466.
 * Implements Android TV Remote Service v2 session handshake, keep-alive, and real-time command delivery.
 */

import tls from 'tls';
import { CertificateManager } from './crypto-manager';
import { ATVRemoteV2Messages, ProtobufReader } from './protobuf-codec';
import { AndroidKeyCode, ConnectionState, KeyDirection, REMOTE_PORT, TVCommandResult, TVDevice } from './types';

export interface RemoteSessionEvents {
  onStateChange: (state: ConnectionState, message?: string) => void;
  onCommandAck: (result: TVCommandResult) => void;
  onDisconnected: (tv: TVDevice, reason: string) => void;
  onLog: (level: 'info' | 'warn' | 'error' | 'debug', msg: string, data?: Record<string, unknown>) => void;
  onPing: (latencyMs: number) => void;
}

export class RemoteSession {
  private certManager: CertificateManager;
  private socket: tls.TLSSocket | null = null;
  private currentTv: TVDevice | null = null;
  private events: RemoteSessionEvents | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConfigured = false;
  private lastPingSent = 0;
  private commandStats = { totalSent: 0, successful: 0, failed: 0, lastLatencyMs: 0 };

  constructor(certManager: CertificateManager) {
    this.certManager = certManager;
  }

  public isConnected(): boolean {
    return !!this.socket && !this.socket.destroyed && this.socket.writable && this.isConfigured;
  }

  public getStats() {
    return { ...this.commandStats };
  }

  /**
   * Connects to TV remote service port 6466 with mTLS using stored certificate credentials
   */
  public async connect(tv: TVDevice, events: RemoteSessionEvents): Promise<boolean> {
    this.disconnect();
    this.currentTv = tv;
    this.events = events;

    const creds = this.certManager.getDeviceCredentials(tv.id) || this.certManager.getOrCreateMasterIdentity();

    events.onLog('info', `[RemoteSession] Connecting to ${tv.name} on remote channel (${tv.host}:${tv.remotePort || REMOTE_PORT})`);
    events.onStateChange(ConnectionState.ESTABLISHING_REMOTE_SESSION, `Connecting to TV Remote Service...`);

    return new Promise((resolve) => {
      let resolved = false;

      const socketOptions: tls.ConnectionOptions = {
        host: tv.host,
        port: tv.remotePort || REMOTE_PORT,
        rejectUnauthorized: false,
        cert: creds.certPem,
        key: creds.privateKeyPem,
        minVersion: 'TLSv1.2',
        timeout: 10000,
      };

      try {
        const socket = tls.connect(socketOptions, () => {
          events.onLog('info', `[RemoteSession] TLS connection established with TV remote port`);

          // Step 1: Send RemoteConfigure
          events.onLog('debug', '[RemoteSession] Sending RemoteConfigure (code: 622, model: TVm)');
          const configMsg = ATVRemoteV2Messages.buildRemoteConfigure('TVm Physical Remote', '1.0.0');
          socket.write(configMsg);

          // Step 2: Send RemoteSetActive
          const activeMsg = ATVRemoteV2Messages.buildRemoteSetActive(622);
          socket.write(activeMsg);

          this.isConfigured = true;
          events.onStateChange(ConnectionState.CONNECTED, `Connected to ${tv.name}`);
          this.startHeartbeat();

          if (!resolved) {
            resolved = true;
            resolve(true);
          }
        });

        this.socket = socket;

        let incomingBuffer = Buffer.alloc(0);

        socket.on('data', (chunk) => {
          incomingBuffer = Buffer.concat([incomingBuffer, chunk]);

          try {
            const { packets, remaining } = ProtobufReader.unframePackets(incomingBuffer);
            incomingBuffer = remaining;

            for (const payload of packets) {
              this.handleIncomingMessage(payload);
            }
          } catch (err) {
            events.onLog('debug', '[RemoteSession] Incoming frame parse:', { err: String(err) });
          }
        });

        socket.on('timeout', () => {
          events.onLog('warn', '[RemoteSession] Remote socket timeout');
          this.handleDisconnect('Socket timeout');
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        });

        socket.on('error', (err) => {
          events.onLog('error', `[RemoteSession] Remote socket error: ${err.message}`);
          this.handleDisconnect(err.message);
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        });

        socket.on('close', () => {
          events.onLog('warn', '[RemoteSession] Remote socket closed');
          this.handleDisconnect('Connection closed by TV');
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        });

      } catch (err) {
        events.onLog('error', `[RemoteSession] Socket connection failure: ${String(err)}`);
        this.handleDisconnect(String(err));
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }
    });
  }

  private handleIncomingMessage(payload: Buffer): void {
    const reader = new ProtobufReader(payload);
    const fields = reader.readFields();

    // Check for PingRequest (Field 7)
    const pingReq = fields.find(f => f.fieldNumber === 7);
    if (pingReq && this.socket && this.socket.writable) {
      const pingResp = ATVRemoteV2Messages.buildRemotePingResponse(1);
      this.socket.write(pingResp);
    }

    // Check for PingResponse (Field 8)
    const pingResp = fields.find(f => f.fieldNumber === 8);
    if (pingResp && this.lastPingSent > 0 && this.events) {
      const latency = Math.max(1, Date.now() - this.lastPingSent);
      this.commandStats.lastLatencyMs = latency;
      this.events.onPing(latency);
    }
  }

  private startHeartbeat(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.isConnected() && this.socket) {
        this.lastPingSent = Date.now();
        const pingMsg = ATVRemoteV2Messages.buildRemotePingRequest(1, 2);
        this.socket.write(pingMsg);
      }
    }, 5000);
  }

  private handleDisconnect(reason: string): void {
    const wasConnected = this.isConfigured;
    this.isConfigured = false;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (wasConnected && this.currentTv && this.events) {
      this.events.onStateChange(ConnectionState.DISCONNECTED, `Disconnected from ${this.currentTv.name}: ${reason}`);
      this.events.onDisconnected(this.currentTv, reason);
    }
  }

  /**
   * Transmits a real Android TV KeyCode to the television
   */
  public async sendKey(keyCode: AndroidKeyCode, direction: KeyDirection = KeyDirection.SHORT): Promise<TVCommandResult> {
    const startTime = Date.now();
    this.commandStats.totalSent++;

    if (!this.isConnected() || !this.socket) {
      this.commandStats.failed++;
      const result: TVCommandResult = {
        success: false,
        timestamp: Date.now(),
        command: `KEY_${AndroidKeyCode[keyCode] || keyCode}`,
        error: 'Remote session not connected',
      };
      if (this.events) this.events.onCommandAck(result);
      return result;
    }

    try {
      const packet = ATVRemoteV2Messages.buildRemoteKeyInject(keyCode, direction);
      this.socket.write(packet);

      const latencyMs = Math.max(1, Date.now() - startTime);
      this.commandStats.successful++;
      this.commandStats.lastLatencyMs = latencyMs;

      const result: TVCommandResult = {
        success: true,
        timestamp: Date.now(),
        command: `KEY_${AndroidKeyCode[keyCode] || keyCode}`,
        latencyMs,
      };

      if (this.events) {
        this.events.onLog('debug', `[RemoteSession] Sent key ${AndroidKeyCode[keyCode] || keyCode} (${latencyMs}ms)`);
        this.events.onCommandAck(result);
      }
      return result;
    } catch (err) {
      this.commandStats.failed++;
      const result: TVCommandResult = {
        success: false,
        timestamp: Date.now(),
        command: `KEY_${AndroidKeyCode[keyCode] || keyCode}`,
        error: String(err),
      };
      if (this.events) this.events.onCommandAck(result);
      return result;
    }
  }

  /**
   * Transmits volume adjustment command
   */
  public async adjustVolume(direction: 'UP' | 'DOWN' | 'MUTE'): Promise<TVCommandResult> {
    if (direction === 'UP') return this.sendKey(AndroidKeyCode.KEYCODE_VOLUME_UP);
    if (direction === 'DOWN') return this.sendKey(AndroidKeyCode.KEYCODE_VOLUME_DOWN);
    return this.sendKey(AndroidKeyCode.KEYCODE_VOLUME_MUTE);
  }

  /**
   * Transmits text characters to the active input field on the television
   */
  public async sendText(text: string): Promise<TVCommandResult> {
    const startTime = Date.now();
    this.commandStats.totalSent++;

    if (!this.isConnected() || !this.socket) {
      this.commandStats.failed++;
      return {
        success: false,
        timestamp: Date.now(),
        command: `TEXT_IME`,
        error: 'Remote session not connected',
      };
    }

    try {
      const packet = ATVRemoteV2Messages.buildRemoteImeKeyInject(text);
      this.socket.write(packet);

      const latencyMs = Math.max(1, Date.now() - startTime);
      this.commandStats.successful++;
      const result: TVCommandResult = {
        success: true,
        timestamp: Date.now(),
        command: `TEXT_IME (${text.length} chars)`,
        latencyMs,
      };
      if (this.events) {
        this.events.onLog('info', `[RemoteSession] Sent IME text "${text}" to TV (${latencyMs}ms)`);
        this.events.onCommandAck(result);
      }
      return result;
    } catch (err) {
      this.commandStats.failed++;
      return {
        success: false,
        timestamp: Date.now(),
        command: 'TEXT_IME',
        error: String(err),
      };
    }
  }

  /**
   * Launches an Android TV / Google TV application using its deep-link intent
   */
  public async launchApp(appLinkOrPackage: string): Promise<TVCommandResult> {
    const startTime = Date.now();
    this.commandStats.totalSent++;

    if (!this.isConnected() || !this.socket) {
      this.commandStats.failed++;
      return {
        success: false,
        timestamp: Date.now(),
        command: `LAUNCH_APP`,
        error: 'Remote session not connected',
      };
    }

    try {
      const packet = ATVRemoteV2Messages.buildRemoteAppLinkLaunch(appLinkOrPackage);
      this.socket.write(packet);

      const latencyMs = Math.max(1, Date.now() - startTime);
      this.commandStats.successful++;
      const result: TVCommandResult = {
        success: true,
        timestamp: Date.now(),
        command: `LAUNCH_APP: ${appLinkOrPackage}`,
        latencyMs,
      };
      if (this.events) {
        this.events.onLog('info', `[RemoteSession] Launched app "${appLinkOrPackage}" on TV`);
        this.events.onCommandAck(result);
      }
      return result;
    } catch (err) {
      this.commandStats.failed++;
      return {
        success: false,
        timestamp: Date.now(),
        command: `LAUNCH_APP: ${appLinkOrPackage}`,
        error: String(err),
      };
    }
  }

  public disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {
        // Ignore
      }
      this.socket = null;
    }
    this.isConfigured = false;
  }
}
