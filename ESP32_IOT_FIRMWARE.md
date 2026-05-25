# ESP32/ESP8266 ThingsBoard IoT Firmware

Firmware ini digunakan untuk menghubungkan modul ESP32 atau ESP8266 Anda ke server **ThingsBoard** untuk memantau sensor DHT11/DHT22 serta mengontrol 4 channel Relay Module secara real-time.

## Fitur Utama
- **Deteksi Board Otomatis**: Mendukung penuh ESP32 dan ESP8266 secara plug-and-play.
- **Sensor Telemetri**: Mengirimkan data Suhu (temperature) dan Kelembapan (humidity) ke ThingsBoard secara presisi setiap 5 detik sekali.
- **Aktuator RPC Dual-Arah**: Mengontrol Relay 1-4 via tombol switch/widget dashboard ThingsBoard menggunakan token autentikasi yang aman.
- **Format JSON Ringan**: Menggunakan konstruksi JSON manual yang efisien untuk meminimalkan beban memori pada board.

---

## Kode Firmware (Arduino C++)

```cpp
/*
 * =================================================================
 * IoT Smart Control & Monitoring (ESP32 / ESP8266) to ThingsBoard
 * Sensor: DHT22 (Temperature & Humidity)
 * Aktuator: 4x Relay Module
 * =================================================================
 */

// --- Deteksi Board Otomatis ---
#if defined(ESP32)
  #include <WiFi.h>
  #define BOARD_TYPE "ESP32"
  #define DHTPIN 4      // Pin Data DHT22 untuk ESP32
  #define RELAY1 18     // Pin Relay 1 ESP32
  #define RELAY2 19     // Pin Relay 2 ESP32
  #define RELAY3 21     // Pin Relay 3 ESP32
  #define RELAY4 22     // Pin Relay 4 ESP32
#elif defined(ESP8266)
  #include <ESP8266WiFi.h>
  #define BOARD_TYPE "ESP8266"
  #define DHTPIN 2      // Pin D5 (GPIO2) ESP8266
  #define RELAY1 16     // Pin D1 (GPIO16) ESP8266
  #define RELAY2 5     // Pin D2 (GPIO5) ESP8266
  #define RELAY3 4     // Pin D3 (GPIO4) ESP8266
  #define RELAY4 0     // Pin D4 (GPIO0) ESP8266
#else
  #error "Board tidak dikenali. Pilih ESP32 atau ESP8266!"
#endif

#include <PubSubClient.h>
#include <DHT.h>

// --- KONFIGURASI WIFI & THINGSBOARD (WAJIB DISESUAIKAN) ---
const char* ssid = "no connect";        // Ganti dengan SSID WiFi Anda
const char* password = "19Hajimemasu"; // Ganti dengan Password WiFi
const char* mqtt_server = "8611103848";
const char* token = "8749143834:AAHvNq0RhjAiiZZBPJmsaoakIKsA4KwWYyc";    // Ganti dengan Device Token dari ThingsBoard

// --- Inisialisasi Sensor & Object ---
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

WiFiClient espClient;
PubSubClient client(espClient);

// Variabel status Relay di ThingsBoard (true = ON, false = OFF)
bool stateR1 = false;
bool stateR2 = false;
bool stateR3 = false;
bool stateR4 = false;

unsigned long lastSend = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("\nMemulai Sistem IoT berbasis " + String(BOARD_TYPE));
  
  dht.begin();

  // Konfigurasi Pin Relay sebagai Output
  pinMode(RELAY1, OUTPUT);
  pinMode(RELAY2, OUTPUT);
  pinMode(RELAY3, OUTPUT);
  pinMode(RELAY4, OUTPUT);

  // Set default state relay ke OFF 
  // (Asumsi relay module tipe "Active LOW". Jika "Active HIGH", ganti HIGH menjadi LOW)
  digitalWrite(RELAY1, HIGH);
  digitalWrite(RELAY2, HIGH);
  digitalWrite(RELAY3, HIGH);
  digitalWrite(RELAY4, HIGH);

  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

void setup_wifi() {
  delay(10);
  Serial.print("\nMenghubungkan ke WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WiFi Terhubung] IP: " + WiFi.localIP().toString());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Menghubungkan ke ThingsBoard...");
    // Koneksi menggunakan Token sebagai username
    if (client.connect(BOARD_TYPE, token, NULL)) {
      Serial.println(" [Berhasil]");
      // Subscribe ke antrian RPC (Remote Procedure Call) ThingsBoard
      client.subscribe("v1/devices/me/rpc/request/+");
    } else {
      Serial.print(" [Gagal] rc=");
      Serial.print(client.state());
      Serial.println(" Coba lagi dalam 5 detik...");
      delay(5000);
    }
  }
}

// Fungsi untuk menangani perintah masuk (Tombol Switch) dari ThingsBoard Dashboard
void callback(char* topic, byte* payload, unsigned int length) {
  String topicStr = String(topic);
  String reqId = topicStr.substring(topicStr.lastIndexOf("/") + 1);
  String responseTopic = "v1/devices/me/rpc/response/" + reqId;

  // Konversi payload ke bentuk String
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.println("Perintah diterima: " + message);

  // Parsing manual tanpa library JSON tambahan agar tahan banting & tidak error beda versi
  // --- RELAY 1 ---
  if (message.indexOf("\"getValue1\"") > 0) {
    client.publish(responseTopic.c_str(), stateR1 ? "true" : "false");
  } else if (message.indexOf("\"setValue1\"") > 0) {
    stateR1 = (message.indexOf("true") > 0);
    digitalWrite(RELAY1, stateR1 ? LOW : HIGH); // Active LOW logic
    client.publish(responseTopic.c_str(), stateR1 ? "true" : "false");
  }
  
  // --- RELAY 2 ---
  else if (message.indexOf("\"getValue2\"") > 0) {
    client.publish(responseTopic.c_str(), stateR2 ? "true" : "false");
  } else if (message.indexOf("\"setValue2\"") > 0) {
    stateR2 = (message.indexOf("true") > 0);
    digitalWrite(RELAY2, stateR2 ? LOW : HIGH);
    client.publish(responseTopic.c_str(), stateR2 ? "true" : "false");
  }

  // --- RELAY 3 ---
  else if (message.indexOf("\"getValue3\"") > 0) {
    client.publish(responseTopic.c_str(), stateR3 ? "true" : "false");
  } else if (message.indexOf("\"setValue3\"") > 0) {
    stateR3 = (message.indexOf("true") > 0);
    digitalWrite(RELAY3, stateR3 ? LOW : HIGH);
    client.publish(responseTopic.c_str(), stateR3 ? "true" : "false");
  }

  // --- RELAY 4 ---
  else if (message.indexOf("\"getValue4\"") > 0) {
    client.publish(responseTopic.c_str(), stateR4 ? "true" : "false");
  } else if (message.indexOf("\"setValue4\"") > 0) {
    stateR4 = (message.indexOf("true") > 0);
    digitalWrite(RELAY4, stateR4 ? LOW : HIGH);
    client.publish(responseTopic.c_str(), stateR4 ? "true" : "false");
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  // Kirim data sensor setiap 5000 ms (5 detik)
  if (now - lastSend > 5000) { 
    lastSend = now;
    
    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (isnan(h) || isnan(t)) {
      Serial.println("Gagal membaca sensor DHT22!");
      return;
    }

    Serial.print("Suhu: "); Serial.print(t); Serial.print(" °C | ");
    Serial.print("Kelembapan: "); Serial.print(h); Serial.println(" %");

    // Format JSON manual untuk Telemetry ThingsBoard
    String telemetryData = "{\"temperature\":" + String(t) + ", \"humidity\":" + String(h) + "}";
    client.publish("v1/devices/me/telemetry", telemetryData.c_str());
  }
}
```
