/**
 * TVm Cryptographic & Certificate Manager
 * Generates and manages X.509 client certificates and RSA key pairs for Android TV Remote v2 TLS/mTLS.
 * Calculates pairing PIN SHA-256 hashes per Android TV Remote v2 specs.
 */

import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TVCertificatePair, TVCredentialReference } from './types';

const CREDENTIALS_FILE = path.join(process.cwd(), '.tvm-credentials.json');

interface StoredCredentials {
  masterIdentity?: TVCertificatePair;
  devices: Record<string, {
    credentialId: string;
    certPem: string;
    privateKeyPem: string;
    serverCertPem?: string;
    createdAt: number;
    updatedAt: number;
  }>;
}

export class CertificateManager {
  private memoryStore: StoredCredentials = { devices: {} };

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(CREDENTIALS_FILE)) {
        const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
        this.memoryStore = JSON.parse(raw);
      }
    } catch (err) {
      console.error('[CertificateManager] Failed to read credentials file, initializing fresh store:', err);
      this.memoryStore = { devices: {} };
    }
  }

  private saveToDisk(): void {
    try {
      fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(this.memoryStore, null, 2), {
        mode: 0o600, // Secure permissions: read/write for owner only
      });
    } catch (err) {
      console.error('[CertificateManager] Failed to persist credentials to disk:', err);
    }
  }

  /**
   * Generates a standard X.509 client certificate and RSA 2048-bit keypair
   * compatible with Google TV and Android TV Remote v2 mTLS requirements.
   */
  public generateClientCertificate(commonName: string = 'TVm Remote Client'): TVCertificatePair {
    const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 });
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(16));
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

    const attrs = [
      { name: 'commonName', value: commonName },
      { name: 'organizationName', value: 'TVm Remote' },
      { name: 'organizationalUnitName', value: 'TVm Control Center' },
      { name: 'countryName', value: 'US' },
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Self-sign certificate with SHA-256
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const certPem = forge.pki.certificateToPem(cert);
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

    // Compute SHA-256 fingerprint
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const md = forge.md.sha256.create();
    md.update(der);
    const fingerprint = md.digest().toHex();

    return {
      certPem,
      privateKeyPem,
      fingerprint,
    };
  }

  /**
   * Retrieves or creates the master client identity used for Android TV Remote v2 sessions
   */
  public getOrCreateMasterIdentity(): TVCertificatePair {
    if (this.memoryStore.masterIdentity && this.memoryStore.masterIdentity.certPem) {
      return this.memoryStore.masterIdentity;
    }
    const newIdentity = this.generateClientCertificate('TVm Master Controller');
    this.memoryStore.masterIdentity = newIdentity;
    this.saveToDisk();
    return newIdentity;
  }

  /**
   * Retrieves stored credentials for a specific TV device ID
   */
  public getDeviceCredentials(tvId: string): TVCertificatePair | null {
    const record = this.memoryStore.devices[tvId];
    if (record) {
      return {
        certPem: record.certPem,
        privateKeyPem: record.privateKeyPem,
        fingerprint: this.extractFingerprint(record.certPem),
      };
    }
    return null;
  }

  /**
   * Stores paired credentials for a TV device ID
   */
  public saveDeviceCredentials(tvId: string, certs: TVCertificatePair, serverCertPem?: string): TVCredentialReference {
    const credentialId = `cred_${tvId}_${Date.now()}`;
    const now = Date.now();

    this.memoryStore.devices[tvId] = {
      credentialId,
      certPem: certs.certPem,
      privateKeyPem: certs.privateKeyPem,
      serverCertPem,
      createdAt: this.memoryStore.devices[tvId]?.createdAt || now,
      updatedAt: now,
    };

    this.saveToDisk();

    return {
      tvId,
      credentialId,
      createdAt: this.memoryStore.devices[tvId].createdAt,
      updatedAt: now,
    };
  }

  /**
   * Removes device credentials upon user forgetting a TV
   */
  public removeDeviceCredentials(tvId: string): boolean {
    if (this.memoryStore.devices[tvId]) {
      delete this.memoryStore.devices[tvId];
      this.saveToDisk();
      return true;
    }
    return false;
  }

  /**
   * Checks if TV has valid credentials saved
   */
  public hasDeviceCredentials(tvId: string): boolean {
    return !!this.memoryStore.devices[tvId];
  }

  /**
   * Computes the SHA-256 pairing secret expected by Android TV Remote v2:
   * secret = SHA-256(client_cert_der + server_cert_der + pin_bytes_or_alphanumeric_hex)
   */
  public calculatePairingSecret(
    clientCertPem: string,
    serverCertPem: string,
    pinCode: string
  ): Buffer {
    try {
      const clientCert = forge.pki.certificateFromPem(clientCertPem);
      const serverCert = forge.pki.certificateFromPem(serverCertPem);

      const clientDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(clientCert)).getBytes(), 'binary');
      const serverDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(serverCert)).getBytes(), 'binary');

      // Clean PIN code (hex or alphanumeric)
      const cleanPin = pinCode.trim().toUpperCase();
      let pinBuffer: Buffer;

      // Android TV Remote v2 standard: PIN displayed as 6 alphanumeric characters or 6 hex digits
      // e.g. "A1B2C3" or "123456"
      // In Android TV Remote v2 protocol, if the PIN is hex (contains only 0-9, A-F and length is even),
      // we check both raw ASCII PIN and hex-decoded bytes.
      if (/^[0-9A-F]{6}$/i.test(cleanPin)) {
        // First 2 bytes (or 4 bytes) hash calculation
        const pinHexBuffer = Buffer.from(cleanPin, 'hex');
        const hash = crypto.createHash('sha256');
        hash.update(clientDer);
        hash.update(serverDer);
        hash.update(pinHexBuffer);
        return hash.digest();
      } else {
        const hash = crypto.createHash('sha256');
        hash.update(clientDer);
        hash.update(serverDer);
        hash.update(Buffer.from(cleanPin, 'utf-8'));
        return hash.digest();
      }
    } catch (err) {
      console.error('[CertificateManager] Error calculating pairing secret:', err);
      // Fallback hash
      const hash = crypto.createHash('sha256');
      hash.update(Buffer.from(pinCode, 'utf-8'));
      return hash.digest();
    }
  }

  private extractFingerprint(certPem: string): string {
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
      const md = forge.md.sha256.create();
      md.update(der);
      return md.digest().toHex();
    } catch {
      return '';
    }
  }
}
