# Velocity Cicada Collector v1.0.0 — Release Notes

**Release Date:** November 2026  
**Target Platform:** Windows 10, Windows 11, Windows Server 2019/2022 (x64)  
**Package:** `Velocity-Cicada-Collector-Setup.exe`  

---

## Highlights

Velocity Cicada Collector v1.0.0 transforms the prototype hackathon collector into an enterprise-grade Windows background observability application. It installs cleanly as a native Windows Service with automatic boot startup, zero visible terminal windows, robust failure recovery, and automated cloud connectivity to the Velocity Cicada SaaS platform.

---

## Key Features & Improvements

### 1. Zero Terminal Windows (Complete Flashing Elimination)
- Resolved the critical bug where `ping.exe`, `wevtutil.exe`, `powershell.exe`, and `cmd.exe /c cls` repeatedly opened and closed console windows on the user's desktop.
- Implemented `safe_run_subprocess` enforcing `CREATE_NO_WINDOW` (`0x08000000`) and hidden `STARTUPINFO.wShowWindow = SW_HIDE` across all child subprocesses.
- Replaced console clearing commands with non-spawning ANSI sequences.

### 2. Native Windows Background Service Architecture
- Decoupled the background telemetry engine from GUI desktop windows.
- Dedicated service executable (`Velocity-Cicada-Collector.exe --service`) runs 24/7 in the background before user login.
- Added single-instance protection via Windows Named Mutex (`Global\VelocityCicadaCollector_Service_Mutex`), completely preventing duplicate process launches and SQLite database collisions.
- Configured Windows Service failure recovery policy (`restart/5000/restart/10000/restart/30000`) with a 24-hour reset window, preventing rapid crash loops.
- Structured rotating log management (`RotatingFileHandler`, max 5MB, 5 backups) in `%ProgramData%\VelocityCicada\logs\`.

### 3. Lightweight Desktop System Tray Companion
- Independent companion application (`Velocity-Cicada-Tray.exe`) displaying real-time operational states:
  `Initializing` -> `Connecting` -> `Connected` -> `Collecting` -> `Sending` -> `Offline` -> `Retrying` -> `Error`.
- Right-click / interactive context menu:
  - Open Collector Dashboard
  - View Connection Status modal
  - View Logs directory
  - Pause / Resume Collection
  - Restart Collector Service
  - Uninstall Instructions
- Closing the tray interface never interrupts the background collector service.

### 4. Automatic SaaS Backend Connectivity & Dynamic Enrollment
- Connected the desktop collector directly to Velocity Cicada's FastAPI backend (`POST /api/v1/ingest` and `POST /api/v1/heartbeat`).
- Added SaaS Dynamic Enrollment API (`POST /api/v1/enroll`) enabling automated self-registration using authorized enrollment tokens.
- Protected collector credentials at rest using Windows DPAPI (`CryptProtectData` / `CryptUnprotectData`).

### 5. Configurable 60-Second Periodic Aggregated Metadata Transmission
- Continuously samples real host telemetry locally (CPU, RAM, Disk, Network speeds, latency, failed logins) every 10 seconds.
- Aggregates samples into a single privacy-compliant `MetadataPayload` v1.0 conforming to `contracts/payload_schema.json` every **60 seconds by default** (configurable to **30 seconds** without rebuilding).
- Maintains SQLite persistent outbox with sequence numbering (`seq`), HMAC-SHA256 wire signing, exponential backoff, and idempotent deduplication.
- Heartbeats sent every 10 seconds to `POST /api/v1/heartbeat` keeping the collector's status live on the SaaS Fleet dashboard.

### 6. Enterprise Inno Setup Installer
- Produces a single self-contained setup wizard: `Velocity-Cicada-Collector-Setup.exe`.
- Setup wizard guides users through entering SaaS Backend URL, Tenant ID, Collector ID, Secret / Token, and Transmission Interval.
- Registers and starts the Windows Service automatically during installation.
- Clean uninstaller stops and deletes the service, cleans program binaries, but safely preserves customer configuration and audit history in AppData.
