"""
Real-time Predictive Maintenance Backend
Connects Firebase Realtime Database with ML model

Architecture:
1. Listen to /sensor/batchAcceleration for ESP32 batch uploads
2. Build sliding window buffer (50 samples)
3. Extract features from window
4. Run RandomForest classifier
5. Publish results to /sensor/status for frontend
"""

import os
import time
import joblib
import numpy as np
import asyncio
import websockets
import json
from firebase_admin import credentials, initialize_app, db
from collections import deque
from concurrent.futures import ThreadPoolExecutor

# ================= CONFIG =================
WINDOW_SIZE = 10         # Smaller window for smoother updates
STABILITY_THRESHOLD = 3  # Consecutive BAD predictions before declaring BAD
CONFIDENCE_THRESHOLD = 0.7
POLL_INTERVAL = 1.0      # seconds
WS_PORT = int(os.environ.get("PORT", 8765))
# =========================================

print("[*] Starting Predictive Maintenance Backend...")

# Initialize Firebase Admin SDK
try:
    if os.path.exists("firebase_key.json"):
        cred = credentials.Certificate("firebase_key.json")
    else:
        # Load from environment variables (Render/Cloud)
        print("[*] Loading credentials from environment...")
        firebase_config = {
            "type": os.environ.get("FIREBASE_TYPE"),
            "project_id": os.environ.get("FIREBASE_PROJECT_ID"),
            "private_key_id": os.environ.get("FIREBASE_PRIVATE_KEY_ID"),
            "private_key": os.environ.get("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n"),
            "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL"),
            "client_id": os.environ.get("FIREBASE_CLIENT_ID"),
            "auth_uri": os.environ.get("FIREBASE_AUTH_URI"),
            "token_uri": os.environ.get("FIREBASE_TOKEN_URI"),
            "auth_provider_x509_cert_url": os.environ.get("FIREBASE_AUTH_PROVIDER_CERT_URL"),
            "client_x509_cert_url": os.environ.get("FIREBASE_CLIENT_CERT_URL")
        }
        cred = credentials.Certificate(firebase_config)

    initialize_app(cred, {
        "databaseURL": "https://cloud-esp32-567c6-default-rtdb.asia-southeast1.firebasedatabase.app/"
    })
    print("[+] Connected to Firebase")
except Exception as e:
    print(f"[-] Firebase initialization failed: {e}")
    # print("Make sure 'firebase_key.json' exists or env vars are set")
    # exit(1)

# Load trained model
try:
    model = joblib.load("pdm_binary.pkl")
    print("[+] Loaded ML model (pdm_binary.pkl)")
except Exception as e:
    print(f"[-] Model loading failed: {e}")
    print("Run 'python class_train.py' first to create the model")
    exit(1)

# Buffer for sliding window
buffer = deque(maxlen=WINDOW_SIZE)
clients = set()

def extract_features(data_points):
    """
    Extract features matching the training process
    data_points: list of (x, y, z) tuples
    """
    x = np.array([p[0] for p in data_points])
    y = np.array([p[1] for p in data_points])
    z = np.array([p[2] for p in data_points])
    
    mag = np.sqrt(x**2 + y**2 + z**2)
    
    # Features must match class_train.py exactly
    return [[
        x.mean(), y.mean(), z.mean(),           # Mean values
        x.std(), y.std(), z.std(),              # Standard deviation
        np.sqrt((x**2).mean()),                 # RMS X
        np.sqrt((y**2).mean()),                 # RMS Y
        np.sqrt((z**2).mean()),                 # RMS Z
        mag.mean(),                             # Magnitude mean
        mag.max(),                              # Magnitude max
        mag.min(),                              # Magnitude min
        np.ptp(mag)                             # Peak-to-peak
    ]]

async def broadcast_status(state, prob_bad, timestamp=None):
    """Broadcast classification result to WebSockets"""
    if not clients:
        return
        
    data = json.dumps({
        "state": state,
        "prob_bad": prob_bad,
        "updated_at": int(time.time() * 1000),  # Server time
        "data_timestamp": timestamp             # Sensor time (sync key)
    })
    
    await asyncio.gather(*[client.send(data) for client in clients], return_exceptions=True)
    print(f"[>] Broadcast: {state} ({prob_bad*100:.1f}%) to {len(clients)} clients")

async def handler(websocket):
    clients.add(websocket)
    print(f"[+] Client connected from {websocket.remote_address}")
    try:
        await websocket.wait_closed()
    finally:
        clients.remove(websocket)
        print(f"[-] Client disconnected")

def get_firebase_batches():
    """Blocking call to get data from Firebase"""
    return db.reference("/sensor/batchAcceleration").get()

import http

async def health_check(path, request_headers):
    if path == "/health":
        return http.HTTPStatus.OK, [], b"OK\n"
    return None

async def main():
    print(f"[*] Starting WebSocket server on port {WS_PORT}...")
    async with websockets.serve(handler, "0.0.0.0", WS_PORT, process_request=health_check):
        print(f"[+] WebSocket server running")
        print(f"[*] Starting True Real-Time monitoring loop...\n")

        # --- 1. Startup: Jump to the Present ---
        # Get the very last batch key currently in DB.
        # We will ONLY process data that comes AFTER this key.
        print("[*] Syncing with stream head...")
        last_key = None
        try:
            initial_snap = db.reference("/sensor/batchAcceleration").order_by_key().limit_to_last(1).get()
            if initial_snap:
                last_key = list(initial_snap.keys())[0]
                print(f"[+] Synced. Ignoring history before key: {last_key}")
            else:
                print("[!] Database empty. Waiting for first batch...")
        except Exception as e:
            print(f"[!] Init Error: {e}")

        # ---------------------------------------

        total_processed_count = 0
        loop = asyncio.get_running_loop()
        executor = ThreadPoolExecutor(max_workers=1)

        while True:
            try:
                # --- 2. Forward-Only Query ---
                # Fetch only batches NEWER than our last seen key
                query = db.reference("/sensor/batchAcceleration").order_by_key()
                
                if last_key:
                    query = query.start_after(last_key)
                
                # Limit to 10 to keep it somewhat real-time if a burst comes in
                query = query.limit_to_first(10)
                
                # Run blocking Firebase call
                batches = await loop.run_in_executor(executor, query.get)
                
                if not batches:
                    # No new data yet
                    await asyncio.sleep(0.1)  # Fast poll for responsiveness
                    continue
                
                # -----------------------------
                
                # Sort keys to ensure chronological order
                batch_keys = sorted(batches.keys())
                
                for key in batch_keys:
                    batch_data = batches[key]
                    print(f"[*] Processing NEW batch {key} ({len(batch_data)} samples)")
                    
                    # Add all batch data to buffer
                    batch_max_prob = 0.0
                    
                    for item in batch_data:
                        buffer.append((item["X"], item["Y"], item["Z"]))
                    
                        # Process with sliding window every time we add a sample
                        if len(buffer) >= WINDOW_SIZE:
                            # Extract features from current window
                            features = extract_features(list(buffer))
                            
                            # Get model prediction
                            prob = model.predict_proba(features)[0]
                            prob_bad = prob[1]
                            
                            # Track peak probability in this batch
                            if prob_bad > batch_max_prob:
                                batch_max_prob = prob_bad
                    
                    # End of batch processing
                    state = "BAD" if batch_max_prob > CONFIDENCE_THRESHOLD else "GOOD"
                    last_timestamp = batch_data[-1].get("timestamp", int(time.time()*1000))
        
                    # Broadcast immediately via WebSocket
                    await broadcast_status(state, batch_max_prob, last_timestamp)

                    # --- Sync to Firebase (For Frontend Persistence) ---
                    # Update status for every batch since we are now true real-time
                    # (No catch-up speed concern anymore)
                    try:
                        status_data = {
                            "state": state,
                            "prob_bad": batch_max_prob,
                            "updated_at": int(time.time() * 1000),
                            "data_timestamp": last_timestamp
                        }
                        await loop.run_in_executor(executor, lambda: db.reference("/sensor/status").set(status_data))
                    except Exception as e:
                        print(f"[!] Firebase Status Sync Failed: {e}")
                    # ---------------------------------------------------
                        
                    # Update last_key to this one, so next loop starts after this
                    last_key = key
                    total_processed_count += 1

                    # --- Auto-Cleanup Trigger (Every 50 batches) ---
                    if total_processed_count % 50 == 0:
                        print(f"[*] Cleanup Triggered: Removing oldest 50 batches...")
                        try:
                            # Get oldest 50 keys (from the very beginning of DB)
                            oldest_batches = db.reference("/sensor/batchAcceleration").order_by_key().limit_to_first(50).get()
                            if oldest_batches:
                                updates = {k: None for k in oldest_batches.keys()}
                                db.reference("/sensor/batchAcceleration").update(updates)
                                print(f"[+] Cleanup Done: Removed {len(updates)} old batches")
                        except Exception as e:
                            print(f"[!] Cleanup Failed: {e}")
                    # -----------------------------------------------
                
            except Exception as e:
                print(f"[!] Unexpected error: {e}")
                await asyncio.sleep(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n[*] Shutting down gracefully...")
