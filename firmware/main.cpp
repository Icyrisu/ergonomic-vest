#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <math.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ============================================================================
// WIFI CONFIGURATION
// ============================================================================
const char *wifiSsid     = "JagoOtomasi";
const char *wifiPassword = "jago2101";

// ============================================================================
// MQTT CONFIGURATION
// ============================================================================
const char *mqttServer   = "broker.hivemq.com";
const int   mqttPort     = 1883;
const char *mqttUser     = "";     // Leave empty if no authentication
const char *mqttPassword = "";     // Leave empty if no authentication

// MQTT Topics
const char *topicSensor1 = "UMJ/EV/S2";       // Upper Spine / Thoracic Pitch
const char *topicSensor2 = "UMJ/EV/S3";       // Lower Spine / Lumbar Pitch
const char *topicCommand = "UMJ/EV/CMD";      // Inbound Commands (e.g. {"command":"tare"})
const char *topicResp    = "UMJ/EV/RESP";     // Outbound Acknowledgment

// Physical Tare Button (BOOT Button on ESP32 GPIO 0)
#define TARE_BUTTON_PIN  0

// Payload decimals (Pitch-only)
const int PAYLOAD_DECIMAL_PLACES = 2;

// Telemetry interval (ms) - 100ms = 10Hz smooth telemetry
const unsigned long sendInterval = 100;

// Sensor Objects
Adafruit_MPU6050 mpu1; // 0x68
Adafruit_MPU6050 mpu2; // 0x69

// Network Objects
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ============================================================================
// SHARED THREAD-SAFE DATA STRUCTURE
// ============================================================================
struct SensorData
{
    float pitch1;
    float pitch2;
};

SensorData sharedSensorData = {0.0f, 0.0f};
SemaphoreHandle_t dataMutex = NULL;

// RTOS Task Handles
TaskHandle_t taskSensorHandle  = NULL;
TaskHandle_t taskNetworkHandle = NULL;

// Tare / Calibration Flags
volatile bool requestTare    = false;
volatile bool tareAckPending = false;

// Sensor Offsets
float gxOffset1 = 0.0f;
float gyOffset1 = 0.0f;
float pitchOffset1 = 0.0f;

float gxOffset2 = 0.0f;
float gyOffset2 = 0.0f;
float pitchOffset2 = 0.0f;

// ============================================================================
// KALMAN FILTER CLASS (OPTIMIZED FOR ZERO-DRIFT)
// ============================================================================
class KalmanFilter
{
public:
    // Q_angle: Process noise variance for accelerometer
    // Q_bias: Process noise variance for gyro bias drift (lowered to minimize drift)
    // R_measure: Measurement noise variance (accelerometer noise)
    float Q_angle   = 0.001f;
    float Q_bias    = 0.0003f;
    float R_measure = 0.03f;

    float angle = 0.0f;
    float bias  = 0.0f;
    float rate  = 0.0f;

    float P[2][2] = {{0.0f, 0.0f}, {0.0f, 0.0f}};

    void setAngle(float newAngle)
    {
        angle = newAngle;
        bias  = 0.0f;
    }

    float getAngle(float newAngle, float newRate, float dt)
    {
        // 1. Predict
        rate = newRate - bias;
        angle += dt * rate;

        P[0][0] += dt * (dt * P[1][1] - P[0][1] - P[1][0] + Q_angle);
        P[0][1] -= dt * P[1][1];
        P[1][0] -= dt * P[1][1];
        P[1][1] += Q_bias * dt;

        // 2. Update (Kalman Gain)
        float S = P[0][0] + R_measure;
        float K[2];
        K[0] = P[0][0] / S;
        K[1] = P[1][0] / S;

        // 3. Error correction
        float y = newAngle - angle;
        angle += K[0] * y;
        bias  += K[1] * y;

        // 4. Update error covariance
        float P00_temp = P[0][0];
        float P01_temp = P[0][1];

        P[0][0] -= K[0] * P00_temp;
        P[0][1] -= K[0] * P01_temp;
        P[1][0] -= K[1] * P00_temp;
        P[1][1] -= K[1] * P01_temp;

        return angle;
    }
};

KalmanFilter kalPitch1;
KalmanFilter kalPitch2;

// ============================================================================
// HELPER: PITCH CALCULATION & DEAD-BAND GYRO (ZUPT)
// ============================================================================
// Calculates Pitch angle from raw accelerometer data:
// Pitch = atan2(ay, sqrt(ax^2 + az^2)) * 180 / PI
// Incorporates Zero Velocity Update (dead-band): when stationary (<0.25 deg/s),
// gyro rate is clamped to zero to prevent integration creep.
float readMPUPitch(
    Adafruit_MPU6050 &mpu,
    KalmanFilter &kalPitch,
    float gxOffset,
    float pitchOffset,
    float dt)
{
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    // 1. Accelerometer Pitch Angle (Euler representation for trunk flexion)
    float accPitch = atan2(
                         a.acceleration.y,
                         sqrt(a.acceleration.x * a.acceleration.x + a.acceleration.z * a.acceleration.z)) *
                     180.0f / PI;

    // Apply zero-calibration offset
    accPitch -= pitchOffset;

    // 2. Gyro Rate in deg/s
    float gyroPitch = (g.gyro.x - gxOffset) * 180.0f / PI;

    // 3. Stationary Deadband / ZUPT (Zero Velocity Update)
    // Eliminates micro-drift while user is standing or sitting still
    if (fabs(gyroPitch) < 0.25f)
    {
        gyroPitch = 0.0f;
    }

    // 4. Sensor Fusion using Kalman Filter
    return kalPitch.getAngle(accPitch, gyroPitch, dt);
}

// ============================================================================
// INITIAL CALIBRATION ROUTINE
// ============================================================================
void calibrateSensors()
{
    Serial.println("\n[CALIB] Starting initial stationary gyro and level calibration...");
    const int samples = 500;
    float gxSum1 = 0, pitchSum1 = 0;
    float gxSum2 = 0, pitchSum2 = 0;

    for (int i = 0; i < samples; i++)
    {
        sensors_event_t a1, g1, t1, a2, g2, t2;
        mpu1.getEvent(&a1, &g1, &t1);
        mpu2.getEvent(&a2, &g2, &t2);

        gxSum1 += g1.gyro.x;
        gxSum2 += g2.gyro.x;

        float p1 = atan2(a1.acceleration.y, sqrt(a1.acceleration.x * a1.acceleration.x + a1.acceleration.z * a1.acceleration.z)) * 180.0f / PI;
        float p2 = atan2(a2.acceleration.y, sqrt(a2.acceleration.x * a2.acceleration.x + a2.acceleration.z * a2.acceleration.z)) * 180.0f / PI;

        pitchSum1 += p1;
        pitchSum2 += p2;

        delay(3);
    }

    gxOffset1 = gxSum1 / samples;
    gxOffset2 = gxSum2 / samples;

    pitchOffset1 = pitchSum1 / samples;
    pitchOffset2 = pitchSum2 / samples;

    kalPitch1.setAngle(0.0f);
    kalPitch2.setAngle(0.0f);

    Serial.printf("[CALIB] MPU1 GyroOffset: %.4f rad/s, PitchOffset: %.2f deg\n", gxOffset1, pitchOffset1);
    Serial.printf("[CALIB] MPU2 GyroOffset: %.4f rad/s, PitchOffset: %.2f deg\n", gxOffset2, pitchOffset2);
    Serial.println("[CALIB] Initial calibration complete! Baseline zeroed.");
}

// ============================================================================
// DYNAMIC TARE ZEROING ROUTINE (RUNS ON CORE 1)
// ============================================================================
void executeTare()
{
    Serial.println("\n[TARE] Tare routine triggered! Calibrating neutral posture...");
    const int tareSamples = 60;
    float sumP1 = 0.0f;
    float sumP2 = 0.0f;

    for (int i = 0; i < tareSamples; i++)
    {
        sensors_event_t a1, g1, t1, a2, g2, t2;
        mpu1.getEvent(&a1, &g1, &t1);
        mpu2.getEvent(&a2, &g2, &t2);

        float p1 = atan2(a1.acceleration.y, sqrt(a1.acceleration.x * a1.acceleration.x + a1.acceleration.z * a1.acceleration.z)) * 180.0f / PI;
        float p2 = atan2(a2.acceleration.y, sqrt(a2.acceleration.x * a2.acceleration.x + a2.acceleration.z * a2.acceleration.z)) * 180.0f / PI;

        sumP1 += p1;
        sumP2 += p2;

        vTaskDelay(pdMS_TO_TICKS(10));
    }

    // Set new offsets to zero out angles
    pitchOffset1 = sumP1 / (float)tareSamples;
    pitchOffset2 = sumP2 / (float)tareSamples;

    kalPitch1.setAngle(0.0f);
    kalPitch2.setAngle(0.0f);

    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(10)) == pdTRUE)
    {
        sharedSensorData.pitch1 = 0.0f;
        sharedSensorData.pitch2 = 0.0f;
        xSemaphoreGive(dataMutex);
    }

    requestTare = false;
    tareAckPending = true;
    Serial.printf("[TARE] New Offsets -> MPU1: %.2f deg, MPU2: %.2f deg. Zero achieved!\n", pitchOffset1, pitchOffset2);
}

// ============================================================================
// FORMAT PAYLOAD (PITCH-ONLY)
// ============================================================================
String createJsonPayload(float pitch, int decimals = PAYLOAD_DECIMAL_PLACES)
{
    char buffer[64];
    snprintf(buffer, sizeof(buffer), "{\"pitch\":\"%.*f\"}", decimals, pitch);
    return String(buffer);
}

// ============================================================================
// MQTT CALLBACK (CORE 0)
// ============================================================================
void mqttCallback(char *topic, byte *payload, unsigned int length)
{
    char message[128];
    unsigned int len = (length < sizeof(message) - 1) ? length : (sizeof(message) - 1);
    memcpy(message, payload, len);
    message[len] = '\0';

    Serial.printf("[MQTT RX] Topic: %s | Payload: %s\n", topic, message);

    // If tare command received
    if (strstr(message, "tare") != NULL)
    {
        Serial.println("[MQTT RX] Tare command received! Requesting sensor zeroing...");
        requestTare = true;
    }
}

// ============================================================================
// TASK 1: SENSOR SAMPLING & FILTERING (PINNED TO CORE 1 - REAL TIME)
// ============================================================================
void taskSensorCode(void *parameter)
{
    Serial.printf("[Core %d] TaskSensor running at 100 Hz (Priority 2)\n", xPortGetCoreID());

    // Deterministic loop timing (10 ms = 100 Hz)
    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(10);
    const float dt = 0.010f; // Fixed deterministic dt eliminates integration jitter

    for (;;)
    {
        // 1. Check physical Tare button (GPIO 0 with debounce)
        static int lastBtnState = HIGH;
        int btnState = digitalRead(TARE_BUTTON_PIN);
        if (btnState == LOW && lastBtnState == HIGH)
        {
            Serial.println("[BUTTON] Physical Tare BOOT button pressed!");
            requestTare = true;
        }
        lastBtnState = btnState;

        // 2. Check Tare Request
        if (requestTare)
        {
            executeTare();
        }

        // 3. Read Sensors with Anti-Drift Kalman Filter
        float p1 = readMPUPitch(mpu1, kalPitch1, gxOffset1, pitchOffset1, dt);
        float p2 = readMPUPitch(mpu2, kalPitch2, gxOffset2, pitchOffset2, dt);

        // 4. Update Shared Data with Mutex
        if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(5)) == pdTRUE)
        {
            sharedSensorData.pitch1 = p1;
            sharedSensorData.pitch2 = p2;
            xSemaphoreGive(dataMutex);
        }

        // Wait until next 10ms cycle
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
    }
}

// ============================================================================
// TASK 2: NETWORK & TELEMETRY (PINNED TO CORE 0 - NETWORK & WIFI)
// ============================================================================
void taskNetworkCode(void *parameter)
{
    Serial.printf("[Core %d] TaskNetwork running (Priority 1)\n", xPortGetCoreID());

    // Connect WiFi
    Serial.printf("[WiFi] Connecting to %s...\n", wifiSsid);
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSsid, wifiPassword);

    int timeoutCount = 0;
    while (WiFi.status() != WL_CONNECTED && timeoutCount < 30)
    {
        vTaskDelay(pdMS_TO_TICKS(500));
        Serial.print(".");
        timeoutCount++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    }

    // Setup MQTT
    mqttClient.setServer(mqttServer, mqttPort);
    mqttClient.setCallback(mqttCallback);

    unsigned long lastSend = 0;
    unsigned long lastMqttRetry = 0;

    for (;;)
    {
        // WiFi Auto-Reconnect
        if (WiFi.status() != WL_CONNECTED)
        {
            static unsigned long lastWifiRetry = 0;
            if (millis() - lastWifiRetry > 10000)
            {
                lastWifiRetry = millis();
                Serial.println("[WiFi] Reconnecting...");
                WiFi.reconnect();
            }
        }
        else
        {
            // MQTT Connection Maintenance
            if (!mqttClient.connected())
            {
                if (millis() - lastMqttRetry > 5000)
                {
                    lastMqttRetry = millis();
                    String clientId = "ESP32_Vest_" + WiFi.macAddress();
                    clientId.replace(":", "");

                    Serial.printf("[MQTT] Connecting as %s...\n", clientId.c_str());
                    if (mqttClient.connect(clientId.c_str(), mqttUser, mqttPassword))
                    {
                        Serial.println("[MQTT] Connected to Broker!");
                        mqttClient.subscribe(topicCommand);
                        Serial.printf("[MQTT] Subscribed to %s\n", topicCommand);
                    }
                    else
                    {
                        Serial.printf("[MQTT] Connect failed, state: %d\n", mqttClient.state());
                    }
                }
            }
            else
            {
                mqttClient.loop();

                // If Tare was acknowledged by Sensor Task, publish confirmation
                if (tareAckPending)
                {
                    char respBuf[128];
                    snprintf(respBuf, sizeof(respBuf),
                             "{\"status\":\"tare_ok\",\"offset1\":%.2f,\"offset2\":%.2f}",
                             pitchOffset1, pitchOffset2);
                    mqttClient.publish(topicResp, respBuf);
                    Serial.printf("[MQTT TX] Published tare acknowledgment to %s: %s\n", topicResp, respBuf);
                    tareAckPending = false;
                }

                // Send Periodic Telemetry
                if (millis() - lastSend >= sendInterval)
                {
                    lastSend = millis();

                    SensorData currentData;
                    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(10)) == pdTRUE)
                    {
                        currentData = sharedSensorData;
                        xSemaphoreGive(dataMutex);
                    }

                    String payload1 = createJsonPayload(currentData.pitch1);
                    String payload2 = createJsonPayload(currentData.pitch2);

                    mqttClient.publish(topicSensor1, payload1.c_str());
                    mqttClient.publish(topicSensor2, payload2.c_str());

                    // Telemetry output on Serial
                    Serial.printf("[TELEM] S1 (Thoracic): %.2f deg | S2 (Lumbar): %.2f deg\n",
                                  currentData.pitch1, currentData.pitch2);
                }
            }
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

// ============================================================================
// SETUP
// ============================================================================
void setup()
{
    Serial.begin(115200);
    delay(500);
    Serial.println("\n=======================================================");
    Serial.println("  ERGONOMIC VEST - ESP32 DUAL-CORE ANTI-DRIFT FIRMWARE  ");
    Serial.println("=======================================================");

    // Pin Tare BOOT Button
    pinMode(TARE_BUTTON_PIN, INPUT_PULLUP);

    // I2C Setup
    Wire.begin(21, 22);
    Wire.setClock(400000); // 400kHz Fast I2C

    // Initialize MPU1 (0x68) & MPU2 (0x69)
    Serial.println("[I2C] Initializing MPU1 (0x68)...");
    if (!mpu1.begin(0x68, &Wire, 0))
    {
        Serial.println("[ERROR] Failed to find MPU1 at 0x68! Check wiring.");
    }
    else
    {
        Serial.println("[I2C] MPU1 Found!");
        mpu1.setAccelerometerRange(MPU6050_RANGE_4_G);
        mpu1.setGyroRange(MPU6050_RANGE_500_DEG);
        mpu1.setFilterBandwidth(MPU6050_BAND_21_HZ);
    }

    Serial.println("[I2C] Initializing MPU2 (0x69)...");
    if (!mpu2.begin(0x69, &Wire, 1))
    {
        Serial.println("[ERROR] Failed to find MPU2 at 0x69! Check AD0 pin to 3.3V.");
    }
    else
    {
        Serial.println("[I2C] MPU2 Found!");
        mpu2.setAccelerometerRange(MPU6050_RANGE_4_G);
        mpu2.setGyroRange(MPU6050_RANGE_500_DEG);
        mpu2.setFilterBandwidth(MPU6050_BAND_21_HZ);
    }

    // Mutex
    dataMutex = xSemaphoreCreateMutex();
    if (dataMutex == NULL)
    {
        Serial.println("[FATAL] Could not create dataMutex!");
        while (1) { delay(100); }
    }

    // Initial Calibration (Gyro zero-rate + Level offset)
    calibrateSensors();

    // Launch Core 1 Task: High-priority deterministic sensor sampling (100 Hz)
    xTaskCreatePinnedToCore(
        taskSensorCode,
        "TaskSensor",
        4096,
        NULL,
        2, // Priority 2 (Higher)
        &taskSensorHandle,
        1  // Core 1
    );

    // Launch Core 0 Task: Network, WiFi, MQTT publish & subscribe
    xTaskCreatePinnedToCore(
        taskNetworkCode,
        "TaskNetwork",
        8192,
        NULL,
        1, // Priority 1 (Standard)
        &taskNetworkHandle,
        0  // Core 0
    );

    Serial.println("[SYSTEM] Dual-core tasks pinned and operating!");
}

// ============================================================================
// LOOP (IDLE ON CORE 1)
// ============================================================================
void loop()
{
    // Tasks handle all execution; loop sleeps to yield CPU to TaskSensor
    vTaskDelay(pdMS_TO_TICKS(1000));
}
