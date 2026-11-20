import json
from pathlib import Path
from typing import Any, Dict

HERE = Path(__file__).parent
CONTRACTS_DIR = HERE.parent.parent / "contracts"

def load_thresholds() -> Dict[str, Any]:
    path = CONTRACTS_DIR / "health_thresholds.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

THRESHOLDS = load_thresholds()
