#include "config.h"

const char* const AQI_NOTEFILE = "air.qo";

extern Notecard notecard;

const char *firmwareVersion() {
  return &FIRMWARE_VERSION[sizeof(FIRMWARE_VERSION_HEADER)-1];
}

void configureNotecard(Notecard &notecard) {
  J *hubSetReq = notecard.newRequest("hub.set");
  if (hubSetReq != NULL) {
    JAddStringToObject(hubSetReq, "product", "com.blues.tvantoll:airqo");
    JAddStringToObject(hubSetReq, "mode", "periodic");
    JAddStringToObject(hubSetReq, "voutbound", "usb:15;high:60;normal:360;low:1440;dead:0");
    JAddStringToObject(hubSetReq, "vinbound", "usb:60;high:720;normal:1440;low:1440;dead:0");
    notecard.sendRequest(hubSetReq);
  }

  J *cardVoltageReq = notecard.newRequest("card.voltage");
  if (cardVoltageReq != NULL) {
    JAddStringToObject(cardVoltageReq, "mode", "lic");
    notecard.sendRequest(cardVoltageReq);
  }

  J *cardLocationReq = notecard.newRequest("card.location.mode");
  if (cardLocationReq != NULL) {
    JAddStringToObject(cardLocationReq, "mode", "periodic");
    JAddNumberToObject(cardLocationReq, "seconds", 60 * 60 * 24);
    notecard.sendRequest(cardLocationReq);
  }

  J *cardDfuReq = notecard.newRequest("card.dfu");
  if (cardDfuReq != NULL) {
    JAddStringToObject(cardDfuReq, "name", "stm32");
    notecard.sendRequest(cardDfuReq);
  }

  J *noteTemplateReq = notecard.newRequest("note.template");
  if (noteTemplateReq != NULL) {
    JAddStringToObject(noteTemplateReq, "file", AQI_NOTEFILE);
    J *body = JCreateObject();
    if (body != NULL) {
      JAddNumberToObject(body, "pm10_standard", 22);
      JAddNumberToObject(body, "pm25_standard", 22);
      JAddNumberToObject(body, "pm100_standard", 22);
      JAddNumberToObject(body, "pm10_env", 22);
      JAddNumberToObject(body, "pm25_env", 22);
      JAddNumberToObject(body, "pm100_env", 22);
      JAddNumberToObject(body, "aqi_pm25_us", 22);
      JAddNumberToObject(body, "aqi_pm100_us", 22);
      JAddNumberToObject(body, "particles_03um", 22);
      JAddNumberToObject(body, "particles_05um", 22);
      JAddNumberToObject(body, "particles_10um", 22);
      JAddNumberToObject(body, "particles_25um", 22);
      JAddNumberToObject(body, "particles_50um", 22);
      JAddNumberToObject(body, "particles_100um", 22);
      JAddItemToObject(noteTemplateReq, "body", body);
    }
    notecard.sendRequest(noteTemplateReq);
  }

  J *dfuStatusReq = notecard.newRequest("dfu.status");
  if (dfuStatusReq != NULL) {
    JAddStringToObject(dfuStatusReq, "version", firmwareVersion());
    notecard.sendRequest(dfuStatusReq);
  }
}