"""Embed the shared profile UI without adding runtime file dependencies."""
from pathlib import Path
import re

TOOLS = Path(__file__).resolve().parent


def embed_profiles(html):
    html = re.sub(r'\n?<!-- BEGIN student-profiles -->.*?<!-- END student-profiles -->', '', html, flags=re.S)
    assets = ('<!-- BEGIN student-profiles -->\n<style id="student-profile-styles">' +
              (TOOLS / 'student-store.css').read_text() + '</style>\n' +
              '<script id="student-profile-script">' + (TOOLS / 'student-store.js').read_text() +
              '</script>\n<!-- END student-profiles -->\n')
    # Run before the application reads its saved state. The UI mounts after parse.
    marker = html.find('<script')
    if marker < 0:
        marker = html.index('</body>')
    return html[:marker] + assets + html[marker:]
