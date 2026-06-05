"""
api/parse_statement.py
Vercel Python serverless function — parses a bank statement PDF and returns
JSON transactions.

POST /api/parse_statement
  Body: multipart/form-data, field "file" = PDF bytes
  Response: application/json  [{date, description, amount, category, subcategory, isRefund, page}]
"""

import os
import sys
import json
import tempfile
from http.server import BaseHTTPRequestHandler

# Make the shared parser importable.
# Vercel bundles scripts/ via includeFiles; __file__ resolves relative to this file.
_scripts_dir = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts')
)
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)

from parse_statements import parse_pdf  # noqa: E402

# CORS headers sent on every response
_CORS_HEADERS: dict[str, str] = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def _parse_multipart(rfile, content_type: str, content_length: int) -> dict[str, list[bytes]]:
    """
    Parse a multipart/form-data body without the deprecated `cgi` module.

    Uses python-multipart (streaming, safe, used by FastAPI/Starlette).
    Returns a dict mapping field names → list of raw bytes values.
    """
    from multipart.multipart import parse_options_header, create_form_parser, QuerystringParser  # noqa: F401
    from multipart import multipart as mp

    # Extract the boundary from the Content-Type header
    _, params = parse_options_header(content_type.encode())
    boundary = params.get(b"boundary")
    if not boundary:
        raise ValueError("Missing multipart boundary")

    fields: dict[str, list[bytes]] = {}
    current_name: list[str] = [None]  # type: ignore[list-item]
    current_data: list[bytes] = []

    def on_field(field):
        name = field.field_name.decode() if isinstance(field.field_name, bytes) else field.field_name
        value = field.value if isinstance(field.value, bytes) else field.value.encode()
        fields.setdefault(name, []).append(value)

    def on_file(file):
        name = file.field_name.decode() if isinstance(file.field_name, bytes) else file.field_name
        file.file_object.seek(0)
        data = file.file_object.read()
        fields.setdefault(name, []).append(data)

    callbacks = {
        "on_field": on_field,
        "on_file": on_file,
    }

    body = rfile.read(content_length)
    parser = mp.create_form_parser(
        {"Content-Type": content_type.encode()},
        on_field,
        on_file,
        config={"MAX_SIZE": 20 * 1024 * 1024},  # 20 MB
    )
    parser.write(body)
    parser.finalize()

    return fields


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        """CORS preflight."""
        self.send_response(200)
        for k, v in _CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_POST(self):
        """Parse the uploaded PDF and return transactions as JSON."""
        try:
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                self._send_error(400, "Expected multipart/form-data")
                return

            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self._send_error(400, "Empty request body")
                return

            try:
                form = _parse_multipart(self.rfile, content_type, content_length)
            except ValueError as exc:
                self._send_error(400, str(exc))
                return

            pdf_list = form.get("file")
            if not pdf_list:
                self._send_error(400, "No 'file' field in form data")
                return

            pdf_bytes = pdf_list[0]

            # Write to a temp file and parse
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(pdf_bytes)
                tmp_path = tmp.name

            try:
                transactions = parse_pdf(tmp_path)
            finally:
                os.unlink(tmp_path)

            body = json.dumps(transactions, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            for k, v in _CORS_HEADERS.items():
                self.send_header(k, v)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        except Exception as exc:
            self._send_error(500, str(exc))

    def _send_error(self, code: int, message: str) -> None:
        body = json.dumps({"error": message}).encode("utf-8")
        self.send_response(code)
        for k, v in _CORS_HEADERS.items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):  # noqa: A002
        pass  # suppress default request logging
