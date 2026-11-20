# Data Policy: What Leaves, What Is Redacted, What Stays

> Source of truth for the trust boundary. `payload_schema.json` enforces it in code.
> If a field is not in the schema, it does not leave the customer environment. No exceptions.

## ✅ SENT to SaaS (allow-listed metadata)

| Field | Example | Why it is safe |
|---|---|---|
| `tenant_id`, `collector_id`, `region` | `t_acme`, `c_blr01`, `ap-south-1` | Our own identifiers |
| `source_id` | `src_9f2c4a1b7e30` | HMAC of hostname with a **local-only salt**, so it cannot be reversed in SaaS |
| `source_type`, `service` | `server`, `payments-api` | Logical labels from collector config |
| Metric values | `cpu_pct: 82.4`, `latency_ms: 140` | Numbers only |
| Timestamps | `2026-11-20T09:15:02Z` + `source_tz` | UTC + IANA zone |
| Event `category`, `severity`, `type`, `count` | `auth`, `high`, `failed_login_burst`, `14` | Enums and counts |
| Event `summary` | `"14 failed logins in 60s on src_9f2c4a1b7e30"` | **Templated** by the collector, never copied from a log line |
| Collector health | version, cpu, mem, buffer depth, config hash | Fleet health |
| Redaction stats | `secrets_redacted: 3` | Proof that redaction ran, without revealing what was redacted |

## ✂️ REDACTED locally (scrubbed in the raw store, never sent)

Rules live in `redaction_rules.json`. Matches become `[REDACTED:<rule>]` in the **local** copy.

| Pattern | Example input |
|---|---|
| Passwords in key/value pairs | `password=hunter2`, `pwd: x` |
| Bearer / API tokens | `Authorization: Bearer eyJ...`, `api_key=sk_live_...` |
| AWS keys | `AKIA...` |
| Private keys | `-----BEGIN PRIVATE KEY-----` |
| JWTs | `eyJhbGciOi...` |
| Credit-card-like numbers | `4111 1111 1111 1111` |
| Emails | `alice@corp.com` |
| IPv4 / IPv6 addresses | `10.0.4.17` |

## 🔒 STAYS LOCAL (never leaves, even redacted)

- Raw log lines and syslog messages
- Request/response payloads and bodies
- Usernames, account names, emails, IPs, hostnames, MAC addresses
- Raw authentication records (who tried to log in, from where)
- Full flow records (src/dst IP:port pairs)
- The pseudonymisation salt, collector secret, TLS private key
- Local raw store, kept for `LOCAL_RETENTION_HOURS` (default 24) then purged

## Who can see what

| Viewer | Sees |
|---|---|
| Customer operator at the site (collector UI :8001) | Raw logs (redacted view), egress proof panel, buffer |
| Tenant user in SaaS | Only rows where `tenant_id` = their tenant |
| Another tenant | Nothing. Every SaaS query is filtered by the tenant from the auth token, never from the request body or URL alone |
| Our SaaS operators | Metadata only. No raw data exists in SaaS to see |
