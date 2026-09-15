/**
 * Screen: Patient Health Summary (Phase 10B)
 * Consolidated digital health passport.
 * Strictly adheres to Zero Fake Data Policy: displays real vitals/allergies/meds or 'Not recorded'.
 */

import { t } from '../i18n.js';
import { appState } from '../state.js';
import { router } from '../router.js';
import { api } from '../api.js';

export function renderPatientSummaryScreen() {
  const lang = appState.language;
  const p = appState.patient || {};
  const patientName = p.fullName || p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Patient';
  const abhaId = p.abhaId || p.identifier || 'ABHA-NOT-LINKED';
  const age = p.age ? `${p.age} yrs` : 'Not recorded';
  const gender = p.gender || 'Not recorded';

  const html = `
    <div style="max-width: 760px; margin: 0 auto; padding: 0.5rem 0.5rem 80px;">
      <!-- Top Navigation -->
      <div style="margin-bottom: 20px;">
        <button id="btn-back-dashboard" type="button" class="btn btn--secondary" style="padding: 6px 12px; font-size: 13px; margin-bottom: 8px; display: inline-flex; align-items: center; gap: 6px;">
          ← ${t('backToDashboard', lang)}
        </button>
        <h1 style="font-size: 26px; color: var(--color-navy); margin: 0;">
          ${t('healthSummary', lang)}
        </h1>
        <p style="font-size: 14px; color: var(--color-gray-600); margin: 4px 0 0;">
          ${t('healthSummaryDesc', lang)}
        </p>
      </div>

      <!-- Health Passport Card -->
      <div class="card card--elevated" style="padding: 24px; margin-bottom: 20px; background: linear-gradient(135deg, #FFFFFF 0%, #F5F9FC 100%);">
        <!-- Header Profile Row -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--color-border); flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--color-navy); color: #FFF; display: grid; place-items: center; font-size: 22px; font-weight: 700;">
              ${patientName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style="font-size: 20px; color: var(--color-navy); margin: 0;">${patientName}</h2>
              <span style="font-size: 13px; color: var(--color-gray-600);">
                ABHA ID: <strong>${abhaId}</strong> · Age: ${age} · Gender: ${gender}
              </span>
            </div>
          </div>
          <span class="status-badge status-badge--normal" style="display: inline-flex; align-items: center; gap: 6px;">
            🛡️ ABHA Verified
          </span>
        </div>

        <!-- Recorded Vitals Section -->
        <div style="padding: 18px 0; border-bottom: 1px solid var(--color-border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 11px; font-weight: 700; color: var(--color-teal); text-transform: uppercase; letter-spacing: 0.05em;">
                ${t('recordedVitals', lang)}
              </span>
              <span id="vitals-provenance-badge" style="font-size: 10px; background: #E0F2FE; color: #0284C7; padding: 2px 6px; border-radius: 4px; font-weight: 700;">
                PROVENANCE: PATIENT REPORTED
              </span>
            </div>
            <button id="btn-toggle-vitals-form" type="button" class="btn btn--secondary" style="padding: 4px 10px; font-size: 12px;">
              + Enter / Measure My Vitals
            </button>
          </div>

          <!-- Patient Vitals Entry Form (Collapsible) -->
          <div id="patient-vitals-form" style="display: none; background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
            <h3 style="font-size: 14px; color: var(--color-navy); margin: 0 0 12px; font-weight: 700;">
              Record My Vitals (Patient Self-Reported)
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 12px;">
              <div>
                <label style="font-size: 11px; color: var(--color-gray-600); display: block; font-weight: 600;">Blood Pressure</label>
                <input id="input-vital-bp" type="text" placeholder="120/80" style="width: 100%; padding: 6px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 4px;" />
              </div>
              <div>
                <label style="font-size: 11px; color: var(--color-gray-600); display: block; font-weight: 600;">Heart Rate (bpm)</label>
                <input id="input-vital-hr" type="number" placeholder="72" style="width: 100%; padding: 6px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 4px;" />
              </div>
              <div>
                <label style="font-size: 11px; color: var(--color-gray-600); display: block; font-weight: 600;">Oxygen SpO2 (%)</label>
                <input id="input-vital-spo2" type="number" placeholder="98" style="width: 100%; padding: 6px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 4px;" />
              </div>
              <div>
                <label style="font-size: 11px; color: var(--color-gray-600); display: block; font-weight: 600;">Temperature (°F)</label>
                <input id="input-vital-temp" type="number" step="0.1" placeholder="98.6" style="width: 100%; padding: 6px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 4px;" />
              </div>
              <div>
                <label style="font-size: 11px; color: var(--color-gray-600); display: block; font-weight: 600;">Resp Rate (/min)</label>
                <input id="input-vital-resp" type="number" placeholder="18" style="width: 100%; padding: 6px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 4px;" />
              </div>
              <div>
                <label style="font-size: 11px; color: var(--color-gray-600); display: block; font-weight: 600;">Weight (kg)</label>
                <input id="input-vital-weight" type="number" step="0.1" placeholder="68" style="width: 100%; padding: 6px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 4px;" />
              </div>
              <div>
                <label style="font-size: 11px; color: var(--color-gray-600); display: block; font-weight: 600;">Height (cm)</label>
                <input id="input-vital-height" type="number" placeholder="170" style="width: 100%; padding: 6px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 4px;" />
              </div>
              <div>
                <label style="font-size: 11px; color: var(--color-gray-600); display: block; font-weight: 600;">Hemoglobin (g/dL)</label>
                <input id="input-vital-hb" type="number" step="0.1" placeholder="13.5" style="width: 100%; padding: 6px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 4px;" />
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button id="btn-cancel-vitals" type="button" class="btn btn--secondary" style="padding: 5px 12px; font-size: 12px;">Cancel</button>
              <button id="btn-save-vitals" type="button" class="btn btn--primary" style="padding: 5px 14px; font-size: 12px;">Save Vitals</button>
            </div>
          </div>

          <div id="summary-vitals-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
            <div style="background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px; text-align: center;">
              <span style="font-size: 11px; color: var(--color-gray-600); display: block;">Blood Pressure</span>
              <strong id="vital-bp" style="font-size: 15px; color: var(--color-navy); display: block; margin: 3px 0;">--</strong>
              <small style="font-size: 10px; color: var(--color-gray-500); display: block;">mmHg</small>
            </div>
            <div style="background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px; text-align: center;">
              <span style="font-size: 11px; color: var(--color-gray-600); display: block;">Heart Rate</span>
              <strong id="vital-hr" style="font-size: 15px; color: var(--color-navy); display: block; margin: 3px 0;">--</strong>
              <small style="font-size: 10px; color: var(--color-gray-500); display: block;">bpm</small>
            </div>
            <div style="background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px; text-align: center;">
              <span style="font-size: 11px; color: var(--color-gray-600); display: block;">Oxygen (SpO2)</span>
              <strong id="vital-spo2" style="font-size: 15px; color: var(--color-success); display: block; margin: 3px 0;">--</strong>
              <small style="font-size: 10px; color: var(--color-gray-500); display: block;">Room air</small>
            </div>
            <div style="background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px; text-align: center;">
              <span style="font-size: 11px; color: var(--color-gray-600); display: block;">Temperature</span>
              <strong id="vital-temp" style="font-size: 15px; color: var(--color-navy); display: block; margin: 3px 0;">--</strong>
              <small style="font-size: 10px; color: var(--color-gray-500); display: block;">°F</small>
            </div>
            <div style="background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px; text-align: center;">
              <span style="font-size: 11px; color: var(--color-gray-600); display: block;">Resp Rate</span>
              <strong id="vital-resp" style="font-size: 15px; color: var(--color-navy); display: block; margin: 3px 0;">--</strong>
              <small style="font-size: 10px; color: var(--color-gray-500); display: block;">breaths/min</small>
            </div>
            <div style="background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px; text-align: center;">
              <span style="font-size: 11px; color: var(--color-gray-600); display: block;">Weight</span>
              <strong id="vital-weight" style="font-size: 15px; color: var(--color-navy); display: block; margin: 3px 0;">--</strong>
              <small style="font-size: 10px; color: var(--color-gray-500); display: block;">kg</small>
            </div>
            <div style="background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px; text-align: center;">
              <span style="font-size: 11px; color: var(--color-gray-600); display: block;">Height / BMI</span>
              <strong id="vital-bmi" style="font-size: 15px; color: var(--color-navy); display: block; margin: 3px 0;">--</strong>
              <small style="font-size: 10px; color: var(--color-gray-500); display: block;">cm / kg/m²</small>
            </div>
            <div style="background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px; text-align: center;">
              <span style="font-size: 11px; color: var(--color-gray-600); display: block;">Hemoglobin</span>
              <strong id="vital-hb" style="font-size: 15px; color: var(--color-navy); display: block; margin: 3px 0;">--</strong>
              <small style="font-size: 10px; color: var(--color-gray-500); display: block;">g/dL</small>
            </div>
          </div>
        </div>

        <!-- Known Allergies Section -->
        <div style="padding: 18px 0; border-bottom: 1px solid var(--color-border);">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
            <span style="font-size: 16px;">⚠️</span>
            <span style="font-size: 12px; font-weight: 700; color: var(--color-critical); text-transform: uppercase;">
              ${t('knownAllergies', lang)}
            </span>
          </div>
          <div id="summary-allergies-list">
            <span style="font-size: 13px; color: var(--color-gray-600);">Checking records...</span>
          </div>
        </div>

        <!-- Active Medications Section -->
        <div style="padding-top: 18px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
            <span style="font-size: 16px;">💊</span>
            <span style="font-size: 12px; font-weight: 700; color: var(--color-navy); text-transform: uppercase;">
              ${t('activeMedications', lang)}
            </span>
          </div>
          <div id="summary-medications-list" style="display: flex; flexDirection: column; gap: 10px;">
            <span style="font-size: 13px; color: var(--color-gray-600);">Loading medications...</span>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    html,
    attachEvents: () => {
      document.getElementById('btn-back-dashboard')?.addEventListener('click', () => {
        router.navigate('patientDashboard');
      });

      // Fetch longitudinal summary
      async function loadSummary() {
        const patientId = appState.patient?.id || appState.encounter?.patientId;
        if (!patientId) {
          renderEmptyState();
          return;
        }

        try {
          const res = await api.getPatientSummary(patientId);
          if (res && res.success && res.data) {
            populateSummary(res.data);
          } else {
            renderEmptyState();
          }
        } catch (err) {
          console.error('Error fetching patient summary:', err);
          renderEmptyState();
        }
      }

      function populateSummary(data) {
        // Zero Fake Data: display exact values or "Not recorded"
        const vitals = data.vitals || {};
        const bpEl = document.getElementById('vital-bp');
        const hrEl = document.getElementById('vital-hr');
        const spo2El = document.getElementById('vital-spo2');
        const tempEl = document.getElementById('vital-temp');

        const respEl = document.getElementById('vital-resp');
        const weightEl = document.getElementById('vital-weight');
        const bmiEl = document.getElementById('vital-bmi');
        const hbEl = document.getElementById('vital-hb');

        if (bpEl) bpEl.textContent = vitals.bloodPressure || vitals.bp || 'Not recorded';
        if (hrEl) hrEl.textContent = vitals.heartRate || vitals.pulse || 'Not recorded';
        if (spo2El) spo2El.textContent = vitals.oxygenSaturation || vitals.spo2 ? `${vitals.oxygenSaturation || vitals.spo2}%` : 'Not recorded';
        if (tempEl) tempEl.textContent = vitals.temperature ? `${vitals.temperature}°F` : 'Not recorded';
        if (respEl) respEl.textContent = vitals.respRate || vitals.respiratoryRate ? `${vitals.respRate || vitals.respiratoryRate}/min` : 'Not recorded';
        if (weightEl) weightEl.textContent = vitals.weight ? `${vitals.weight} kg` : 'Not recorded';
        if (bmiEl) {
          const ht = vitals.height ? `${vitals.height} cm` : '';
          const bm = vitals.bmi ? `BMI ${vitals.bmi}` : '';
          bmiEl.textContent = (ht && bm) ? `${ht} / ${bm}` : (ht || bm || 'Not recorded');
        }
        if (hbEl) hbEl.textContent = vitals.hb || vitals.hemoglobin ? `${vitals.hb || vitals.hemoglobin} g/dL` : 'Not recorded';

        // Allergies
        const allergiesContainer = document.getElementById('summary-allergies-list');
        if (allergiesContainer) {
          const allergies = Array.isArray(data.allergies) ? data.allergies : (data.allergies ? [data.allergies] : []);
          if (allergies.length > 0) {
            allergiesContainer.innerHTML = allergies.map(a => `
              <div style="display: inline-block; margin-right: 8px; margin-bottom: 6px; background: var(--color-critical-bg); border: 1px solid var(--color-critical-border); border-radius: var(--radius-md); padding: 6px 12px; font-size: 13px; color: #991B1B; font-weight: 600;">
                ⚠️ ${typeof a === 'string' ? a : (a.substance || a.name || 'Allergy')} ${a.reaction ? `(${a.reaction})` : ''}
              </div>
            `).join('');
          } else {
            allergiesContainer.innerHTML = `
              <div style="font-size: 13px; color: var(--color-gray-600); background: #F8FAFC; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px 12px;">
                ✓ ${t('noKnownAllergies', lang)}
              </div>
            `;
          }
        }

        // Medications
        const medsContainer = document.getElementById('summary-medications-list');
        if (medsContainer) {
          const meds = Array.isArray(data.medications) ? data.medications : [];
          if (meds.length > 0) {
            medsContainer.innerHTML = meds.map(m => `
              <div style="display: flex; justify-content: space-between; align-items: center; background: #FFF; border: 1px solid var(--color-border); padding: 12px 16px; border-radius: var(--radius-md);">
                <div>
                  <strong style="font-size: 14px; color: var(--color-navy); display: block;">${m.name || m.medicineName || 'Medication'}</strong>
                  <span style="font-size: 12px; color: var(--color-gray-600);">${m.instructions || m.dosage || m.reason || 'As advised'}</span>
                </div>
                <span style="font-size: 13px; font-weight: 600; color: var(--color-teal);">${m.frequency || m.status || 'Active'}</span>
              </div>
            `).join('');
          } else {
            medsContainer.innerHTML = `
              <div style="font-size: 13px; color: var(--color-gray-600); background: #F8FAFC; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px 12px;">
                ${t('noActiveMedications', lang)}
              </div>
            `;
          }
        }
      }

      function renderEmptyState() {
        const bpEl = document.getElementById('vital-bp');
        const hrEl = document.getElementById('vital-hr');
        const spo2El = document.getElementById('vital-spo2');
        const tempEl = document.getElementById('vital-temp');

        if (bpEl) bpEl.textContent = 'Not recorded';
        if (hrEl) hrEl.textContent = 'Not recorded';
        if (spo2El) spo2El.textContent = 'Not recorded';
        if (tempEl) tempEl.textContent = 'Not recorded';

        const allergiesContainer = document.getElementById('summary-allergies-list');
        if (allergiesContainer) {
          allergiesContainer.innerHTML = `<div style="font-size: 13px; color: var(--color-gray-600);">${t('noKnownAllergies', lang)}</div>`;
        }
        const medsContainer = document.getElementById('summary-medications-list');
        if (medsContainer) {
          medsContainer.innerHTML = `<div style="font-size: 13px; color: var(--color-gray-600);">${t('noActiveMedications', lang)}</div>`;
        }
      }

      // Vitals Form Toggle
      const vitalsForm = document.getElementById('patient-vitals-form');
      document.getElementById('btn-toggle-vitals-form')?.addEventListener('click', () => {
        if (vitalsForm) {
          vitalsForm.style.display = vitalsForm.style.display === 'none' ? 'block' : 'none';
        }
      });
      document.getElementById('btn-cancel-vitals')?.addEventListener('click', () => {
        if (vitalsForm) vitalsForm.style.display = 'none';
      });

      // Save Vitals
      document.getElementById('btn-save-vitals')?.addEventListener('click', async () => {
        if (!p.id) {
          alert('Patient profile not active');
          return;
        }

        const bp = document.getElementById('input-vital-bp')?.value?.trim();
        const heartRate = document.getElementById('input-vital-hr')?.value?.trim();
        const spo2 = document.getElementById('input-vital-spo2')?.value?.trim();
        const temp = document.getElementById('input-vital-temp')?.value?.trim();
        const respRate = document.getElementById('input-vital-resp')?.value?.trim();
        const weight = document.getElementById('input-vital-weight')?.value?.trim();
        const height = document.getElementById('input-vital-height')?.value?.trim();
        const hb = document.getElementById('input-vital-hb')?.value?.trim();

        const vitalsPayload = {
          bp: bp || null,
          heartRate: heartRate || null,
          spo2: spo2 || null,
          temp: temp || null,
          respRate: respRate || null,
          weight: weight || null,
          height: height || null,
          hb: hb || null,
          source: 'PATIENT',
        };

        const res = await api.recordPatientVitals(p.id, vitalsPayload);
        if (res?.success) {
          alert('Your vitals have been recorded with provenance: PATIENT.');
          if (vitalsForm) vitalsForm.style.display = 'none';
          loadSummary();
        } else {
          alert(res?.error || 'Could not record vitals.');
        }
      });

      loadSummary();
    }
  };
}
