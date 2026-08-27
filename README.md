# TVm — Google TV & Android TV Control Center

TVm is a modern, high-performance web interface and local networking bridge that connects directly to Google TV and Android TV devices using the native **Android TV Remote v2** protocol over Wi-Fi (without Bluetooth).

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      TVm PWA Frontend                       │
│    (React 18 + Vite + Tailwind CSS + WebSockets + Haptics)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ WebSocket / REST (/ws/tvm-bridge)
┌──────────────────────────────▼──────────────────────────────┐
│                TVm Local Connectivity Bridge                │
│    (Node.js / Express / Native Android Network Service)     │
├──────────────────────────────┬──────────────────────────────┤
│  mDNS Discovery (_androidtvremote2._tcp.local)             │
│  TLS Certificate Manager (RSA 2048 / SHA-256 X.509)        │
│  Pairing Engine (TCP Port 6467 / Cryptographic SHA-256 PIN) │
│  Remote Session (TCP Port 6466 / Protobuf Key Injection)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Local Wi-Fi (TCP / TLS)
┌──────────────────────────────▼──────────────────────────────┐
│                 Google TV / Android TV                      │
│       (Chromecast with Google TV, Sony, TCL, Philips...)    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

- **Genuine Android TV Remote v2 Protocol**:
  - Direct TLS handshake on port **6467** for pairing.
  - Generates TV-prompted 6-digit cryptographic PIN verification.
  - Establishes persistent TLS remote control session on port **6466**.
  - Bidirectional ping/pong keepalive and real Android KeyCode injection.
- **Discovery**:
  - mDNS / DNS-SD scanning for `_androidtvremote2._tcp.local`.
  - Manual IP entry & live TCP port probe.
  - Local `/24` subnet scanning.
- **Control Modes**:
  - 3D Realistic Physical Remote with haptic feedback.
  - Low-latency Touchpad & Swipe Gestures.
  - Gyroscopic Air Mouse with orientation sensors.
  - Physical & Virtual Keyboard with IME text dispatch.
  - Deep-link Application Launcher (YouTube, Netflix, Prime, Disney+, etc.).
  - Real-time Diagnostics & Protocol Packet Inspector.

---

## 🔒 Security & Credentials

- Client credentials (X.509 certificates and private RSA keys) are stored locally in `.tvm-credentials.json` with restricted permissions (`0600`).
- No private keys or raw certificate private material are exposed over frontend APIs.
- Git excludes all local credential files and keys.

---

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start TVm
```bash
npm run dev
```

### 3. Pair with Your TV
1. Ensure your phone/computer and your Google TV are connected to the **same Wi-Fi network**.
2. Open `http://localhost:3000`.
3. Tap **TV Devices & Pairing** (or enter your TV's local IP address if mDNS is restricted by your router).
4. Tap **Pair** next to your TV.
5. Look at your TV screen and enter the 6-character PIN code displayed.
6. Once verified, TVm establishes the port 6466 remote session and starts transmitting commands.

---

## 📦 Deployment & Platform Notes

- **Local Network Requirement**: Android TV Remote v2 operates exclusively across local LAN (ports 6467 and 6466). When running in cloud-only environments (such as Vercel), TVm functions as a progressive web UI that connects to a local bridge running on the user's LAN or Android device.
- **Testbed Isolation**: Local development testbeds are disabled by default in production and only activate when `ENABLE_LOCAL_TESTBED=true` or `NODE_ENV=test` is explicitly provided.
