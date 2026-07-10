"""
api/ping.py
Vercel Python serverless function — pings the Supabase database to keep it warm.
Scheduled via Vercel Cron.
"""

import os
import json
import urllib.request
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        supabase_url = os.environ.get("VITE_SUPABASE_URL")
        supabase_key = os.environ.get("VITE_SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "error",
                "message": "Missing environment variables VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY"
            }).encode('utf-8'))
            return

        try:
            # Query a public table (expenses) with limit 1, which works with the anon key.
            # This generates actual database query activity to prevent pausing.
            url = supabase_url.rstrip('/') + "/rest/v1/expenses?limit=1"
            
            # Formulate the request
            req = urllib.request.Request(
                url,
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}"
                }
            )
            
            # Trigger the request
            with urllib.request.urlopen(req, timeout=15) as response:
                status_code = response.getcode()
                response.read() # Consume response

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "success",
                "message": "Supabase kept warm successfully!",
                "response_code": status_code
            }).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "error",
                "message": f"Failed to ping Supabase: {str(e)}"
            }).encode('utf-8'))
