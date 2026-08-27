/**
 * TVm Local Connectivity Bridge Client
 * Communicates with the local Node.js connectivity bridge over WebSocket with REST fallback.
 */

import {
  AndroidKeyCode,
  ConnectionState,
  DiagnosticLog,
  KeyDirection,
  TVCommandResult,
  TVDevice,
} from '../types';

export type BridgeEventCallback = {
  onStateChange?: (state: ConnectionState, message: string, activeTv?: TVDevice | null) => void;
  onTVDiscovered?: (tv: TVDevice) => void;
  onPinPrompt?: (tv: TVDevice, testbedPin?: string) => void;
  onCommandAck?: (result: TVCommandResult) => void;
  onDiagnosticLog?: (log: DiagnosticLog) => void;
  onPing?: (latencyMs: number) => void;
};

export class BridgeClient {
  private ws: WebSocket | null = null;
  private callbacks: Set<BridgeEventCallback> = new Set();
  private isConnecting = false;
  private reconnectTimer: any = null;

  constructor() {
    this.connectWs();
  }

  public subscribe(cb: BridgeEventCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  private connectWs(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/tvm-bridge`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('[BridgeClient] WS parse error:', err);
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.isConnecting = false;
        // Auto-reconnect WS after 2.5s
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connectWs();
          }, 2500);
        }
      };

      this.ws.onerror = () => {
        // Fallback gracefully to REST
      };
    } catch {
      this.isConnecting = false;
    }
  }

  private handleServerMessage(msg: { type: string; data: any }): void {
    for (const cb of this.callbacks) {
      if (msg.type === 'state_change' && cb.onStateChange) {
        cb.onStateChange(msg.data.state, msg.data.message, msg.data.activeTv);
      } else if (msg.type === 'initial_state' && cb.onStateChange) {
        cb.onStateChange(msg.data.state, msg.data.stateMessage, msg.data.activeTv);
      } else if (msg.type === 'tv_discovered' && cb.onTVDiscovered) {
        cb.onTVDiscovered(msg.data);
      } else if (msg.type === 'pin_prompt' && cb.onPinPrompt) {
        cb.onPinPrompt(msg.data.tv, msg.data.testbedPin);
      } else if (msg.type === 'command_ack' && cb.onCommandAck) {
        cb.onCommandAck(msg.data);
      } else if (msg.type === 'diagnostic_log' && cb.onDiagnosticLog) {
        cb.onDiagnosticLog(msg.data);
      } else if (msg.type === 'tv_ping' && cb.onPing) {
        cb.onPing(msg.data.latencyMs);
      }
    }
  }

  public async getStatus(): Promise<{
    state: ConnectionState;
    stateMessage: string;
    activeTv: TVDevice | null;
    discoveredTvs: TVDevice[];
    pairedTvs: TVDevice[];
  }> {
    const res = await fetch('/api/bridge/status');
    return res.json();
  }

  public async connectTV(tvId: string): Promise<{ success: boolean; state: ConnectionState }> {
    const res = await fetch('/api/bridge/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tvId }),
    });
    return res.json();
  }

  public async submitPin(pin: string): Promise<{ success: boolean }> {
    const res = await fetch('/api/bridge/pairing/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    return res.json();
  }

  public async sendKey(keyCode: AndroidKeyCode, direction: KeyDirection = KeyDirection.SHORT): Promise<TVCommandResult> {
    // Ultra-low latency via WebSocket if open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'send_key', keyCode, direction }));
      return { success: true, timestamp: Date.now(), command: `KEY_${AndroidKeyCode[keyCode] || keyCode}` };
    }

    const res = await fetch('/api/bridge/command/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyCode, direction }),
    });
    return res.json();
  }

  public async adjustVolume(direction: 'UP' | 'DOWN' | 'MUTE'): Promise<TVCommandResult> {
    const res = await fetch('/api/bridge/command/volume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    });
    return res.json();
  }

  public async sendText(text: string): Promise<TVCommandResult> {
    const res = await fetch('/api/bridge/command/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.json();
  }

  public async launchApp(appLink: string): Promise<TVCommandResult> {
    const res = await fetch('/api/bridge/command/app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appLink }),
    });
    return res.json();
  }

  public async sendMotion(payload: { x: number; y: number; pitch?: number; roll?: number }): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'send_motion', payload: { ...payload, timestamp: Date.now() } }));
      return;
    }

    await fetch('/api/bridge/command/motion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  public async addManualTV(ip: string, name?: string): Promise<TVDevice> {
    const res = await fetch('/api/bridge/manual-tv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, name }),
    });
    return res.json();
  }

  public async rescan(): Promise<{ success: boolean; count: number; tvs: TVDevice[] }> {
    const res = await fetch('/api/bridge/scan/rescan', { method: 'POST' });
    return res.json();
  }

  public async scanSubnet(subnetPrefix: string): Promise<{ success: boolean; count: number; tvs: TVDevice[] }> {
    const res = await fetch('/api/bridge/scan/subnet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subnetPrefix }),
    });
    return res.json();
  }

  public async probeHost(host: string): Promise<{ host: string; isOpen: boolean }> {
    const res = await fetch('/api/bridge/scan/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host }),
    });
    return res.json();
  }

  public async forgetTV(tvId: string): Promise<{ success: boolean }> {
    const res = await fetch('/api/bridge/forget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tvId }),
    });
    return res.json();
  }

  public async disconnect(): Promise<void> {
    await fetch('/api/bridge/disconnect', { method: 'POST' });
  }

  public async getLogs(): Promise<DiagnosticLog[]> {
    const res = await fetch('/api/bridge/logs');
    return res.json();
  }

  public async clearLogs(): Promise<void> {
    await fetch('/api/bridge/logs/clear', { method: 'POST' });
  }

  public async testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const res = await fetch('/api/bridge/test-connection', { method: 'POST' });
    return res.json();
  }
}

export const bridgeClient = new BridgeClient();
