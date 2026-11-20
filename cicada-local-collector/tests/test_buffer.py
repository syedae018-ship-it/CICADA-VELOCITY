"""Unit tests for the SQLite Offline Buffer and Exponential Backoff."""

import os
import tempfile
import time
import unittest
import uuid

from collector.buffer import OfflineBuffer


class TestOfflineBuffer(unittest.TestCase):
    """Verifies SQLite offline persistence, retry queuing, and backoff calculations."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_buffer.db")
        self.buffer = OfflineBuffer(db_path=self.db_path)

        self.sample_payload = {
            "payload_id": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "device_id": str(uuid.uuid4()),
            "cpu_percent": 15.0,
        }

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_enqueue_and_count(self):
        """Verify enqueue stores record and increments pending count."""
        self.assertEqual(self.buffer.count_pending(), 0)
        success = self.buffer.enqueue(self.sample_payload)
        self.assertTrue(success)
        self.assertEqual(self.buffer.count_pending(), 1)

    def test_get_pending_and_mark_succeeded(self):
        """Verify retrieving pending items and removing upon success."""
        self.buffer.enqueue(self.sample_payload)
        pending = self.buffer.get_pending(limit=5)
        self.assertEqual(len(pending), 1)

        payload_id, data = pending[0]
        self.assertEqual(payload_id, self.sample_payload["payload_id"])
        self.assertEqual(data["cpu_percent"], 15.0)

        # Mark succeeded removes it from queue
        removed = self.buffer.mark_succeeded(payload_id)
        self.assertTrue(removed)
        self.assertEqual(self.buffer.count_pending(), 0)

    def test_mark_failed_exponential_backoff(self):
        """Verify failed attempts apply exponential backoff and delay next retry."""
        self.buffer.enqueue(self.sample_payload)
        payload_id = self.sample_payload["payload_id"]

        # First failure -> sets backoff
        self.buffer.mark_failed(payload_id)

        # Immediate check should now return 0 pending items (because next_retry_at is in the future)
        pending_immediate = self.buffer.get_pending(limit=5)
        self.assertEqual(len(pending_immediate), 0)

        # But total count remains 1
        self.assertEqual(self.buffer.count_pending(), 1)

    def test_idempotent_replace_on_duplicate_enqueue(self):
        """Enqueueing identical payload_id does not throw error or create duplicates."""
        self.buffer.enqueue(self.sample_payload)
        self.buffer.enqueue(self.sample_payload)
        self.assertEqual(self.buffer.count_pending(), 1)


if __name__ == "__main__":
    unittest.main()
