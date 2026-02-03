#include <Wire.h>
#include <MPU6050_light.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

#define WIFI_SSID "ํYOUR SSID"
#define WIFI_PASSWORD "YOUR"

#define API_KEY "YOUR"
#define DATABASE_URL "YOUR"
#define USER_EMAIL "YOUR"
#define USER_PASSWORD "YOUR"

struct AccData {
  float x;
  float y;
  float z;
  unsigned long timestamp;
};

#define MAX_SAMPLES 100
AccData rtcBuffer[MAX_SAMPLES];
volatile int sampleCount = 0;
volatile bool readyToSend = false;

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

MPU6050 mpu(Wire);
SemaphoreHandle_t dataMutex;

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Wire.begin();
  byte status = mpu.begin();
  while (status != 0) {
    Serial.println("MPU6050 not connected!");
    delay(1000);
  }

  mpu.calcGyroOffsets();

  dataMutex = xSemaphoreCreateMutex();

  // สร้าง Task อ่านเซนเซอร์
  xTaskCreatePinnedToCore(
    TaskSensor, "TaskSensor", 10000, NULL, 1, NULL, 0);

  // สร้าง Task ส่งข้อมูล
  xTaskCreatePinnedToCore(
    TaskUploader, "TaskUploader", 10000, NULL, 1, NULL, 1);
}

void TaskSensor(void *pvParameters) {
  unsigned long lastTime = millis();
  while (true) {
    mpu.update();

    if (xSemaphoreTake(dataMutex, portMAX_DELAY)) {
      if (!readyToSend && sampleCount < MAX_SAMPLES) {
        rtcBuffer[sampleCount].timestamp = millis();
        rtcBuffer[sampleCount].x = mpu.getAccX() * 9.81;
        rtcBuffer[sampleCount].y = mpu.getAccY() * 9.81;
        rtcBuffer[sampleCount].z = mpu.getAccZ() * 9.81;
        sampleCount++;
        if (sampleCount >= MAX_SAMPLES) {
          readyToSend = true;
        }
      }
      xSemaphoreGive(dataMutex);
    }

    vTaskDelay(10 / portTICK_PERIOD_MS);  // อ่านทุก 10ms
  }
}

void TaskUploader(void *pvParameters) {
  while (true) {
    if (readyToSend) {
      if (xSemaphoreTake(dataMutex, portMAX_DELAY)) {
        sendBatchToFirebase();
        sampleCount = 0;
        readyToSend = false;
        xSemaphoreGive(dataMutex);
      }
    }
    vTaskDelay(100 / portTICK_PERIOD_MS);  // ตรวจทุก 100ms
  }
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

void loop() {
}
