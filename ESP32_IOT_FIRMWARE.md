# ESP32 IoT Smart Home Firmware

This firmware connects your ESP32 to the MQTT broker and integrates with the Vercel Dashboard.

## Hardware Requirements
- ESP32 Development Board
- DHT11 Sensor (Data Pin connected to GPIO 4)
- 4-Channel Relay Module (Connected to GPIO 18, 19, 21, 22)
- External Power Supply for Relays

## MQTT Topics Used
- **Publishing (ESP32 -> Web):**
  - `smartnode/sensors`: Reads DHT11 (`{"temp": 28.5, "hum": 62}`)
  - `smartnode/relays/state`: Current states (`{"r1": true, "r2": false, "r3": false, "r4": true}`)
- **Subscribing (Web -> ESP32):**
  - `smartnode/relays/command`: Commands (`{"id": 1, "status": true}`)

## Firmware (Ardunio / ESP32)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// --- CONFIGURATION ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "broker.emqx.io"; // Matches Dashboard
const int mqtt_port = 1883;

// GPIO Pins
#define DHTPIN 4
#define DHTTYPE DHT11
#define RELAY1 18
#define RELAY2 19
#define RELAY3 21
#define RELAY4 22

DHT dht(DHTPIN, DHTTYPE);
WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastMsg = 0;
bool r1_state = false, r2_state = false, r3_state = false, r4_state = false;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  if (String(topic) == "smartnode/relays/command") {
    StaticJsonDocument<200> doc;
    deserializeJson(doc, message);
    
    int id = doc["id"];
    bool status = doc["status"];

    switch(id) {
      case 1: r1_state = status; digitalWrite(RELAY1, status ? LOW : HIGH); break;
      case 2: r2_state = status; digitalWrite(RELAY2, status ? LOW : HIGH); break;
      case 3: r3_state = status; digitalWrite(RELAY3, status ? LOW : HIGH); break;
      case 4: r4_state = status; digitalWrite(RELAY4, status ? LOW : HIGH); break;
    }
    
    sendRelayState();
  }
}

void sendRelayState() {
  StaticJsonDocument<200> doc;
  doc["r1"] = r1_state;
  doc["r2"] = r2_state;
  doc["r3"] = r3_state;
  doc["r4"] = r4_state;
  
  char buffer[256];
  serializeJson(doc, buffer);
  client.publish("smartnode/relays/state", buffer);
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
      client.subscribe("smartnode/relays/command");
      sendRelayState();
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  pinMode(RELAY1, OUTPUT);
  pinMode(RELAY2, OUTPUT);
  pinMode(RELAY3, OUTPUT);
  pinMode(RELAY4, OUTPUT);
  
  // High = Off for most relay modules
  digitalWrite(RELAY1, HIGH);
  digitalWrite(RELAY2, HIGH);
  digitalWrite(RELAY3, HIGH);
  digitalWrite(RELAY4, HIGH);

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  dht.begin();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastMsg > 5000) { // Every 5 seconds
    lastMsg = now;
    
    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (isnan(h) || isnan(t)) {
      Serial.println("Failed to read from DHT sensor!");
      return;
    }

    StaticJsonDocument<200> doc;
    doc["temp"] = t;
    doc["hum"] = h;
    
    char buffer[256];
    serializeJson(doc, buffer);
    client.publish("smartnode/sensors", buffer);
    Serial.print("Published: ");
    Serial.println(buffer);
  }
}
```

## Setup Telegram Bot (Node.js or Python)
To complete the system, you should run a Telegram Bot script (on a PC or Server) that also connects to the MQTT broker.

**Telegram Logic Summary:**
- `/r1_on` -> Publish `{"id": 1, "status": true}` to `smartnode/relays/command`
- Subscribe to `smartnode/sensors` -> Reply with sensor data when asked.
