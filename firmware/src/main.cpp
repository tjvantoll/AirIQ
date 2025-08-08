#include <Arduino.h>
#include "Adafruit_PM25AQI.h"
#include <Notecard.h>
#include <Wire.h>
#include "version.h"

// Project configuration
#define AQI_NOTEFILE "air.qo"
#define READING_INTERVAL_ENV_VAR "reading_interval_min"

// STLINK serial for debug output
#define SERIAL_BAUD 115200
HardwareSerial serial_debug(PIN_VCP_RX, PIN_VCP_TX);

// Uncomment the following line to disable all logging output
// #define RELEASE

const unsigned long DEFAULT_SLEEP_DURATION_MINS = 15;
const unsigned long SENSOR_RETRY_DELAY_MS = 500;

Adafruit_PM25AQI aqi;
Notecard notecard;
PM25_AQI_Data aqiData;

int getSleepDurationMins() {
  int result = DEFAULT_SLEEP_DURATION_MINS;
  J *envReq = notecard.newRequest("env.get");
  if (envReq != NULL) {
    JAddStringToObject(envReq, "name", READING_INTERVAL_ENV_VAR);
    J *envRsp = notecard.requestAndResponse(envReq);
    if (envRsp != NULL) {
      if (JHasObjectItem(envRsp, "text")) {
        const char* intervalStr = JGetString(envRsp, "text");
        if (intervalStr != NULL) {
          unsigned long intervalMins = (unsigned long)atoi(intervalStr);
          if (intervalMins > 0) {
            result = intervalMins;
#ifndef RELEASE
            serial_debug.print(F("Using reading interval: "));
            serial_debug.print(intervalMins);
            serial_debug.println(F(" minutes"));
#endif
          }
        }
      }
      notecard.deleteResponse(envRsp);
    }
  }

  return result;
}

void setup() {
#ifndef RELEASE
  // Turn on the Swan’s LED for debugging
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);

  // Initialize STLINK serial communication with timeout
  serial_debug.begin(SERIAL_BAUD);
  const size_t usb_timeout_ms = 3000;
  for (const size_t start_ms = millis(); !serial_debug && (millis() - start_ms) < usb_timeout_ms;);
  serial_debug.println(F("AirIQ startup"));
  serial_debug.println(F("Initializing Notecard..."));
#endif

  notecard.begin();

#ifndef RELEASE
  notecard.setDebugOutputStream(serial_debug);
#endif

  J *dfuReq = notecard.newRequest("dfu.status");
  if (dfuReq != NULL) {
    JAddStringToObject(dfuReq, "version", firmwareVersion());
    notecard.sendRequest(dfuReq);
  }

  uint8_t retryCount = 0;
  const uint8_t MAX_RETRIES = 50;
  bool sensorInitialized = false;

#ifndef RELEASE
  serial_debug.println(F("Initializing AQI sensor..."));
#endif

  while (!sensorInitialized && retryCount < MAX_RETRIES) {
#ifndef RELEASE
    serial_debug.print(F("AQI sensor init attempt "));
    serial_debug.println(retryCount + 1);
#endif

    aqi = Adafruit_PM25AQI();
    if (aqi.begin_I2C()) {
      sensorInitialized = true;
#ifndef RELEASE
      serial_debug.println(F("AQI sensor ready"));
#endif
    } else {
      retryCount++;
#ifndef RELEASE
      serial_debug.println(F("AQI sensor not ready, retrying..."));
#endif
      delay(SENSOR_RETRY_DELAY_MS);
    }
  }

  // Per datasheet: “Stable data should be got at least 30 seconds
  // after the sensor wakes up from the sleep mode because of the fan’s
  // performance.
  // https://cdn-shop.adafruit.com/product-files/4632/4505_PMSA003I_series_data_manual_English_V2.6.pdf
  delay(30000);

  if (aqi.read(&aqiData)) {
#ifndef RELEASE
    serial_debug.print(F("PM1.0 Standard: "));
    serial_debug.println(aqiData.pm10_standard);
    serial_debug.print(F("PM2.5 Standard: "));
    serial_debug.println(aqiData.pm25_standard);
    serial_debug.print(F("PM10.0 Standard: "));
    serial_debug.println(aqiData.pm100_standard);
    serial_debug.print(F("PM1.0 Environmental: "));
    serial_debug.println(aqiData.pm10_env);
    serial_debug.print(F("PM2.5 Environmental: "));
    serial_debug.println(aqiData.pm25_env);
    serial_debug.print(F("PM10.0 Environmental: "));
    serial_debug.println(aqiData.pm100_env);
    serial_debug.print(F("AQI PM2.5 US: "));
    serial_debug.println(aqiData.aqi_pm25_us);
    serial_debug.print(F("AQI PM10 US: "));
    serial_debug.println(aqiData.aqi_pm100_us);
    serial_debug.print(F("Particles >0.3μm: "));
    serial_debug.println(aqiData.particles_03um);
    serial_debug.print(F("Particles >0.5μm: "));
    serial_debug.println(aqiData.particles_05um);
    serial_debug.print(F("Particles >1.0μm: "));
    serial_debug.println(aqiData.particles_10um);
    serial_debug.print(F("Particles >2.5μm: "));
    serial_debug.println(aqiData.particles_25um);
    serial_debug.print(F("Particles >5.0μm: "));
    serial_debug.println(aqiData.particles_50um);
    serial_debug.print(F("Particles >10.0μm: "));
    serial_debug.println(aqiData.particles_100um);
#endif

    J *addReq = notecard.newRequest("note.add");
    if (addReq != NULL) {
      JAddStringToObject(addReq, "file", AQI_NOTEFILE);
      J *body = JCreateObject();
      if (body != NULL) {
        JAddNumberToObject(body, "pm10_standard", aqiData.pm10_standard);
        JAddNumberToObject(body, "pm25_standard", aqiData.pm25_standard);
        JAddNumberToObject(body, "pm100_standard", aqiData.pm100_standard);
        JAddNumberToObject(body, "pm10_env", aqiData.pm10_env);
        JAddNumberToObject(body, "pm25_env", aqiData.pm25_env);
        JAddNumberToObject(body, "pm100_env", aqiData.pm100_env);
        JAddNumberToObject(body, "aqi_pm25_us", aqiData.aqi_pm25_us);
        JAddNumberToObject(body, "aqi_pm100_us", aqiData.aqi_pm100_us);
        JAddNumberToObject(body, "particles_03um", aqiData.particles_03um);
        JAddNumberToObject(body, "particles_05um", aqiData.particles_05um);
        JAddNumberToObject(body, "particles_10um", aqiData.particles_10um);
        JAddNumberToObject(body, "particles_25um", aqiData.particles_25um);
        JAddNumberToObject(body, "particles_50um", aqiData.particles_50um);
        JAddNumberToObject(body, "particles_100um", aqiData.particles_100um);

        JAddItemToObject(addReq, "body", body);
      }

      if (notecard.sendRequest(addReq)) {
#ifndef RELEASE
        serial_debug.println(F("Data queued successfully"));
#endif
      } else {
#ifndef RELEASE
        serial_debug.println(F("Failed to queue data"));
#endif
      }
    }
  } else {
#ifndef RELEASE
    serial_debug.println(F("Sensor read failed"));
#endif
  }
}

void loop() {
  int sleepDurationMins = getSleepDurationMins();
#ifndef RELEASE
  serial_debug.print(F("Entering sleep for "));
  serial_debug.print(sleepDurationMins);
  serial_debug.println(F(" minutes..."));
#endif

  J *req = notecard.newCommand("card.attn");
  if (req != NULL) {
    JAddStringToObject(req, "mode", "sleep");
    JAddNumberToObject(req, "seconds", sleepDurationMins * 60);
    notecard.sendRequest(req);
  }

  // Should never reach here - fallback delay if sleep fails
  delay(1000);
}