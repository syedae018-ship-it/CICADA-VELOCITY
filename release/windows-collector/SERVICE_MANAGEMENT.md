# Velocity Cicada Collector — Windows Service Management

## 1. Windows Service Architecture
The collector is implemented as a dedicated native Windows Service:

- **Service Name:** `VelocityCicadaCollector`
- **Display Name:** `Velocity Cicada Collector Service`
- **Startup Type:** `Automatic` (starts before user login on machine boot)
- **Binary:** `Velocity-Cicada-Collector.exe --service`
- **Single-Instance Mutex:** `Global\VelocityCicadaCollector_Service_Mutex`
- **Port:** Local REST API on `127.0.0.1:8001` (accessible locally by Tray companion and egress proof viewer)

---

## 2. Standard Service Management Commands

### Using Built-in Collector CLI (Recommended)
From an elevated Administrator command prompt or PowerShell:

```powershell
cd "C:\Program Files\Velocity Cicada Collector"

# 1. Query Real-Time Status & SaaS Connectivity
.\Velocity-Cicada-Collector.exe --status

# 2. Start the Service
.\Velocity-Cicada-Collector.exe --start

# 3. Stop the Service
.\Velocity-Cicada-Collector.exe --stop

# 4. Restart the Service
.\Velocity-Cicada-Collector.exe --restart

# 5. Re-register / Install the Service
.\Velocity-Cicada-Collector.exe --install

# 6. De-register / Remove the Service
.\Velocity-Cicada-Collector.exe --uninstall
```

### Using Native Windows Service Commands
```powershell
# Query service status via SCM
sc.exe query VelocityCicadaCollector

# Start service via PowerShell
Start-Service VelocityCicadaCollector

# Stop service via PowerShell
Stop-Service VelocityCicadaCollector

# Restart service via PowerShell
Restart-Service VelocityCicadaCollector
```

---

## 3. Failure Recovery Policy

To prevent runaway CPU consumption or rapid crash-restart loops during transient system faults, the service is configured with a staged recovery policy:

```powershell
sc.exe failure VelocityCicadaCollector reset= 86400 actions= restart/5000/restart/10000/restart/30000
```

- **First Failure:** Windows waits 5,000 ms (5 seconds) before restarting the process.
- **Second Failure:** Windows waits 10,000 ms (10 seconds) before restarting.
- **Subsequent Failures:** Windows waits 30,000 ms (30 seconds) before restarting.
- **Failure Count Reset:** Counter resets back to zero after 86,400 seconds (24 hours) of continuous normal uptime.

---

## 4. Signal Handling & Clean Shutdown

When the Windows Service Control Manager sends a stop request (`SERVICE_CONTROL_STOP`, `CTRL_SHUTDOWN_EVENT`, or `SIGTERM`):
1. The service intercepts the signal via `SetConsoleCtrlHandler` / signal handlers.
2. Background host sampling and heartbeats are paused immediately.
3. Any in-flight HTTP payload upload is completed.
4. The SQLite database write-ahead log (WAL) is flushed and checkpointed.
5. The named Windows Mutex is released.
6. The process exits cleanly with return code 0.
