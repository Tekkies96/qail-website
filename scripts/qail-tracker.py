#!/usr/bin/env python3
"""
QAIL Website Analysis Tracker
Polls Telegram bot for website analysis notifications and logs to CSV.
"""

import json
import os
import re
import time
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone

# Configuration
BOT_TOKEN = "8810717882:AAHQRFrAsbjHjTXuSplUouUlR-ARLqm99Hg"
BASE_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"
LOGS_DIR = os.path.expanduser("~/.openclaw/workspace/qail-website/logs")
CSV_FILE = os.path.join(LOGS_DIR, "analyzed-urls.csv")
STATE_FILE = os.path.join(LOGS_DIR, "last-update-id.json")
POLL_INTERVAL = 60
RETRY_DELAY = 120

# Ensure logs directory exists
os.makedirs(LOGS_DIR, exist_ok=True)

def get_json(url, data=None):
    """Make a JSON API request."""
    try:
        if data:
            req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode())
        else:
            req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"[ERROR] API request failed: {e}")
        return None

def get_updates(offset=None):
    """Get updates from Telegram bot."""
    params = {"timeout": 60}
    if offset:
        params["offset"] = offset
    return get_json(f"{BASE_URL}/getUpdates", params)

def send_message(chat_id, text):
    """Send a message via bot."""
    return get_json(f"{BASE_URL}/sendMessage", {"chat_id": chat_id, "text": text})

def load_state():
    """Load last processed update_id."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {"last_update_id": None, "processed_urls": []}

def save_state(state):
    """Save state to file."""
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f)

def append_to_csv(url, success, timestamp):
    """Append a URL entry to CSV."""
    try:
        file_exists = os.path.exists(CSV_FILE)
        with open(CSV_FILE, 'a') as f:
            if not file_exists:
                f.write("url,success,timestamp\n")
            # Escape URL in case of commas
            safe_url = url.replace(",", "%2C")
            f.write(f"{safe_url},{success},{timestamp}\n")
        print(f"[INFO] Appended: {url} ({success})")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to write CSV: {e}")
        return False

def parse_url(message_text):
    """Extract URL from message text."""
    # Pattern: *URL:* followed by the URL
    match = re.search(r'\*URL:\*\s*(https?://\S+)', message_text)
    if match:
        return match.group(1).rstrip('.,;:)')
    
    # Fallback: look for any http URL
    match = re.search(r'(https?://\S+)', message_text)
    if match:
        return match.group(1).rstrip('.,;:)')
    
    return None

def is_analysis_message(text):
    """Check if message is a QAIL analysis notification."""
    if not text:
        return False
    return "QAIL Analysis" in text or "🌐" in text

def main():
    """Main polling loop."""
    print("[INFO] QAIL Website Tracker starting...")
    print(f"[INFO] CSV file: {CSV_FILE}")
    print(f"[INFO] Polling every {POLL_INTERVAL} seconds")
    
    state = load_state()
    last_update_id = state.get("last_update_id")
    processed_urls = set(state.get("processed_urls", []))
    
    print(f"[INFO] Last update ID: {last_update_id}")
    print(f"[INFO] Processed URLs count: {len(processed_urls)}")
    
    consecutive_errors = 0
    
    while True:
        try:
            # Get updates
            params = {"timeout": 60}
            if last_update_id:
                params["offset"] = last_update_id + 1
            
            result = get_updates(params)
            
            if result is None:
                print(f"[WARN] API call failed, retrying in {RETRY_DELAY}s")
                consecutive_errors += 1
                time.sleep(RETRY_DELAY)
                continue
            
            if not result.get("ok"):
                print(f"[ERROR] Telegram API error: {result}")
                consecutive_errors += 1
                time.sleep(RETRY_DELAY)
                continue
            
            updates = result.get("result", [])
            
            if updates:
                print(f"[INFO] Received {len(updates)} update(s)")
            
            new_last_id = last_update_id
            
            for update in updates:
                update_id = update.get("update_id")
                message = update.get("message", {})
                text = message.get("text", "")
                
                new_last_id = update_id  # Track latest
                
                # Check if it's an analysis message
                if is_analysis_message(text):
                    print(f"[DEBUG] Analysis message found: {text[:100]}...")
                    
                    url = parse_url(text)
                    timestamp = datetime.now(timezone.utc).isoformat()
                    
                    if url:
                        # Create unique key for deduplication
                        url_key = f"{url}|{timestamp[:13]}"  # Use hour granularity for dedup
                        
                        if url not in processed_urls:
                            success = 1  # Assuming if we received it, it was successful
                            if append_to_csv(url, success, timestamp):
                                processed_urls.add(url)
                                # Keep processed_urls bounded
                                if len(processed_urls) > 10000:
                                    processed_urls = set(list(processed_urls)[-5000:])
                        else:
                            print(f"[DEBUG] Already processed: {url}")
                    else:
                        print(f"[WARN] Could not parse URL from: {text[:100]}")
                
                last_update_id = update_id
            
            # Save state after each poll cycle
            save_state({
                "last_update_id": last_update_id,
                "processed_urls": list(processed_urls)
            })
            
            consecutive_errors = 0
            time.sleep(POLL_INTERVAL)
            
        except KeyboardInterrupt:
            print("\n[INFO] Shutting down...")
            break
        except Exception as e:
            print(f"[ERROR] Unexpected error: {e}")
            consecutive_errors += 1
            time.sleep(RETRY_DELAY if consecutive_errors > 3 else 5)

if __name__ == "__main__":
    main()