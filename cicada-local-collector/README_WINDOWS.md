# CICADA Local Collector — Windows Customer & Build Guide

A native Windows desktop application and standard setup installer for **CICADA Local Collector**.

---

## 1. Customer Experience & Installation

Customers do **not** need Python or command-line tools installed.

### Step 1: Install the Application
1. Download `CICADA-Local-Collector-Setup.exe`.
2. Double-click the installer.
3. Accept the default destination folder:
   ```text
   C:\Users\<Username>\AppData\Local\Programs\CICADA Local Collector
   (or C:\Program Files\CICADA Local Collector)
   ```
4. Choose whether to create a Desktop shortcut and Start Menu shortcut.
5. Click **Install**.

### Step 2: Launch and Enroll
1. Launch **CICADA Local Collector** from your Desktop or Start Menu.
2. The modern desktop application opens with live CPU, RAM, Disk, and Network meters running in local mode.
3. Click **"Connect to CICADA Cloud..."**.
4. Enter your organization's:
   - **Supabase URL**
   - **Publishable Key**
   - **Device Token (JWT)**
   - **Tenant UUID**
5. Check the mandatory consent box:
   `[x] I explicitly consent to transmitting pseudonymous operational system telemetry (CPU, RAM, Disk, Network speeds) to my organization's CICADA cloud tenant.`
6. Click **Save & Connect**.

### Step 3: Monitor Connection & Privacy
- **Cloud Status** changes to `ONLINE` with green badge.
- View real-time resource meters and network rates.
- Click **"View Safe Telemetry Preview"** at any time to inspect the exact allowlisted JSON payload leaving your computer.
- Click **"Pause Monitoring"** or **"Disconnect Cloud"** whenever you wish.

---

## 2. Directory Architecture & Data Preservation

To ensure compatibility with standard (non-admin) Windows accounts and preserve device identities during app upgrades:

- **Application Binaries**:
  `{autopf}\CICADA Local Collector\` (Read-only application binaries)
- **Persistent User Data**:
  `%LOCALAPPDATA%\CICADA-Collector\` (e.g., `C:\Users\<user>\AppData\Local\CICADA-Collector\`)
  - `collector_id.json`: Persistent pseudonymous UUIDv4.
  - `device_config.json`: Organization tenant and credentials.
  - `telemetry_buffer.db`: Offline SQLite queue for resilient buffering.
  - `telemetry.json`: Local snapshot.

> **Uninstaller Note:** Running the uninstaller cleanly removes all application binaries and shortcuts, while preserving your persistent `collector_id.json` in user AppData so reinstalling or upgrading retains your stable device identity.

---

## 3. Building the Windows Installer from Source

### Prerequisites
1. Windows 10 or Windows 11 (64-bit).
2. Python 3.8+ installed.
3. Inno Setup 6 (free from [jrsoftware.org](https://jrsoftware.org/isdl.php) or via `winget install JRSoftware.InnoSetup`).

### Automated One-Click Build Script

In Windows PowerShell, run:

```powershell
.\build_windows.ps1
```

The script automatically:
1. Installs build dependencies (`psutil`, `pyinstaller`).
2. Runs all 35 automated tests (fails build if any test fails).
3. Compiles the Python application using PyInstaller into `dist\CICADA-Collector\`.
4. Compiles `installer\CICADA-Collector.iss` using Inno Setup compiler (`ISCC.exe`).
5. Generates the final customer installer:
   ```text
   dist\installer\CICADA-Local-Collector-Setup.exe
   ```

---

## 4. macOS Preparation & Cross-Platform Roadmap

The Python codebase uses platform-agnostic APIs (`platform`, `psutil`, `urllib.request`, `sqlite3`, `tkinter`).

### Building on macOS (from a Mac machine):
1. **Prerequisites**: macOS 12+ (Intel `x86_64` or Apple Silicon `arm64`).
2. **Install dependencies**:
   ```bash
   pip3 install -r requirements-build.txt
   ```
3. **Run tests**:
   ```bash
   python3 -m unittest discover -s tests -v
   ```
4. **Compile Application Bundle**:
   ```bash
   pyinstaller --name "CICADA-Collector" --windowed --clean collector/main.py
   ```
   This generates `dist/CICADA-Collector.app`.
5. **Packaging into DMG**:
   Use `create-dmg` or `hdiutil` to package into a `.dmg` installer:
   ```bash
   hdiutil create -volname "CICADA Local Collector" -srcfolder dist/CICADA-Collector.app -ov -format UDZO CICADA-Collector-macOS.dmg
   ```
6. **Code Signing & Notarization (Production Release)**:
   - Sign using your Apple Developer ID:
     `codesign --deep --force --verify --verbose --sign "Developer ID Application: YourOrg" dist/CICADA-Collector.app`
   - Notarize with Apple:
     `xcrun notarytool submit CICADA-Collector-macOS.dmg --keychain-profile "AC_PASSWORD" --wait`
   - Staple the ticket:
     `xcrun stapler staple CICADA-Collector-macOS.dmg`

*(Note: Creating a signed macOS `.app` or `.dmg` must be performed directly on a macOS host).*

---

## 5. Security & Privacy Guarantees

- **No Hardcoded Credentials**: The installer binary contains zero API keys or database secrets.
- **Explicit Customer Consent**: Cloud transmission will not start until the customer checks the consent box.
- **Zero Raw Logs or Personal Files**: The allowlist and regex redaction engine strictly filter all outgoing data.
- **Fail-Closed Protection**: Any unexpected or unallowlisted field immediately halts transmission.
