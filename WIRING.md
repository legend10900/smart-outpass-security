# Hardware Wiring Guide & Breadboard Assembly
**Smart Outpass Security System — ESP32 DevKit V1 Hardware Node**

This document provides the complete, pin-by-pin hardware schematic, breadboard wiring diagram, power distribution guidelines, and component specifications for assembling the physical classroom door node.

---

## 1. Bill of Materials (BOM)

| Component | Quantity | Key Specifications / Notes |
| :--- | :--- | :--- |
| **ESP32 DevKit V1** | 1 | 30-pin or 36-pin dual-core ESP-WROOM-32 with micro-USB / Type-C |
| **RC522 RFID Reader Module** | 1 | 13.56 MHz SPI interface with Mifare S50 cards / keyfobs (**3.3V Power ONLY**) |
| **16x2 I2C LCD Display #1** | 1 | Door Scan Prompt display, Address `0x27` (Default) |
| **16x2 I2C LCD Display #2** | 1 | Classroom Telemetry display, Address `0x26` (Bridged A0 solder jumper) |
| **4x4 Matrix Membrane Keypad** | 1 | 8-pin connector (4 Rows, 4 Columns) |
| **SG90 / MG90S Micro Servo** | 1 | Turnstile / gate physical bar barrier (180° rotation) |
| **Green 5mm LED** | 1 | Exit / On-time return & gate open indicator |
| **Red 5mm LED** | 1 | Overdue / Access denied / Rejection indicator |
| **Active 5V Buzzer** | 1 | Audible feedback and chime alerts |
| **Momentary Push Button** | 1 | Red Emergency SOS Trigger button |
| **Current Limiting Resistors** | 2 | 220Ω or 330Ω resistors for Green and Red LEDs |
| **Pull-up Resistor** | 1 | 10kΩ resistor for SOS button (if external pull-up is desired) |
| **Solderless Breadboard** | 1–2 | Full-size (830 tie points) + jumper wires (M-M, M-F, F-F) |
| **5V 2A DC Power Supply** | 1 | External adapter recommended to prevent brownouts when servo rotates |

---

## 2. Complete ESP32 Pin Mapping Table

| Peripheral | Peripheral Pin | ESP32 GPIO | Operating Voltage | Connection Type / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **RC522 RFID** | VCC | **3V3** | 3.3V | **CAUTION: Connecting to 5V will burn the RC522 chip!** |
| | RST | **GPIO 4** | 3.3V | Hardware reset line |
| | GND | **GND** | 0V | Common system ground |
| | MISO | **GPIO 19** | 3.3V | VSPI MISO |
| | MOSI | **GPIO 23** | 3.3V | VSPI MOSI |
| | SCK | **GPIO 18** | 3.3V | VSPI Clock |
| | SDA / SS | **GPIO 5** | 3.3V | VSPI Chip Select (Slave Select) |
| **LCD 1 (0x27)** | VCC | **5V / VIN** | 5V | Contrast potentiometer on rear I2C backpack |
| | GND | **GND** | 0V | Common ground |
| | SDA | **GPIO 21** | 3.3V / 5V | I2C Data bus (shared with LCD 2) |
| | SCL | **GPIO 22** | 3.3V / 5V | I2C Clock bus (shared with LCD 2) |
| **LCD 2 (0x26)** | VCC | **5V / VIN** | 5V | Shared power rail |
| | GND | **GND** | 0V | Common ground |
| | SDA | **GPIO 21** | 3.3V / 5V | Connected in parallel with LCD 1 SDA |
| | SCL | **GPIO 22** | 3.3V / 5V | Connected in parallel with LCD 1 SCL |
| **4x4 Keypad** | Row 1 | **GPIO 13** | 3.3V | Membrane header Pin 1 |
| | Row 2 | **GPIO 12** | 3.3V | Membrane header Pin 2 |
| | Row 3 | **GPIO 14** | 3.3V | Membrane header Pin 3 |
| | Row 4 | **GPIO 27** | 3.3V | Membrane header Pin 4 |
| | Col 1 | **GPIO 26** | 3.3V | Membrane header Pin 5 |
| | Col 2 | **GPIO 25** | 3.3V | Membrane header Pin 6 |
| | Col 3 | **GPIO 33** | 3.3V | Membrane header Pin 7 |
| | Col 4 | **GPIO 32** | 3.3V | Membrane header Pin 8 |
| **Servo Gate** | Signal (Orange/White)| **GPIO 15** | PWM / 3.3V | Driven by `ESP32Servo` library |
| | VCC (Red) | **VIN / Ext 5V** | 5V | Power from 5V rail (separate external supply recommended) |
| | GND (Brown/Black)| **GND** | 0V | Common ground |
| **Green LED** | Anode (+) | **GPIO 2** | 3.3V | Connect via 220Ω resistor to GPIO 2 |
| | Cathode (-) | **GND** | 0V | Ground rail |
| **Red LED** | Anode (+) | **GPIO 16** | 3.3V | Connect via 220Ω resistor to GPIO 16 |
| | Cathode (-) | **GND** | 0V | Ground rail |
| **Buzzer** | Positive (+) | **GPIO 17** | 3.3V / 5V | Active buzzer (generates tone on digital HIGH) |
| | Negative (-) | **GND** | 0V | Ground rail |
| **SOS Push Button**| Terminal 1 | **GPIO 34** | 3.3V | Input pin (read as LOW when pressed) |
| | Terminal 2 | **GND** | 0V | Direct connection to Ground |

---

## 3. Configuring Dual I2C LCD Addresses

Both LCDs communicate over the same standard ESP32 I2C bus (`SDA = GPIO 21`, `SCL = GPIO 22`).
To prevent an I2C address collision:
1. **LCD 1 (0x27):** Leave the three solder pads (`A0`, `A1`, `A2`) on the PCF8574 backpack open. Default address is `0x27`.
2. **LCD 2 (0x26):** Bridge the two small solder pads labeled **`A0`** with a tiny dab of solder on the rear backpack. This changes its address from `0x27` to `0x26`.

> **Note on PCF8574A Chip variants:** If your backpack uses the `PCF8574AT` chip, the default base address is `0x3F` (open) and `0x3E` (A0 bridged). If text does not appear, run the standard Arduino I2C Scanner sketch to verify your backpack's hexadecimal address.

---

## 4. Power & Common Ground Guidelines

1. **Servo Current Spikes:** The micro-servo motor draws up to 500mA during motor starts. If powered directly from the ESP32's 3.3V pin, the microcontroller will suffer brownout resets (`Brownout detector was triggered`). Always power the servo from the **VIN (5V)** pin or an external 5V 2A power supply.
2. **Common Ground:** When using an external 5V power supply for the servo and LCDs, **always tie the external supply's GND terminal to the ESP32 GND rail**. Without a shared ground reference, logic signals to the servo and I2C buses will float.
3. **RC522 RFID 3.3V Rule:** The RC522 RFID chip is strictly rated for **2.5V – 3.6V**. **NEVER connect RC522 VCC to 5V**.

---

## 5. Arduino IDE Setup Instructions

1. Open **Arduino IDE** (v2.x recommended).
2. Go to **File -> Preferences -> Additional Boards Manager URLs** and add:
   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Open **Tools -> Board -> Boards Manager**, search for `esp32` by Espressif Systems, and click **Install**.
4. Select board: **Tools -> Board -> ESP32 Arduino -> DOIT ESP32 DEVKIT V1**.
5. Install required libraries via **Sketch -> Include Library -> Manage Libraries...**:
   - `ArduinoJson` (by Benoit Blanchon)
   - `MFRC522` (by GithubCommunity)
   - `LiquidCrystal_I2C` (by Frank de Brabander)
   - `Keypad` (by Mark Stanley, Alexander Brevig)
   - `ESP32Servo` (by Kevin Harrington)
6. Open `esp32_smart_outpass.ino`, update your `WIFI_SSID`, `WIFI_PASSWORD`, and `BACKEND_BASE_URL` (your computer's local IP, e.g. `http://192.168.1.150:3000`).
7. Connect ESP32 via USB and click **Upload**.
