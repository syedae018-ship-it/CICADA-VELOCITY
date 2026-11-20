# Chapter 4: Privacy Engine, Redaction & Security

## 1. Privacy Architecture: The Zero-Knowledge Boundary

Velocity Cicada enforces a strict **Zero-Knowledge Architecture** for cloud observability. The SaaS cloud platform never receives, parses, stores, or processes raw customer logs.

```mermaid
flowchart LR
    subgraph INGEST["1. Ingestion"]
        RawLog["Raw Log / Metric Line"]
    end

    subgraph REDACT["2. Local Redaction Engine"]
        PatternCheck{"Matches 11 Regex Patterns?"}
        Mask["Mask to [REDACTED:name]"]
        PatternCheck -- Yes --> Mask
        PatternCheck -- No --> Passthrough["Clean Value"]
    end

    subgraph PSEUDO["3. Salt Pseudonymization"]
        HostName["Hostname: db-01.acme.corp"]
        SaltHash["HMAC-SHA256(SITE_SALT, host)[0:12]"]
        PseudoID["src_9f2a4c11b0e2"]
        HostName --> SaltHash --> PseudoID
    end

    subgraph ALLOWLIST["4. Schema Allow-List"]
        Filter{"In payload_schema.json?"}
        Drop["Strip Key / Value"]
        Keep["Include in Egress Window"]
        Filter -- Forbidden --> Drop
        Filter -- Permitted --> Keep
    end

    subgraph WIRE["5. HMAC Wire Egress"]
        Metadata["Sanitized Metadata Payload"]
        HMACSign["Sign with Pre-Shared Key"]
        SaaSCloud["SaaS Cloud (Port 8000)"]
        Metadata --> HMACSign --> SaaSCloud
    end

    RawLog --> PatternCheck
    Mask --> HostName
    Passthrough --> HostName
    PseudoID --> Filter
```

---

## 2. The 11 Pre-Compiled Regex Redaction Rules

Defined in `contracts/redaction_rules.json` and executed in `collector/redact.py`:

| Rule Name | Target Pattern | Example Match | Replacement Token |
| :--- | :--- | :--- | :--- |
| `password_assignment` | `(?i)(password\|passwd\|pwd)\s*[:=]\s*['"]?([^\s'"]+)` | `password="Secret123"` | `password=[REDACTED:password_assignment]` |
| `api_key` | `(?i)(api[_-]?key\|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{16,})` | `api_key: "abc123xyz7890123"` | `api_key=[REDACTED:api_key]` |
| `bearer_token` | `Bearer\s+[a-zA-Z0-9_\-\.]{20,}` | `Bearer eyJhbGciOi...` | `[REDACTED:bearer_token]` |
| `jwt` | `eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}` | `eyJhbG...` | `[REDACTED:jwt]` |
| `aws_key` | `AKIA[0-9A-Z]{16}` | `AKIAIOSFODNN7EXAMPLE` | `[REDACTED:aws_key]` |
| `ssh_private_key` | `-----BEGIN (RSA\|OPENSSH\|DSA\|EC) PRIVATE KEY-----` | `-----BEGIN RSA PRIVATE KEY-----` | `[REDACTED:ssh_private_key]` |
| `email` | `[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+` | `john.doe@company.com` | `[REDACTED:email]` |
| `ipv4_address` | `\b(?:(?:25[0-5]\|2[0-4][0-9]\|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]\|2[0-4][0-9]\|[01]?[0-9][0-9]?)\b` | `192.168.1.50` | `[REDACTED:ipv4_address]` |
| `credit_card` | `\b(?:\d{4}[ -]?){3}\d{4}\b` | `4532-1234-5678-9012` | `[REDACTED:credit_card]` |
| `ssn` | `\b\d{3}-\d{2}-\d{4}\b` | `123-45-6789` | `[REDACTED:ssn]` |
| `connection_string` | `(?i)(postgres\|mysql\|mongodb):\/\/[^\s'"]+` | `postgres://user:pass@host/db` | `[REDACTED:connection_string]` |

---

## 3. Mathematical Pseudonymization via Salted HMAC

In enterprise observability, raw hostnames often expose business architecture (e.g., `cardholder-vault-primary.us-east.prod`).

In Velocity Cicada (`collector/pseudo.py`):
```python
def source_id(host: str, salt: str = None) -> str:
    effective_salt = (salt or settings.SITE_SALT).encode("utf-8")
    h = hmac.new(effective_salt, host.encode("utf-8"), hashlib.sha256).hexdigest()[:12]
    return f"src_{h}"
```

### Why Salted HMAC is Superior to Simple Hashing:
1. **Rainbow Table Resistance**: An attacker with a pre-computed dictionary of common hostnames (`web-01`, `db-01`) cannot invert the hash because each customer site uses a unique cryptographic `SITE_SALT`.
2. **Determinism within Tenant**: All telemetry from `payments-api-01` produces the exact same `src_7a9f2b1c4e80` across aggregation windows, allowing the AIOps engine to track historical baselines accurately.
3. **Zero Information Leakage**: The salt never leaves the customer VPC.

---

## 4. Egress Proof & Verification

Velocity Cicada provides mathematical proof of egress safety via the **Egress Proof** dashboard view (`EgressProofView.tsx`):
- Every transmitted payload includes a `sha256` digest of its JSON body.
- The SaaS ingestion system verifies that the received payload hash matches the collector's recorded transmission hash.
- The dashboard performs real-time automated regex checks on all metadata fields received by SaaS to verify **0 detected secrets**.
