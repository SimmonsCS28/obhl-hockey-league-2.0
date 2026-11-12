import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('recap', Path(__file__).parents[2] / 'skills/obhl-season-recap/scripts/publish_recap.py')
recap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recap)

class GenerateRecapTest(unittest.TestCase):
    def test_requires_valid_origin_and_id(self):
        for value in ('0', '-1', '1;echo bad', '1/recap', '1.5', '9223372036854775808'):
            with self.assertRaises(recap.GenerationError): recap.season_id(value)
        for url in ('http://example.com', 'https://user:pass@example.com', 'https://example.com/api', 'https://example.com?token=secret'):
            with self.assertRaises(recap.GenerationError): recap.site_url(url)
        self.assertEqual(12, recap.season_id('12'))
        self.assertEqual('http://127.0.0.1:8005',recap.site_url('http://127.0.0.1:8005',True))
    @patch.object(recap, 'api')
    def test_login_publish_and_public_verification(self, api):
        saved={'seasonId':12,'generatedAt':'2026-11-12T15:00:00Z','totalGoals':37}
        api.side_effect=[{'token':'test-session'},saved,saved]
        self.assertEqual(saved,recap.generate('https://example.com',12,'admin','secret'))
        self.assertEqual(api.call_args_list[1].kwargs, {'token':'test-session'})
        self.assertEqual(api.call_args_list[2].kwargs, {})
    @patch.object(recap, 'api')
    def test_initial_password_setup_never_publishes(self, api):
        api.return_value={'token':'test-session','mustChangePassword':True}
        with self.assertRaises(recap.GenerationError): recap.generate('https://example.com',12,'admin','secret')
        self.assertEqual(1,api.call_count)
    @patch.object(recap, 'api')
    def test_failed_public_verification_is_not_success(self, api):
        api.side_effect=[{'token':'test-session'},{'seasonId':12,'generatedAt':'2026-11-12T15:00:00Z'},{}]
        with self.assertRaises(recap.GenerationError): recap.generate('https://example.com',12,'admin','secret')
    @patch.object(recap, 'api')
    def test_missing_credentials_do_not_make_requests(self, api):
        with self.assertRaises(recap.GenerationError): recap.generate('https://example.com',12,None,None)
        api.assert_not_called()
    @patch.object(recap, 'api')
    def test_invalid_timestamp_is_rejected(self, api):
        api.side_effect=[{'token':'test-session'},{'seasonId':12,'generatedAt':'invalid\n::notice::text'}]
        with self.assertRaises(recap.GenerationError): recap.generate('https://example.com',12,'admin','secret')

if __name__ == '__main__': unittest.main()
