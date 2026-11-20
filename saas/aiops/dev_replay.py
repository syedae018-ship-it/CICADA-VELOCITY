import copy
import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from .engine import on_ingest
from .store import STORE

HERE = Path(__file__).parent
CONTRACTS_DIR = HERE.parent.parent / "contracts" / "sample_payloads"

def run_replay():
    print("=" * 60)
    print("  CICADA AIOps Engine: dev_replay demonstration")
    print("=" * 60)

    # 1. Warm up baseline with normal payload samples
    normal_path = CONTRACTS_DIR / "01_normal.json"
    if not normal_path.exists():
        print(f"Error: {normal_path} not found.")
        return

    with open(normal_path, "r", encoding="utf-8") as f:
        base_payload = json.load(f)

    tenant_id = base_payload.get("tenant_id", "t_acme")
    print(f"\n[1/4] Warming baseline for tenant '{tenant_id}' (25 samples)...")

    # Feed 25 baseline samples with slight noise to satisfy min_samples=20
    for i in range(25):
        payload = copy.deepcopy(base_payload)
        now_iso = datetime.now(timezone.utc).isoformat()
        payload["sent_at_utc"] = now_iso
        for src in payload["sources"]:
            src["event_time_utc"] = now_iso
            for m in src["metrics"]:
                if isinstance(src["metrics"][m], (int, float)) and not isinstance(src["metrics"][m], bool):
                    src["metrics"][m] += random.uniform(-1.0, 1.0)
        on_ingest(tenant_id, payload)

    sources = STORE.sources.get(tenant_id, {})
    for s_id, s in sources.items():
        print(f"   - Source {s_id} ({s['service']}): state={s['state']}, reason={s['reason']}")

    # 2. Inject CPU Anomaly Scenario (#5)
    print("\n[2/4] Injecting CPU anomaly payload (02_cpu_anomaly.json)...")
    anom_path = CONTRACTS_DIR / "02_cpu_anomaly.json"
    with open(anom_path, "r", encoding="utf-8") as f:
        anom_payload = json.load(f)

    # Feed twice to satisfy consecutive anomaly requirement (prevents false-alarm spikes)
    for step in range(2):
        p = copy.deepcopy(anom_payload)
        now_iso = datetime.now(timezone.utc).isoformat()
        p["sent_at_utc"] = now_iso
        for src in p["sources"]:
            src["event_time_utc"] = now_iso
        on_ingest(tenant_id, p)

    alerts = STORE.alerts.get(tenant_id, [])
    print(f"   => Generated {len(alerts)} alerts. Latest alert explanation:")
    if alerts:
        latest = alerts[-1]
        print(f"      Metric: {latest['metric']} (kind: {latest['kind']}, severity: {latest['severity']})")
        print(f"      Why: {latest['explanation'].get('why')}")
        print(f"      Z-score: {latest['explanation'].get('z_score')}")

    # 3. Inject Security Burst Scenario (#3)
    print("\n[3/4] Injecting Security Failed Logins (03_failed_logins.json)...")
    sec_path = CONTRACTS_DIR / "03_failed_logins.json"
    with open(sec_path, "r", encoding="utf-8") as f:
        sec_payload = json.load(f)

    now_iso = datetime.now(timezone.utc).isoformat()
    sec_payload["sent_at_utc"] = now_iso
    for src in sec_payload.get("sources", []):
        src["event_time_utc"] = now_iso
    for ev in sec_payload.get("events", []):
        ev["event_time_utc"] = now_iso
    on_ingest(tenant_id, sec_payload)

    # 4. Check Correlated Incidents & Recommendations
    print("\n[4/4] Evaluating Correlated Incidents and Explainable Recommendations:")
    incidents = STORE.incidents.get(tenant_id, [])
    print(f"   => Total Incidents: {len(incidents)}")
    for inc in incidents:
        print(f"   * Incident [{inc['incident_id']}]: {inc['title']}")
        print(f"     Likely Cause: {inc['likely_cause']}")
        print(f"     Alerts Merged: {inc['alert_count']} (Duplicates Suppressed: {inc['suppressed_duplicates']})")

    recs = STORE.recommendations.get(tenant_id, [])
    print(f"\n   => Generated Recommendations: {len(recs)}")
    for r in recs:
        print(f"   * Recommendation [{r['rec_id']}]: {r['action']}")
        print(f"     Confidence: {r['confidence']}, Risk: {r['risk']}")
        print(f"     Reasoning Path:")
        for step in r['reasoning_path']:
            print(f"       -> {step}")

    print("\n" + "=" * 60)
    print("  dev_replay completed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    run_replay()
