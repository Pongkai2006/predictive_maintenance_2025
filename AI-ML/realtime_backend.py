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
import collections
# ================= CONFIG =================
WINDOW_SIZE = 10         # Smaller window for smoother updates
STABILITY_THRESHOLD = 3  # Consecutive BAD predictions before declaring BAD
CONFIDENCE_THRESHOLD = 0.7
POLL_INTERVAL = 1.0      # seconds
WS_PORT = int(os.environ.get("PORT", 8765))
# =========================================

print("[*] Starting Predictive Maintenance Backend (Direct WebSocket Mode)...")

# Load trained model

# Load trained model
try:
    model = joblib.load("pdm_binary.pkl")
    print("[+] Loaded ML model (pdm_binary.pkl)")
except Exception as e:
    print(f"[-] Model loading failed: {e}")
    print("Run 'python class_train.py' first to create the model")
    exit(1)

# Buffer for sliding window
buffer = collections.deque(maxlen=WINDOW_SIZE)
dashboard_clients = set()
sensor_clients = set()

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

# State for "Latest Known Status" (to attach to every data point)
latest_inference = {
    "state": "READY",
    "prob_bad": 0.0
}

async def broadcast_combined(data_item, state_info):
    """
    Broadcast a combined packet: Raw Data (X,Y,Z) + Latest AI Status
    This ensures the Dashboard gets everything in one stream.
    """
    if not dashboard_clients:
        return
        
    message = json.dumps({
        # Raw Data (Graph)
        "X": data_item.get("X", 0),
        "Y": data_item.get("Y", 0),
        "Z": data_item.get("Z", 0),
        "timestamp": data_item.get("timestamp", int(time.time()*1000)),
        
        # AI Status (Card)
        "state": state_info["state"],
        "prob_bad": state_info["prob_bad"],
        "updated_at": int(time.time() * 1000)
    })
    
    # Remove closed connections automatically
    to_remove = set()
    for client in dashboard_clients:
        try:
            await client.send(message)
        except websockets.exceptions.ConnectionClosed:
            to_remove.add(client)
    
    dashboard_clients.difference_update(to_remove)

async def handle_dashboard(websocket):
    """Handle Frontend Dashboard connections"""
    print(f"[+] Dashboard connected: {websocket.remote_address}")
    dashboard_clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        dashboard_clients.discard(websocket)
        print("[-] Dashboard disconnected")

async def handle_sensor(websocket):
    """Handle ESP32 Sensor connections (Input)"""
    print(f"[+] SENSOR CONNECTED: {websocket.remote_address}")
    sensor_clients.add(websocket)
    
    # Reset buffer on new connection? No, keep history.
    
    try:
        async for message in websocket:
            try:
                # 1. Parse Data
                data = json.loads(message)
                
                # Support both single object and list of objects
                items = data if isinstance(data, list) else [data]
                
                for item in items:
                    # 2. Add to Buffer
                    buffer.append((float(item["X"]), float(item["Y"]), float(item["Z"])))
                    
                    # 3. Predict (if buffer full)
                    if len(buffer) >= WINDOW_SIZE:
                        features = extract_features(list(buffer))
                        prob = model.predict_proba(features)[0]
                        prob_bad = prob[1]
                        
                        # Update global state
                        latest_inference["state"] = "BAD" if prob_bad > CONFIDENCE_THRESHOLD else "GOOD"
                        latest_inference["prob_bad"] = prob_bad
                        
                    # 4. DATA FORWARDING (Zero Latency)
                    # We send EVERY packet to the dashboard immediately.
                    # It carries the *latest known* status.
                    await broadcast_combined(item, latest_inference)
                        
            except json.JSONDecodeError:
                print(f"[!] Invalid JSON from sensor")
            except Exception as e:
                print(f"[!] Processing Error: {e}")
                
    finally:
        sensor_clients.discard(websocket)
        print("[-] Sensor disconnected")

async def handler(websocket, path):
    """Router for WebSocket connections"""
    if path == "/sensor":
        await handle_sensor(websocket)
    else:
        # Default to dashboard for root "/" or "/dashboard"
        await handle_dashboard(websocket)

import http
async def health_check(path, request_headers):
    if path == "/health":
        return http.HTTPStatus.OK, [], b"OK\n"
    return None

async def main():
    print(f"[*] Starting Dual-Channel WebSocket server on port {WS_PORT}...")
    print(f"    - /sensor    : Input for ESP32")
    print(f"    - /dashboard : Output for Frontend")
    
    # Clean DB on start to signal 'System Ready'
    # try:
    #     db.reference("/sensor/status").set({
    #         "state": "READY",
    #         "prob_bad": 0.0,
    #         "updated_at": int(time.time() * 1000)
    #     })
    #     print("[+] Set initial status to READY")
    # except Exception as e:
    #     print(f"[!] Firebase Init Warning: {e}")

    async with websockets.serve(handler, "0.0.0.0", WS_PORT):
        print(f"[+] Server Running. Waiting for Sensor Stream...\n")
        await asyncio.get_running_loop().create_future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n[*] Shutting down gracefully...")
