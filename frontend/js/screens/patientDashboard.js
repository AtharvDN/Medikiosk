/**
 * Screen: Patient Care Dashboard (Phase 10B)
 * Self-service hospital kiosk dashboard based on the reference design.
 * Pure Vanilla HTML5, CSS3, ES Modules.
 */

import { t } from '../i18n.js';
import { appState, notifyStateChange, resetClinicalSession } from '../state.js';
import { router } from '../router.js';
import { api } from '../api.js';
import { audioController } from '../audio.js';

export function renderPatientDashboardScreen() {
  const lang = appState.language;
  const p = appState.patient || {};
  const enc = appState.encounter || {};
  const dept = appState.department || {};

  const patientName = p.fullName || p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Patient';
  const abhaId = p.abhaId || p.identifier || '91-4812-7392-1049';
  const token = enc.tokenNumber || 'T-104';
  const deptName = dept.name || (appState.opdMode === 'AYUSH' ? t('ayushDept', lang) : 'General Medicine OPD');
  const roomName = dept.roomNumber || 'OPD Room 3';
  const statusBadge = enc.status === 'COMPLETED' ? 'Completed' : (enc.status === 'IN_CONSULTATION' ? 'In Consultation' : t('waitingForCall', lang));

  const html = `
    <div style="max-width: 760px; margin: 0 auto; padding: 0.5rem 0.5rem 80px;">
      <!-- Patient Welcome Banner -->
      <section class="patient-welcome-banner">
        <span style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-sky-light); font-weight: 700;">
          ${t('dashboardBadge', lang)}
        </span>
        <h1>${t('hello', lang)}, ${patientName}</h1>
        <p>${t('dashboardWelcomeDesc', lang)}</p>

        <div class="patient-meta-row">
          <div class="patient-meta-pill">
            <span>ABHA:</span>
            <strong>${abhaId}</strong>
          </div>
          <div class="patient-meta-pill">
            <span>Token:</span>
            <strong style="color: #FDE68A;">${token}</strong>
          </div>
          <div class="patient-meta-pill">
            <span>Language:</span>
            <strong>${lang.toUpperCase()}</strong>
          </div>
        </div>
      </section>

      <!-- PRIMARY ACTION: RECORD MY CASE (Visually Dominant) -->
      <section aria-label="Primary Action">
        <button id="btn-record-my-case" class="card-primary-action" type="button" aria-label="${t('recordMyCase', lang)}">
          <div class="card-primary-action__content">
            <div class="card-primary-action__icon">
              🎙️
            </div>
            <div class="card-primary-action__text">
              <h2>${t('recordMyCase', lang)}</h2>
              <p>${t('recordMyCaseDesc', lang)}</p>
              <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; margin-top: 6px; color: #B2E2DD; font-weight: 600;">
                ✦ ${t('recordMyCaseBadge', lang)}
              </span>
            </div>
          </div>
          <div class="card-primary-action__arrow">
            ➔
          </div>
        </button>
      </section>

      <!-- Upcoming Consultation Status Card -->
      <section class="consultation-card" aria-label="Upcoming Consultation">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div class="consultation-token">
              <span>TOKEN</span>
              <strong>${token}</strong>
            </div>
            <div>
              <span style="font-size: 11px; font-weight: 700; color: #B45309; text-transform: uppercase;">
                ${t('todayConsultation', lang)}
              </span>
              <h3 style="font-size: 17px; color: var(--color-navy); margin: 2px 0 4px;">
                ${deptName}
              </h3>
              <p style="font-size: 13px; color: var(--color-gray-600); margin: 0;">
                ${roomName} · ${t('room12', lang)}
              </p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="status-badge ${enc.status === 'COMPLETED' ? 'status-badge--normal' : (enc.status === 'CANCELLED' ? 'status-badge--critical' : 'status-badge--warning')}">
              ${statusBadge}
            </span>
            ${(enc.id && enc.status !== 'COMPLETED' && enc.status !== 'IN_CONSULTATION' && enc.status !== 'CANCELLED') ? `
              <button id="btn-cancel-encounter" type="button" class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px; color: #DC2626; border-color: #FCA5A5;">
                ✕ Cancel OPD Request
              </button>
            ` : ''}
          </div>
        </div>
      </section>

      <!-- Doctor's Review / Consultation Result Section (Finalized by Doctor) -->
      <section id="patient-consultation-result-card" style="display: none; margin-bottom: 20px;">
        <div class="card" style="background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); border: 1.5px solid #86EFAC; padding: 20px; border-radius: var(--radius-lg);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div>
              <span style="display: inline-block; background: #15803D; color: #FFF; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 4px;">
                ✓ Physician Signed-off Consultation Result
              </span>
              <h3 id="result-doctor-name" style="font-size: 18px; color: #14532D; margin: 4px 0 2px;">Dr. Priya Deshmukh</h3>
              <span id="result-dept-date" style="font-size: 13px; color: #166534;">General Medicine OPD · Completed Today</span>
            </div>
            <span style="font-size: 11px; background: #DCFCE7; border: 1px solid #86EFAC; color: #15803D; padding: 3px 8px; border-radius: 4px; font-weight: 700;">
              SOURCE: PHYSICIAN
            </span>
          </div>

          <div style="background: #FFFFFF; border-radius: 8px; padding: 14px; margin-bottom: 10px; border: 1px solid #BBF7D0;">
            <span style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; display: block; margin-bottom: 4px;">
              Clinical Impression / Diagnosis:
            </span>
            <p id="result-impression" style="font-size: 14px; color: #1F2937; margin: 0; font-weight: 500;">
              Clinical evaluation completed.
            </p>
          </div>

          <div style="background: #FFFFFF; border-radius: 8px; padding: 14px; border: 1px solid #BBF7D0;">
            <span style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; display: block; margin-bottom: 4px;">
              Doctor's Advice & Care Plan:
            </span>
            <p id="result-advice" style="font-size: 14px; color: #1F2937; margin: 0;">
              Follow prescribed medications and rest. Return if acute red flags develop.
            </p>
          </div>
        </div>
      </section>

      <!-- Secondary Features Grid -->
      <div style="margin-bottom: 12px;">
        <h2 style="font-size: 17px; color: var(--color-navy); margin: 0 0 12px; font-weight: 700;">
          ${t('healthServices', lang)}
        </h2>
      </div>

      <div class="patient-actions-grid">
        <!-- 1. My Health History -->
        <div id="card-patient-history" class="dashboard-feature-card">
          <div class="dashboard-feature-card__icon">
            🕒
          </div>
          <div style="flex: 1;">
            <h3>${t('healthHistory', lang)}</h3>
            <p>${t('healthHistoryDesc', lang)}</p>
            <span style="font-size: 12px; color: var(--color-sky); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-top: 8px;">
              View past visits ➔
            </span>
          </div>
        </div>

        <!-- 2. Medical Records -->
        <div id="card-patient-records" class="dashboard-feature-card">
          <div class="dashboard-feature-card__icon dashboard-feature-card__icon--teal">
            📄
          </div>
          <div style="flex: 1;">
            <h3>${t('medicalRecords', lang)}</h3>
            <p>${t('medicalRecordsDesc', lang)}</p>
            <span style="font-size: 12px; color: var(--color-teal); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-top: 8px;">
              Scanned reports & docs ➔
            </span>
          </div>
        </div>

        <!-- 3. My Health Summary -->
        <div id="card-patient-summary" class="dashboard-feature-card">
          <div class="dashboard-feature-card__icon dashboard-feature-card__icon--amber">
            🩺
          </div>
          <div style="flex: 1;">
            <h3>${t('healthSummary', lang)}</h3>
            <p>${t('healthSummaryDesc', lang)}</p>
            <span style="font-size: 12px; color: #B45309; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-top: 8px;">
              View digital health passport ➔
            </span>
          </div>
        </div>

        <!-- 4. Profile & Consent -->
        <div id="card-patient-profile" class="dashboard-feature-card">
          <div class="dashboard-feature-card__icon">
            👤
          </div>
          <div style="flex: 1;">
            <h3>${t('profileConsent', lang)}</h3>
            <p>${t('profileConsentDesc', lang)}</p>
            <span style="font-size: 12px; color: var(--color-sky); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-top: 8px;">
              Manage settings ➔
            </span>
          </div>
        </div>
      </div>

      <!-- Help & Assistance Banner -->
      <div class="card" style="background: #F8FAFC; display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px;">❓</span>
          <div>
            <strong style="font-size: 13px; color: var(--color-navy); display: block;">
              ${t('needKioskHelp', lang)}
            </strong>
            <span style="font-size: 12px; color: var(--color-gray-600);">
              ${t('kioskHelpDesc', lang)}
            </span>
          </div>
        </div>
        <span style="font-size: 12px; font-weight: 700; color: var(--color-teal);">
          ${t('helpDeskCounter', lang)}
        </span>
      </div>
    </div>
  `;

  return {
    html,
    attachEvents: () => {
      // 1. Record My Case -> starts fresh encounter
      document.getElementById('btn-record-my-case')?.addEventListener('click', () => {
        // Reset only the clinical intake session, keep persistent patient profile
        resetClinicalSession(false);
        // Start OPD Department Selection for new encounter
        router.navigate('opdSelection');
      });

      // Cancel OPD Request
      document.getElementById('btn-cancel-encounter')?.addEventListener('click', async () => {
        if (!enc.id) return;
        const confirmed = window.confirm('Are you sure you want to cancel this OPD request? Your token will be released.');
        if (confirmed) {
          const res = await api.cancelEncounter(enc.id);
          if (res?.success) {
            window.alert('Your OPD request has been cancelled.');
            appState.encounter = { ...enc, status: 'CANCELLED' };
            notifyStateChange('encounter');
            router.renderCurrentScreen();
          } else {
            window.alert(res?.error?.message || 'Could not cancel request. It may already be in consultation.');
          }
        }
      });

      // Asynchronously load doctor's review / consultation result
      if (p.id) {
        api.getPatientDashboard(p.id).then((res) => {
          if (res?.success && res.data?.consultationResult) {
            const cr = res.data.consultationResult;
            const cardEl = document.getElementById('patient-consultation-result-card');
            const docNameEl = document.getElementById('result-doctor-name');
            const deptDateEl = document.getElementById('result-dept-date');
            const impressionEl = document.getElementById('result-impression');
            const adviceEl = document.getElementById('result-advice');

            if (cardEl) {
              cardEl.style.display = 'block';
              if (docNameEl) docNameEl.textContent = cr.doctorName || 'Attending Physician';
              if (deptDateEl) {
                const dateStr = cr.consultationDate ? new Date(cr.consultationDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today';
                deptDateEl.textContent = `${cr.department || 'General Medicine'} · ${dateStr}`;
              }
              if (impressionEl) impressionEl.textContent = cr.clinicalImpression || 'Clinical evaluation completed.';
              if (adviceEl) adviceEl.textContent = cr.advice || 'Follow advised care plan and return if symptoms persist.';
            }
          }
        }).catch((err) => console.warn('[PatientDashboard] Could not fetch consultation result:', err));
      }

      // 2. Navigation to sub-screens
      document.getElementById('card-patient-history')?.addEventListener('click', () => {
        router.navigate('patientHistory');
      });

      document.getElementById('card-patient-records')?.addEventListener('click', () => {
        router.navigate('patientRecords');
      });

      document.getElementById('card-patient-summary')?.addEventListener('click', () => {
        router.navigate('patientSummary');
      });

      document.getElementById('card-patient-profile')?.addEventListener('click', () => {
        router.navigate('patientProfile');
      });
    },
  };
}
