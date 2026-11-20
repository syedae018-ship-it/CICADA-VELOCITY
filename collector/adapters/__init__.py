from typing import Dict, Any
from collector.adapters.simulator import adapt_to_raw_record

def adapt_record(data: Dict[str, Any]) -> Dict[str, Any]:
    return adapt_to_raw_record(data)
