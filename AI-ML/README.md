# AI Backend Setup Instructions

## Overview
This document explains how to set up and run the Firebase-connected AI backend service.

## Prerequisites

1. **Trained ML Model**: `pdm_binary.pkl` (already exists)
2. **Firebase Admin Credentials**: Service account key JSON file
3. **Python 3.x** installed

## Setup Steps

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- `numpy` - Numerical operations
- `scikit-learn` - ML library
- `joblib` - Model serialization
- `firebase-admin` - Firebase Admin SDK

### 2. Get Firebase Admin Credentials

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the gear icon ⚙️ > Project Settings
4. Go to **Service Accounts** tab
5. Click **Generate new private key**
6. Save the downloaded JSON file as `firebase_key.json` in the `AI-ML/` directory

> [!WARNING]
> **Never commit `firebase_key.json` to git!** It contains sensitive credentials.

### 3. Update Database URL

Edit `realtime_backend.py` line 25:

```python
"databaseURL": "https://your-project-id-default-rtdb.asia-southeast1.firebasedatabase.app/"
```

Replace with your actual Firebase Realtime Database URL (found in Firebase Console).

## Running the Backend

### Start the Service

```bash
cd AI-ML
python realtime_backend.py
```

You should see:
```
🚀 Starting Predictive Maintenance Backend...
✅ Connected to Firebase
✅ Loaded ML model (pdm_binary.pkl)

🔄 Starting real-time monitoring...
   Window size: 50
   Confidence threshold: 0.7
   Stability threshold: 3

📊 Collecting data... 50 more samples needed
```

### Expected Behavior

1. **Data Collection Phase**: Collects 50 samples to fill the sliding window
2. **Processing Phase**: Every 0.2 seconds:
   - Reads latest sensor data from `/sensor/raw`
   - Extracts features
   - Runs ML prediction
   - Publishes to `/sensor/status`

### Output Example

```
📤 Published: GOOD (prob_bad: 15.23%)
📤 Published: GOOD (prob_bad: 18.45%)
📤 Published: BAD (prob_bad: 82.10%)
📤 Published: BAD (prob_bad: 85.67%)
```

## Configuration

Edit these constants in `realtime_backend.py`:

```python
WINDOW_SIZE = 50              # Must match training
STABILITY_THRESHOLD = 3       # Consecutive BAD before declaring BAD
CONFIDENCE_THRESHOLD = 0.7    # Probability threshold for BAD
POLL_INTERVAL = 0.2           # Seconds between checks
```

## Troubleshooting

### "Firebase initialization failed"
- Check `firebase_key.json` exists
- Verify `databaseURL` is correct
- Ensure Firebase Realtime Database is enabled

### "Model loading failed"
- Run `python class_train.py` first to train the model
- Verify `pdm_binary.pkl` exists

### No data being processed
- Check ESP32/IoT device is writing to `/sensor/raw`
- Verify Firebase database has data
- Check Firebase Console for raw data entries

## System Architecture

```
┌─────────────┐
│   ESP32     │ ──┐
│ Sensor      │   │
└─────────────┘   │
                  ▼
             ┌──────────────────┐
             │   Firebase        │
             │   /sensor/raw     │
             └──────────────────┘
                  │
                  ▼
             ┌──────────────────┐
             │  AI Backend       │
             │  (This Script)    │
             │  - Sliding Window │
             │  - Feature Extract│
             │  - ML Prediction  │
             └──────────────────┘
                  │
                  ▼
             ┌──────────────────┐
             │   Firebase        │
             │   /sensor/status  │
             └──────────────────┘
                  │
                  ▼
             ┌──────────────────┐
             │  Next.js Dashboard│
             │  (Frontend)       │
             └──────────────────┘
```

## Next Steps

1. ✅ Train model (already done)
2. ✅ Create backend service (just created)
3. 📝 Get `firebase_key.json`
4. 🚀 Run backend: `python realtime_backend.py`
5. 🔌 Connect ESP32 to Firebase
6. 📊 Monitor dashboard at `http://localhost:3000`
