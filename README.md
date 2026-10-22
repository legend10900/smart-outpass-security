# Smart Outpass Security System (ESP32 IoT + Next.js + Supabase)

An enterprise-grade IoT classroom movement monitoring and role-based overdue verification system. Designed for high schools and universities to manage student transition times between periods, detect hall-wandering, verify tardiness through faculty workflows, and provide audited parent notification receipts.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Classroom Door Hardware [ESP32 DevKit V1 Door Node]
        RFID[RC522 RFID Reader]
        Keypad[4x4 Matrix Keypad]
        LCD1["LCD 1 (0x27): Door Prompt"]
        LCD2["LCD 2 (0x26): Room Count"]
        Servo[Servo Gate Barrier]
        SOS[Emergency SOS Button]
        LEDs[Green & Red Status LEDs]
        Buzzer[Tone Alert Buzzer]
    end

    subgraph Backend API [Next.js App Router]
        ScanAPI["POST /api/hardware/scan"]
        ReasonAPI["POST /api/hardware/reason"]
        HeartbeatAPI["POST /api/hardware/heartbeat"]
        SosAPI["POST /api/hardware/sos"]
        VerifyAPI["POST /api/staff/verify"]
        AdminAPI["POST /api/admin/config"]
    end

    subgraph Database & Realtime [Supabase PostgreSQL]
        DB_Students[(students)]
        DB_Logs[(movement_logs)]
        DB_Staff[(staff)]
        DB_Device[(device_status)]
        DB_Notif[(notification_logs)]
        DB_SOS[(sos_alerts)]
    end

    subgraph Client Portals [Web Application]
        MonitorView["/ Live Corridor Monitor"]
        TeacherPortal["/teacher Faculty Console"]
        CoordPortal["/coordinator Triage Console"]
        ParentPortal["/parent Guardian View"]
        AdminView["/admin Policy & RFID Config"]
        SimDrawer["[DEMO / HARDWARE SIMULATOR]"]
    end

    RFID -->|Tap Card| ScanAPI
    Keypad -->|Reason 1-4 + Code| ReasonAPI
    SOS -->|Push Alarm| SosAPI
    Door Node -->|Every 3s Heartbeat| HeartbeatAPI

    ScanAPI --> Database & Realtime
    ReasonAPI --> Database & Realtime
    HeartbeatAPI --> Database & Realtime
    VerifyAPI --> Database & Realtime
    AdminAPI --> Database & Realtime

    Database & Realtime --> Client Portals
    SimDrawer -.->|Simulated Scan/Keypad/SOS| Backend API
```

---

## Key Features

1. **Strict Single-Reader Directional State Machine:**
   - Single RC522 reader at classroom door differentiates **EXIT** from **RETURN** strictly via database state (`INSIDE` vs `OUTSIDE_ACTIVE`).
   - Normal return before the 60-second timer expires closes the pass as `RETURNED_ON_TIME`.
   - Late return locks the gate and prompts a 4-choice keypad reason (`1: Teacher`, `2: Coordinator`, `3: Infirmary`, `4: Other`).

2. **Role-Based Overdue Verification:**
   - **Option 1 (`Teacher`):** Student enters teacher's 2-digit shortcode (e.g., `#01`). Requests appear live in Teacher Portal for instant **Approve** (unlocks door gate) or **Reject** (notifies coordinator and parent).
   - **Option 2 (`Coordinator`):** Directly escalates to Coordinator security queue.
   - **Option 3 (`Infirmary`):** Routes to Medical/Infirmary review ledger.
   - **Option 4 (`Other`):** Dispatches immediate factual, non-accusatory notice to parent/guardian and coordinator.

3. **Audited Notification Confirmation Rule:**
   - Notifications via Telegram Bot API and Nodemailer SMTP require an explicit **HTTP 200 OK** confirmation response before updating `parent_notified = true` and writing the delivery timestamp (`parent_notified_at`).

4. **Hardware Integrity & Fail-Safe Online Status:**
   - ESP32 sends a heartbeat every 3 seconds.
   - If `NOW() - last_heartbeat > 10 seconds`, the web UI turns red with **`HARDWARE OFFLINE`**.
   - Remote command queueing (`OPEN_GATE`, `REJECT_BUZZER`) dispatches actions to physical node on the next heartbeat.

5. **Integrated Hardware Simulator (Demo Mode):**
   - Built-in slide-out `[DEMO / HARDWARE SIMULATOR]` drawer lets you simulate RFID card taps, keypad entries (`1`, `2`, `3`, `4` + `#`), and SOS alarms before physical breadboard assembly.
   - All simulated events are explicitly stamped with `source = 'SIMULATED'`.

---

## Directory Structure

```text
c:\Users\Admin\rfid\
├── app/
│   ├── api/
│   │   ├── admin/config/route.ts      # Policy & profile manager
│   │   ├── data/overview/route.ts     # Real-time state query
│   │   ├── hardware/heartbeat/route.ts# 3s ESP32 heartbeat & sweeper
│   │   ├── hardware/reason/route.ts   # 4x4 Keypad reason router
│   │   ├── hardware/scan/route.ts     # RFID card scan state machine
│   │   ├── hardware/sos/route.ts      # Emergency push button endpoint
│   │   ├── sos/acknowledge/route.ts   # Siren acknowledge endpoint
│   │   └── staff/verify/route.ts      # Faculty Approve/Reject handler
│   ├── coordinator/page.tsx           # Coordinator Security Command
│   ├── parent/page.tsx                # Isolated Guardian Outpass Portal
│   ├── teacher/page.tsx               # Faculty Verification Console
│   ├── admin/page.tsx                 # System Settings & RFID Enrollment
│   ├── globals.css                    # Tailwind & virtual LCD styles
│   ├── layout.tsx                     # Global App Shell & Fonts
│   └── page.tsx                       # Live Corridor Radar & Movement Table
├── components/
│   ├── AppShell.tsx                   # Master wrapper for portals
│   ├── GlobalHeader.tsx               # 10s status indicator & SOS siren
│   └── HardwareSimulatorDrawer.tsx    # Virtual ESP32, LCDs, LEDs, Keypad
├── lib/
│   ├── db.ts                          # Supabase PostgreSQL & local store
│   ├── notifications.ts               # Telegram / SMTP delivery engine
│   ├── supabase.ts                    # Supabase client initializer
│   └── types.ts                       # Complete TypeScript schema
├── esp32_smart_outpass.ino            # Production C++ Arduino firmware
├── schema.sql                         # Complete Supabase SQL migration & seed data
├── WIRING.md                          # Pin-to-pin breadboard wiring guide
├── .env.example                       # Environment variables template
└── package.json                       # Next.js 14 project dependencies
```

---

## Getting Started

### 1. Database Setup (Supabase)
1. Open your [Supabase Dashboard](https://supabase.com).
2. Go to the **SQL Editor** and paste the contents of `schema.sql`.
3. Click **Run**. This creates:
   - All enum types (`student_status_enum`, `movement_status_enum`, etc.)
   - Tables (`system_settings`, `staff`, `students`, `movement_logs`, `device_status`, `sos_alerts`, `notification_logs`)
   - Auto-sweeper stored procedures
   - Supabase Realtime publication setup
   - Seed data for 4 students, 3 teachers, 1 coordinator, 1 admin, and default settings.

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your credentials (optional for local demo mode; the system includes built-in persistent fallbacks with seed data):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional Telegram bot
TELEGRAM_BOT_TOKEN=your-bot-token
```

### 3. Run Next.js Web Application
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Pre-Loaded Seed Data for Quick Testing

### Students & RFID Cards:
| Student Name | Roll Number | Class | Test RFID UID (Hex) |
| :--- | :--- | :--- | :--- |
| **Aryan Patel** | `10-A-04` | Class 10-A | `E2806894` |
| **Chloe Zhao** | `10-A-12` | Class 10-A | `43B1A289` |
| **Liam O'Connor** | `10-A-19` | Class 10-A | `A1B2C3D4` |
| **Zara Al-Mansoor**| `10-A-28` | Class 10-A | `9876FEDC` |

### Faculty & Shortcodes:
| Staff Name | Role | Keypad Shortcode | Email |
| :--- | :--- | :--- | :--- |
| **Mr. Robert Sharma** | Teacher (Math) | `#01` | `sharma@school.edu` |
| **Ms. Sarah Davis** | Teacher (Science) | `#02` | `davis@school.edu` |
| **Dr. Anand Rao** | Teacher (English) | `#03` | `rao@school.edu` |
| **Mrs. Eleanor Jenkins**| Head Coordinator | `#99` | `jenkins.coord@school.edu` |
| **Principal Arthur Miller**| Administrator | `#00` | `miller.admin@school.edu` |

---

## Physical Hardware Deployment (ESP32)

1. Review [WIRING.md](WIRING.md) for breadboard pinout and 3.3V vs 5V voltage rails.
2. In `esp32_smart_outpass.ino`, set:
   ```cpp
   const char* WIFI_SSID     = "Your_WiFi_Network";
   const char* WIFI_PASSWORD = "Your_WiFi_Password";
   const char* BACKEND_BASE_URL = "http://192.168.1.150:3000"; // Computer IP running Next.js
   ```
3. Upload sketch to ESP32 DevKit V1 via Arduino IDE.
4. Watch the Serial Monitor at `115200` baud. Within 3 seconds, the Web UI badge will transition to **`HARDWARE ONLINE (ESP32)`**.
