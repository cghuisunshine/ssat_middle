"""Offline regression checks for unavailable and malformed download sources."""

import hashlib
from io import BytesIO
from pathlib import Path
import ssl
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

import download_ssat_reading as downloader


PDF = b"%PDF-1.6\nexample\n%%EOF\n"


def response(data=PDF, url="https://example.com/test.pdf", length=None):
    stream = BytesIO(data)
    stream.url = url
    stream.headers = {"Content-Length": str(len(data) if length is None else length)}
    return stream


class DownloadTests(unittest.TestCase):
    def test_tls_failure_uses_archive_and_records_provenance(self):
        item = downloader.ITEMS[0]
        archive = downloader.FALLBACK_URLS[item[0]][0]
        failure = URLError(ssl.SSLError("TLSV1_UNRECOGNIZED_NAME"))
        with TemporaryDirectory() as directory, patch.object(
            downloader, "urlopen", side_effect=[failure, response(url=archive)]
        ):
            result = downloader.fetch_item(item, Path(directory), 5)
            self.assertEqual(result["status"], "saved")
            self.assertEqual((Path(directory) / item[0]).read_bytes(), PDF)
            self.assertEqual(result["source"], item[2])
            self.assertEqual(result["resolved_url"], archive)
            self.assertTrue(result["archived"])
            self.assertTrue(result["fallback_used"])
            self.assertIn("TLSV1_UNRECOGNIZED_NAME", result["attempts"][0]["error"])
            self.assertEqual(result["sha256"], hashlib.sha256(PDF).hexdigest())

    def test_parking_page_is_rejected_before_using_fallback(self):
        item = downloader.ITEMS[3]
        cdn = downloader.FALLBACK_URLS[item[0]][0]
        with TemporaryDirectory() as directory, patch.object(
            downloader, "urlopen", side_effect=[
                response(b"<html>Parked domain</html>"), response(url=cdn),
            ]
        ):
            result = downloader.fetch_item(item, Path(directory), 5)
            self.assertEqual(result["status"], "saved")
            self.assertTrue(result["fallback_used"])
            self.assertFalse(result["archived"])
            self.assertEqual(result["attempts"][0]["error"], "Server did not return a PDF")

    def test_failed_download_preserves_existing_file_and_cleans_partial(self):
        item = downloader.ITEMS[0]
        with TemporaryDirectory() as directory, patch.object(
            downloader, "urlopen", side_effect=URLError("unavailable")
        ):
            target = Path(directory) / item[0]
            target.write_bytes(PDF)
            partial = target.with_suffix(".pdf.part")
            partial.write_bytes(b"partial")
            result = downloader.fetch_item(item, Path(directory), 5)
            self.assertEqual(result["status"], "failed")
            self.assertEqual(len(result["attempts"]), 2)
            self.assertEqual(target.read_bytes(), PDF)
            self.assertFalse(partial.exists())

    def test_truncated_pdf_and_short_response_are_rejected(self):
        for downloaded, message in [
            (response(b"%PDF-1.6\ntruncated"), "missing end-of-file"),
            (response(length=len(PDF) + 1), "Content-Length mismatch"),
            (response(url="http://example.com/test.pdf"), "unencrypted"),
        ]:
            with self.subTest(message=message), patch.object(
                downloader, "urlopen", return_value=downloaded
            ), self.assertRaisesRegex(ValueError, message):
                downloader.read_download("https://example.com/test.pdf", "test.pdf", 5)

    def test_archive_rate_limit_uses_curl_and_validates_its_payload(self):
        archive = downloader.FALLBACK_URLS[downloader.ITEMS[0][0]][0]
        for data, succeeds in [(PDF, True), (b"<html>Rate limit</html>", False)]:
            with self.subTest(succeeds=succeeds), patch.object(
                downloader, "urlopen", side_effect=HTTPError(archive, 429, "limit", {}, None)
            ), patch.object(downloader.shutil, "which", return_value="/usr/bin/curl"), patch.object(
                downloader, "read_with_curl", return_value=(data, archive)
            ) as curl:
                if succeeds:
                    self.assertEqual(downloader.read_download(archive, "test.pdf", 5), (PDF, archive))
                else:
                    with self.assertRaisesRegex(ValueError, "did not return a PDF"):
                        downloader.read_download(archive, "test.pdf", 5)
                curl.assert_called_once_with(archive, 5)


if __name__ == "__main__":
    unittest.main()
