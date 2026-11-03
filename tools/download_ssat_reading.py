#!/usr/bin/env python3
"""Download the public SSAT Middle reading resources found in this session.

Uses Python's standard library and, if available, system curl for archive
rate-limit responses. Run from any directory; no account is used.
Downloaded publisher files stay outside Git through /reading_materials/.
Unavailable publisher URLs have explicit HTTPS CDN/Wayback fallbacks; the
index and JSON report identify the copy downloaded. TLS verification stays on.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from html import escape
import json
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
from urllib.error import HTTPError
from urllib.request import Request, urlopen


IVY = "https://downloads.ivyglobal.com/ssat/"
ITEMS = [
    ("ivy_middle_reading.pdf", "Ivy Global: Middle Level reading, 40 questions",
     IVY + "middle_test_1/ssat_middle_level_test_reading_section.pdf"),
    ("ivy_middle_answers.pdf", "Ivy Global: separate answer key",
     IVY + "middle_test_1/ssat_middle_level_test_answers.pdf"),
    ("ivy_middle_full_test.pdf", "Ivy Global: full test with answers (overlaps reading PDF)",
     IVY + "middle_test_1/SSAT%20Middle%20Level%20Test%201%20v%201.6.pdf"),
    ("princeton_middle_full_test.pdf", "Princeton Review: full Middle Level practice test",
     "https://content.randomhouse.com/assets/9780804126403/pdfs/Middle%20Level%20SSAT%20Practice%20Test.pdf"),
    ("test_ninjas_middle_full_test.pdf", "Test Ninjas: full Middle Level test; detailed key needs account",
     "https://test-ninjas.com/free/ssat/test-ninjas-ssat-middle-level-practice-test-1.pdf"),
    ("ivy_reading_strategies.pdf", "Ivy Global: reading strategies, supplementary guide",
     IVY + "segments/English_Critical_Reading_Strategies.pdf"),
    ("gotestprep_middle_reading.html", "GoTestPrep: 22 Middle Level questions; webpage snapshot",
     "https://gotestprep.com/ssat-reading-comprehension-practice-test/"),
    ("gotestprep_mixed_reading.html", "GoTestPrep: 22 Middle/Upper questions; webpage snapshot",
     "https://gotestprep.com/ssat-reading-comprehension-practice-pdf/"),
    ("prep4ssat_reading_download_page.html", "Prep4SSAT: download listing only; seven sets require website buttons",
     "https://www.prep4ssat.com/resource/ssat-test-middle-level/practice/reading/1"),
]

# These are copies of the same files, not substitute practice materials.
# Pin successful captures: newer captures can be archived 404s or parking pages.
# Princeton's official ebook page supplies this publisher-owned CDN URL:
# https://content.randomhouse.com/assets/9780525569794/view.php?id=9780525569794a003
# The older edition uses the same CDN with its original asset path below.
FALLBACK_URLS = {
    "ivy_middle_reading.pdf": (
        "https://web.archive.org/web/20250504215716id_/" + ITEMS[0][2],
    ),
    "ivy_middle_answers.pdf": (
        "https://web.archive.org/web/20240821020633id_/" + ITEMS[1][2],
    ),
    "ivy_middle_full_test.pdf": (
        "https://web.archive.org/web/20191113103643id_/" + ITEMS[2][2],
    ),
    "princeton_middle_full_test.pdf": (
        "https://d10tqtvpzsk3q2.cloudfront.net/assets/9780804126403/pdfs/"
        "Middle%20Level%20SSAT%20Practice%20Test.pdf",
    ),
    "ivy_reading_strategies.pdf": (
        "https://web.archive.org/web/20230627012737id_/" + ITEMS[5][2],
    ),
}
MAX_BYTES = 100 * 1024 * 1024


def read_with_curl(url, timeout):
    """Retry archive rate limits with system curl, retaining TLS verification."""
    with TemporaryDirectory(prefix="ssat-download-") as directory:
        target = Path(directory) / "response"
        process = subprocess.run(
            ["curl", "--fail", "--location", "--silent", "--show-error",
             "--proto", "=https", "--proto-redir", "=https",
             "--max-time", str(timeout), "--max-filesize", str(MAX_BYTES),
             "--output", str(target), "--write-out", "%{url_effective}", url],
            capture_output=True, text=True, timeout=timeout + 5,
        )
        if process.returncode:
            raise ValueError("curl download failed: " + process.stderr.strip())
        with target.open("rb") as downloaded:
            data = downloaded.read(MAX_BYTES + 1)
        return data, process.stdout.strip()


def read_download(url, filename, timeout):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    expected = None
    try:
        with urlopen(request, timeout=timeout) as response:
            resolved_url = response.url
            data = response.read(MAX_BYTES + 1)
            expected = response.headers.get("Content-Length")
    except HTTPError as error:
        if (error.code != 429 or not url.startswith("https://web.archive.org/")
                or not shutil.which("curl")):
            raise
        error.close()
        data, resolved_url = read_with_curl(url, timeout)
    if not resolved_url.startswith("https://"):
        raise ValueError("Refusing a redirect to an unencrypted URL")
    if len(data) > MAX_BYTES:
        raise ValueError("Response exceeds 100 MiB limit")
    if expected is not None and len(data) != int(expected):
        raise ValueError("Incomplete response (Content-Length mismatch)")
    if filename.endswith(".pdf"):
        if b"%PDF-" not in data[:1024]:
            raise ValueError("Server did not return a PDF")
        if b"%%EOF" not in data[-1024:]:
            raise ValueError("Incomplete PDF (missing end-of-file marker)")
    if filename.endswith(".html") and b"<html" not in data[:8192].lower():
        raise ValueError("Server did not return an HTML page")
    return data, resolved_url


def fetch_item(item, destination, timeout):
    filename, title, url = item
    target = destination / filename
    result = {"file": filename, "title": title, "source": url, "attempts": []}
    temporary = target.with_suffix(target.suffix + ".part")
    try:
        for candidate in (url, *FALLBACK_URLS.get(filename, ())):
            try:
                data, resolved_url = read_download(candidate, filename, timeout)
            except Exception as error:
                result["attempts"].append({"url": candidate, "error": str(error)})
                continue
            result["attempts"].append({"url": candidate, "status": "downloaded"})
            result.update(download_url=candidate, resolved_url=resolved_url,
                          fallback_used=candidate != url,
                          archived=resolved_url.startswith("https://web.archive.org/"))
            break
        else:
            raise ValueError("All download sources failed: " + " | ".join(
                attempt["error"] for attempt in result["attempts"]))
        temporary.write_bytes(data)
        temporary.replace(target)
        result.update(status="saved", bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
    except Exception as error:
        temporary.unlink(missing_ok=True)
        result.update(status="failed", error=str(error))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path,
                        default=Path(__file__).resolve().parents[1] / "reading_materials")
    parser.add_argument("--timeout", type=float, default=45)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(lambda item: fetch_item(item, args.output, args.timeout), ITEMS))
    report = {"checked_at": datetime.now(timezone.utc).isoformat(), "items": results}
    (args.output / "download_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    rows = []
    for result in results:
        saved = result["status"] == "saved"
        label = escape(result["title"])
        material = f'<a href="{escape(result["file"])}">{label}</a>' if saved else label
        detail = "saved" if saved else "failed: " + escape(result["error"])
        if saved and result["fallback_used"]:
            copy = "archived copy" if result["archived"] else "publisher CDN copy"
            detail += f' (<a href="{escape(result["resolved_url"])}">{copy}</a>)'
        rows.append(f'<tr><td>{material}</td><td>{detail}</td>'
                    f'<td><a href="{escape(result["source"])}">Source</a></td></tr>')
        print(f'{result["status"].upper()}: {result["file"]}'
              + (" — " + result["error"] if not saved else
                 " — archived copy" if result["archived"] else
                 " — publisher CDN copy" if result["fallback_used"] else ""))
    html = ('<!doctype html><html lang="en"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>SSAT Middle reading downloads</title>'
            '<style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:16px}'
            'table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:12px;text-align:left}'
            'a{color:#1452a3}</style><h1>SSAT Middle reading resources</h1>'
            '<p>Unofficial practice materials. Full tests include non-reading sections. '
            'The separate Ivy reading PDF overlaps its full test.</p>'
            '<p>If a publisher URL is unavailable, a publisher CDN or pinned Internet Archive '
            'copy is tried over HTTPS. The links below identify downloaded fallback copies.</p>'
            '<p>HTML files are webpage snapshots, not PDF worksheets; images and scripts may require internet. '
            'The Prep4SSAT snapshot is only a listing: use the source page to download its seven sets. '
            'Account-only explanations are not downloaded. This collection is not exhaustive.</p>'
            '<table><tr><th>Material</th><th>This run</th><th>Original</th></tr>'
            + ''.join(rows) + '</table></html>')
    (args.output / "index.html").write_text(html, encoding="utf-8")
    saved = sum(result["status"] == "saved" for result in results)
    print(f"\nSaved {saved}/{len(results)} resources to {args.output}")
    print(f"Index: {args.output / 'index.html'}")
    return 0 if saved == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
