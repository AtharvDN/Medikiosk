/**
 * Screen: Patient Profile & Privacy Consent (Phase 10B)
 * Profile demographic details and ABDM / OCR consent controls.
 * Pure Vanilla HTML5, CSS3, ES Modules.
 */

import { t } from '../i18n.js';
import { appState, resetSession } from '../state.js';
import { router } from '../router.js';

export function renderPatientProfileScreen() {
  const lang = appState.language;
  const p = appState.patient || {};
  const patientName = p.fullName || p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Patient';
  const abhaId = p.abhaId || p.identifier || '91-4812-7392-1049';
  const phone = p.phone || p.contactNumber || '9876543210';
  const currentLang = lang === 'hi' ? 'हिंदी (Hindi)' : (lang === 'mr' ? 'मराठी (Marathi)' : 'English');

  // Retrieve stored consent preferences or default to true
  const savedConsentOcr = localStorage.getItem('consent_ocr') !== 'false';
  const savedConsentAbdm = localStorage.getItem('consent_abdm') !== 'false';

  const html = `
    <div style="max-width: 760px; margin: 0 auto; padding: 0.5rem 0.5rem 80px;">
      <!-- Top Navigation -->
      <div style="margin-bottom: 20px;">
        <button id="btn-back-dashboard" type="button" class="btn btn--secondary" style="padding: 6px 12px; font-size: 13px; margin-bottom: 8px; display: inline-flex; align-items: center; gap: 6px;">
          ← ${t('backToDashboard', lang)}
        </button>
        <h1 style="font-size: 26px; color: var(--color-navy); margin: 0;">
          ${t('profileConsent', lang)}
        </h1>
        <p style="font-size: 14px; color: var(--color-gray-600); margin: 4px 0 0;">
          ${t('profileConsentDesc', lang)}
        </p>
      </div>

      <!-- Personal Demographic Information -->
      <div class="card card--elevated" style="padding: 24px; margin-bottom: 20px;">
        <h3 style="font-size: 16px; color: var(--color-navy); margin: 0 0 16px;">
          Personal Information
        </h3>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--color-gray-600); display: block; margin-bottom: 4px;">Full Name</label>
            <input class="form-input" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: #F8FAFC; color: var(--color-navy); font-weight: 500;" value="${patientName}" readonly />
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--color-gray-600); display: block; margin-bottom: 4px;">ABHA Account Number</label>
            <input class="form-input" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: #F8FAFC; color: var(--color-navy); font-weight: 500;" value="${abhaId}" readonly />
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--color-gray-600); display: block; margin-bottom: 4px;">Registered Mobile</label>
            <input class="form-input" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: #F8FAFC; color: var(--color-navy); font-weight: 500;" value="${phone}" readonly />
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--color-gray-600); display: block; margin-bottom: 4px;">Default Language</label>
            <input class="form-input" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: #F8FAFC; color: var(--color-navy); font-weight: 500;" value="${currentLang}" readonly />
          </div>
        </div>
      </div>

      <!-- Digital Health Consent Framework -->
      <div class="card" style="padding: 24px; margin-bottom: 24px;">
        <h3 style="font-size: 16px; color: var(--color-navy); margin: 0 0 6px;">
          Digital Health Consent Framework
        </h3>
        <p style="font-size: 13px; color: var(--color-gray-600); margin: 0 0 16px;">
          In compliance with National Health Authority (NHA) ABDM consent standards.
        </p>

        <div style="display: flex; flex-direction: column; gap: 14px;">
          <label style="display: flex; align-items: center; justify-content: space-between; padding: 14px; background: var(--color-bg); border-radius: var(--radius-md); cursor: pointer; border: 1px solid var(--color-border);">
            <div>
              <strong style="font-size: 14px; color: var(--color-navy); display: block;">Optical Character Recognition (OCR) Analysis</strong>
              <span style="font-size: 12px; color: var(--color-gray-600);">Allow AI to extract vital signs and medications from uploaded documents</span>
            </div>
            <input
              type="checkbox"
              id="consent-ocr-checkbox"
              ${savedConsentOcr ? 'checked' : ''}
              style="width: 20px; height: 20px; accent-color: var(--color-navy); cursor: pointer;"
            />
          </label>

          <label style="display: flex; align-items: center; justify-content: space-between; padding: 14px; background: var(--color-bg); border-radius: var(--radius-md); cursor: pointer; border: 1px solid var(--color-border);">
            <div>
              <strong style="font-size: 14px; color: var(--color-navy); display: block;">ABDM Health Record Linking</strong>
              <span style="font-size: 12px; color: var(--color-gray-600);">Link today's OPD encounter summary with your Ayushman Bharat Account</span>
            </div>
            <input
              type="checkbox"
              id="consent-abdm-checkbox"
              ${savedConsentAbdm ? 'checked' : ''}
              style="width: 20px; height: 20px; accent-color: var(--color-navy); cursor: pointer;"
            />
          </label>
        </div>

        <div style="margin-top: 20px; display: flex; align-items: center; gap: 14px;">
          <button type="button" id="btn-save-consent" class="btn btn--primary">
            Save Preferences
          </button>
          <span id="consent-save-notice" style="display: none; color: var(--color-success); font-weight: 600; font-size: 13px; align-items: center; gap: 4px;">
            ✓ Saved successfully
          </span>
        </div>
      </div>

      <!-- Exit Session Action -->
      <div style="text-align: center;">
        <button
          type="button"
          id="btn-exit-kiosk-session"
          class="btn btn--secondary"
          style="color: var(--color-critical); border-color: var(--color-critical-border); padding: 10px 20px; font-weight: 600;"
        >
          🚪 <span>Exit Kiosk Session</span>
        </button>
      </div>
    </div>
  `;

  return {
    html,
    attachEvents: () => {
      document.getElementById('btn-back-dashboard')?.addEventListener('click', () => {
        router.navigate('patientDashboard');
      });

      // Save consent preferences
      document.getElementById('btn-save-consent')?.addEventListener('click', () => {
        const ocrChecked = document.getElementById('consent-ocr-checkbox')?.checked;
        const abdmChecked = document.getElementById('consent-abdm-checkbox')?.checked;
        localStorage.setItem('consent_ocr', ocrChecked ? 'true' : 'false');
        localStorage.setItem('consent_abdm', abdmChecked ? 'true' : 'false');

        const notice = document.getElementById('consent-save-notice');
        if (notice) {
          notice.style.display = 'inline-flex';
          setTimeout(() => {
            if (notice) notice.style.display = 'none';
          }, 2500);
        }
      });

      // Exit kiosk session
      document.getElementById('btn-exit-kiosk-session')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to exit your kiosk session?')) {
          resetSession();
          router.navigate('landing');
        }
      });
    }
  };
}
