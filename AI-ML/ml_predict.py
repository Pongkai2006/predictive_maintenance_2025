#!/usr/bin/env python
"""
ML Prediction Script - Called by Node.js server
Accepts window data as JSON, returns prediction
"""

import sys
import json
import joblib
import numpy as np

def extract_features(data_points):
    """Extract features from window data"""
    x = np.array([p[0] for p in data_points])
    y = np.array([p[1] for p in data_points])
    z = np.array([p[2] for p in data_points])
    
    mag = np.sqrt(x**2 + y**2 + z**2)
    
    return [[
        x.mean(), y.mean(), z.mean(),
        x.std(), y.std(), z.std(),
        np.sqrt((x**2).mean()),
        np.sqrt((y**2).mean()),
        np.sqrt((z**2).mean()),
        mag.mean(),
        mag.max(),
        mag.min(),
        np.ptp(mag)
    ]]

if __name__ == '__main__':
    try:
        # Load model
        model = joblib.load('pdm_binary.pkl')
        
        # Parse input
        window_data = json.loads(sys.argv[1])
        
        # Extract features
        features = extract_features(window_data)
        
        # Predict
        prob = model.predict_proba(features)[0]
        
        # Output result as JSON
        result = {
            'prob_bad': float(prob[1]),
            'prob_good': float(prob[0])
        }
        
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
