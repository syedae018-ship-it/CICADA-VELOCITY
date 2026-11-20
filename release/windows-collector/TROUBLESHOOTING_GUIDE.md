# Velocity Cicada Collector — Troubleshooting & Diagnostic Guide

## 1. Quick Diagnostic Checklist

If the collector is not appearing online or data is not flowing to the SaaS Dashboard:

1. **Check Service State:**
   ```powershell
   Get-Service VelocityCicadaCollector
   ```
   *Fix:* If stopped, run `Start-Service VelocityCicadaCollector`.

2. **Query Real-Time Collector Status:**
   ```powershell
   cd "C:\Program Files\Velocity Cicada Collector"
   .\Velocity-Cicada-Collector.exe --status
   ```
   *Expected:* `"saas_reachable": true`, `"buffer_depth": 0`.

3. **Inspect Application Logs:**
   Navigate to:
   ```text
   C:\ProgramData\VelocityCicada\logs\collector-service.log
   ```
   Logs rotate automatically at 5MB with 5 backups.

---

## 2. Common Issues and Resolutions

### Issue A: Terminal Windows Keep Flashing Open and Closed
- **Cause:** Older versions of the collector spawned `ping.exe`, `wevtutil.exe`, or `powershell.exe` without Windows `CREATE_NO_WINDOW` flags.
- **Resolution:**
  - Verify you are running v1.0.0+ compiled with `safe_subprocess_run`.
  - In `safe_subprocess_run`, `creationflags = 0x08000000` (`CREATE_NO_WINDOW`) and `STARTF_USESHOWWINDOW` / `SW_HIDE` are enforced across all child processes.
  - No terminal windows will ever appear during metric sampling or network probing.

### Issue B: Status Shows "Offline" or "Retrying (Buffer > 0)"
- **Cause:** Network connection to the SaaS backend is temporarily unavailable or blocked by a local firewall.
- **Expected Behavior:** 
  - The collector operates in zero-data-loss mode.
  - All aggregated metadata is buffered in the local SQLite outbox (`collector.db`).
  - Exponential backoff retries occur automatically (1s, 2s, 4s, 8s, 15s).
- **Resolution:**
  1. Test connectivity to the backend from PowerShell:
     ```powershell
     curl.exe -I http://localhost:8000/api/v1/health
     ```
  2. Verify your firewall allows outbound HTTPS traffic on port 443 (or 8000 for local dev).
  3. Once network connectivity is restored, the collector automatically detects backend availability, drains the outbox in sequence order, and resets buffer depth to 0.

### Issue C: HTTP 401 Unauthorized / HMAC Verification Failure
- **Cause:** The `COLLECTOR_SECRET` in `config.json` does not match the secret registered on the SaaS backend for that `COLLECTOR_ID`.
- **Resolution:**
  1. Open `C:\ProgramData\VelocityCicada\config.json`.
  2. Confirm `collector_id` and `tenant_id` match your SaaS assignment.
  3. For test environments, ensure `collector_id = "c_win01"` has secret `dev-secret-c_win01` (or re-enroll using `--enroll <token>`).
  4. Ensure your workstation clock is synchronized. Requests with timestamps skewed by > 300 seconds are rejected by design (replay protection).

### Issue D: Another Instance Already Running
- **Cause:** Attempting to start the collector binary while the Windows Service is already actively running.
- **Resolution:**
  - The collector enforces single-instance protection via Windows Named Mutex `Global\VelocityCicadaCollector_Service_Mutex`.
  - The second instance will exit gracefully without corrupting the SQLite outbox or crashing the system.
  - Use `Velocity-Cicada-Tray.exe` to inspect status without launching a second collector instance.

---

## 3. Log Locations & Log Rotation

Application logs are stored with automatic 5MB log rotation (max 5 backup files):

| Platform | Primary Log Location |
|---|---|
| Windows Service | `C:\ProgramData\VelocityCicada\logs\collector-service.log` |
| Windows User AppData | `%LOCALAPPDATA%\VelocityCicada\logs\collector-service.log` |
| Linux / macOS | `~/.config/velocity-cicada/logs/collector-service.log` |
