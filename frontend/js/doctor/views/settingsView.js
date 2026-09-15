/**
 * Physician Settings & Clinical Preferences View — MediKiosk (Phase 10)
 */

import { doctorState } from '../doctorState.js';
import { doctorApi } from '../doctorApi.js';
import { icons } from '../doctorIcons.js';

export function renderDoctorSettingsView() {
  const doc = doctorState.doctor || {
    name: 'Dr. Priya Deshmukh',
    employeeId: 'DOC-8942',
    hospital: 'District Civil Hospital, Pune',
    department: 'General Medicine / OPD-3',
  };

  const html = `
    <div style="margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--doc-text-main); margin-bottom: 0.25rem; display: flex; align-items: center; gap: 8px;">
        ${icons.settings(22, '#2563EB')} Physician Profile & Clinical Preferences
      </h2>
      <p style="font-size: 0.85rem; color: var(--doc-text-muted);">
        Configure your workstation alerts, display preferences, and view authenticated clinician credentials.
      </p>
    </div>

    <div style="max-width: 800px; display: flex; flex-direction: column; gap: 1.5rem;">
      <!-- Profile Card -->
      <div class="doc-table-card" style="padding: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--doc-text-main); display: flex; align-items: center; gap: 8px;">
          ${icons.user(20, '#2563EB')} Authenticated Physician Profile
        </h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.9rem;">
          <div>
            <span style="color: var(--doc-text-muted);">Full Name:</span><br/>
            <strong>${doc.name}</strong>
          </div>
          <div>
            <span style="color: var(--doc-text-muted);">Employee ID:</span><br/>
            <code>${doc.employeeId}</code>
          </div>
          <div>
            <span style="color: var(--doc-text-muted);">Hospital / Facility:</span><br/>
            <strong>${doc.hospital}</strong>
          </div>
          <div>
            <span style="color: var(--doc-text-muted);">Assigned Department:</span><br/>
            <strong>${doc.department}</strong>
          </div>
        </div>
      </div>

      <!-- Clinical Preferences Form -->
      <div class="doc-table-card" style="padding: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--doc-text-main); display: flex; align-items: center; gap: 8px;">
          ${icons.settings(20, '#2563EB')} Intake & Alert Preferences
        </h3>

        <form id="doc-settings-form" style="display: flex; flex-direction: column; gap: 1.25rem;">
          <label style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.95rem; cursor: pointer;">
            <input type="checkbox" id="pref-audio-alerts" checked style="width: 18px; height: 18px;" />
            <div>
              <strong>Audible Red-Flag Chime</strong>
              <div style="font-size: 0.8rem; color: var(--doc-text-muted);">Play alert chime on newly detected emergency intake</div>
            </div>
          </label>

          <label style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.95rem; cursor: pointer;">
            <input type="checkbox" id="pref-ayush-display" checked style="width: 18px; height: 18px;" />
            <div>
              <strong>Always Display AYUSH Dashavidha Assessment</strong>
              <div style="font-size: 0.8rem; color: var(--doc-text-muted);">Show 10-fold constitution parameters whenever available</div>
            </div>
          </label>

          <label style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.95rem; cursor: pointer;">
            <input type="checkbox" id="pref-high-contrast" style="width: 18px; height: 18px;" />
            <div>
              <strong>High Contrast Workstation Mode</strong>
              <div style="font-size: 0.8rem; color: var(--doc-text-muted);">Enhance text borders for clinical monitors in bright OPD rooms</div>
            </div>
          </label>

          <div>
            <button type="submit" class="doc-btn-open" style="padding: 0.65rem 1.5rem; font-size: 0.95rem;">
              Save Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  function attachEvents() {
    const form = document.getElementById('doc-settings-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const audio = document.getElementById('pref-audio-alerts')?.checked;
      const ayush = document.getElementById('pref-ayush-display')?.checked;
      const contrast = document.getElementById('pref-high-contrast')?.checked;

      try {
        await doctorApi.updateSettings({
          audioAlertEnabled: audio,
          ayushAssessmentDisplay: ayush ? 'ALWAYS_IF_AVAILABLE' : 'OFF',
          highContrastMode: contrast,
        });
        alert('Physician preferences updated successfully.');
      } catch (err) {
        alert('Failed to update settings: ' + err.message);
      }
    });
  }

  return { html, attachEvents };
}
