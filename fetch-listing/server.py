#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import asyncio
from playwright.sync_api import sync_playwright

PORT = 5052

def fetch_and_analyze(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1400, 'height': 1000})
        
        print(f'Opening: {url}')
        page.goto(url, wait_until='domcontentloaded', timeout=60000)
        page.wait_for_timeout(3000)
        
        # Dismiss cookie banner
        try:
            btn = page.locator('button:has-text("Accept")').first
            if btn.is_visible(timeout=2000):
                btn.click()
                page.wait_for_timeout(1000)
        except:
            pass
        
        # Scroll to load all content
        for s in range(1, 7):
            page.evaluate(f'window.scrollTo(0, {s * 1000})')
            page.wait_for_timeout(2000)
        
        # Take screenshot
        screenshot_path = f'/tmp/listing-{hash(url)}.png'
        page.screenshot(path=screenshot_path, full_page=True)
        print(f'Screenshot saved: {screenshot_path}')
        
        browser.close()
        
        return {'success': True, 'screenshot': screenshot_path}

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        
        try:
            data = json.loads(body)
            url = data.get('url', '')
            
            if not url:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'URL is required'}).encode())
                return
            
            # Only allow Airbnb, Lekkeslaap, Booking.com
            allowed = ['airbnb.com', 'airbnb.co.uk', 'lekkeslaap.co.za', 'booking.com']
            if not any(d in url for d in allowed):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Only Airbnb, Lekkeslaap, and Booking.com URLs are supported'}).encode())
                return
            
            result = fetch_and_analyze(url)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            print(f'Error: {e}')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def log_message(self, format, *args):
        print(f'{self.address_string()} - {format % args}')

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    print(f'Fetch listing server running on port {PORT}')
    server.serve_forever()
