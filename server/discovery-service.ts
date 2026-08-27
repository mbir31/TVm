/**
 * TVm Discovery Service
 * Discovers Google TV and Android TV devices on the local Wi-Fi network using mDNS / DNS-SD.
 * Target service: _androidtvremote2._tcp.local
 * Resolves local IP addresses, ports, and hardware model metadata.
 */

import { Bonjour } from 'bonjour-service';
import net from 'net';
import { ConnectionState, PAIRING_PORT, REMOTE_PORT, TVCapabilitiesMap, TVCapability, TVDevice } from './types';

export interface DiscoveryEvents {
  onTVDiscovered: (tv: TVDevice) => void;
  onTVLost: (tvId: string) => void;
  onLog: (level: 'info' | 'warn' | 'error' | 'debug', msg: string, data?: Record<string, unknown>) => void;
}

const DEFAULT_CAPABILITIES: TVCapabilitiesMap = {
  [TVCapability.REMOTE_NAVIGATION]: 'SUPPORTED',
  [TVCapability.VOLUME]: 'SUPPORTED',
  [TVCapability.MUTE]: 'SUPPORTED',
  [TVCapability.POWER]: 'SUPPORTED',
  [TVCapability.MEDIA]: 'SUPPORTED',
  [TVCapability.KEYBOARD]: 'SUPPORTED',
  [TVCapability.TEXT_INPUT]: 'SUPPORTED',
  [TVCapability.APP_LAUNCH]: 'SUPPORTED',
  [TVCapability.TOUCHPAD]: 'SUPPORTED',
  [TVCapability.AIR_MOUSE]: 'SUPPORTED',
  [TVCapability.MOTION]: 'SUPPORTED',
  [TVCapability.GAME_CONTROLLER]: 'SUPPORTED',
  [TVCapability.VOICE]: 'SUPPORTED',
};

export class DiscoveryService {
  private bonjour: Bonjour | null = null;
  private discoveredTVs = new Map<string, TVDevice>();
  private isScanning = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private events: DiscoveryEvents | null = null;

  constructor() {
    try {
      this.bonjour = new Bonjour();
    } catch (err) {
      console.warn('[DiscoveryService] Bonjour mDNS initialization warning:', err);
    }
  }

  public getDiscoveredTVs(): TVDevice[] {
    return Array.from(this.discoveredTVs.values());
  }

  public getTV(id: string): TVDevice | undefined {
    return this.discoveredTVs.get(id);
  }

  public registerTV(tv: TVDevice): void {
    this.discoveredTVs.set(tv.id, tv);
  }

  /**
   * Starts mDNS listener for _androidtvremote2._tcp.local services
   */
  public startDiscovery(events: DiscoveryEvents): void {
    this.events = events;
    if (this.isScanning) return;
    this.isScanning = true;

    events.onLog('info', '[DiscoveryService] Starting mDNS broadcast scanner for _androidtvremote2._tcp.local');

    try {
      if (!this.bonjour) {
        this.bonjour = new Bonjour();
      }

      this.bonjour.find({ type: 'androidtvremote2' }, (service) => {
        this.handleDiscoveredService(service);
      });

      // Also listen for legacy androidtv services
      this.bonjour.find({ type: 'androidtv' }, (service) => {
        this.handleDiscoveredService(service);
      });

      // Also listen for googlecast services to identify Google TV hostnames
      this.bonjour.find({ type: 'googlecast' }, (service) => {
        const fn = service.txt?.fn || service.name || '';
        const md = service.txt?.md || '';
        // If device looks like a Google TV or Android TV
        if (fn.toLowerCase().includes('tv') || md.toLowerCase().includes('chromecast with google tv') || md.toLowerCase().includes('bravia')) {
          this.handleDiscoveredService(service, true);
        }
      });

      // Periodic check for stale devices
      if (this.scanInterval) clearInterval(this.scanInterval);
      this.scanInterval = setInterval(() => {
        const now = Date.now();
        for (const [id, tv] of this.discoveredTVs.entries()) {
          // If not seen in 60 seconds and not a virtual testbed or manual TV, log debug
          if (!tv.isTestbed && now - tv.lastSeen > 60000) {
            events.onLog('debug', `[DiscoveryService] TV ${tv.name} became stale`);
          }
        }
      }, 15000);

    } catch (err) {
      events.onLog('error', `[DiscoveryService] mDNS scanning error: ${String(err)}`);
    }
  }

  private handleDiscoveredService(service: any, isCast = false): void {
    const host = service.addresses?.[0] || service.host || service.referer?.address;
    if (!host) return;

    const name = service.txt?.fn || service.name || (isCast ? 'Google TV Device' : 'Android TV');
    const model = service.txt?.md || service.txt?.model || 'Android TV Device';
    const manufacturer = service.txt?.mf || service.txt?.vendor || 'Google / Android TV';
    const tvId = `tv_${host.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const tvDevice: TVDevice = {
      id: tvId,
      name: name.replace(/\._androidtvremote2.*$/, '').replace(/\._googlecast.*$/, ''),
      manufacturer,
      model,
      platform: name.toLowerCase().includes('google') ? 'Google TV' : 'Android TV',
      serviceType: '_androidtvremote2._tcp.local',
      host,
      discoveredPort: isCast ? PAIRING_PORT : (service.port || PAIRING_PORT),
      pairingPort: PAIRING_PORT,
      remotePort: REMOTE_PORT,
      capabilities: { ...DEFAULT_CAPABILITIES },
      connectionState: ConnectionState.DISCOVERED,
      lastSeen: Date.now(),
      isPaired: false,
    };

    const isNew = !this.discoveredTVs.has(tvId);
    this.discoveredTVs.set(tvId, tvDevice);

    if (this.events) {
      this.events.onLog('info', `[DiscoveryService] ${isNew ? 'Discovered new' : 'Updated'} TV: ${tvDevice.name} at ${host}`);
      this.events.onTVDiscovered(tvDevice);
    }
  }

  /**
   * Actively probes a specific IP address on port 6467/6466
   */
  public async probeTV(host: string, port = PAIRING_PORT, timeout = 1200): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(true);
        }
      });

      socket.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.on('error', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      try {
        socket.connect(port, host);
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Scans a subnet range (e.g. 192.168.1.1 - 192.168.1.254) for open Google TV ports
   */
  public async scanSubnet(
    subnetPrefix: string,
    onFound?: (tv: TVDevice) => void
  ): Promise<TVDevice[]> {
    const cleanPrefix = subnetPrefix.trim().replace(/\.\d+$/, '').replace(/\.$/, '');
    const found: TVDevice[] = [];
    const batchSize = 25;

    if (this.events) {
      this.events.onLog('info', `[DiscoveryService] Scanning subnet ${cleanPrefix}.1-254 for Google TV / Android TV devices on port ${PAIRING_PORT}...`);
    }

    const ips: string[] = [];
    for (let i = 1; i <= 254; i++) {
      ips.push(`${cleanPrefix}.${i}`);
    }

    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (ip) => {
          const isOpen = await this.probeTV(ip, PAIRING_PORT, 800) || await this.probeTV(ip, REMOTE_PORT, 800);
          if (isOpen) {
            const tv = this.addManualTV(ip, `Google TV (${ip})`);
            found.push(tv);
            if (onFound) onFound(tv);
            if (this.events) {
              this.events.onLog('info', `[DiscoveryService] Subnet scan discovered active TV at ${ip}`);
              this.events.onTVDiscovered(tv);
            }
          }
          return isOpen;
        })
      );
    }

    return found;
  }

  /**
   * Adds or probes a TV by direct IP address entered manually by user
   */
  public addManualTV(ipAddress: string, name?: string): TVDevice {
    const cleanIp = ipAddress.trim();
    const tvId = `tv_${cleanIp.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const displayName = name?.trim() || `Google TV (${cleanIp})`;

    const device: TVDevice = {
      id: tvId,
      name: displayName,
      manufacturer: 'Google / Android TV',
      model: 'Smart TV',
      platform: 'Google TV',
      serviceType: '_androidtvremote2._tcp.local',
      host: cleanIp,
      discoveredPort: PAIRING_PORT,
      pairingPort: PAIRING_PORT,
      remotePort: REMOTE_PORT,
      capabilities: { ...DEFAULT_CAPABILITIES },
      connectionState: ConnectionState.DISCOVERED,
      lastSeen: Date.now(),
      isPaired: false,
    };

    this.discoveredTVs.set(tvId, device);
    return device;
  }

  public triggerRescan(): TVDevice[] {
    if (this.bonjour && this.events) {
      try {
        this.bonjour.find({ type: 'androidtvremote2' }, (service) => {
          this.handleDiscoveredService(service);
        });
        this.bonjour.find({ type: 'googlecast' }, (service) => {
          this.handleDiscoveredService(service, true);
        });
      } catch (err) {
        console.warn('[DiscoveryService] Rescan error:', err);
      }
    }
    return this.getDiscoveredTVs();
  }

  public stopDiscovery(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.bonjour) {
      try {
        this.bonjour.destroy();
      } catch {
        // Ignore
      }
      this.bonjour = null;
    }
    this.isScanning = false;
  }
}

