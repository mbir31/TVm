/**
 * TVm Discovery Service
 * Discovers Google TV and Android TV devices on the local Wi-Fi network using mDNS / DNS-SD.
 * Target service: _androidtvremote2._tcp.local
 * Resolves local IP addresses, ports, and hardware model metadata.
 */

import { Bonjour } from 'bonjour-service';
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
    if (this.isScanning) return;
    this.isScanning = true;

    events.onLog('info', '[DiscoveryService] Starting mDNS broadcast scanner for _androidtvremote2._tcp.local');

    try {
      if (!this.bonjour) {
        this.bonjour = new Bonjour();
      }

      const browser = this.bonjour.find({ type: 'androidtvremote2' }, (service) => {
        const host = service.addresses?.[0] || service.host || service.referer?.address;
        if (!host) return;

        const name = service.txt?.fn || service.name || 'Google TV';
        const model = service.txt?.md || service.txt?.model || 'Android TV Device';
        const manufacturer = service.txt?.mf || service.txt?.vendor || 'Google / Android TV';
        const tvId = `tv_${host.replace(/[^a-zA-Z0-9]/g, '_')}`;

        const tvDevice: TVDevice = {
          id: tvId,
          name: name.replace(/\._androidtvremote2.*$/, ''),
          manufacturer,
          model,
          platform: name.toLowerCase().includes('google') ? 'Google TV' : 'Android TV',
          serviceType: '_androidtvremote2._tcp.local',
          host,
          discoveredPort: service.port || PAIRING_PORT,
          pairingPort: PAIRING_PORT,
          remotePort: REMOTE_PORT,
          capabilities: { ...DEFAULT_CAPABILITIES },
          connectionState: ConnectionState.DISCOVERED,
          lastSeen: Date.now(),
          isPaired: false,
        };

        const isNew = !this.discoveredTVs.has(tvId);
        this.discoveredTVs.set(tvId, tvDevice);

        events.onLog('info', `[DiscoveryService] ${isNew ? 'Discovered new' : 'Updated'} TV: ${tvDevice.name} at ${host}`);
        events.onTVDiscovered(tvDevice);
      });

      // Periodic check for stale devices
      if (this.scanInterval) clearInterval(this.scanInterval);
      this.scanInterval = setInterval(() => {
        const now = Date.now();
        for (const [id, tv] of this.discoveredTVs.entries()) {
          // If not seen in 45 seconds and not a virtual testbed, mark as lost
          if (!tv.isTestbed && now - tv.lastSeen > 45000) {
            events.onLog('debug', `[DiscoveryService] TV ${tv.name} became stale`);
          }
        }
      }, 15000);

    } catch (err) {
      events.onLog('error', `[DiscoveryService] mDNS scanning error: ${String(err)}`);
    }
  }

  /**
   * Adds or probes a TV by direct IP address entered manually by user
   */
  public addManualTV(ipAddress: string, name?: string): TVDevice {
    const cleanIp = ipAddress.trim();
    const tvId = `tv_${cleanIp.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const displayName = name?.trim() || `Android TV (${cleanIp})`;

    const device: TVDevice = {
      id: tvId,
      name: displayName,
      manufacturer: 'Android TV / Google TV',
      model: 'Network TV',
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
