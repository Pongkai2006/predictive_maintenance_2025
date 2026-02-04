"""
Test Script: Complete System Integration
Simulates ESP32 sensor data → Backend processes → Frontend displays

This script writes mock sensor data to Firebase matching ESP32 format.
"""

import time
import random
import math
from firebase_admin import credentials, initialize_app, db
import json

print("[*] Integration Test - Mock Sensor Data Generator\n")

# Initialize Firebase
try:
    cred = credentials.Certificate("firebase_key.json")
    initialize_app(cred, {
        "databaseURL": "https://cloud-esp32-567c6-default-rtdb.asia-southeast1.firebasedatabase.app/"
    })
    print("[+] Connected to Firebase\n")
except Exception as e:
    print(f"[-] Firebase initialization failed: {e}")
    print("Update the databaseURL and ensure firebase_key.json exists")
    exit(1)

def generate_good_data():
    """Generate GOOD machine vibration data (low amplitude)"""
    t = time.time()
    return {
        "X": random.uniform(-2.0, 2.0) + 0.5 * math.sin(t),
        "Y": random.uniform(-2.0, 2.0) + 0.3 * math.cos(t),
        "Z": random.uniform(-2.0, 2.0),
        "timestamp": int(t * 1000)
    }

def generate_bad_data():
    """Generate BAD machine vibration data (high amplitude)"""
    t = time.time()
    return {
        "X": random.uniform(-8.0, 8.0) + 3.0 * math.sin(t * 2),
        "Y": random.uniform(-8.0, 8.0) + 3.0 * math.cos(t * 2),
        "Z": random.uniform(-6.0, 6.0),
        "timestamp": int(t * 1000)
    }

print("[*] Test Scenarios:\n")
print("1. GOOD data (5 seconds)  - Low vibration")
print("2. BAD data  (5 seconds)  - High vibration")
print("3. GOOD data (5 seconds)  - Return to normal")
print("\nPress Ctrl+C to stop\n")

try:
    scenario = 1
    start_time = time.time()
    count = 0
    batch = []
    
    while True:
        elapsed = time.time() - start_time
        
        # Switch scenarios every 5 seconds
        if elapsed < 5:
            data = generate_good_data()
            scenario_name = "GOOD"
        elif elapsed < 10:
            data = generate_bad_data()
            scenario_name = "BAD"
        elif elapsed < 15:
            data = generate_good_data()
            scenario_name = "GOOD"
        else:
            start_time = time.time()
            data = generate_good_data()
            scenario_name = "GOOD (restarted)"
        
        batch.append(data)
        count += 1
        print(f"[{scenario_name}] #{count} -> X:{data['X']:6.2f}, Y:{data['Y']:6.2f}, Z:{data['Z']:6.2f}")
        
        # Send batch every 100 samples (matching ESP32 firmware)
        if len(batch) >= 100:
            db.reference("/sensor/batchAcceleration").push(batch)
            print(f"[>] Uploaded batch of {len(batch)} samples")
            batch = []
        
        time.sleep(0.01)  # 100 samples per second (100Hz)
        
except KeyboardInterrupt:
    # Upload remaining batch
    if len(batch) > 0:
        db.reference("/sensor/batchAcceleration").push(batch)
        print(f"\n[>] Uploaded final batch of {len(batch)} samples")
    
    print("\n[+] Test completed!")
    print(f"   Total samples sent: {count}")
    print("\nNext steps:")
    print("1. Check backend terminal - should show classifications")
    print("2. Check dashboard (localhost:3000) - should show real-time updates")
