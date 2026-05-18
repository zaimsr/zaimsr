# ESP32 IoT Smart Home Firmware (v2.2)

This firmware connects your ESP32 to the MQTT broker and integrates with the Vercel Dashboard using unique topics.

## Hardware Requirements
- ESP32 Development Board
- DHT11 Sensor (Data Pin connected to GPIO 4)
- 4-Channel Relay Module (Connected to GPIO 18, 19, 21, 22)

## Unique MQTT Topics
To avoid interference, we use your ID (**8611103848**) in the topics.
- **Publishing (ESP32 -> Cloud):**
  - `smartnode/8611103848/status`: `{"status": "online"}` (Every 10s)
  - `smartnode/8611103848/sensors`: `{"temp": 28.5, "hum": 62}` (Every 5s)
  - `smartnode/8611103848/relays/state`: `{"r1": true, "r2": false...}` (On Change)
- **Subscribing (Cloud -> ESP32):**
  - `smartnode/8611103848/relays/command`: `{"id": 1, "status": true}`

## Firmware (Arduino / ESP32)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// --- CONFIGURATION ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;
const char* device_id = "8611103848"; // YOUR UNIQUE ID

// Topics
String baseTopic = "smartnode/" + String(device_id);
String topic_sensors = baseTopic + "/sensors";
String topic_state = baseTopic + "/relays/state";
String topic_cmd = baseTopic + "/relays/command";
String topic_status = baseTopic + "/status";

#define RELAY1 18
#define RELAY2 19
#define RELAY3 21
#define RELAY4 22
#define DHTPIN 4
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);
WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastMsg = 0;
bool r1 = false, r2 = false, r3 = false, r4 = false;

void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) message += (char)payload[i];
  
  StaticJsonDocument<200> doc;
  deserializeJson(doc, message);
  
  int id = doc["id"];
  bool status = doc["status"];

  if (id == 1) { r1 = status; digitalWrite(RELAY1, r1 ? LOW : HIGH); }
  if (id == 2) { r2 = status; digitalWrite(RELAY2, r2 ? LOW : HIGH); }
  if (id == 3) { r3 = status; digitalWrite(RELAY3, r3 ? LOW : HIGH); }
  if (id == 4) { r4 = status; digitalWrite(RELAY4, r4 ? LOW : HIGH); }
  
  sendState();
}

void sendState() {
  StaticJsonDocument<200> doc;
  doc["r1"] = r1; doc["r2"] = r2; doc["r3"] = r3; doc["r4"] = r4;
  char buf[256];
  serializeJson(doc, buf);
  client.publish(topic_state.c_str(), buf);
}

void reconnect() {
  while (!client.connected()) {
    String clientId = "ESP32-" + String(device_id);
    if (client.connect(clientId.c_str())) {
      client.subscribe(topic_cmd.c_str());
      client.publish(topic_status.c_str(), "{\"status\":\"online\"}");
      sendState();
    } else {
      delay(5000);
    }
  }
}

void setup() {
  pinMode(RELAY1, OUTPUT); digitalWrite(RELAY1, HIGH);
  pinMode(RELAY2, OUTPUT); digitalWrite(RELAY2, HIGH);
  pinMode(RELAY3, OUTPUT); digitalWrite(RELAY3, HIGH);
  pinMode(RELAY4, OUTPUT); digitalWrite(RELAY4, HIGH);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  dht.begin();
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  unsigned long now = millis();
  if (now - lastMsg > 5000) {
    lastMsg = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    
    if (!isnan(t)) {
      StaticJsonDocument<200> doc;
      doc["temp"] = t; doc["hum"] = h;
      char buf[256];
      serializeJson(doc, buf);
      client.publish(topic_sensors.c_str(), buf);
    }
  }
}
```

## Setup Telegram Bot (Node.js or Python)
To complete the system, you should run a Telegram Bot script (on a PC or Server) that also connects to the MQTT broker.

**Telegram Logic Summary:**
- `/r1_on` -> Publish `{"id": 1, "status": true}` to `smartnode/relays/command`
- Subscribe to `smartnode/sensors` -> Reply with sensor data when asked.
