"""Unit tests for the Redaction Engine."""

import unittest

from collector.redaction import contains_sensitive_data, redact_data, redact_text


class TestRedactionEngine(unittest.TestCase):
    """Verifies that no sensitive tokens, credentials, or personal identifiers survive."""

    def test_email_redaction(self):
        """Verifies email addresses are detected and sanitized."""
        text = "Contact support at admin@example.com or user.test+filter@sub.domain.org"
        sanitized = redact_text(text)
        self.assertNotIn("admin@example.com", sanitized)
        self.assertNotIn("user.test+filter@sub.domain.org", sanitized)
        self.assertIn("[REDACTED]", sanitized)

    def test_password_redaction(self):
        """Verifies password assignments and credentials in strings are sanitized."""
        text = "Config loaded with password='SuperSecretPassword123!' and token: 'my_access_secret'"
        sanitized = redact_text(text)
        self.assertNotIn("SuperSecretPassword123!", sanitized)
        self.assertNotIn("my_access_secret", sanitized)
        self.assertIn("[REDACTED]", sanitized)

    def test_api_key_redaction(self):
        """Verifies standard API keys (e.g. sk-..., sbp_...) are neutralized."""
        text = "Using OpenAI sk-1234567890abcdef1234567890 and Supabase sbp_abcdef1234567890abcdef12"
        sanitized = redact_text(text)
        self.assertNotIn("sk-1234567890abcdef1234567890", sanitized)
        self.assertNotIn("sbp_abcdef1234567890abcdef12", sanitized)
        self.assertIn("[REDACTED]", sanitized)

    def test_jwt_redaction(self):
        """Verifies full JWT tokens (header.payload.signature) are neutralized."""
        fake_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        text = f"Authorization header with Bearer {fake_jwt}"
        sanitized = redact_text(text)
        self.assertNotIn(fake_jwt, sanitized)
        self.assertIn("[REDACTED]", sanitized)

    def test_ipv4_and_ipv6_exclusion(self):
        """Verifies IPv4 and IPv6 addresses are redacted."""
        text = "Host connecting from 192.168.1.100 and public 203.0.113.195 or 2001:0db8:85a3:0000:0000:8a2e:0370:7334"
        sanitized = redact_text(text)
        self.assertNotIn("192.168.1.100", sanitized)
        self.assertNotIn("203.0.113.195", sanitized)
        self.assertNotIn("2001:0db8:85a3:0000:0000:8a2e:0370:7334", sanitized)
        self.assertIn("[REDACTED]", sanitized)

    def test_recursive_redact_data_structure(self):
        """Verifies nested dictionary and list data structures are recursively sanitized."""
        nested_data = {
            "metrics": {"cpu": 15.0},
            "unexpected_log": [
                "User john.doe@corp.com logged in",
                {"error": "Failed auth with password=Hunter2"},
            ],
            "api_config": {
                "key": "sk-secret123456789012345678"
            }
        }
        sanitized = redact_data(nested_data)

        self.assertEqual(sanitized["metrics"]["cpu"], 15.0)
        self.assertNotIn("john.doe@corp.com", str(sanitized))
        self.assertNotIn("Hunter2", str(sanitized))
        self.assertNotIn("sk-secret123456789012345678", str(sanitized))

    def test_contains_sensitive_data_check(self):
        """Verifies sensitive content detection helper."""
        self.assertTrue(contains_sensitive_data("my email is test@domain.com"))
        self.assertFalse(contains_sensitive_data("cpu_percent is 45.2"))


if __name__ == "__main__":
    unittest.main()
