/*
 ==============================================================================
  SMART OUTPASS SECURITY SYSTEM - PRODUCTION FIRMWARE
  Target Hardware: ESP32 DevKit V1 (30 or 36 pin)
  Role: Physical Classroom Door IoT Terminal
  
  Libraries Required (Install via Arduino Library Manager):
  - ArduinoJson (v6.x or v7.x) by Benoit Blanchon
  - MFRC522 by GithubCommunity
  - LiquidCrystal_I2C by Frank de Brabander
  - Keypad by Mark Stanley, Alexander Brevig
  - ESP32Servo by Kevin Harrington
  
  Pin Assignments:
  - RC522 RFID:   SS=5, SCK=18, MOSI=23, MISO=19, RST=4 (3.3V Power)
  - Dual I2C LCD: SDA=21, SCL=22 (LCD1=0x27 Door Prompt, LCD2=0x26 Classroom Count)
  - 4x4 Keypad:   Rows={13, 12, 14, 27}, Cols={26, 25, 33, 32}
  - Servo Gate:   GPIO 15
  - Green LED:    GPIO 2
  - Red LED:      GPIO 16
  - Active Buzzer:GPIO 17
  - SOS Button:   GPIO 34 (INPUT_PULLUP with hardware debouncing)
 ==============================================================================
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Keypad.h>
#include <ESP32Servo.h>

// WiFi Clients for HTTP / HTTPS (Vercel) support
WiFiClient plainClient;
WiFiClientSecure secureClient;

void setupHttp(HTTPClient& http, const String& url) {
  if (url.startsWith("https://")) {
    secureClient.setInsecure(); // Bypass SSL cert validation for cloud hosting (Vercel)
    http.begin(secureClient, url);
  } else {
    http.begin(plainClient, url);
  }
}

// ============================================================================
// 1. NETWORK & BACKEND CONFIGURATION
// ============================================================================
const char* WIFI_SSID     = "Your_WiFi_SSID";
const char* WIFI_PASSWORD = "Your_WiFi_Password";

// Replace with your Next.js server IP or domain (e.g. "http://192.168.1.150:3000")
const char* BACKEND_BASE_URL = "http://192.168.1.150:3000";
const char* DEVICE_ID        = "DOOR_NODE_01";

// ============================================================================
// 2. PIN DEFINITIONS
// ============================================================================
#define PIN_RFID_SS     5
#define PIN_RFID_RST    4
#define PIN_SERVO       15
#define PIN_LED_GREEN   2
#define PIN_LED_RED     16
#define PIN_BUZZER      17
#define PIN_SOS_BTN     34
#define I2C_SDA         21
#define I2C_SCL         22

// Keypad Pinout
const byte KEYPAD_ROWS = 4;
const byte KEYPAD_COLS = 4;
char keypadKeys[KEYPAD_ROWS][KEYPAD_COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[KEYPAD_ROWS] = {13, 12, 14, 27};
byte colPins[KEYPAD_COLS] = {26, 25, 33, 32};

// ============================================================================
// 3. HARDWARE INSTANCES
// ============================================================================
MFRC522 rfid(PIN_RFID_SS, PIN_RFID_RST);
LiquidCrystal_I2C lcd1(0x27, 16, 2); // Door scan prompt
LiquidCrystal_I2C lcd2(0x26, 16, 2); // Classroom statistics
Keypad customKeypad = Keypad(makeKeymap(keypadKeys), rowPins, colPins, KEYPAD_ROWS, KEYPAD_COLS);
Servo gateServo;

// ============================================================================
// 4. FINITE STATE MACHINE (FSM) ENUMS & TIMERS
// ============================================================================
enum SystemState {
  STATE_IDLE_SCANNING,
  STATE_AWAITING_KEYPAD_REASON,
  STATE_AWAITING_TEACHER_CODE,
  STATE_GATE_OPENING
};

SystemState currentState = STATE_IDLE_SCANNING;

// Non-blocking Timing Variables
unsigned long lastHeartbeatMillis = 0;
const unsigned long HEARTBEAT_INTERVAL_MS = 3000;

unsigned long gateOpenStartMillis = 0;
unsigned long gateHoldDurationMs  = 5000;

unsigned long stateTimeoutMillis = 0;
const unsigned long REASON_TIMEOUT_MS = 25000; // 25s timeout for keypad input

// Keypad Buffer
String activeScannedUid = "";
char selectedReasonKey = ' ';
String teacherCodeBuffer = "";

// Buzzer Non-blocking Pattern Engine
int buzzerBeepsRemaining = 0;
unsigned long lastBuzzerToggleMillis = 0;
bool buzzerState = false;
int buzzerPulseMs = 100;

// SOS Button Debounce
int lastSosReading = HIGH;
unsigned long lastSosDebounceTime = 0;
const unsigned long SOS_DEBOUNCE_DELAY = 50;

// Function Prototypes
void handleHeartbeat();
void handleRfidScanning();
void handleKeypadInput();
void handleSosButton();
void updateBuzzerEngine();
void openGate(int seconds);
void closeGate();
void triggerBuzzerPattern(const String& pattern);
void displayLcd1(const String& line1, const String& line2);
void displayLcd2(const String& line1, const String& line2);
String getUidString(MFRC522::Uid *uid);

// ============================================================================
// 5. SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[INIT] Starting Smart Outpass Security Terminal...");

  // I/O Pin Modes
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_SOS_BTN, INPUT_PULLUP);

  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  // Initialize I2C Bus & LCDs
  Wire.begin(I2C_SDA, I2C_SCL);
  lcd1.init();
  lcd1.backlight();
  lcd2.init();
  lcd2.backlight();

  displayLcd1("SMART OUTPASS", "Connecting WiFi");
  displayLcd2("DOOR_NODE_01", "Booting ESP32...");

  // Initialize Servo
  gateServo.attach(PIN_SERVO);
  closeGate();

  // Initialize SPI & RC522 RFID
  SPI.begin();
  rfid.PCD_Init();
  delay(50);
  rfid.PCD_DumpVersionToSerial();

  // Connect to WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WIFI] Connecting to SSID: ");
  Serial.println(WIFI_SSID);

  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected! IP: " + WiFi.localIP().toString());
    displayLcd1("SMART OUTPASS", "TAP RFID CARD");
    displayLcd2("DOOR_NODE_01", "Out: 0 | Late: 0");
    triggerBuzzerPattern("1_SHORT");
  } else {
    Serial.println("\n[WIFI] Connection Timeout. Will retry in loop.");
    displayLcd1("WiFi Standby", "Reconnecting...");
  }
}

// ============================================================================
// 6. MAIN LOOP (Strictly Non-Blocking Millis Architecture)
// ============================================================================
void loop() {
  unsigned long currentMillis = millis();

  // 1. Update Non-Blocking Audio & Buzzer Engine
  updateBuzzerEngine();

  // 2. Poll Physical SOS Emergency Push Button
  handleSosButton();

  // 3. Periodic Backend Heartbeat (Every 3000ms)
  if (currentMillis - lastHeartbeatMillis >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatMillis = currentMillis;
    if (WiFi.status() == WL_CONNECTED) {
      handleHeartbeat();
    }
  }

  // 4. Finite State Machine Transitions
  switch (currentState) {
    case STATE_IDLE_SCANNING:
      handleRfidScanning();
      break;

    case STATE_AWAITING_KEYPAD_REASON:
    case STATE_AWAITING_TEACHER_CODE:
      handleKeypadInput();
      // Timeout guard: return to idle if student walks away
      if (currentMillis - stateTimeoutMillis > REASON_TIMEOUT_MS) {
        Serial.println("[FSM] Keypad input timed out. Resetting to IDLE.");
        displayLcd1("Session Timeout", "Tap Card Again");
        digitalWrite(PIN_LED_RED, LOW);
        delay(1000);
        displayLcd1("SMART OUTPASS", "TAP RFID CARD");
        currentState = STATE_IDLE_SCANNING;
      }
      break;

    case STATE_GATE_OPENING:
      if (currentMillis - gateOpenStartMillis >= gateHoldDurationMs) {
        closeGate();
        digitalWrite(PIN_LED_GREEN, LOW);
        displayLcd1("SMART OUTPASS", "TAP RFID CARD");
        currentState = STATE_IDLE_SCANNING;
      }
      break;
  }
}

// ============================================================================
// 7. RFID SCAN PROCESSING (POST /api/hardware/scan)
// ============================================================================
void handleRfidScanning() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String cardUid = getUidString(&(rfid.uid));
  Serial.println("\n[RFID] Scanned UID: " + cardUid);
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  displayLcd1("Verifying...", cardUid);
  digitalWrite(PIN_LED_GREEN, HIGH);

  if (WiFi.status() != WL_CONNECTED) {
    displayLcd1("WiFi Offline", "Try Again Later");
    triggerBuzzerPattern("3_SHORT");
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
    delay(1500);
    digitalWrite(PIN_LED_RED, LOW);
    displayLcd1("SMART OUTPASS", "TAP RFID CARD");
    return;
  }

  HTTPClient http;
  String url = String(BACKEND_BASE_URL) + "/api/hardware/scan";
  setupHttp(http, url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["card_uid"] = cardUid;
  doc["device_id"] = DEVICE_ID;
  doc["source"]    = "ESP32_PHYSICAL";

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  digitalWrite(PIN_LED_GREEN, LOW);

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.println("[HTTP SCAN] Response: " + payload);

    StaticJsonDocument<512> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, payload);

    if (!error) {
      String action      = responseDoc["action"] | "ACCESS_DENIED";
      String lcd1Text    = responseDoc["lcd1"] | "Access Denied";
      String lcd2Text    = responseDoc["lcd2"] | "";
      String beepPattern = responseDoc["beep_pattern"] | "1_SHORT";
      bool shouldOpen    = responseDoc["open_gate"] | false;
      int holdSec        = responseDoc["gate_hold_sec"] | 5;

      displayLcd1(lcd1Text, lcd2Text);
      triggerBuzzerPattern(beepPattern);

      if (action == "OPEN_EXIT" || action == "OPEN_RETURN") {
        digitalWrite(PIN_LED_GREEN, HIGH);
        digitalWrite(PIN_LED_RED, LOW);
        openGate(holdSec);
        currentState = STATE_GATE_OPENING;
      }
      else if (action == "REQUIRE_REASON") {
        // Late Return: student must enter reason on keypad
        activeScannedUid = cardUid;
        teacherCodeBuffer = "";
        selectedReasonKey = ' ';
        digitalWrite(PIN_LED_RED, HIGH);
        digitalWrite(PIN_LED_GREEN, LOW);
        stateTimeoutMillis = millis();
        currentState = STATE_AWAITING_KEYPAD_REASON;
      }
      else {
        // Access Denied / Unregistered
        digitalWrite(PIN_LED_RED, HIGH);
        delay(1500);
        digitalWrite(PIN_LED_RED, LOW);
        displayLcd1("SMART OUTPASS", "TAP RFID CARD");
        currentState = STATE_IDLE_SCANNING;
      }
    }
  } else {
    Serial.println("[HTTP SCAN] Connection Error: " + String(httpCode));
    displayLcd1("Server Error", "Check Host IP");
    triggerBuzzerPattern("3_SHORT");
    delay(1500);
    displayLcd1("SMART OUTPASS", "TAP RFID CARD");
  }
  http.end();
}

// ============================================================================
// 8. 4x4 KEYPAD REASON WORKFLOW (POST /api/hardware/reason)
// ============================================================================
void handleKeypadInput() {
  char key = customKeypad.getKey();
  if (!key) return;

  Serial.print("[KEYPAD] Key: ");
  Serial.println(key);
  triggerBuzzerPattern("1_SHORT");

  if (currentState == STATE_AWAITING_KEYPAD_REASON) {
    if (key == '1') {
      selectedReasonKey = '1';
      teacherCodeBuffer = "";
      displayLcd1("1: Teacher Code:", "Enter 2-digit #");
      currentState = STATE_AWAITING_TEACHER_CODE;
      stateTimeoutMillis = millis();
    }
    else if (key == '2' || key == '3' || key == '4') {
      selectedReasonKey = key;
      if (key == '2') displayLcd1("2: Coordinator", "Press # to Submit");
      if (key == '3') displayLcd1("3: Infirmary", "Press # to Submit");
      if (key == '4') displayLcd1("4: Other Reason", "Press # to Submit");
      currentState = STATE_AWAITING_TEACHER_CODE; // Awaiting confirmation '#'
      stateTimeoutMillis = millis();
    }
  }
  else if (currentState == STATE_AWAITING_TEACHER_CODE) {
    if (key == '#') {
      // Submit Reason to Backend
      displayLcd1("Submitting...", "Please Wait");
      sendKeypadReason(selectedReasonKey, teacherCodeBuffer);
    }
    else if (key == '*') {
      // Clear Input Buffer
      teacherCodeBuffer = "";
      displayLcd1("Reason Buffer", "Cleared. Re-enter");
      delay(800);
      displayLcd1("Overdue! Reason:", "1:Tch 2:Crd 3:Inf");
      currentState = STATE_AWAITING_KEYPAD_REASON;
    }
    else if (isDigit(key) && teacherCodeBuffer.length() < 2) {
      teacherCodeBuffer += key;
      displayLcd1("Teacher ID: #" + teacherCodeBuffer, "Press # to Send");
    }
  }
}

void sendKeypadReason(char reasonKey, const String& teacherCode) {
  if (WiFi.status() != WL_CONNECTED) {
    displayLcd1("WiFi Offline", "Cannot Send");
    return;
  }

  HTTPClient http;
  String url = String(BACKEND_BASE_URL) + "/api/hardware/reason";
  setupHttp(http, url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["card_uid"]      = activeScannedUid;
  doc["reason_key"]    = String(reasonKey);
  if (teacherCode.length() > 0) {
    doc["teacher_code"] = teacherCode;
  }
  doc["device_id"]     = DEVICE_ID;
  doc["source"]        = "ESP32_PHYSICAL";

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode > 0) {
    String payload = http.getString();
    Serial.println("[HTTP REASON] Response: " + payload);

    StaticJsonDocument<512> responseDoc;
    deserializeJson(responseDoc, payload);

    String lcd1Text = responseDoc["lcd1"] | "Reason Logged";
    String lcd2Text = responseDoc["lcd2"] | "Wait For Staff";
    bool openGateVal = responseDoc["open_gate"] | false;

    displayLcd1(lcd1Text, lcd2Text);
    digitalWrite(PIN_LED_RED, LOW);

    if (openGateVal) {
      digitalWrite(PIN_LED_GREEN, HIGH);
      openGate(5);
      currentState = STATE_GATE_OPENING;
    } else {
      delay(2500);
      displayLcd1("SMART OUTPASS", "TAP RFID CARD");
      currentState = STATE_IDLE_SCANNING;
    }
  } else {
    displayLcd1("Send Failed", "Retry Shortly");
    delay(1500);
    displayLcd1("SMART OUTPASS", "TAP RFID CARD");
    currentState = STATE_IDLE_SCANNING;
  }
  http.end();
}

// ============================================================================
// 9. HEARTBEAT & REMOTE COMMAND DISPATCH (POST /api/hardware/heartbeat)
// ============================================================================
void handleHeartbeat() {
  HTTPClient http;
  String url = String(BACKEND_BASE_URL) + "/api/hardware/heartbeat";
  setupHttp(http, url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["device_id"]  = DEVICE_ID;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["uptime"]     = millis() / 1000;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode > 0) {
    String payload = http.getString();
    StaticJsonDocument<384> responseDoc;
    deserializeJson(responseDoc, payload);

    String pendingCommand = responseDoc["pending_command"] | "NONE";
    String lcd2Summary    = responseDoc["lcd2_summary"] | "Out: 0 | Late: 0";

    // Update Classroom Monitor LCD2
    displayLcd2("DOOR_NODE_01", lcd2Summary);

    // Execute Remote Command queued by Teacher/Coordinator
    if (pendingCommand == "OPEN_GATE") {
      Serial.println("[REMOTE CMD] OPEN_GATE command received from Teacher Portal!");
      displayLcd1("Staff Approved", "Gate Unlocked");
      digitalWrite(PIN_LED_GREEN, HIGH);
      digitalWrite(PIN_LED_RED, LOW);
      triggerBuzzerPattern("1_SHORT");
      openGate(5);
      currentState = STATE_GATE_OPENING;
    }
    else if (pendingCommand == "REJECT_BUZZER") {
      Serial.println("[REMOTE CMD] REJECT_BUZZER command received!");
      displayLcd1("Visit Rejected", "Admission Denied");
      digitalWrite(PIN_LED_RED, HIGH);
      triggerBuzzerPattern("3_SHORT");
      delay(1500);
      digitalWrite(PIN_LED_RED, LOW);
      displayLcd1("SMART OUTPASS", "TAP RFID CARD");
    }
  }
  http.end();
}

// ============================================================================
// 10. PHYSICAL SOS EMERGENCY BUTTON (POST /api/hardware/sos)
// ============================================================================
void handleSosButton() {
  int reading = digitalRead(PIN_SOS_BTN);

  if (reading != lastSosReading) {
    lastSosDebounceTime = millis();
  }

  if ((millis() - lastSosDebounceTime) > SOS_DEBOUNCE_DELAY) {
    // Active LOW trigger when button pressed to GND
    if (reading == LOW && lastSosReading == HIGH) {
      Serial.println("\n[EMERGENCY] Physical SOS Button Pressed!");
      displayLcd1("EMERGENCY SOS!", "ALARM ACTIVE");
      digitalWrite(PIN_LED_RED, HIGH);
      triggerBuzzerPattern("3_SHORT");

      if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        String url = String(BACKEND_BASE_URL) + "/api/hardware/sos";
        setupHttp(http, url);
        http.addHeader("Content-Type", "application/json");

        StaticJsonDocument<128> doc;
        doc["device_id"] = DEVICE_ID;
        doc["source"]    = "ESP32_PHYSICAL";

        String body;
        serializeJson(doc, body);
        http.POST(body);
        http.end();
      }
    }
  }
  lastSosReading = reading;
}

// ============================================================================
// 11. ACTUATORS & PERIPHERAL HELPERS
// ============================================================================
void openGate(int seconds) {
  gateServo.write(90); // 90° Open
  gateOpenStartMillis = millis();
  gateHoldDurationMs  = seconds * 1000UL;
  Serial.println("[ACTUATOR] Servo Gate -> 90° (OPEN)");
}

void closeGate() {
  gateServo.write(0);  // 0° Closed / Locked
  Serial.println("[ACTUATOR] Servo Gate -> 0° (LOCKED)");
}

void triggerBuzzerPattern(const String& pattern) {
  if (pattern == "1_SHORT") {
    buzzerBeepsRemaining = 1;
    buzzerPulseMs = 120;
  } else if (pattern == "2_SHORT") {
    buzzerBeepsRemaining = 2;
    buzzerPulseMs = 100;
  } else if (pattern == "3_SHORT") {
    buzzerBeepsRemaining = 3;
    buzzerPulseMs = 150;
  }
}

void updateBuzzerEngine() {
  if (buzzerBeepsRemaining <= 0) {
    digitalWrite(PIN_BUZZER, LOW);
    buzzerState = false;
    return;
  }

  unsigned long now = millis();
  if (now - lastBuzzerToggleMillis >= (unsigned long)buzzerPulseMs) {
    lastBuzzerToggleMillis = now;
    buzzerState = !buzzerState;
    digitalWrite(PIN_BUZZER, buzzerState ? HIGH : LOW);

    if (!buzzerState) {
      buzzerBeepsRemaining--;
    }
  }
}

void displayLcd1(const String& line1, const String& line2) {
  lcd1.clear();
  lcd1.setCursor(0, 0);
  lcd1.print(line1.substring(0, 16));
  lcd1.setCursor(0, 1);
  lcd1.print(line2.substring(0, 16));
}

void displayLcd2(const String& line1, const String& line2) {
  lcd2.clear();
  lcd2.setCursor(0, 0);
  lcd2.print(line1.substring(0, 16));
  lcd2.setCursor(0, 1);
  lcd2.print(line2.substring(0, 16));
}

String getUidString(MFRC522::Uid *uid) {
  String uidStr = "";
  for (byte i = 0; i < uid->size; i++) {
    if (uid->uidByte[i] < 0x10) uidStr += "0";
    uidStr += String(uid->uidByte[i], HEX);
  }
  uidStr.toUpperCase();
  return uidStr;
}
