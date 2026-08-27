/**
 * TVm Application Server (Express + WebSocket + TV Connectivity Bridge + Vite Middleware)
 * Runs on Port 3000, host 0.0.0.0.
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { TVConnectivityService } from './server/tv-connectivity-service';
import { AndroidKeyCode, KeyDirection } from './server/types';

const PORT = 3000;

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json());

  // Initialize the TVm Connectivity Service
  const tvmService = new TVConnectivityService();

  // Create WebSocket Server for ultra-low latency bidirectional control
  const wss = new WebSocketServer({ server, path: '/ws/tvm-bridge' });

  wss.on('connection', (ws) => {
    // Send immediate initial state
    ws.send(JSON.stringify({
      type: 'initial_state',
      data: {
        state: tvmService.getState(),
        stateMessage: tvmService.getStateMessage(),
        activeTv: tvmService.getActiveTV(),
        discoveredTvs: tvmService.getDiscoveredTVs(),
      },
    }));

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'send_key') {
          const res = await tvmService.sendKey(msg.keyCode as AndroidKeyCode, msg.direction || KeyDirection.SHORT);
          ws.send(JSON.stringify({ type: 'command_ack', data: res }));
        } else if (msg.type === 'send_motion') {
          await tvmService.sendMotionInput(msg.payload);
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (err) {
        console.error('[WS] Message handling error:', err);
      }
    });
  });

  // Broadcast TVm events to all connected UI clients
  tvmService.addListener({
    onStateChange: (state, message, tv) => {
      const payload = JSON.stringify({ type: 'state_change', data: { state, message, activeTv: tv } });
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      }
    },
    onTVDiscovered: (tv) => {
      const payload = JSON.stringify({ type: 'tv_discovered', data: tv });
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      }
    },
    onPinPrompt: (tv, testbedPin) => {
      const payload = JSON.stringify({ type: 'pin_prompt', data: { tv, testbedPin } });
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      }
    },
    onCommandAck: (result) => {
      const payload = JSON.stringify({ type: 'command_ack', data: result });
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      }
    },
    onDiagnosticLog: (log) => {
      const payload = JSON.stringify({ type: 'diagnostic_log', data: log });
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      }
    },
    onPing: (latencyMs) => {
      const payload = JSON.stringify({ type: 'tv_ping', data: { latencyMs } });
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      }
    },
  });

  // ================= REST API ROUTES =================

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'TVm Connectivity Bridge', timestamp: Date.now() });
  });

  app.get('/api/bridge/status', (req, res) => {
    res.json({
      state: tvmService.getState(),
      stateMessage: tvmService.getStateMessage(),
      activeTv: tvmService.getActiveTV(),
      discoveredTvs: tvmService.getDiscoveredTVs(),
      pairedTvs: tvmService.getPairedTVs(),
    });
  });

  app.get('/api/bridge/tvs', (req, res) => {
    res.json(tvmService.getDiscoveredTVs());
  });

  app.post('/api/bridge/connect', async (req, res) => {
    const { tvId } = req.body;
    if (!tvId) return res.status(400).json({ error: 'tvId is required' });
    const success = await tvmService.connectTV(tvId);
    res.json({ success, state: tvmService.getState() });
  });

  app.post('/api/bridge/pairing/pin', async (req, res) => {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'pin is required' });
    const success = await tvmService.submitPin(pin);
    res.json({ success });
  });

  app.post('/api/bridge/command/key', async (req, res) => {
    const { keyCode, direction } = req.body;
    if (keyCode === undefined) return res.status(400).json({ error: 'keyCode is required' });
    const result = await tvmService.sendKey(keyCode, direction || KeyDirection.SHORT);
    res.json(result);
  });

  app.post('/api/bridge/command/volume', async (req, res) => {
    const { direction } = req.body;
    if (!direction) return res.status(400).json({ error: 'direction (UP/DOWN/MUTE) is required' });
    const result = await tvmService.adjustVolume(direction);
    res.json(result);
  });

  app.post('/api/bridge/command/text', async (req, res) => {
    const { text } = req.body;
    if (text === undefined) return res.status(400).json({ error: 'text is required' });
    const result = await tvmService.sendText(text);
    res.json(result);
  });

  app.post('/api/bridge/command/app', async (req, res) => {
    const { appLink } = req.body;
    if (!appLink) return res.status(400).json({ error: 'appLink is required' });
    const result = await tvmService.launchApp(appLink);
    res.json(result);
  });

  app.post('/api/bridge/command/motion', async (req, res) => {
    const payload = req.body;
    await tvmService.sendMotionInput(payload);
    res.json({ success: true });
  });

  app.post('/api/bridge/manual-tv', (req, res) => {
    const { ip, name } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP address is required' });
    const tv = tvmService.addManualTV(ip, name);
    res.json(tv);
  });

  app.post('/api/bridge/scan/rescan', (req, res) => {
    const tvs = tvmService.triggerRescan();
    res.json({ success: true, count: tvs.length, tvs });
  });

  app.post('/api/bridge/scan/subnet', async (req, res) => {
    const { subnetPrefix } = req.body;
    if (!subnetPrefix) return res.status(400).json({ error: 'subnetPrefix is required (e.g. 192.168.1)' });
    const found = await tvmService.scanSubnet(subnetPrefix);
    res.json({ success: true, count: found.length, tvs: found });
  });

  app.post('/api/bridge/scan/probe', async (req, res) => {
    const { host } = req.body;
    if (!host) return res.status(400).json({ error: 'host IP is required' });
    const isOpen = await tvmService.probeTV(host);
    res.json({ host, isOpen });
  });

  app.post('/api/bridge/forget', (req, res) => {
    const { tvId } = req.body;
    if (!tvId) return res.status(400).json({ error: 'tvId is required' });
    const success = tvmService.forgetTV(tvId);
    res.json({ success });
  });

  app.post('/api/bridge/disconnect', (req, res) => {
    tvmService.disconnect();
    res.json({ success: true });
  });

  app.get('/api/bridge/logs', (req, res) => {
    res.json(tvmService.getLogs());
  });

  app.post('/api/bridge/logs/clear', (req, res) => {
    tvmService.clearLogs();
    res.json({ success: true });
  });

  app.post('/api/bridge/test-connection', async (req, res) => {
    const result = await tvmService.testConnection();
    res.json(result);
  });

  // ================= VITE / STATIC CLIENT =================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[TVm Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
