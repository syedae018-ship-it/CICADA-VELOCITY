# CICADA Local Collector to Supabase Cloud

A lightweight, privacy-first system telemetry collector built in Python. Designed for multi-laptop fleets (Windows and macOS) to monitor real system performance, apply strict default-deny allowlisting and redaction, and securely transmit pseudonymous operational metrics directly to **Supabase Cloud** for visualization on the CICADA dashboard.

---

## Architecture

```text
[ Windows / macOS Laptop ]
       │
       ▼
 [ psutil / system_info ] ──► Real Metrics (CPU, RAM, Disk, Net Rates, Uptime)
       │
       ▼
 [ Redaction Engine ]     ──► Neutralizes Emails, API Keys, Tokens, Passwords, IPs
       │
       ▼
 [ Strict Allowlist ]     ──► Default-Deny: Discards any unapproved or nested fields
       │
       ▼
 [ Pseudonymous Identity] ──► Persistent UUIDv4 Device ID (Never leaks hostname/user)
       │
       ├──► Local Snapshot: data/telemetry.json
       ├──► Offline SQLite Buffer: data/telemetry_buffer.db (Auto-retry on reconnect)
       │
       ▼ (Direct HTTPS REST - PostgREST)
 [ Supabase Cloud ]       ──► telemetry_events Table (Enforced by Row-Level Security)
       │
       ▼
 [ CICADA Web Dashboard ] ──► Hosted on Vercel (Queries Supabase by Tenant ID)
```

---

## Key Features

1. **Direct Cloud Ingestion to Supabase**:
   - Transmits telemetry directly to Supabase PostgREST HTTPS API (`/rest/v1/telemetry_events`).
   - No intermediary ingestion servers required.
2. **Centralized Strict Allowlist Engine**:
   - Explicit allowed fields (`schema_version`, `tenant_id`, `device_id`, `payload_id`, `timestamp`, `operating_system`, `cpu_percent`, `memory_total_bytes`, `memory_used_bytes`, `memory_percent`, `disk_total_bytes`, `disk_used_bytes`, `disk_percent`, `network_upload_bytes_per_second`, `network_download_bytes_per_second`, `uptime_seconds`).
   - Strict default-deny: Any unknown key, arbitrary dictionary, or oversized payload is rejected.
3. **Multi-Pattern Redaction Engine**:
   - Deep regex scanning neutralizes emails, passwords, API keys, Bearer tokens, JWTs, and IP addresses before payload generation.
   - Never logs or stores raw sensitive strings.
4. **Pseudonymous Device Identity**:
   - Stable UUIDv4 device identifier stored locally in `data/collector_id.json`.
   - Separate unique `payload_id` per transmission for strict idempotency.
   - Never collects or transmits computer hostnames, MAC addresses, or personal usernames.
5. **Offline SQLite Queue with Exponential Backoff**:
   - When the laptop is offline or network drops, telemetry records buffer locally in `data/telemetry_buffer.db`.
   - Drains pending records automatically when internet connectivity returns.
6. **Local Privacy Proof & Audit Screen**:
   - Run with `--privacy-proof` to inspect live audit metrics and review a safe JSON preview before transmission.

---

## Project Structure

```text
cicada-local-collector/
├── collector/
│   ├── __init__.py           # Application metadata & version (v0.1.0)
│   ├── main.py               # Main loop, dashboard & CLI flags (--privacy-proof, --enroll)
│   ├── config.py             # Safe configuration loader (.env parser)
│   ├── metrics.py            # Real psutil system metrics & rate calculation
│   ├── health.py             # Infrastructure health & threshold alerts
│   ├── network_probe.py      # Latency (RTT ms) & packet loss (%) probe
│   ├── security.py           # Privacy-preserving failed login count
│   ├── system_info.py        # Cross-platform OS & architecture detection
│   ├── identity.py           # Persistent pseudonymous UUIDv4 management
│   ├── privacy.py            # Strict centralized allowlist & default-deny engine
│   ├── redaction.py          # Multi-pattern regex redaction engine
│   ├── buffer.py             # SQLite offline queue with exponential backoff
│   ├── supabase_client.py    # Direct HTTPS PostgREST upload client
│   ├── enrollment.py         # Device enrollment & credential persistence
│   └── payload.py            # Local JSON snapshot assembler
├── supabase/
│   └── migrations/
│       └── 20261120000000_telemetry_events.sql  # Database schema & RLS policies
├── data/
│   ├── .gitkeep              # Directory placeholder
│   ├── collector_id.json     # Generated device UUIDv4
│   ├── telemetry.json        # Latest local snapshot
│   └── telemetry_buffer.db   # Local offline buffer (SQLite)
├── tests/
│   ├── __init__.py
│   ├── test_allowlist.py     # Allowlist & schema rejection tests
│   ├── test_redaction.py     # Redaction pattern tests (emails, keys, JWTs, IPs)
│   ├── test_buffer.py        # Offline SQLite buffer & backoff tests
│   ├── test_supabase_upload.py # Upload responses, 201, 401, 409 idempotency tests
│   ├── test_privacy.py       # Privacy policy tests
│   └── test_payload.py       # Metrics & payload tests
├── .env.example              # Environment variables template
├── requirements.txt          # Minimal dependency: psutil>=5.9.0
├── README.md                 # Documentation & setup guide
└── .gitignore                # Excludes secrets, envs, caches, databases
```

---

## Supabase Project Setup & Database Migration

### 1. Run Database Migration in Supabase
1. Open your **Supabase Dashboard** -> Go to the **SQL Editor**.
2. Open `supabase/migrations/20261120000000_telemetry_events.sql`.
3. Paste and run the SQL migration.

This creates:
- `public.tenants`: Multi-tenant organization registry.
- `public.devices`: Registered devices table with automatic heartbeat triggers.
- `public.telemetry_events`: Telemetry table with unique constraint on `(tenant_id, device_id, payload_id)`.
- Restrictive **Row-Level Security (RLS)** policies preventing unauthorized tenant access or device impersonation.

---

## Environment Configuration

Copy `.env.example` to `.env` in the root folder:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```ini
# Supabase Project HTTPS URL
SUPABASE_URL=https://your-project-id.supabase.co

# Supabase Publishable / Anon Key (Safe for public clients)
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Device Authentication Token (JWT issued during enrollment)
SUPABASE_DEVICE_TOKEN=your-device-enrollment-token-here

# Shared Tenant UUID for your fleet
CICADA_TENANT_ID=00000000-0000-0000-0000-000000000000

# Collection interval in seconds (default: 10s for demo)
COLLECTION_INTERVAL_SECONDS=10
```

> **Note:** If `SUPABASE_DEVICE_TOKEN` is omitted, the collector automatically runs in safe **Local-Only Mode** without crashing or faking cloud uploads.

---

## Running on Windows (PowerShell)

### Step 1: Open PowerShell and Navigate to the Folder
```powershell
cd c:\Users\iammo\Desktop\cicada\CICADA-VELOCITY\cicada-local-collector
```

### Step 2: Install Dependencies
```powershell
pip install -r requirements.txt
```

### Step 3: Run the Collector
To start continuous monitoring and direct Supabase uploads:
```powershell
python collector/main.py
```
*Press **Ctrl+C** to stop at any time.*

### Step 4: Inspect Local Privacy Proof
To view live privacy audit statistics and verify the exact allowlisted JSON before transmission:
```powershell
python collector/main.py --privacy-proof
```

---

## Running on macOS

> **Testing Status Note:**
> Engineered using standard cross-platform Python libraries (`platform`, `psutil`, `urllib.request`, `sqlite3`). Actively tested on Windows 11; Apple Silicon / Intel Mac testing pending physical hardware access.

```bash
cd /path/to/cicada-local-collector
pip install -r requirements.txt
python3 collector/main.py
```

---

## Multi-Laptop Hackathon Demo Setup (3 Laptops)

To connect 3 independent laptops (e.g., Windows Laptop 1, MacBook Laptop 2, Windows/Linux Laptop 3) to the same CICADA tenant:

1. **Step 1: Install Collector on all 3 Laptops**
   - Copy or clone `cicada-local-collector` onto Laptop 1, Laptop 2, and Laptop 3.
2. **Step 2: Configure Shared Tenant and Supabase URL**
   - On each laptop, create a `.env` file with the **identical**:
     - `SUPABASE_URL`
     - `SUPABASE_PUBLISHABLE_KEY`
     - `CICADA_TENANT_ID=00000000-0000-0000-0000-000000000000`
3. **Step 3: Unique Pseudonymous Device Identities**
   - Each laptop will automatically generate its own unique `device_id` on first launch (stored in `data/collector_id.json`).
   - The cloud distinguishes them automatically without knowing their actual hostnames or usernames.
4. **Step 4: Launch Collector on Each Laptop**
   - Laptop 1: `python collector/main.py --interval 10`
   - Laptop 2: `python3 collector/main.py --interval 10`
   - Laptop 3: `python collector/main.py --interval 10`
5. **Step 5: View Fleet in CICADA Dashboard**
   - All 3 laptops will appear simultaneously under the demo tenant in Supabase and the Vercel-hosted CICADA dashboard.

---

## Automated Tests

Run the comprehensive test suite (35 automated tests):

```powershell
python -m unittest discover -s tests -v
```

### Test Coverage Summary:
- `test_allowlist.py`: Strict schema validation, unknown-field rejection, oversized payload bounds, type checks.
- `test_redaction.py`: Neutralization of emails, passwords, API keys, JWTs, IPv4/IPv6 addresses.
- `test_buffer.py`: SQLite persistence, retry queuing, exponential backoff, duplicate handling.
- `test_supabase_upload.py`: HTTP 201 success, HTTP 409 idempotency, offline fallback on network loss, 401 auth handling.
- `test_payload.py` & `test_privacy.py`: Real metrics collection, stable UUID generation, and infrastructure health evaluation.

---

## Privacy Guarantee

- **No Personal Identifiers**: Usernames, personal files, and hostnames are **never** collected or transmitted.
- **No IP Addresses in Telemetry**: Public and private IP addresses are disallowed and stripped by the allowlist.
- **Defense in Depth**: Data minimization, allowlisting, regex redaction, and database RLS work together.
