# VELOCITY CICADA — LOCAL COLLECTOR EXECUTABLE AUDIT REPORT
**Author:** Senior Windows Desktop Application Engineer & Systems Architect  
**Scope:** Root-cause analysis of installed executable behavior, terminal-window flashing, process lifecycle, and SaaS backend connectivity gaps.

---

## 1. Executive Summary

An exhaustive code audit was conducted across the existing Velocity Cicada repositories:
- `collector/` (Person A's local API, store, normalization, redaction, aggregation)
- `transport/` (Person B's signing, SQLite outbox, sender loop, heartbeat)
- `contracts/` (JSON schemas for `MetadataPayload` v1.0 and `Heartbeat` v1.0)
- `saas/` (FastAPI backend with `/api/v1/ingest`, `/api/v1/heartbeat`, AIOps engine, storage)
- `cicada-local-collector/` (Windows build scripts, PyInstaller spec, Inno Setup script, and Tkinter GUI)

The investigation confirmed that while individual telemetry collection and contract validation modules are functional, the current Windows packaging suffered from **two critical defects**:
1. **Recurring terminal-window flashing** caused by unconstrained child subprocesses (`ping`, `wevtutil`, `powershell`, `cmd.exe /c cls`) executed without Windows `CREATE_NO_WINDOW` flags.
2. **Backend disconnection gap** caused by an architectural divergence where the desktop collector bypassed Velocity Cicada's SaaS ingestion API (`/api/v1/ingest`) in favor of direct Supabase PostgREST calls which remained unenrolled and failed silently.

---

## 2. Root Cause Analysis: Repeated Terminal Window Flashing

The user reported that the installed executable repeatedly opens and closes terminal windows on Windows. 

Our investigation uncovered **four distinct triggers** within the execution cycle:

### A. Subprocess Spawning Without `CREATE_NO_WINDOW` Flags
When an application is compiled with PyInstaller using `--noconsole` (`console=False`), the main process has no attached console. However, when Python executes `subprocess.run()`, `subprocess.Popen()`, or `subprocess.check_output()` on Windows, the Windows API `CreateProcessW` defaults to allocating a new console window unless the `CREATE_NO_WINDOW` process creation flag (`0x08000000`) or `STARTUPINFO.wShowWindow = SW_HIDE` is explicitly supplied.

In the collector codebase, subprocesses are executed continuously on background worker threads:
1. **Network Probe (`network_probe.py` line 90):**
   ```python
   # Executes every 10 seconds:
   proc = subprocess.run(
       ["ping", "-n", "2", "-w", "1000", target],
       stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, ...
   )
   ```
   *Result:* A `ping.exe` command prompt window flashes open and closed every collection cycle.
2. **Security Telemetry (`security.py` line 37):**
   ```python
   # Executes every 10 seconds:
   proc = subprocess.run(
       ["wevtutil", "qe", "Security", "/q:*[System[(EventID=4625)]]", ...],
       stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, ...
   )
   ```
   *Result:* A `wevtutil.exe` command prompt window flashes open and closed every collection cycle.
3. **Hardware Temperature Telemetry (`metrics.py` line 58):**
   ```python
   # Executes every 10 seconds:
   proc = subprocess.run(
       ["powershell", "-NoProfile", "-Command", "(Get-CimInstance ...).CurrentTemperature"],
       stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, ...
   )
   ```
   *Result:* A `powershell.exe` window flashes open and closed every collection cycle.
4. **GPU Usage Telemetry (`metrics.py` line 76):**
   ```python
   proc = subprocess.run(["nvidia-smi", "--query-gpu=..."], ...)
   ```
   *Result:* An `nvidia-smi.exe` console window flashes if NVIDIA drivers are present.

### B. Console Screen Clearing in CLI / Headless Fallback Mode
In `collector/main.py` (lines 106-109):
```python
if sys.stdout.isatty():
    os.system("cls" if os.name == "nt" else "clear")
```
`os.system("cls")` executes `cmd.exe /c cls`. In a GUI application or service fallback, this creates an ephemeral `cmd.exe` terminal window every collection cycle.

### C. GUI Fallback to CLI Loop on Display Failure
In `collector/main.py` (lines 486-497):
```python
try:
    from collector.gui import launch_gui
    launch_gui()
except Exception as e:
    logger.warning("Could not launch Desktop GUI (%s), falling back to CLI interface.", e)
    run_collector(...)
```
If the executable is launched in a headless context (such as a Windows Service, Task Scheduler in Session 0, or user without an active desktop session), Tkinter raises a display initialization error, falling back to `run_collector()`, which indefinitely loops and invokes `os.system("cls")`.

---

## 3. Process Lifecycle & Execution Model Flaws

| Category | Existing Implementation | Professional Windows Requirement |
|---|---|---|
| **Execution Architecture** | Monolithic Tkinter GUI (`CicadaApp`) with inline daemon thread. | Decoupled Architecture: Dedicated Windows Service / background daemon + Lightweight System Tray companion. |
| **Persistence Across Reboots** | Relies on user manually launching GUI or simple Start Menu shortcut. | Runs as a managed Windows Service set to `Automatic` startup. Starts before user login. |
| **Window Minimization** | Closing the window terminates the Python process entirely. | Background service continues running uninterrupted 24/7. System tray provides non-intrusive status. |
| **Instance Management** | None. Double-clicking executable launches duplicate processes. | Named Windows Mutex (`VelocityCicadaCollector_SingleInstance_Mutex`) to prevent duplicate instances. |
| **Crash Recovery** | Uncaught exceptions terminate the worker thread silently. | Service Manager restart recovery configuration (`reset= 86400 actions= restart/5000/restart/10000/restart/30000`) and internal exponential backoff. |
| **Logging** | Console stdout / basic file without rotation. | Rotating structured logs (`RotatingFileHandler`, max 5MB, 5 backups) in `%PROGRAMDATA%\VelocityCicada\logs\` or `%LOCALAPPDATA%\VelocityCicada\logs\`. |

---

## 4. Backend Connectivity & Data Pipeline Gaps

### A. Architectural Disconnect: Supabase Direct Upload vs. SaaS Ingest Pipeline
- **Velocity Cicada SaaS Backend (`saas/app.py`):**
  - Exposes `POST /api/v1/ingest` and `POST /api/v1/heartbeat`.
  - Requires HMAC-SHA256 headers (`X-Collector-Id`, `X-Timestamp`, `X-Signature`).
  - Requires payload conforming to `contracts/payload_schema.json` (`MetadataPayload` v1.0).
  - Maintains sequence gap detection, deduplication, AIOps correlation, and fleet monitoring.
- **Desktop Collector (`cicada-local-collector`):**
  - Bypassed `transport/` and `saas/ingest`.
  - Attempted direct HTTPS calls to Supabase PostgREST table `rest/v1/telemetry_events` with an 18-field flat JSON.
  - Required manual entry of `SUPABASE_DEVICE_TOKEN`, `SUPABASE_URL`, and `SUPABASE_KEY`.
  - Because these values defaulted to empty, the collector ran in `"LOCAL ONLY (Unenrolled)"` mode and transmitted **zero data** to the Velocity Cicada SaaS backend.
  - The SaaS dashboard (`dashboard/`) never saw the collector under the Fleet tab because no heartbeat was ever received.

### B. Transmission Frequency vs. Collection Frequency
- The user requirements specify:
  - Telemetry collected continuously locally (e.g., every 10 seconds).
  - Aggregated metadata transmitted periodically every **60 seconds by default**, configurable to **30 seconds**.
- The existing code attempted transmission every 10 seconds or not at all, confusing collection frequency with transmission frequency.

### C. Missing Enrollment Infrastructure
- `saas/ingest/auth.py` only recognized hardcoded collectors from `saas/config.py` (`c_blr01`, `c_fra01`).
- There was no enrollment endpoint (`POST /api/v1/enroll`) on SaaS allowing newly installed Windows collectors to enroll, obtain an assigned collector ID, and receive their HMAC secret securely.

---

## 5. Remediation Delivered

1. **Subprocess Sanitization:**
   Implemented `collector.subprocess_util.safe_run_subprocess` enforcing `CREATE_NO_WINDOW` (`0x08000000`) and `STARTUPINFO.wShowWindow = SW_HIDE`. Replaced all `subprocess.run` calls in `network_probe.py`, `security.py`, and `metrics.py`. Eliminated `os.system("cls")`.
2. **Dedicated Windows Service & Daemon:**
   Implemented `collector.windows_service.py` supporting `--service`, `--install`, `--uninstall`, `--start`, `--stop`, `--restart`, `--status`, and `--enroll`.
3. **Single-Instance Protection:**
   Implemented `collector.mutex.SingleInstanceLock` utilizing Windows Named Mutex `Global\VelocityCicadaCollector_Service_Mutex`.
4. **Credential Protection:**
   Implemented `collector.dpapi` providing Windows DPAPI encryption (`CryptProtectData`) at rest for all collector secrets.
5. **Decoupled Desktop System Tray Companion:**
   Implemented `collector.tray.py` providing an independent desktop status monitor with context menu (Open Dashboard, View Status, View Logs, Pause/Resume, Uninstall Guide).
6. **SaaS Dynamic Enrollment Endpoint:**
   Added `POST /api/v1/enroll` in `saas/ingest/routes.py` enabling dynamic enrollment with assigned identities and secrets.
7. **60-Second Periodic Aggregation & Real Host Sampler:**
   Implemented `collector.host_collector.py` sampling live psutil metrics every 10s and flushing aggregated metadata matching `contracts/payload_schema.json` every 60s (or 30s) to `POST /api/v1/ingest`.
8. **Enterprise Inno Setup Package:**
   Provided `Velocity-Cicada-Collector.iss`, `velocity-cicada.spec`, and `build_windows.ps1` in `release/windows-collector/`.
