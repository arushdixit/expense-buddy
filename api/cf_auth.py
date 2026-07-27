"""
api/cf_auth.py
Vercel Serverless Function bridging Cloudflare Access Google OAuth with Supabase Auth.
Reads Cf-Access-Authenticated-User-Email header and generates a Supabase Auth session/magic link.
"""

import os
import json
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 1. Extract Cloudflare Access email header
        cf_email = self.headers.get('Cf-Access-Authenticated-User-Email') or self.headers.get('cf-access-authenticated-user-email')

        # Fallback for local development or direct testing
        if not cf_email:
            cf_email = os.environ.get("VITE_DEV_USER_EMAIL", "dixit.arush@gmail.com")

        cf_email = cf_email.strip().lower()

        supabase_url = os.environ.get("VITE_SUPABASE_URL", "https://zdbrjfxxynvywfdrsnjr.supabase.co").rstrip('/')
        service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

        # Determine target origin for redirect
        referer = self.headers.get('Referer') or ''
        if 'expenses.arushpamoli.com' in referer:
            redirect_target = "https://expenses.arushpamoli.com"
        elif 'arushpamoli.com' in referer:
            redirect_target = "https://arushpamoli.com"
        else:
            redirect_target = os.environ.get("APP_URL", "https://expenses.arushpamoli.com").rstrip('/')

        try:
            # 2. Call Supabase Auth Admin API to generate magic link
            admin_url = f"{supabase_url}/auth/v1/admin/generate_link"
            payload = json.dumps({
                "type": "magiclink",
                "email": cf_email,
                "options": {
                    "redirectTo": redirect_target
                }
            }).encode('utf-8')

            req = urllib.request.Request(
                admin_url,
                data=payload,
                headers={
                    "apikey": service_role_key,
                    "Authorization": f"Bearer {service_role_key}",
                    "Content-Type": "application/json"
                }
            )

            with urllib.request.urlopen(req, timeout=10) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                action_link = res_data.get("action_link")

            if action_link:
                # Redirect browser to action link (signs user into Supabase Auth & redirects to app)
                self.send_response(302)
                self.send_header("Location", action_link)
                self.end_headers()
                return

        except Exception as e:
            print(f"[cf_auth] Error generating magic link: {e}")

        # Fallback: Redirect back to app main page
        self.send_response(302)
        self.send_header("Location", f"{redirect_target}/")
        self.end_headers()
