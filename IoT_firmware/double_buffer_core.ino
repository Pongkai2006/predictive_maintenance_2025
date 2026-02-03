#include <Wire.h>
#include <MPU6050_light.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

#define WIFI_SSID "ํYOUR"
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

// Queue สำหรับแต่ละ buffer
QueueHandle_t bufferQueueA;
QueueHandle_t bufferQueueB;

// Pointer ควบคุม buffer ที่กำลังเขียนและส่ง
QueueHandle_t writeQueue;
QueueHandle_t sendQueue;

volatile bool readyToSend = false;

SemaphoreHandle_t switchMutex;

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

MPU6050 mpu(Wire);

void setup() {
  Serial.begin(115200);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

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

  // สร้าง queue ขนาด MAX_SAMPLES สำหรับแต่ละ buffer
  bufferQueueA = xQueueCreate(MAX_SAMPLES, sizeof(AccData));
  bufferQueueB = xQueueCreate(MAX_SAMPLES, sizeof(AccData));

  writeQueue = bufferQueueA;
  sendQueue = bufferQueueB;

  switchMutex = xSemaphoreCreateMutex();

  // สร้าง Task แยก core
  xTaskCreatePinnedToCore(TaskSensor, "TaskSensor", 10000, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(TaskUploader, "TaskUploader", 10000, NULL, 1, NULL, 1);
}

void TaskSensor(void* pvParameters) {
  while (true) {
    mpu.update();

    AccData data;
    data.timestamp = millis();
    data.x = mpu.getAccX() * 9.81;
    data.y = mpu.getAccY() * 9.81;
    data.z = mpu.getAccZ() * 9.81;

    // ใส่ข้อมูลลง queue
    if (xQueueSend(writeQueue, &data, 0) == errQUEUE_FULL) {
      // ถ้า queue เต็ม (MAX_SAMPLES ตัว) ให้สลับ buffer
      if (xSemaphoreTake(switchMutex, portMAX_DELAY)) {
        // สลับ queue
        QueueHandle_t temp = writeQueue;
        writeQueue = sendQueue;
        sendQueue = temp;
        readyToSend = true;
        xSemaphoreGive(switchMutex);

        Serial.println("Buffer switched! Ready to send batch.");

        // หลังสลับแล้วลองใส่ข้อมูลใหม่อีกครั้ง (non-blocking)
        xQueueSend(writeQueue, &data, portMAX_DELAY);
      }
    }

    vTaskDelay(10 / portTICK_PERIOD_MS);  // sampling ทุก 10 ms
  }
}

void TaskUploader(void* pvParameters) {
  AccData data;
  FirebaseJsonArray jsonArray;

  while (true) {
    if (readyToSend) {
      Serial.println("Upload started");
      unsigned long startTime = millis();

      if (xSemaphoreTake(switchMutex, portMAX_DELAY)) {
        // ดึงข้อมูลทั้งหมดจาก sendQueue
        while (xQueueReceive(sendQueue, &data, 0) == pdTRUE) {
          FirebaseJson jsonItem;
          jsonItem.set("timestamp", data.timestamp);
          jsonItem.set("X", data.x);
          jsonItem.set("Y", data.y);
          jsonItem.set("Z", data.z);
          jsonArray.add(jsonItem);
        }
        readyToSend = false;
        xSemaphoreGive(switchMutex);
      }

      // ส่ง batch ข้อมูล
      if (Firebase.RTDB.push(&fbdo, "/sensor/batchAcceleration", &jsonArray)) {
        Serial.println("Batch upload success!");
      } else {
        Serial.print("Batch upload failed: ");
        Serial.println(fbdo.errorReason());
      }

      jsonArray.clear();

      Serial.printf("Upload took %lums\n", millis() - startTime);
    }
    vTaskDelay(50 / portTICK_PERIOD_MS);
  }
}

void loop() {
  // ไม่มีอะไรใน loop เพราะใช้ FreeRTOS task แยกทำงานหมดแล้ว
}
