#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
// Using real MPU6050 sensor
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>

// ================= CONFIGURATION =================
// WiFi Credentials
const char* ssid = "Theo";
const char* password = "25491123";

// WebSocket Server Configuration
// PRODUCTION MODE - Connected to Render deployment
const char* ws_host = "predictive-maintenance-2025.onrender.com";
const int ws_port = 443;  // SSL/TLS WebSocket (wss://)
const char* ws_path = "/sensor";  // Backend endpoint for sensor data

// Sensor Configuration
const int SAMPLE_RATE_MS = 50;  // 20Hz sampling rate
const int WIFI_RETRY_DELAY = 5000;  // 5 seconds between WiFi retries
const int WS_RECONNECT_DELAY = 3000;  // 3 seconds between WebSocket reconnects

// Debug Mode (set to false for production)
const bool DEBUG_MODE = true;

// ================= GLOBALS =================
WebSocketsClient webSocket;
// Connection state tracking
bool wifi_connected = false;
bool ws_connected = false;
unsigned long wifi_retry_time = 0;
unsigned long ws_retry_time = 0;
unsigned long last_sample_time = 0;

// MPU6050 Sensor
Adafruit_MPU6050 mpu;
bool sensor_initialized = false;

// ================= SENSOR FUNCTIONS =================
// Real MPU6050 sensor reading functions
void readMPU6050(float &x, float &y, float &z) {
  if (!sensor_initialized) {
    x = y = z = 0.0;
    return;
  }
  
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  
  x = a.acceleration.x;
  y = a.acceleration.y;
  z = a.acceleration.z;
}

bool initializeMPU6050() {
  if (!mpu.begin()) {
    if (DEBUG_MODE) Serial.println("[!] Failed to find MPU6050 chip");
    return false;
  }
  
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  
  if (DEBUG_MODE) Serial.println("[+] MPU6050 initialized successfully");
  return true;
}
// ================= WEBSOCKET EVENT HANDLER =================
void wsEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            ws_connected = false;  // Track disconnection
            if (DEBUG_MODE) {
                Serial.println("[WSc] ❌ Disconnected from server");
            }
            break;
            
        case WStype_CONNECTED:
            ws_connected = true;  // Track connection
            if (DEBUG_MODE) {
                Serial.printf("[WSc] ✓ Connected to: %s\n", payload);
                Serial.println("[WSc] Starting data transmission...");
            }
            break;
            
        case WStype_TEXT:
            if (DEBUG_MODE) {
                Serial.printf("[WSc] Received message: %s\n", payload);
            }
            break;
            
        case WStype_ERROR:
            ws_connected = false;  // Track error as disconnected
            if (DEBUG_MODE) {
                Serial.println("[WSc] ⚠ WebSocket error occurred");
            }
            break;
            
        default:
            break;
    }
}
// ================= SETUP =================
void setup() {
    Serial.begin(115200);
    delay(100);
    
    if (DEBUG_MODE) {
        Serial.println("\n\n=================================");
        Serial.println("ESP32 Predictive Maintenance");
        Serial.println("=================================\n");
    }
    
    // Initialize WiFi
    connectWiFi();
    
    // Initialize MPU6050 Sensor
    sensor_initialized = initializeMPU6050();
    if (!sensor_initialized && DEBUG_MODE) {
        Serial.println("[!] Failed to initialize MPU6050 - sensor readings will be 0.0");
    }
    
    // Initialize WebSocket Connection
    connectWebSocket();
    
    if (DEBUG_MODE) {
        Serial.println("\n[+] Setup complete. Starting main loop...\n");
    }
}

// ================= WIFI CONNECTION =================
void connectWiFi() {
    if (DEBUG_MODE) {
        Serial.printf("[*] Connecting to WiFi: %s\n", ssid);
    }
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    
    int retry_count = 0;
    while (WiFi.status() != WL_CONNECTED && retry_count < 20) {
        delay(500);
        Serial.print(".");
        retry_count++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        wifi_connected = true;
        if (DEBUG_MODE) {
            Serial.println("\n[+] WiFi Connected!");
            Serial.printf("    IP Address: %s\n", WiFi.localIP().toString().c_str());
            Serial.printf("    Signal: %d dBm\n", WiFi.RSSI());
        }
    } else {
        wifi_connected = false;
        if (DEBUG_MODE) {
            Serial.println("\n[!] WiFi connection failed!");
        }
    }
}

// ================= WEBSOCKET CONNECTION =================
void connectWebSocket() {
    if (DEBUG_MODE) {
        Serial.printf("[*] Connecting to WebSocket: %s:%d%s\n", ws_host, ws_port, ws_path);
    }
    
    // PRODUCTION - SSL WebSocket (Render deployment)
    if (ws_port == 443) {
        webSocket.beginSSL(ws_host, ws_port, ws_path);
        webSocket.enableHeartbeat(15000, 3000, 2);  // Ping every 15s, timeout 3s, 2 retries
        if (DEBUG_MODE) {
            Serial.println("[+] Using SSL WebSocket (Production Mode)");
        }
    } 
    // LOCAL - Plain WebSocket (development)
    else {
        webSocket.begin(ws_host, ws_port, ws_path);
        if (DEBUG_MODE) {
            Serial.println("[+] Using Plain WebSocket (Local Mode)");
        }
    }
    
    webSocket.onEvent(wsEvent);
    webSocket.setReconnectInterval(WS_RECONNECT_DELAY);
}
// ================= MAIN LOOP =================
void loop() {
    // Monitor WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
        if (wifi_connected) {
            wifi_connected = false;
            if (DEBUG_MODE) {
                Serial.println("[!] WiFi connection lost! Attempting to reconnect...");
            }
        }
        
        // Attempt to reconnect
        if (millis() - wifi_retry_time > WIFI_RETRY_DELAY) {
            wifi_retry_time = millis();
            connectWiFi();
        }
        return;  // Skip WebSocket operations if WiFi is down
    } else if (!wifi_connected) {
        wifi_connected = true;
        if (DEBUG_MODE) {
            Serial.println("[+] WiFi reconnected!");
        }
        connectWebSocket();  // Re-establish WebSocket
    }
    
    // Monitor WebSocket connection and reconnect if needed
    if (WiFi.status() == WL_CONNECTED && !ws_connected) {
        if (millis() - ws_retry_time > WS_RECONNECT_DELAY) {
            ws_retry_time = millis();
            if (DEBUG_MODE) {
                Serial.println("[*] WebSocket disconnected. Attempting to reconnect...");
            }
            connectWebSocket();
        }
    }
    
    // Process WebSocket events
    webSocket.loop();
    
    // Send sensor data at configured sample rate
    if (millis() - last_sample_time >= SAMPLE_RATE_MS) {
        last_sample_time = millis();
        
        // Read sensor data from MPU6050
        float x, y, z;
        
        if (sensor_initialized) {
            readMPU6050(x, y, z);
        } else {
            x = y = z = 0.0;
        }
        
        // Create JSON payload
        StaticJsonDocument<200> doc;
        doc["X"] = x;
        doc["Y"] = y;
        doc["Z"] = z;
        doc["timestamp"] = millis();
        
        String jsonString;
        serializeJson(doc, jsonString);
        
        // Send to backend
        if (webSocket.isConnected()) {
            webSocket.sendTXT(jsonString);
            
            // Optional: Print every 100th sample to avoid flooding serial
            static int sample_count = 0;
            if (DEBUG_MODE && (sample_count++ % 100 == 0)) {
                Serial.printf("[→] Sent sample #%d: X=%.2f, Y=%.2f, Z=%.2f\n", 
                             sample_count, x, y, z);
            }
        } else if (DEBUG_MODE) {
            static unsigned long last_warning = 0;
            if (millis() - last_warning > 5000) {  // Warn every 5 seconds
                Serial.println("[!] WebSocket not connected. Data not sent.");
                last_warning = millis();
            }
        }
    }
}