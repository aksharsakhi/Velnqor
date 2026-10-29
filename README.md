<p align="center">
  <img src="build/icon.png" width="128" alt="Velnqor icon">
</p>

<h1 align="center">Velnqor</h1>

<p align="center">
  <strong>System-Wide Internet Speed Optimization, Multi-Network Bonding & Download Accelerator</strong><br>
  Automatically detect and combine Wi-Fi, Ethernet, USB-tethered iPhone, and mobile networks to maximize throughput across your entire laptop.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#how-it-works">How It Works & Technical Architecture</a> ·
  <a href="#mac-and-iphone-setup">Dual Wi-Fi + iPhone Setup</a> ·
  <a href="#build-from-source">Build from Source</a>
</p>

---

## What is Velnqor?

Velnqor upgrades your laptop's networking capabilities from a single-connection bottleneck into an intelligent **multi-WAN bonded network**. By combining multiple physical network interfaces (such as home Wi-Fi and a USB-tethered iPhone hotspot), Velnqor load-balances all laptop traffic—streaming, browsing, uploads, downloads, and background syncs—across all available pipes concurrently.

---

## Technical Feasibility & OS Architecture

### Why Single-Stream Bonding Differs from Multi-Stream Aggregation

At Layer 3/4 (IP/TCP), a single TCP stream is bound to a 4-tuple: `(Source IP, Source Port, Destination IP, Destination Port)`.

- If an application sends raw packets from one TCP stream out of two different physical interfaces without a middlebox, the remote web server receives packets from two distinct IP addresses (e.g. Wi-Fi IP and Cellular carrier IP) and immediately resets the connection.
- True packet-level aggregation for a single monolithic TCP connection requires a remote bonding VPN server or Multipath TCP (MPTCP) supported by both client and server.

### The Velnqor Solution: Native Multi-Path Dispatching & System Proxying

Modern internet usage is inherently multi-stream:

- Web browsers open dozens of concurrent TCP/TLS connections per page.
- Video streaming (YouTube, Netflix, HLS/DASH) downloads media chunks in parallel HTTP requests.
- Cloud syncing, background applications, APIs, and gaming assets operate over simultaneous channels.
- File downloads and BitTorrent swarms fetch data as independent chunk ranges.

**Velnqor achieves true bandwidth aggregation across your entire laptop** by running a high-performance local multi-WAN dispatcher:

1. **OS-Native System Proxy Integration**: With one click, Velnqor configures macOS network services (`networksetup`) to route laptop traffic through Velnqor's engine.
2. **Multi-WAN Outbound Socket Binding**: For each outgoing connection, Velnqor binds the outbound socket to the specific physical interface address (`localAddress`). On macOS and Windows, outbound routing naturally follows the source IP!
3. **Adaptive Load Balancing & Failover**: Traffic is dynamically weighted using real-time EWMA latency and bandwidth metrics. If an interface drops (e.g., iPhone cable disconnected), connections immediately fail over to the surviving link without breaking your session.
4. **Built-in Acceleration**: The integrated download accelerator concurrently fetches chunks of large files across all links, achieving full cumulative bandwidth (e.g. 100 Mbps Wi-Fi + 50 Mbps iPhone = 150 Mbps download speed).

---

## Features

### ⚡ System-Wide Multi-Network Bonding

- **Automatic Connection Discovery**: Real-time detection of Wi-Fi, Ethernet, iPhone USB tethering, and secondary adapters.
- **Laptop-Wide Traffic Distribution**: Automatically accelerates Chrome, Safari, Spotify, Slack, Discord, Steam, Git, and streaming.
- **Multiple Bonding Policies**:
  - **Adaptive Optimization**: Routes high-throughput requests to high-bandwidth links and latency-sensitive requests to the lowest-ping link.
  - **Multi-WAN Concurrency**: Equal round-robin split across all available connections.
  - **Speed Multiplexer**: Aggressive parallelization for maximum raw speed.
  - **Resilient Failover**: Seamless zero-drop backup for meetings and live streams.
- **Real-Time Speed & Flow Telemetry**: Live combined aggregate throughput meter and active connection inspector.

### 📥 Built-in Download Acceleration

- HTTP range-chunk multiplexing for large files.
- BitTorrent swarm peer distribution across all active adapters.
- Pause, resume, auto-retry, and schedule downloads.
- Browser extension integration for authenticated downloads.

---

## Mac & iPhone Setup (Dual Connection)

To use your Wi-Fi and wired iPhone Hotspot together on macOS:

1. **Connect iPhone over USB**:
   - Plug your iPhone into your Mac using a Lightning or USB-C cable.
   - On your iPhone, go to **Settings › Personal Hotspot** and turn on **Allow Others to Join**.
   - Tap **Trust This Computer** if prompted.

2. **Disable macOS Disconnect Policy**:
   - Open **System Settings › Network** on your Mac.
   - Click on **iPhone USB**.
   - Click **Details...** (or Options).
   - Turn **OFF** the toggle for **"Disable unless needed"**.
   - Ensure both **Wi-Fi** and **iPhone USB** show a green "Connected" status dot.

3. **Launch Velnqor**:
   - Open Velnqor.
   - In the **System Bonding** tab, click **Activate Bonding** and toggle **Auto-Route Laptop Traffic**.
   - Watch both connections aggregate in real time!

---

## Build from Source

```bash
git clone https://github.com/aksharsakhi/Velnqor.git
cd Velnqor
npm ci
npm run dev
```

| Command             | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Starts Velnqor in development mode                        |
| `npm run typecheck` | Validates TypeScript across node, web, e2e, and extension |
| `npm run build`     | Builds production bundle with electron-vite               |
| `npm run build:mac` | Packages macOS application                                |

---

## License

MIT License. Copyright © 2026 Velnqor.
