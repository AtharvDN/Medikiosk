/**
 * Screen 0: Top-Level Landing & Entrypoint (Phase 10B Redesign)
 * Matches frontend design / Medikiosk reference design.
 * Pure Vanilla HTML5, CSS3, ES Modules.
 */

import { t } from '../i18n.js';
import { appState, setLanguage, notifyStateChange } from '../state.js';
import { router } from '../router.js';

export function renderLandingScreen() {
  const lang = appState.language;
  const isPatientLoggedIn = !!(appState.patient?.id);

  const html = `
    <div style="min-height: 100vh; background: var(--color-bg); display: flex; flex-direction: column; margin: -1.5rem -1rem;">
      <!-- Main Hero Section -->
      <section style="background: linear-gradient(120deg, #F5F7FA 0%, #E6F3F2 100%); padding: 48px 24px 60px; border-bottom: 1px solid var(--color-border);">
        <div style="max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 40px; align-items: center;">
          <!-- Left Hero Copy -->
          <div>
            <div style="display: inline-flex; align-items: center; gap: 6px; background: var(--color-teal-light); color: var(--color-teal); padding: 6px 14px; border-radius: var(--radius-full); font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 16px;">
              ✨ SMART HOSPITAL KIOSK · AYUSH INTEGRATED
            </div>

            <h1 style="font-size: clamp(32px, 4.5vw, 48px); line-height: 1.15; color: var(--color-navy); margin: 0 0 16px; letter-spacing: -0.02em; font-weight: 800;">
              Smart Health Reception<br />
              <span style="color: var(--color-teal);">Fast Clinical Intake</span>
            </h1>

            <p style="font-size: 16px; color: var(--color-gray-700); line-height: 1.6; margin: 0 0 28px; max-width: 520px;">
              Voice-guided bilingual medical intake, instant prescription OCR parsing, holistic AYUSH constitution scoring, and seamless digital token handover for District Hospital OPDs.
            </p>

            <!-- Dual Entry CTAs -->
            <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: center;">
              <button
                id="btn-landing-patient"
                type="button"
                class="btn btn--primary btn--lg"
                style="font-size: 16px; font-weight: 700; padding: 14px 28px; display: inline-flex; align-items: center; gap: 8px;"
              >
                <span>${isPatientLoggedIn ? t('openPatientDashboard', lang) || 'Open Patient Dashboard' : t('startPatientCheckIn', lang) || 'Start Patient Check-In'}</span>
                <span>➔</span>
              </button>

              <button
                id="btn-landing-doctor"
                type="button"
                class="btn btn--secondary btn--lg"
                style="font-size: 15px; font-weight: 600; padding: 14px 24px; display: inline-flex; align-items: center; gap: 8px;"
              >
                <span>🩺</span>
                <span>${t('doctorPortal', lang) || 'Doctor Portal'}</span>
              </button>
            </div>

            <!-- Trust Indicators -->
            <div style="display: flex; flex-wrap: wrap; gap: 18px; margin-top: 32px; font-size: 13px; color: var(--color-gray-600); font-weight: 600;">
              <span style="display: flex; align-items: center; gap: 6px;">
                🛡️ ABHA & ABDM Compliant
              </span>
              <span style="display: flex; align-items: center; gap: 6px;">
                🌐 Multi-Language (EN / HI / MR)
              </span>
              <span style="display: flex; align-items: center; gap: 6px;">
                🔊 Voice & Audio Guidance
              </span>
            </div>
          </div>

          <!-- Right Interactive Graphic Card -->
          <div>
            <div
              class="card card--elevated"
              style="background: linear-gradient(135deg, #1A3A5C 0%, #2A5A8C 100%); color: #FFFFFF; padding: 28px; border-radius: 20px; box-shadow: var(--shadow-xl); position: relative; overflow: hidden;"
            >
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <span class="status-badge" style="background: rgba(255,255,255,0.15); color: #FFFFFF; border: none;">
                  ● KIOSK READY
                </span>
                <span style="font-size: 12px; color: var(--color-sky-light);">
                  Terminal 01 · OPD Ground Floor
                </span>
              </div>

              <div style="margin-bottom: 18px;">
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-sky-light); font-weight: 700;">
                  HOW IT WORKS
                </span>
                <h3 style="font-size: 20px; margin: 6px 0 10px; color: #FFF; font-weight: 700;">
                  1. Speak Symptoms in Your Language<br />
                  2. Scan Lab Reports & Prescriptions<br />
                  3. Collect OPD Queue Token
                </h3>
                <p style="font-size: 13px; color: #D3E2F0; margin: 0; line-height: 1.5;">
                  Trained for high-volume Indian government civil hospitals with complete OPD doctor synchronization.
                </p>
              </div>

              <div style="background: rgba(255, 255, 255, 0.1); padding: 12px 16px; border-radius: var(--radius-md); display: flex; align-items: center; gap: 12px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--color-teal); display: grid; place-items: center; font-size: 16px;">
                  🎙️
                </div>
                <div>
                  <strong style="font-size: 13px; display: block; color: #FFF;">AI Voice Assistant</strong>
                  <span style="font-size: 11px; color: #A0C4E2;">English · हिंदी · मराठी</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Feature Strip -->
      <section style="max-width: 1120px; margin: 48px auto; padding: 0 24px; flex: 1;">
        <div style="text-align: center; margin-bottom: 36px;">
          <span style="font-size: 12px; font-weight: 700; color: var(--color-teal); letter-spacing: 0.08em; text-transform: uppercase;">
            COMPLETE CLINICAL PIPELINE
          </span>
          <h2 style="font-size: 28px; color: var(--color-navy); margin: 6px 0 8px; font-weight: 800;">
            Designed for Indian Hospital OPDs
          </h2>
          <p style="font-size: 15px; color: var(--color-gray-600); margin: 0;">
            Empowering patients at the reception while saving precious physician consultation time.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px;">
          <div class="card" style="padding: 20px;">
            <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--color-info-bg); color: var(--color-navy); display: grid; place-items: center; margin-bottom: 14px; font-size: 20px;">
              🎙️
            </div>
            <h3 style="font-size: 16px; color: var(--color-navy); margin: 0 0 6px; font-weight: 700;">
              Multilingual Voice Intake
            </h3>
            <p style="font-size: 13px; color: var(--color-gray-600); line-height: 1.5; margin: 0;">
              Patients explain symptoms naturally in Hindi, Marathi, or English with automatic medical term extraction.
            </p>
          </div>

          <div class="card" style="padding: 20px;">
            <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--color-teal-light); color: var(--color-teal); display: grid; place-items: center; margin-bottom: 14px; font-size: 20px;">
              📄
            </div>
            <h3 style="font-size: 16px; color: var(--color-navy); margin: 0 0 6px; font-weight: 700;">
              Instant Document OCR
            </h3>
            <p style="font-size: 13px; color: var(--color-gray-600); line-height: 1.5; margin: 0;">
              Digitizes paper prescriptions, lab reports, and discharge summaries with entity structuring.
            </p>
          </div>

          <div class="card" style="padding: 20px;">
            <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: #FEF3C7; color: #D97706; display: grid; place-items: center; margin-bottom: 14px; font-size: 20px;">
              🌿
            </div>
            <h3 style="font-size: 16px; color: var(--color-navy); margin: 0 0 6px; font-weight: 700;">
              AYUSH & Allopathic Triage
            </h3>
            <p style="font-size: 13px; color: var(--color-gray-600); line-height: 1.5; margin: 0;">
              Provides Prakriti scoring, Dasha-Vidha Pariksha, and standardized red-flag triage recommendations.
            </p>
          </div>

          <div class="card" style="padding: 20px;">
            <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--color-success-bg); color: var(--color-success); display: grid; place-items: center; margin-bottom: 14px; font-size: 20px;">
              🏥
            </div>
            <h3 style="font-size: 16px; color: var(--color-navy); margin: 0 0 6px; font-weight: 700;">
              Physician Workstation
            </h3>
            <p style="font-size: 13px; color: var(--color-gray-600); line-height: 1.5; margin: 0;">
              Real-time patient queue, 8-tab comprehensive clinical workspace, and ABHA compliant e-signoff.
            </p>
          </div>
        </div>
      </section>

      <!-- Language Selector Footer Bar -->
      <section style="background: #F1F5F9; border-top: 1px solid var(--color-border); padding: 14px 24px; text-align: center;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <span style="font-size: 12px; color: var(--color-gray-600); font-weight: 600;">भाषा निवडा / भाषा चुनें / Select Language:</span>
          <button id="btn-lang-en" type="button" class="btn ${lang === 'en' ? 'btn--primary' : 'btn--secondary'}" style="padding: 4px 12px; font-size: 12px;">English</button>
          <button id="btn-lang-hi" type="button" class="btn ${lang === 'hi' ? 'btn--primary' : 'btn--secondary'}" style="padding: 4px 12px; font-size: 12px;">हिंदी</button>
          <button id="btn-lang-mr" type="button" class="btn ${lang === 'mr' ? 'btn--primary' : 'btn--secondary'}" style="padding: 4px 12px; font-size: 12px;">मराठी</button>
        </div>
      </section>

      <!-- Institutional Footer -->
      <footer style="background: #0F2640; color: #FFFFFF; padding: 24px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
        <div style="max-width: 1120px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <strong style="font-size: 15px; display: block;">MediKiosk — SIH 26047</strong>
            <span style="font-size: 12px; color: #A0C4E2;">
              All India Institute of Ayurveda & District Civil Hospital Pune
            </span>
          </div>
          <div style="font-size: 12px; color: #A0C4E2;">
            ABDM Compliant · Safe & Encrypted Clinical Data Exchange
          </div>
        </div>
      </footer>
    </div>
  `;

  return {
    html,
    attachEvents: () => {
      // Patient Check-in
      document.getElementById('btn-landing-patient')?.addEventListener('click', () => {
        if (appState.patient?.id) {
          router.navigate('patientDashboard');
        } else {
          router.navigate('welcome');
        }
      });

      // Doctor Portal
      document.getElementById('btn-landing-doctor')?.addEventListener('click', () => {
        window.location.hash = '#/doctor';
      });

      // Language Switchers
      document.getElementById('btn-lang-en')?.addEventListener('click', () => {
        setLanguage('en');
        router.renderCurrentScreen();
      });
      document.getElementById('btn-lang-hi')?.addEventListener('click', () => {
        setLanguage('hi');
        router.renderCurrentScreen();
      });
      document.getElementById('btn-lang-mr')?.addEventListener('click', () => {
        setLanguage('mr');
        router.renderCurrentScreen();
      });
    }
  };
}
