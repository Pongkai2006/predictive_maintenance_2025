#include <Wire.h>
#include <MPU6050_light.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

#define WIFI_SSID "YOUR SSID"
#define WIFI_PASSWORD "YOUR PASSWORD"

#define API_KEY "YOUR KEY"
#define DATABASE_URL "YOUR URL"
#define USER_EMAIL "YOUR EMAIL"
#define USER_PASSWORD "YOUR PASSWORD"

struct AccData {
  float x;
  float y;
  float z;
  unsigned long timestamp;
};

#define MAX_SAMPLES 100
AccData rtcBuffer[MAX_SAMPLES];
int sampleCount = 0;

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

MPU6050 mpu(Wire);

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("Connected to WiFi");

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  delay(200);

  Wire.begin();

  byte status = mpu.begin();
  Serial.print("MPU6050 status: ");
  Serial.println(status);
  while (status != 0) {
    Serial.println("MPU6050 not connected!");
    delay(1000);
  }

  Serial.println("Calibrating gyro...");
  mpu.calcGyroOffsets();
  Serial.println("Done!");
}

unsigned long lastSampleTime = 0;

void loop() {
  static unsigned long lastSampleTime = 0;
  unsigned long now = millis();
  unsigned long dt = now - lastSampleTime;
  lastSampleTime = now;

  mpu.update();
  rtcBuffer[sampleCount].timestamp = now;
  rtcBuffer[sampleCount].x = mpu.getAccX() * 9.81;
  rtcBuffer[sampleCount].y = mpu.getAccY() * 9.81;
  rtcBuffer[sampleCount].z = mpu.getAccZ() * 9.81;
  sampleCount++;

  Serial.print("dt: ");
  Serial.print(dt);
  Serial.print(" ms => ");
  Serial.print(1000.0 / dt);
  Serial.println(" Hz");

  if (sampleCount >= MAX_SAMPLES) {
    sendBatchToFirebase();
    sampleCount = 0;
  }

  delay(10);
}
void sendBatchToFirebase() {
  FirebaseJsonArray jsonArray;

  for (int i = 0; i < sampleCount; i++) {
    FirebaseJson jsonItem;
    jsonItem.set("timestamp", rtcBuffer[i].timestamp);
    jsonItem.set("X", rtcBuffer[i].x);
    jsonItem.set("Y", rtcBuffer[i].y);
    jsonItem.set("Z", rtcBuffer[i].z);
    jsonArray.add(jsonItem);
  }

  if (Firebase.RTDB.push(&fbdo, "/sensor/batchAcceleration", &jsonArray)) {
    Serial.println("Batch upload success!");
  } else {
    Serial.print("Batch upload failed: ");
    Serial.println(fbdo.errorReason());
  }
}
