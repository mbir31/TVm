/**
 * TVm Central Connectivity Orchestrator
 * Coordinates Discovery, Pairing, Cryptographic Certificates, Remote Sessions,
 * State Machine transitions, Reconnection, Multi-TV management, and Diagnostics.
 */

import { CertificateManager } from './crypto-manager';
import { DiscoveryService } from './discovery-service';
import { LocalTVTestbed } from './local-tv-testbed';
import { PairingService } from './pairing-service';
import { RemoteSession } from './remote-session';
import {
  AndroidKeyCode,
  ConnectionState,
  DiagnosticLog,
  KeyDirection,
  MotionInputPayload,
  TVCommandResult,
  TVDevice,
} from './types';

export interface TVConnectivityListener {
  onStateChange: (state: ConnectionState, message?: string, tv?: TVDevice | null) => void;
  onTVDiscovered: (tv: TVDevice) => void;
  onPinPrompt: (tv: TVDevice, testbedPin?: string) => void;
  onCommandAck: (result: TVCommandResult) => void;
  onDiagnosticLog: (log: DiagnosticLog) => void;
  onPing: (latencyMs: number) => void;
}

export class TVConnectivityService {
  private certManager: CertificateManager;
  private discoveryService: DiscoveryService;
  private pairingService: PairingService;
  private remoteSession: RemoteSession;
  private testbed: LocalTVTestbed;

  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private stateMessage = 'Ready to connect';
  private activeTv: TVDevice | null = null;
  private pairedTvs: Map<string, TVDevice> = new Map();
  private listeners: Set<TVConnectivityListener> = new Set();
  private logs: DiagnosticLog[] = [];
  private autoReconnect = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor() {
    this.certManager = new CertificateManager();
    this.discoveryService = new DiscoveryService();
    this.pairingService = new PairingService(this.certManager);
    this.remoteSession = new RemoteSession(this.certManager);
    this.testbed = new LocalTVTestbed(this.certManager);

    this.init();
  }

  private async init(): Promise<void> {
    this.log('info', 'system', 'Initializing TVm Local Connectivity Core & Protocol Engine');

    // 1. Local Testbed Server is isolated behind explicit opt-in (ENABLE_LOCAL_TESTBED=true)
    // In production or standard mode, testbed never registers or appears in discovery list.
    const isTestbedExplicitlyEnabled = process.env.ENABLE_LOCAL_TESTBED === 'true' || process.env.NODE_ENV === 'test';
    if (isTestbedExplicitlyEnabled) {
      const testbedDevice = await this.testbed.start({
        onPinGenerated: (tvId, pin) => {
          this.log('info', 'pairing', `[Dev Testbed] Virtual TV generated pairing PIN: ${pin}`);
          if (this.activeTv?.id === tvId) {
            this.notifyPinPrompt(this.activeTv, pin);
          }
        },
        onCommandReceived: (tvId, cmd, details) => {
          this.log('info', 'testbed', `[Dev Testbed] Virtual TV executed command: ${cmd}`, details);
        },
        onLog: (lvl, msg, data) => {
          this.log(lvl, 'testbed', msg, data);
        },
      });

      this.discoveryService.registerTV(testbedDevice);
      this.log('warn', 'system', 'Development LocalTVTestbed is active on loopback ports 16467/16466 (ENABLE_LOCAL_TESTBED=true)');
    } else {
      this.log('info', 'system', 'Production mode: LocalTVTestbed disabled. All discovery and pairing targets real Wi-Fi network.');
    }

    // 2. Start mDNS discovery on local network
    this.discoveryService.startDiscovery({
      onTVDiscovered: (tv) => {
        // Check if previously paired
        if (this.certManager.hasDeviceCredentials(tv.id)) {
          tv.isPaired = true;
          this.pairedTvs.set(tv.id, tv);
        }
        this.log('info', 'discovery', `TV identified: ${tv.name} (${tv.host})`);
        this.notifyTVDiscovered(tv);

        // Auto-reconnect if preferred TV is found and we are disconnected
        if (this.autoReconnect && this.state === ConnectionState.DISCONNECTED && tv.isPaired) {
          this.connectTV(tv.id);
        }
      },
      onTVLost: (tvId) => {
        this.log('warn', 'discovery', `TV signal lost: ${tvId}`);
      },
      onLog: (lvl, msg, data) => {
        this.log(lvl, 'discovery', msg, data);
      },
    });
  }

  public addListener(listener: TVConnectivityListener): () => void {
    this.listeners.add(listener);
    // Emit initial status
    listener.onStateChange(this.state, this.stateMessage, this.activeTv);
    return () => this.listeners.delete(listener);
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public getStateMessage(): string {
    return this.stateMessage;
  }

  public getActiveTV(): TVDevice | null {
    return this.activeTv;
  }

  public getDiscoveredTVs(): TVDevice[] {
    const list = this.discoveryService.getDiscoveredTVs();
    return list.map(tv => ({
      ...tv,
      isPaired: this.certManager.hasDeviceCredentials(tv.id),
      connectionState: this.activeTv?.id === tv.id ? this.state : ConnectionState.DISCOVERED,
    }));
  }

  public getPairedTVs(): TVDevice[] {
    return this.getDiscoveredTVs().filter(t => t.isPaired);
  }

  public getLogs(): DiagnosticLog[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
  }

  private transitionState(newState: ConnectionState, message?: string): void {
    this.state = newState;
    this.stateMessage = message || newState;
    this.log('info', 'system', `State Machine Transition: [ ${newState} ] - ${this.stateMessage}`);
    for (const l of this.listeners) {
      l.onStateChange(this.state, this.stateMessage, this.activeTv);
    }
  }

  private notifyTVDiscovered(tv: TVDevice): void {
    for (const l of this.listeners) {
      l.onTVDiscovered(tv);
    }
  }

  private notifyPinPrompt(tv: TVDevice, testbedPin?: string): void {
    for (const l of this.listeners) {
      l.onPinPrompt(tv, testbedPin);
    }
  }

  private notifyCommandAck(result: TVCommandResult): void {
    for (const l of this.listeners) {
      l.onCommandAck(result);
    }
  }

  private notifyPing(latencyMs: number): void {
    for (const l of this.listeners) {
      l.onPing(latencyMs);
    }
  }

  private log(
    level: 'info' | 'warn' | 'error' | 'debug' | 'trace',
    category: 'discovery' | 'pairing' | 'tls' | 'remote' | 'command' | 'testbed' | 'system',
    message: string,
    data?: Record<string, unknown>
  ): void {
    // Sanitize any potential sensitive fields
    const sanitizedData = data ? JSON.parse(JSON.stringify(data, (key, value) => {
      if (/key|secret|private|password/i.test(key)) return '[REDACTED]';
      return value;
    })) : undefined;

    const logEntry: DiagnosticLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      data: sanitizedData,
    };

    this.logs.unshift(logEntry);
    if (this.logs.length > 200) this.logs.pop();

    for (const l of this.listeners) {
      l.onDiagnosticLog(logEntry);
    }
  }

  /**
   * Connects to a target TV. If not paired, triggers first-time pairing. If already paired, starts remote session.
   */
  public async connectTV(tvId: string): Promise<boolean> {
    const tv = this.discoveryService.getTV(tvId);
    if (!tv) {
      this.transitionState(ConnectionState.TV_UNAVAILABLE, `TV device not found in discovery list`);
      return false;
    }

    this.activeTv = tv;
    this.reconnectAttempts = 0;

    // Check if TV is already paired
    const hasCreds = this.certManager.hasDeviceCredentials(tv.id);

    if (!hasCreds) {
      this.log('info', 'pairing', `TV ${tv.name} is not yet paired. Starting pairing protocol.`);
      return this.startPairing(tv);
    } else {
      this.log('info', 'remote', `TV ${tv.name} is already paired. Establishing TLS remote session.`);
      return this.establishRemoteSession(tv);
    }
  }

  /**
   * Starts first-time TV Remote Service v2 pairing
   */
  public async startPairing(tv: TVDevice): Promise<boolean> {
    this.activeTv = tv;
    return this.pairingService.startPairing(tv, {
      onStateChange: (st, msg) => this.transitionState(st, msg),
      onPinPrompt: (targetTv) => {
        const pin = targetTv.isTestbed ? this.testbed.getActivePin() : undefined;
        this.notifyPinPrompt(targetTv, pin || undefined);
      },
      onPairingSuccess: (targetTv) => {
        targetTv.isPaired = true;
        this.pairedTvs.set(targetTv.id, targetTv);
        this.log('info', 'pairing', `Pairing completed successfully. Moving to remote session.`);
        this.establishRemoteSession(targetTv);
      },
      onPairingError: (targetTv, err) => {
        this.log('error', 'pairing', `Pairing failed for ${targetTv.name}: ${err}`);
      },
      onLog: (lvl, msg, data) => this.log(lvl, 'pairing', msg, data),
    });
  }

  /**
   * Submits the 6-digit pairing PIN code entered by the user
   */
  public async submitPin(pinCode: string): Promise<boolean> {
    return this.pairingService.submitPin(pinCode, {
      onStateChange: (st, msg) => this.transitionState(st, msg),
      onPinPrompt: (t) => this.notifyPinPrompt(t),
      onPairingSuccess: (t) => {
        t.isPaired = true;
        this.pairedTvs.set(t.id, t);
        this.establishRemoteSession(t);
      },
      onPairingError: (t, err) => this.log('error', 'pairing', `PIN error: ${err}`),
      onLog: (lvl, msg, data) => this.log(lvl, 'pairing', msg, data),
    });
  }

  /**
   * Establishes the persistent remote control session on port 6466
   */
  public async establishRemoteSession(tv: TVDevice): Promise<boolean> {
    this.activeTv = tv;
    const success = await this.remoteSession.connect(tv, {
      onStateChange: (st, msg) => this.transitionState(st, msg),
      onCommandAck: (res) => this.notifyCommandAck(res),
      onDisconnected: (targetTv, reason) => {
        this.log('warn', 'remote', `Disconnected from ${targetTv.name}: ${reason}`);
        this.handleAutoReconnect(targetTv);
      },
      onLog: (lvl, msg, data) => this.log(lvl, 'remote', msg, data),
      onPing: (latency) => this.notifyPing(latency),
    });

    if (success) {
      tv.lastConnected = Date.now();
      this.reconnectAttempts = 0;
    }
    return success;
  }

  private handleAutoReconnect(tv: TVDevice): void {
    if (!this.autoReconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('warn', 'remote', `Max reconnect attempts (${this.maxReconnectAttempts}) reached for ${tv.name}`);
      this.transitionState(ConnectionState.CONNECTION_FAILED, `Could not reconnect to ${tv.name}`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(30000, 1500 * Math.pow(1.5, this.reconnectAttempts));
    this.log('info', 'remote', `Scheduling auto-reconnect #${this.reconnectAttempts} in ${Math.round(delay / 1000)}s`);
    this.transitionState(ConnectionState.RECONNECTING, `Reconnecting to ${tv.name} (attempt ${this.reconnectAttempts})...`);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.activeTv?.id === tv.id) {
        this.establishRemoteSession(tv);
      }
    }, delay);
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.pairingService.cancel();
    this.remoteSession.disconnect();
    this.transitionState(ConnectionState.DISCONNECTED, 'Disconnected');
  }

  public async sendKey(keyCode: AndroidKeyCode, direction: KeyDirection = KeyDirection.SHORT): Promise<TVCommandResult> {
    return this.remoteSession.sendKey(keyCode, direction);
  }

  public async adjustVolume(direction: 'UP' | 'DOWN' | 'MUTE'): Promise<TVCommandResult> {
    return this.remoteSession.adjustVolume(direction);
  }

  public async sendText(text: string): Promise<TVCommandResult> {
    return this.remoteSession.sendText(text);
  }

  public async launchApp(appLinkOrPackage: string): Promise<TVCommandResult> {
    return this.remoteSession.launchApp(appLinkOrPackage);
  }

  public async sendMotionInput(payload: MotionInputPayload): Promise<void> {
    // Map motion input to directional nudges or pointer movement
    if (Math.abs(payload.x) > 0.6) {
      await this.sendKey(payload.x > 0 ? AndroidKeyCode.KEYCODE_DPAD_RIGHT : AndroidKeyCode.KEYCODE_DPAD_LEFT);
    }
    if (Math.abs(payload.y) > 0.6) {
      await this.sendKey(payload.y > 0 ? AndroidKeyCode.KEYCODE_DPAD_DOWN : AndroidKeyCode.KEYCODE_DPAD_UP);
    }
  }

  public addManualTV(ip: string, name?: string): TVDevice {
    const tv = this.discoveryService.addManualTV(ip, name);
    this.log('info', 'discovery', `Added manual TV IP: ${ip}`);
    this.notifyTVDiscovered(tv);
    return tv;
  }

  public triggerRescan(): TVDevice[] {
    this.log('info', 'discovery', 'Triggering active Wi-Fi mDNS rescan query');
    const tvs = this.discoveryService.triggerRescan();
    for (const tv of tvs) {
      this.notifyTVDiscovered(tv);
    }
    return tvs;
  }

  public async scanSubnet(subnetPrefix: string): Promise<TVDevice[]> {
    this.log('info', 'discovery', `Initiating TCP port 6467 probe scan across subnet: ${subnetPrefix}`);
    const found = await this.discoveryService.scanSubnet(subnetPrefix, (tv) => {
      this.notifyTVDiscovered(tv);
    });
    this.log('info', 'discovery', `Subnet scan complete. Found ${found.length} device(s).`);
    return found;
  }

  public async probeTV(host: string): Promise<boolean> {
    return this.discoveryService.probeTV(host);
  }

  public forgetTV(tvId: string): boolean {
    this.certManager.removeDeviceCredentials(tvId);
    this.pairedTvs.delete(tvId);
    if (this.activeTv?.id === tvId) {
      this.disconnect();
    }
    this.log('info', 'system', `Securely forgot credentials for TV: ${tvId}`);
    return true;
  }

  public setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
  }

  /**
   * Runs an active connectivity diagnostic test against current TV
   */
  public async testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();
    if (!this.remoteSession.isConnected()) {
      return { success: false, latencyMs: 0, error: 'Remote session not established' };
    }
    // Send a safe ping / info request
    const res = await this.sendKey(AndroidKeyCode.KEYCODE_INFO);
    const latency = Math.max(1, Date.now() - startTime);
    return {
      success: res.success,
      latencyMs: latency,
      error: res.error,
    };
  }
}
