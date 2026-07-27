"""
api/auth_me.py
Vercel Python serverless function for resolving Cloudflare Access Google OAuth identity.
Checks Cloudflare Access HTTP headers:
- Cf-Access-Authenticated-User-Email
- Cf-Access-Jwt-Assertion
"""

import os
import json
import uuid
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        origin = self.headers.get('Origin') or '*'
        self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Access-Control-Allow-Credentials', 'true')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Cf-Access-Jwt-Assertion, Cf-Access-Authenticated-User-Email')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        # 1. Read Cloudflare Access headers forwarded by Cloudflare Zero Trust
        cf_email = self.headers.get('Cf-Access-Authenticated-User-Email') or self.headers.get('cf-access-authenticated-user-email')
        cf_jwt = self.headers.get('Cf-Access-Jwt-Assertion') or self.headers.get('cf-access-jwt-assertion')

        # Fallback for local development or direct access without Cloudflare proxy
        if not cf_email:
            dev_email = os.environ.get("VITE_DEV_USER_EMAIL", "dev@arushpamoli.com")
            cf_email = dev_email

        # Derive a stable deterministic UUID from email address namespace
        user_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, cf_email))

        user_info = {
            "authenticated": True,
            "email": cf_email,
            "user": {
                "id": user_uuid,
                "email": cf_email,
                "name": cf_email.split('@')[0].capitalize(),
                "role": "authenticated"
            },
            "cf_jwt_present": bool(cf_jwt)
        }

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(user_info).encode('utf-8'))
