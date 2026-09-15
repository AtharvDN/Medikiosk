# MediKiosk — Smart Multilingual Patient Case-Taking & Clinical Intake Platform

[![SIH 2026](https://img.shields.io/badge/SIH-2026-orange.svg)](https://www.sih.gov.in/)
[![Ministry of Ayush](https://img.shields.io/badge/Ministry-Ayush-green.svg)](https://ayush.gov.in/)
[![All India Institute of Ayurveda](https://img.shields.io/badge/Department-AIIA-blue.svg)](https://aiia.gov.in/)
[![Problem Statement](https://img.shields.io/badge/Problem%20Statement-SIH26047-red.svg)](https://www.sih.gov.in/)
[![License](https://img.shields.io/badge/License-Apache%202.0-lightgrey.svg)](LICENSE)
[![OCR Engine](https://img.shields.io/badge/OCR-PaddleOCR%20Devanagari%20PP--OCRv5-blueviolet.svg)]()
[![Voice Pipeline](https://img.shields.io/badge/Voice-Sovereign%20ASR%20%2B%20Neural%20TTS-teal.svg)]()
[![Clinical Summary](https://img.shields.io/badge/Clinical%20Summary-Deterministic%20Verbal%20Synthesis-success.svg)]()

> **SIH 2026 Problem Statement ID:** SIH26047  
> **Title:** Patient Case-Taking Software  
> **Organization:** Ministry of Ayush | **Department:** All India Institute of Ayurveda (AIIA)  
> **Theme:** MedTech / BioTech / HealthTech  

---

## ⚡ Antigravity Prompt (Copy & Paste to Run Everything)

If you are opening this repository in **Google Antigravity IDE** (or any agentic AI coding environment), **copy and paste the exact prompt block below** to automatically install dependencies, initialize the database, start all microservices, and verify the build:

```text
Please set up, configure, and launch the MediKiosk application:

1. Prerequisites Check:
   - Check that Node.js (v18+), Python (3.10-3.12), and FFmpeg are installed and available in PATH.

2. Install Dependencies:
   - Run `npm install` in the root directory (this installs dependencies for both backend and frontend workspaces).
   - In `voice_runtime/`, install Python dependencies: `pip install -r voice_runtime/requirements.txt`.

3. Database & Environment Configuration:
   - If `backend/.env` does not exist, copy from `backend/.env.example`.
   - In `backend/`, generate Prisma client and synchronize schema:
     `npx prisma generate`
     `npx prisma db push`
   - Seed the database with the 4 demo doctors, hospital departments, and demo patients:
     `npm run db:seed`

4. Launch Microservices:
   - Start all services using the root script `npm run dev` or run in dedicated daemon terminals:
     a) Python Voice & OCR Runtime: `python voice_runtime/server.py` (Ports 8001 ASR, 8002 OCR, 8003 TTS)
     b) Node.js Express Backend: `npm --prefix backend run dev` (Port 5000)
     c) Vite Patient & Doctor Web Frontend: `npm --prefix frontend run dev` (Port 5173)

5. Automated Verification:
   - Run the integration tests: `npx vitest run tests/phase10bRefinement.test.js` and `npx vitest run tests/voiceApi.test.js` inside `backend/`.
   - Confirm when all ports are responding and provide the demo doctor and patient credentials.
```

---

## 1. System Overview

**MediKiosk** is a sovereign, multimodal clinical intake platform engineered for high-volume outpatient departments (OPDs) in Indian tertiary hospitals and Ayurvedic institutes.

The platform provides a complete end-to-end clinical workflow:
1. **Patient Intake Kiosk (`/`):** Touch-first vernacular interface in **Marathi (मराठी), Hindi (हिन्दी), and English**. Patients report symptoms verbally or via touch, upload past prescriptions/reports with on-device OCR, review a verified clinical summary, and receive an OPD queue token.
2. **Physician Workstation (`/doctor/login`):** Institutional clinical console for doctors. Features department-scoped patient queues, condition-driven physical examinations, AYUSH vs Modern medicine separation, patient-entered vitals review, and digital sign-off.
3. **Patient Longitudinal Portal (`/patient/dashboard`):** Historical timeline of past visits, physician clinical impressions, doctor's advice & care plans, ABDM-linked medical reports, and OPD request cancellation.
4. **Sovereign AI & Voice Microservices:** Local, privacy-preserving microservices partitioned across dedicated ports for Speech-to-Text (ASR), Devanagari OCR, and Natural Speech Synthesis (TTS).

---

## 2. Dedicated Microservice Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Patient Kiosk & Doctor Portal (Port 5173)                │
│        Vanilla HTML5 + Modern CSS3 + Native ES Modules (Zero React)         │
│     • Touch-First Kiosk (>= 64px tap targets, Audio Visualizer, Dual Mic)   │
│     • Doctor Workstation (Queue, Condition-Driven Exam, AYUSH Scoping)      │
│     • Patient Portal (Longitudinal History, Doctor Conclusion & Remarks)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST API (JSON / Base64, up to 25 MB)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                     Node.js Express Backend (Port 5000)                     │
│    • Clinical Session State Machine        • Deterministic Verbal Summary   │
│    • Doctor-Encounter Authorization Scope • Medication Reconciliation      │
│    • Patient History & Timeline Builder   • Provenance & Audit Logs        │
└──────────────────┬───────────────────────────────────────────┬──────────────┘
                   │ Prisma Client                             │ HTTP REST
┌──────────────────▼──────────────────┐     ┌──────────────────▼──────────────┐
│       Supabase / PostgreSQL         │     │ Sovereign Python Microservices  │
│ • ClinicalSession & MedicalDocument │     │                                 │
│ • Patient, Doctor, Encounters & Notes│     │  • Port 8001: IndicConformer ASR│
│ • Strict Doctor Queue Isolation     │     │  • Port 8002: PaddleOCR Engine  │
│ • DoctorReview & Finalized Exams    │     │  • Port 8003: Neural TTS Engine │
└─────────────────────────────────────┘     └─────────────────────────────────┘
```

### Dedicated Service Ports
| Service | Technology | Port | Primary Endpoints |
|---|---|---|---|
| **Web Frontend** | Vanilla JS / Vite | `5173` | `http://localhost:5173` |
| **Backend REST API** | Express.js / Prisma | `5000` | `http://localhost:5000/api/*` |
| **Vernacular ASR** | IndicConformer / Google ASR | `8001` | `http://127.0.0.1:8001/asr`, `/health` |
| **Devanagari OCR** | PaddleOCR PP-OCRv5 | `8002` | `http://127.0.0.1:8002/ocr`, `/health` |
| **Neural TTS** | Multilingual Neural TTS | `8003` | `http://127.0.0.1:8003/tts`, `/health` |

---

## 3. Technology Stack

### Frontend Client (`frontend/`)
- **Core:** Pure HTML5, Modern CSS3, Native Vanilla JavaScript (ES Modules). Zero React / TypeScript bundle overhead for instant kiosk cold boots.
- **Typography:** Google Fonts (Inter, Noto Sans, Noto Sans Devanagari).
- **Audio:** Web Audio API with auto-unlocking, discrete voice state machine (`IDLE` $\rightarrow$ `LISTENING` $\rightarrow$ `PROCESSING` $\rightarrow$ `TRANSCRIBING` $\rightarrow$ `SUCCESS`).
- **Responsive Layout:** 16:9 Landscape touch kiosk display + Desktop Doctor Workstation.

### Backend Application (`backend/`)
- **Runtime:** Node.js (v18+) ES Modules.
- **Framework:** Express.js 4 (configured with 25 MB payload limit for high-res prescription scans).
- **Database & ORM:** PostgreSQL / Supabase with Prisma ORM 5.
- **Security:** JWT authentication, Bcrypt password hashing, doctor-patient authorization scoping.
- **Clinical Engine:** Deterministic summary builder, multi-symptom triage classifier, AYUSH assessment pipeline.

### Sovereign AI Runtime (`voice_runtime/`)
- **Speech-to-Text (ASR):** Vernacular acoustic speech recognition with multi-locale cascading fallback (`mr-IN` $\rightarrow$ `hi-IN` $\rightarrow$ `en-IN`) on port `8001`.
- **Document OCR:** PaddleOCR 3.x using `devanagari_PP-OCRv5_mobile_rec` for authentic Devanagari (Marathi/Hindi) and English prescription recognition on port `8002`. Supports PDF multi-page rasterization via `pypdfium2`.
- **Text-to-Speech (TTS):** 24kHz studio-quality Neural TTS (`mr-IN-AarohiNeural`, `hi-IN-SwaraNeural`, `en-IN-NeerjaNeural`) on port `8003`.

---

## 4. Demo Doctor & Patient Credentials

The seed script creates four realistic demo doctor profiles covering diverse hospital specialties and pre-configured patient records:

### Doctor Workstation Logins (`http://localhost:5173/doctor/login`)

| Doctor Name | Department / Specialty | Employee ID / Email | Password | Room |
|---|---|---|---|---|
| **Dr. Priya Deshmukh** | General Medicine | `DOC-8942` / `doctor@medikiosk.local` | `Password123!` | OPD Room 3 |
| **Dr. Rajendra Joshi** | AYUSH / Kayachikitsa | `DOC-AYUSH-01` / `ayush.doctor@medikiosk.local` | `Password123!` | OPD Room 7 |
| **Dr. Neha Kulkarni** | Pediatrics OPD | `DOC-PEDI-01` / `pedi.doctor@medikiosk.local` | `Password123!` | OPD Room 5 |
| **Dr. Arjun Patil** | Orthopaedics OPD | `DOC-ORTHO-01` / `ortho.doctor@medikiosk.local` | `Password123!` | OPD Room 12 |

### Demo Patient Profiles (Patient Portal & Kiosk)

| Field | Demo Value |
|---|---|
| **ABHA ID** | `91-4812-7392-1049` |
| **Hospital UHID** | `PUNE-2026-0042` |
| **Mobile Number** | `9822012345` |
| **Patient Name** | Ananya Sharma / Sunita Deshmukh |

---

## 5. Manual Prerequisites

Before running the application manually, ensure the following software is installed:

1. **Node.js**: `v18.x` or later (`node -v`)
2. **npm**: `v9.x` or later (`npm -v`)
3. **Python**: `3.10` to `3.12` (`python --version`)
4. **FFmpeg**: Required for audio transcoding and loudness normalization.
   - **Windows:** `winget install Gyan.FFmpeg` or download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) and add its `bin/` directory to your `PATH`.
   - **Linux:** `sudo apt update && sudo apt install -y ffmpeg`
   - **macOS:** `brew install ffmpeg`
5. **PostgreSQL / Supabase**: A local PostgreSQL instance or a free cloud database from [Supabase](https://supabase.com).

---

## 6. Step-by-Step Installation

### Step 1: Clone the Repository
```bash
git clone https://github.com/VipulRekhi/Code2Cure.git
cd Code2Cure
```

### Step 2: Install Node.js Dependencies
```bash
npm install
```
*(This installs dependencies across the root, `backend/`, and `frontend/` workspaces).*

### Step 3: Install Python Dependencies
```bash
# Optional but recommended: create a virtual environment
python -m venv .venv

# Activate virtual environment:
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# Install requirements
pip install -r voice_runtime/requirements.txt
```

### Step 4: Configure Backend Environment Variables
```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and configure your database credentials:
```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

# PostgreSQL / Supabase Connection URL
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/medikiosk_db?schema=public"
DIRECT_URL="postgresql://postgres:your_password@localhost:5432/medikiosk_db?schema=public"

JWT_SECRET="medikiosk_super_secure_development_secret_key_12345"
JWT_EXPIRES_IN=7d

# Isolated Microservice Ports
ASR_URL=http://127.0.0.1:8001
ASR_ENDPOINT=http://127.0.0.1:8001/asr
OCR_URL=http://127.0.0.1:8002
OCR_ENDPOINT=http://127.0.0.1:8002/ocr
TTS_URL=http://127.0.0.1:8003
TTS_ENDPOINT=http://127.0.0.1:8003/tts
```

### Step 5: Initialize and Seed the Database
```bash
cd backend
npx prisma generate
npx prisma db push
npm run db:seed
cd ..
```

---

## 7. Running the Application

### Option A: Single Command (Recommended)
From the repository root, start all 3 services concurrently:
```bash
npm run dev
```

*This launches:*
- **Python Voice/OCR Microservices** on ports `8001`, `8002`, `8003`
- **Express Backend API** on `http://localhost:5000`
- **Vite Web Frontend** on `http://localhost:5173`

---

### Option B: Separate Terminals

#### Terminal 1: Sovereign Voice & OCR Microservices
```bash
python voice_runtime/server.py
```
*Health endpoints: `http://127.0.0.1:8001/health` (ASR), `http://127.0.0.1:8002/health` (OCR), `http://127.0.0.1:8003/health` (TTS).*

#### Terminal 2: Node.js Express Backend
```bash
npm run dev:backend
```
*API Base: `http://localhost:5000`.*

#### Terminal 3: Web Frontend
```bash
npm run dev:frontend
```
*App UI: `http://localhost:5173`.*

---

## 8. Verification & Automated Testing

Run the automated integration test suites to verify backend, frontend, and voice pipeline integrity:

### 1. Phase 10B Clinical Specifications Suite (9/9 Passed)
```bash
cd backend
npx vitest run tests/phase10bRefinement.test.js
```
*Verifies: Doctor queue scoping, condition-driven physical exam matrix, AYUSH null-safety for General Medicine, patient-entered vitals provenance, OPD cancellation rules, and optional OCR.*

### 2. Sovereign Voice & Multilingual Audio Pipeline (12/12 Passed)
```bash
cd backend
npx vitest run tests/voiceApi.test.js
```
*Verifies: Real acoustic Marathi/Hindi/English speech recognition, 24kHz neural audio streaming, cross-session zero leakage, and dynamic clinical triage.*

### 3. Doctor Workstation & Scoping Suite (14/14 Passed)
```bash
cd backend
npx vitest run tests/doctorPortal.test.js
```

### 4. Frontend Component & State Tests (49/49 Passed)
```bash
cd frontend
npm test
```

---

## 9. Key Clinical Invariants & Safety Rules

> [!IMPORTANT]
> **MediKiosk Clinical Boundaries:**
> - **Intake & Structuring Platform Only:** MediKiosk never asserts definitive diagnoses or suggests prescription dosages autonomously.
> - **Physician Ownership:** Clinical impressions and care plans must be entered, reviewed, and finalized by a licensed physician before publication to the patient portal.
> - **AYUSH Separation:** For modern medicine encounters, `ayushAssessment` is strictly `null`. Ayurvedic assessments (Prakriti, Vikriti, Agni, Koshtha) are only active for AYUSH OPD encounters.
> - **Vitals Provenance:** Vitals recorded at the kiosk are strictly marked `PATIENT_ENTERED` until verified by a physician.
> - **Zero OCR Hallucination:** Missing fields in uploaded prescriptions are explicitly labeled `"Not detected"` or `"NOT_PROVIDED"`, never invented.

---

## 10. Troubleshooting

### 1. "Voice service temporarily unavailable" / Microphone Not Working
- Ensure `python voice_runtime/server.py` is running and `http://127.0.0.1:8001/health` returns status `200`.
- Verify that FFmpeg is installed and accessible in your system `PATH` (`ffmpeg -version`).
- Allow microphone permissions in your browser for `http://localhost:5173`.

### 2. Doctor Workspace Blank Screen
- Ensure you have logged in with a valid doctor profile (e.g. `DOC-8942` / `Password123!`).
- Verify that the patient selected in the queue is assigned to that doctor's department.

### 3. Database Connection Error
- Check that PostgreSQL is running locally or that your Supabase credentials in `backend/.env` are valid.
- Run `npx prisma db push` inside `backend/` to verify connection and schema synchronization.

---

## 11. Contributing & License

Developed for the **Smart India Hackathon (SIH 2026)** under the Ministry of Ayush & All India Institute of Ayurveda (AIIA).

Licensed under the [Apache License 2.0](LICENSE).
