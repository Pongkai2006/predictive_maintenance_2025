# Predictive Maintenance 2025

An IoT + AI project that detects early signs of equipment failure using ESP32 and AI models.

## Folder Structure

- `IoT_firmware/`: Arduino code for ESP32 with MPU6050 sensor and Firebase upload.
- `signal_processing/`: Python scripts for filtering and analyzing acceleration signals.
- `AI-ML/`: Training scripts and machine learning models for fault prediction.
- `web/`: Web interface to visualize real-time sensor data.
- `docs/`: System architecture diagrams and documentation.
- `data/raw/`: Contains raw, unprocessed sensor data collected from devices.
- `data/processed/`: Contains cleaned and preprocessed data ready for analysis or modeling.

## Tech Stack

- **Hardware**: ESP32 WROOM 32, MPU6050
- **Cloud**: Firebase Realtime Database
- **AI/ML**: *(To be updated)*
- **Web**: *(To be updated)*

## Getting Started

```bash
git clone https://github.com/Pongkai2006/predictive_maintenance_2025.git
cd AI-ML
pip install -r requirements.txt
