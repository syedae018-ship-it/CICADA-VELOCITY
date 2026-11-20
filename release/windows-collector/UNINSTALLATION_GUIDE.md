# Velocity Cicada Collector — Uninstallation Guide

## 1. Overview
The **Velocity Cicada Collector** provides a clean, safe, and completely reversible uninstallation procedure.

When uninstalled, the collector:
1. Gracefully signals the running background service to complete any in-flight transmissions.
2. Stops the Windows Service (`sc.exe stop VelocityCicadaCollector`).
3. De-registers the service from the Windows Service Control Manager (`sc.exe delete VelocityCicadaCollector`).
4. Removes all application binaries from `C:\Program Files\Velocity Cicada Collector\`.
5. Removes Start Menu, Desktop, and Startup shortcuts.
6. **Preserves Customer Configuration and Audit Logs:** Device identities (`collector_id.json`), configuration templates, and SQLite buffer archives in `%ProgramData%\VelocityCicada\` or `%LocalAppData%\VelocityCicada\` are deliberately retained to prevent accidental data loss and ensure seamless future upgrades.

---

## 2. Standard Graphical Uninstallation

1. Open **Windows Settings** (Press `Win + I`).
2. Navigate to **Apps** -> **Installed apps** (or **Add/Remove Programs** in Control Panel).
3. In the search box, type `Velocity Cicada Collector`.
4. Click the three dots `...` next to **Velocity Cicada Collector** and select **Uninstall**.
5. Confirm by clicking **Yes** when prompted by Windows User Account Control.
6. The uninstaller will stop the background service, remove binary files and shortcuts, and display a confirmation message upon completion.

---

## 3. Command-Line Uninstallation

You can cleanly stop and remove the Windows Service directly from an elevated Administrator PowerShell prompt:

```powershell
# Navigate to installation directory
cd "C:\Program Files\Velocity Cicada Collector"

# Cleanly de-register the service
.\Velocity-Cicada-Collector.exe --uninstall
```

To run the full uninstaller silently (e.g. for MDM / Intune script de-provisioning):

```powershell
# Run the Inno uninstaller silently
& "C:\Program Files\Velocity Cicada Collector\unins000.exe" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
```

---

## 4. Complete Purge (Optional Clean Slate)

If you wish to completely wipe all historical configuration and audit logs from the machine (e.g., when decommissioning hardware):

```powershell
# 1. Stop and remove the service
Stop-Service VelocityCicadaCollector -ErrorAction SilentlyContinue
sc.exe delete VelocityCicadaCollector

# 2. Delete installation directory
Remove-Item -Recurse -Force "C:\Program Files\Velocity Cicada Collector" -ErrorAction SilentlyContinue

# 3. Delete application data and logs
Remove-Item -Recurse -Force "$env:ProgramData\VelocityCicada" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\VelocityCicada" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\CICADA-Collector" -ErrorAction SilentlyContinue
```
