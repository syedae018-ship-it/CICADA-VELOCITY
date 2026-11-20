import json
import re
from pathlib import Path
from typing import Any, Tuple, List, Dict
from collector.config import settings

class RedactionEngine:
    def __init__(self, rules_path: Path = None):
        self.rules_path = rules_path or settings.RULES_PATH
        self.rules: List[Dict[str, Any]] = []
        self.replacement_template = "[REDACTED:{name}]"
        self._load_rules()

    def _load_rules(self):
        if not self.rules_path.exists():
            return
        data = json.loads(self.rules_path.read_text(encoding="utf-8"))
        self.replacement_template = data.get("replacement", "[REDACTED:{name}]")
        self.rules = []
        for r in data.get("rules", []):
            try:
                compiled = re.compile(r["pattern"])
                self.rules.append({
                    "name": r["name"],
                    "pattern": compiled
                })
            except Exception as e:
                print(f"Warning: Failed to compile pattern for {r.get('name')}: {e}")

    def redact_text(self, text: str) -> Tuple[str, int]:
        if not text or not isinstance(text, str):
            return text, 0
        total_redactions = 0
        current_text = text
        for rule in self.rules:
            pattern: re.Pattern = rule["pattern"]
            replacement = self.replacement_template.format(name=rule["name"])
            matches = list(pattern.finditer(current_text))
            if matches:
                total_redactions += len(matches)
                current_text = pattern.sub(replacement, current_text)
        return current_text, total_redactions

    def redact_structure(self, obj: Any) -> Tuple[Any, int]:
        total_count = 0
        if isinstance(obj, str):
            return self.redact_text(obj)
        elif isinstance(obj, dict):
            new_dict = {}
            for k, v in obj.items():
                new_v, count = self.redact_structure(v)
                new_dict[k] = new_v
                total_count += count
            return new_dict, total_count
        elif isinstance(obj, list):
            new_list = []
            for item in obj:
                new_item, count = self.redact_structure(item)
                new_list.append(new_item)
                total_count += count
            return new_list, total_count
        else:
            return obj, 0

_engine = None

def get_redaction_engine() -> RedactionEngine:
    global _engine
    if _engine is None:
        _engine = RedactionEngine()
    return _engine

def redact(text: str) -> Tuple[str, int]:
    return get_redaction_engine().redact_text(text)

def redact_obj(obj: Any) -> Tuple[Any, int]:
    return get_redaction_engine().redact_structure(obj)
