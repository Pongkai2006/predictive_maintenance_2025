"""
Convert scikit-learn model to ONNX format for Node.js
This allows the model to run directly in Node.js without Python subprocess

Requirements:
    pip install skl2onnx onnxruntime

Usage:
    python convert_to_onnx.py
"""

import joblib
import numpy as np
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

print("[*] Converting scikit-learn model to ONNX...")

# Load the trained model
model = joblib.load("pdm_binary.pkl")
print("[+] Loaded model: pdm_binary.pkl")

# Define input shape
# Our model expects 13 features (from extract_features function)
# Features: x_mean, y_mean, z_mean, x_std, y_std, z_std, 
#           rms_x, rms_y, rms_z, mag_mean, mag_max, mag_min, mag_ptp
initial_type = [('float_input', FloatTensorType([None, 13]))]

# Convert to ONNX
# CRITICAL: Use options={'zipmap': False} to output raw probabilities as tensor
# This makes it compatible with onnxruntime-node
onnx_model = convert_sklearn(
    model, 
    initial_types=initial_type,
    target_opset=12,  # Compatible with most runtimes
    options={id(model): {'zipmap': False}}  # Output tensor, not ZipMap
)

# Save ONNX model
output_path = "pdm_binary.onnx"
with open(output_path, "wb") as f:
    f.write(onnx_model.SerializeToString())

print(f"[+] ONNX model saved: {output_path}")

# Test the ONNX model
import onnxruntime as rt

sess = rt.InferenceSession(output_path)
input_name = sess.get_inputs()[0].name
output_name = sess.get_outputs()[0].name

# Test with dummy data
test_data = np.array([[0.1, 0.2, 9.8, 0.5, 0.4, 0.3, 0.2, 0.3, 9.9, 10.0, 11.0, 9.0, 2.0]], dtype=np.float32)
result = sess.run([output_name], {input_name: test_data})

print(f"[+] Test prediction: {result}")
print("[✓] Conversion successful! Ready for Node.js")
