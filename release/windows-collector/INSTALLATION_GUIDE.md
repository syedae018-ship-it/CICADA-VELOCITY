# Velocity Cicada Collector — Enterprise Installation Guide

## 1. Overview
The **Velocity Cicada Collector** is an enterprise-grade background monitoring agent designed for Windows 10, Windows 11, and Windows Server (64-bit).

It runs automatically in the background as a Windows Service (`VelocityCicadaCollector`), starts before user login, continuously gathers system and network telemetry locally, sanitizes and aggregates the data into privacy-compliant metadata, and transmits it securely every 60 seconds (or 30 seconds) to the Velocity Cicada SaaS platform.

**No command prompts or terminal windows will ever flash on the user's screen.**

---

## 2. System Requirements
- **Operating System:** Windows 10 (1809+), Windows 11, or Windows Server 2019/2022 (x64)
- **Privileges:** Administrator access (required to install the Windows Service)
- **RAM:** Less than 50 MB resident memory
- **CPU:** < 0.2% CPU utilization at idle
- **Network:** HTTPS access to the Velocity Cicada SaaS backend (port 443 in production, or port 8000 in local dev)

---

## 3. Interactive Graphical Installation

### Step 1: Run the Installer
1. Download `Velocity-Cicada-Collector-Setup.exe`.
2. Right-click the installer and select **Run as administrator**.

### Step 2: Choose Destination Folder
- Accept the standard 64-bit installation path:
  ```text
  C:\Program Files\Velocity Cicada Collector
  ```
- Click **Next**.

### Step 3: Configure SaaS Backend Connection
The setup wizard presents the **SaaS Backend Configuration** dialog:
- **SaaS Backend URL:** 
  - Local / Demo: `http://localhost:8000`
  - Production: `https://api.velocitycicada.com`
- **Tenant ID:** 
  - Enter your organization identifier (e.g. `t_acme` or `t_globex`).
- **Collector ID:** 
  - Enter a unique workstation identifier (e.g. `c_win01`).
- **Collector Secret / Enrollment Key:** 
  - Enter your pre-shared secret or enrollment credential (e.g. `dev-secret-c_win01`).
- **Cloud Region:** 
  - Select your data residency region (`ap-south-1`, `eu-west-1`, or `us-east-1`).
- **Transmission Interval:** 
  - Choose `60` (Default enterprise mode) or `30` (High-frequency mode).

### Step 4: Complete Installation
1. Ensure the checkbox `[x] Register and start Velocity Cicada as a Windows Service` is checked.
2. Click **Install**.
3. The installer:
   - Copies application binaries to `C:\Program Files\Velocity Cicada Collector\`.
   - Saves encrypted configuration to `C:\ProgramData\VelocityCicada\config.json`.
   - Creates and starts the Windows Service `VelocityCicadaCollector`.
   - Configures automatic recovery (restarts automatically after crashes).
   - Places the **Velocity Cicada Status Monitor** tray shortcut in the Start Menu and Startup.
4. Click **Finish**.

---

## 4. Silent / Unattended Installation (IT Automation & Intune / SCCM)

For automated mass enterprise deployments via Microsoft Intune, SCCM, or Group Policy, execute the installer silently with `/VERYSILENT /SUPPRESSMSGBOXES`:

```powershell
# Silent install with default settings
.\Velocity-Cicada-Collector-Setup.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
```

To supply pre-configured parameters during silent deployment, deploy the `config.json` template into `C:\ProgramData\VelocityCicada\config.json` prior to execution.

---

## 5. Automated SaaS Enrollment via Command Line

If installing in an environment where dynamic enrollment is enabled:

```powershell
cd "C:\Program Files\Velocity Cicada Collector"
.\Velocity-Cicada-Collector.exe --enroll "enroll-token-acme" --saas-url "http://localhost:8000" --tenant-id "t_acme"
```

The collector will automatically register with the SaaS registry, receive its assigned identity and HMAC secret, encrypt credentials using Windows DPAPI, and begin transmitting metadata.

---

## 6. Verifying Installation Success

1. **Verify Windows Service is Running:**
   ```powershell
   Get-Service VelocityCicadaCollector
   ```
   *Expected Status:* `Running`

2. **Verify Single-Instance Status:**
   ```powershell
   .\Velocity-Cicada-Collector.exe --status
   ```
   *Expected Output:*
   ```json
   {
     "service_name": "VelocityCicadaCollector",
     "is_running": true,
     "saas_reachable": true,
     "buffer_depth": 0
   }
   ```

3. **Open the Velocity Cicada Web Dashboard:**
   - Navigate to `http://localhost:3000` (or your SaaS Dashboard URL).
   - Click on the **Fleet** tab.
   - Confirm your collector (`c_win01`) appears with `ONLINE` status and green heartbeat indicator.
