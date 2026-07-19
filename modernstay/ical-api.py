#!/usr/bin/env python3
"""
iCal to JSON API for ModernStay Airbnb calendar
Serves parsed iCal data as JSON for the website widget.
"""
import subprocess
import json
from datetime import datetime, date
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import time
import urllib.request

ICAL_URL = "https://www.airbnb.co.za/calendar/ical/1266811295906668461.ics?t=c28eee71ddef4016a2c59e17565e64bb"
CACHE_FILE = "/tmp/modernstay_ical_cache.json"
CACHE_TTL = 600  # 10 minutes
PORT = 5051

def fetch_and_parse_ical():
    """Fetch iCal from Airbnb and parse into structured JSON."""
    try:
        req = urllib.request.Request(ICAL_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response:
            ical_text = response.read().decode('utf-8')
    except Exception as e:
        print(f"Failed to fetch iCal: {e}")
        return None

    events = []
    current_event = {}

    for line in ical_text.split('\n'):
        line = line.strip()
        if line.startswith('DTSTART'):
            key, val = line.split(':', 1)
            current_event['start'] = val.strip()
        elif line.startswith('DTEND'):
            key, val = line.split(':', 1)
            current_event['end'] = val.strip()
        elif line.startswith('SUMMARY'):
            current_event['summary'] = line.split(':', 1)[1].strip()
        elif line == 'END:VEVENT':
            if current_event.get('start'):
                events.append(current_event)
            current_event = {}
        elif line.startswith('BEGIN:VEVENT'):
            current_event = {}

    # Build blocked dates set (dates that are booked)
    blocked = []
    today = date.today()
    end_range = date(today.year + 1, 12, 31)

    for ev in events:
        try:
            start_str = ev.get('start', '')[:8]
            end_str = ev.get('end', '')[:8]
            if len(start_str) == 8:
                d_start = datetime.strptime(start_str, '%Y%m%d').date()
            else:
                continue
            if len(end_str) == 8:
                d_end = datetime.strptime(end_str, '%Y%m%d').date()
            else:
                d_end = d_start
            # Add all dates in range
            current = d_start
            while current < d_end:
                if today <= current <= end_range:
                    blocked.append(current.isoformat())
                current = (datetime(current.year, current.month, current.day + 1) if current.day < 28 else
                           date(current.year if current.month < 12 else current.year + 1,
                                current.month + 1 if current.month < 12 else 1,
                                1))
        except Exception:
            continue

    return {
        'updated': datetime.now().isoformat(),
        'blocked_dates': sorted(set(blocked)),
        'total_blocked': len(set(blocked))
    }

def get_cached():
    """Return cached data if fresh."""
    try:
        with open(CACHE_FILE) as f:
            data = json.load(f)
        updated = datetime.fromisoformat(data['updated'])
        if (datetime.now() - updated).total_seconds() < CACHE_TTL:
            return data
    except Exception:
        pass
    return None

def save_cache(data):
    """Save parsed data to cache."""
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(data, f)
    except Exception:
        pass

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/calendar.json':
            data = get_cached()
            if data is None:
                data = fetch_and_parse_ical()
                if data:
                    save_cache(data)
            
            if data:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())
            else:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b'{"error": "Failed to fetch calendar"}')
        elif self.path == '/health':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'OK')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        print(f"[{args[0]}]")

if __name__ == '__main__':
    # Pre-fetch
    data = fetch_and_parse_ical()
    if data:
        save_cache(data)
        print(f"Pre-fetched {data['total_blocked']} blocked dates")
    else:
        print("Warning: initial fetch failed, will retry on request")
    
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    print(f"Serving on port {PORT}")
    server.serve_forever()
