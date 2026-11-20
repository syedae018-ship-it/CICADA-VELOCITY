import json
import re
import math
from pathlib import Path
from typing import Any, Tuple, List, Dict
from collector.config import settings

STOP_WORDS = {
    "INFO", "WARN", "WARNING", "ERROR", "DEBUG", "TRACE", "CRITICAL", "FATAL",
    "Info", "Warn", "Warning", "Error", "Debug", "Trace", "Critical", "Fatal",
    "Service", "Server", "Database", "Host", "System", "Collector", "Transport",
    "Router", "Gateway", "App", "Application", "Api", "Node", "Cluster", "Proxy",
    "Worker", "Manager", "Payment", "Payments", "Order", "Processor", "Vpn", "Auth",
    "Metric", "Event", "Payload", "Window", "Buffer", "Status", "Egress", "Ingress",
    "Docker", "Kubernetes", "Linux", "Windows", "Ubuntu", "Fastapi", "FastAPI", "Uvicorn",
    "Python", "Json", "Http", "Https", "Get", "Post", "Put", "Delete", "Head",
    "Authorization", "Bearer", "Token", "Secret", "Key", "Tenant", "Region", "Utc",
    "Site", "Salt", "Hmac", "Sha", "Sha256", "Aes", "Rsa", "Ssl", "Tls", "Dns",
    "Ip", "Ipv4", "Ipv6", "Tcp", "Udp", "Cpu", "Mem", "Disk", "Latency", "Loss", "Bandwidth",
    "Session", "Request", "Response", "Connection", "Connect", "Failed", "Success",
    "True", "False", "None", "Null", "Redacted", "Local", "Ai", "Private", "Public",
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December",
    "Point", "Pt", "Way", "Place", "Pl", "Court", "Ct", "Circle", "Lane", "Ln",
    "Drive", "Dr", "Street", "St", "Avenue", "Ave", "Road", "Rd", "Boulevard", "Blvd",
    "Suite", "Ste", "Apt", "Apartment", "Terrace", "Highway", "Hwy", "Parkway", "Pkwy"
}

def shannon_entropy(data: str) -> float:
    """Computes Shannon entropy (bits per character) of a string."""
    if not data:
        return 0.0
    freq: Dict[str, int] = {}
    for char in data:
        freq[char] = freq.get(char, 0) + 1
    entropy = 0.0
    length = len(data)
    for count in freq.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy

class RedactionEngine:
    def __init__(self, rules_path: Path = None):
        self.rules_path = rules_path or settings.RULES_PATH
        self.rules: List[Dict[str, Any]] = []
        self.replacement_template = "[REDACTED:{name}]"
        self._load_rules()
        self._init_ai_model()

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

    def _init_ai_model(self):
        """
        Initializes the lightweight local entity recognition patterns and rules.
        Handles names, physical addresses, high-entropy random keys, and free-text PII.
        """
        # Street / physical address pattern: <street_number> <Street Name> <Suffix>
        # Suffixes: Point, Pt, Way, Place, Pl, Court, Ct, Circle, Lane, Ln, Drive, Dr, Street, St, Avenue, Ave, Road, Rd, Boulevard, Blvd, Suite, Ste, Apt, Apartment
        self.ai_address_pattern = re.compile(
            r"\b\d{1,6}\s+(?:[A-Za-z0-9\.'-]+\s+){1,4}(?:Point|Pt|Way|Place|Pl|Court|Ct|Circle|Lane|Ln|Drive|Dr|Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Suite|Ste|Apt|Apartment)\b",
            re.IGNORECASE
        )
        
        # Name context pattern: context keywords (User, Customer, Patient, Client, Employee, Member, Admin, name, full_name, user_fullname)
        # or prepositions (for, by, from, to, with) followed by 2-to-3 capitalized words
        self.ai_name_context_pattern = re.compile(
            r"\b(?:User|Customer|Patient|Client|Employee|Member|Admin|name|full_name|user_fullname)\s*[:=]?\s*([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,2})\b"
            r"|"
            r"\b(?:for|by|from|to|with)\s+([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,2})\b",
            re.IGNORECASE
        )

        # Unanchored 2-to-3 capitalized words in natural sentences
        self.ai_name_general_pattern = re.compile(
            r"\b([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,2})\b"
        )

        # High-entropy secret token candidates: single continuous tokens (letters, digits, +, /, =, _, -) length >= 16
        self.token_candidate_pattern = re.compile(
            r"(?<![a-zA-Z0-9_\-\+])[a-zA-Z0-9_\-\+/=]{16,}(?![a-zA-Z0-9_\-\+])"
        )

    def redact_text(self, text: str) -> Tuple[str, int, int]:
        """
        Redacts text using two tiers:
        Tier 1: Regular expressions from redaction_rules.json -> [REDACTED:{name}]
        Tier 2: Local AI (Entropy + Named-Entity/Address/Free-text PII) -> [REDACTED:ai_{type} (caught by AI)]

        Returns: (redacted_text, regex_catches, ai_catches)
        """
        if not text or not isinstance(text, str):
            return text, 0, 0

        regex_catches = 0
        ai_catches = 0
        current_text = text

        # 1. Regex Redaction (Tier 1)
        for rule in self.rules:
            pattern: re.Pattern = rule["pattern"]
            replacement = self.replacement_template.format(name=rule["name"])
            matches = list(pattern.finditer(current_text))
            if matches:
                regex_catches += len(matches)
                current_text = pattern.sub(replacement, current_text)

        # 2. Local AI Redaction (Tier 2 - Catches what regex patterns missed)

        # 2a. Physical Addresses (<street_number> <Street Name> <Suffix>)
        def _replace_address(match):
            nonlocal ai_catches
            ai_catches += 1
            return "[REDACTED:ai_address (caught by AI)]"

        current_text = self.ai_address_pattern.sub(_replace_address, current_text)

        # 2b. Free-text Person Names (2-3 word capitalized names, context-led or general)
        def _is_valid_person_name(candidate: str) -> bool:
            words = candidate.split()
            if len(words) < 2 or len(words) > 3:
                return False
            for w in words:
                if w in STOP_WORDS or w.upper() in STOP_WORDS or w.capitalize() in STOP_WORDS:
                    return False
                if w.startswith("src_") or "REDACTED" in w or "caught" in w:
                    return False
                if not re.match(r"^[A-Z][a-z]{1,20}$", w):
                    return False
            return True

        def _replace_name_context(match):
            nonlocal ai_catches
            full_match = match.group(0)
            if "[REDACTED" in full_match:
                return full_match
            name_val = match.group(1) or match.group(2)
            if name_val and _is_valid_person_name(name_val):
                ai_catches += 1
                return full_match.replace(name_val, "[REDACTED:ai_person (caught by AI)]")
            return full_match

        current_text = self.ai_name_context_pattern.sub(_replace_name_context, current_text)

        def _replace_name_general(match):
            nonlocal ai_catches
            cand = match.group(1)
            start = match.start()
            end = match.end()
            prefix_window = current_text[max(0, start-15):start]
            suffix_window = current_text[end:min(len(current_text), end+15)]
            if "[REDACTED" in prefix_window and "]" not in prefix_window:
                return cand
            if "caught by AI" in suffix_window or "(caught by AI)" in prefix_window:
                return cand
            if cand and _is_valid_person_name(cand):
                ai_catches += 1
                return "[REDACTED:ai_person (caught by AI)]"
            return cand

        current_text = self.ai_name_general_pattern.sub(_replace_name_general, current_text)

        # 2c. High-Entropy Secret Tokens (catches random API keys, unformatted secret hashes)
        def _replace_high_entropy(match):
            nonlocal ai_catches
            token = match.group(0)
            if token.startswith("[REDACTED") or token.endswith("]"):
                return token
            # Never redact our own pseudonymous source IDs (format: src_<12-hex>)
            if re.match(r"^src_[a-f0-9]{12}$", token):
                return token
            # Minimum length 16 and Shannon entropy >= 3.6 indicates random keys/hashes
            if len(token) >= 16:
                entropy = shannon_entropy(token)
                if entropy >= 3.6:
                    ai_catches += 1
                    return "[REDACTED:ai_high_entropy_secret (caught by AI)]"
            return token

        current_text = self.token_candidate_pattern.sub(_replace_high_entropy, current_text)

        return current_text, regex_catches, ai_catches

    def redact_structure(self, obj: Any) -> Tuple[Any, int, int]:
        total_regex = 0
        total_ai = 0
        if isinstance(obj, str):
            return self.redact_text(obj)
        elif isinstance(obj, dict):
            new_dict = {}
            for k, v in obj.items():
                # Envelope keys and pseudonymous IDs are preserved without redaction
                if k in ("source_id", "schema_version", "source_type", "kind", "seq", "payload_id"):
                    new_dict[k] = v
                    continue
                new_v, r_c, ai_c = self.redact_structure(v)
                new_dict[k] = new_v
                total_regex += r_c
                total_ai += ai_c
            return new_dict, total_regex, total_ai
        elif isinstance(obj, list):
            new_list = []
            for item in obj:
                new_item, r_c, ai_c = self.redact_structure(item)
                new_list.append(new_item)
                total_regex += r_c
                total_ai += ai_c
            return new_list, total_regex, total_ai
        else:
            return obj, 0, 0

_engine = None

def get_redaction_engine() -> RedactionEngine:
    global _engine
    if _engine is None:
        _engine = RedactionEngine()
    return _engine

def redact(text: str) -> Tuple[str, int]:
    text_out, r_c, ai_c = get_redaction_engine().redact_text(text)
    return text_out, (r_c + ai_c)

def redact_with_details(text: str) -> Tuple[str, int, int]:
    return get_redaction_engine().redact_text(text)

def redact_obj(obj: Any) -> Tuple[Any, int]:
    obj_out, r_c, ai_c = get_redaction_engine().redact_structure(obj)
    return obj_out, (r_c + ai_c)

def redact_obj_with_details(obj: Any) -> Tuple[Any, int, int]:
    return get_redaction_engine().redact_structure(obj)
