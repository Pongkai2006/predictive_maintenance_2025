#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
// ================= CONFIG =================
const char* ssid = "Theo";
const char* password = "25491123";
// Backend WebSocket URL
// Replace with your Render URL (without wss://)
const char* ws_host = "pbl-backend-okmj.onrender.com"; 
const int ws_port = 443; 
const char* ws_path = "/sensor"; // Important: Connect to /sensor namespace
WebSocketsClient webSocket;
unsigned long last_time = 0;
// Fake Sensor Data (Replace with MPU6050 reading)
float getX() { return (random(-200, 200) / 100.0) + sin(millis()/1000.0); }
float getY() { return (random(-200, 200) / 100.0) + cos(millis()/1000.0); }
float getZ() { return (random(-200, 200) / 100.0); }
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.printf("[WSc] Disconnected!\n");
            break;
        case WStype_CONNECTED:
            Serial.printf("[WSc] Connected to url: %s\n", payload);
            break;
    }
}
void setup() {
    Serial.begin(115200);
    // WiFi
    WiFi.begin(ssid, password);
    while(WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi Connected!");
    // WebSocket
    // Use SSL (wss) since Render requires it
    webSocket.beginSsl(ws_host, ws_port, ws_path);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
}
void loop() {
    webSocket.loop();
    // Send data at ~20Hz (every 50ms)
    if (millis() - last_time > 50) {
        last_time = millis();
        // Create JSON
        StaticJsonDocument<200> doc;
        doc["X"] = getX();
        doc["Y"] = getY();
        doc["Z"] = getZ();
        doc["timestamp"] = millis(); // Packet ID
        String jsonString;
        serializeJson(doc, jsonString);
        // Send Direct to Backend
        webSocket.sendTXT(jsonString);
    }
}