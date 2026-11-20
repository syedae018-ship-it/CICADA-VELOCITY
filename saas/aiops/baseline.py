import math
import bisect
from collections import deque
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

class MetricBaseline:
    def __init__(self, window_minutes: int = 15, min_samples: int = 20):
        self.window_seconds = window_minutes * 60
        self.min_samples = min_samples
        # Store as sorted list of (timestamp_epoch, value) to support out-of-order event times
        self.samples: List[Tuple[float, float]] = []

    def _parse_time(self, time_val: Any) -> float:
        if isinstance(time_val, (int, float)):
            return float(time_val)
        if isinstance(time_val, str):
            clean = time_val.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean)
            return dt.timestamp()
        return datetime.utcnow().timestamp()

    def add(self, event_time: Any, value: float):
        """
        Add sample by event_time_utc in chronological order.
        Handles out-of-order and late events properly.
        """
        t = self._parse_time(event_time)
        item = (t, float(value))
        # Binary insertion to keep self.samples sorted by timestamp
        bisect.insort(self.samples, item, key=lambda x: x[0])
        self._prune()

    def _prune(self):
        """Prune samples outside the 15-minute window relative to latest known sample timestamp."""
        if not self.samples:
            return
        latest_t = self.samples[-1][0]
        cutoff = latest_t - self.window_seconds
        # Remove elements older than cutoff
        idx = bisect.bisect_left([s[0] for s in self.samples], cutoff)
        if idx > 0:
            self.samples = self.samples[idx:]

    def stats(self) -> Tuple[float, float, int]:
        n = len(self.samples)
        if n == 0:
            return 0.0, 0.0, 0
        vals = [v for _, v in self.samples]
        mean = sum(vals) / n
        if n < 2:
            return mean, 0.0, n
        variance = sum((x - mean) ** 2 for x in vals) / (n - 1)
        std = math.sqrt(variance)
        return mean, std, n

    def zscore(self, value: float, noise_floor: float = 1.0) -> float:
        mean, std, n = self.stats()
        if n < self.min_samples:
            return 0.0
        effective_std = max(std, noise_floor)
        return (value - mean) / effective_std

    def is_anomalous(self, z_score: float, threshold_z: float = 2.0) -> bool:
        return abs(z_score) >= threshold_z

# Global registry: (tenant_id, source_id, metric) -> MetricBaseline
BASELINES: Dict[Tuple[str, str, str], MetricBaseline] = {}

def get_baseline(tenant_id: str, source_id: str, metric: str) -> MetricBaseline:
    key = (tenant_id, source_id, metric)
    if key not in BASELINES:
        BASELINES[key] = MetricBaseline()
    return BASELINES[key]
