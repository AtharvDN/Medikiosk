/**
 * Priority Clinical Alerts View — MediKiosk (Phase 10)
 * 
 * Consumes existing verified red-flag triggers (e.g. ACUTE_CHEST_PAIN_RED_FLAG).
 * Invariant: Does NOT invent medical diagnoses.
 */

import { doctorApi } from '../doctorApi.js';
import { openPatientWorkspace } from './dashboardView.js';
import { icons } from '../doctorIcons.js';

export function renderDoctorAlertsView() {
  const html = `
    <div style="margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.4rem; font-weight: 800; color: #dc2626; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 8px;">
        ${icons.alert(24, '#dc2626')} Priority Clinical Alerts & Red-Flags
      </h2>
      <p style="font-size: 0.85rem; color: var(--doc-text-muted);">
        Immediate physician attention required for patients reporting high-risk clinical features during kiosk intake.
      </p>
    </div>

    <div id="doc-alerts-container">
      <div style="padding: 3rem; text-align: center; color: var(--doc-text-muted);">
        Scanning active cases for clinical alerts...
      </div>
    </div>
  `;

  function attachEvents() {
    loadAlerts();
  }

  async function loadAlerts() {
    const container = document.getElementById('doc-alerts-container');
    if (!container) return;

    try {
      const res = await doctorApi.getAlerts();
      if (!res.success || !res.data) {
        container.innerHTML = `<div class="doc-state-container"><div class="doc-state-title">Error Loading Alerts</div></div>`;
        return;
      }

      const { alerts } = res.data;

      if (!alerts || alerts.length === 0) {
        container.innerHTML = `
          <div class="doc-state-container">
            <div class="doc-state-icon" style="display:flex;align-items:center;justify-content:center;">${icons.check(28, '#16A34A')}</div>
            <div class="doc-state-title">No Active Red-Flag Alerts</div>
            <div class="doc-state-desc">All intake sessions are currently within standard triage limits. No emergency triggers detected.</div>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          ${alerts
            .map((alert) => {
              const detectedTime = alert.detectedAt
                ? new Date(alert.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Just now';

              return `
                <div class="doc-critical-banner" style="align-items: center;">
                  <div class="doc-critical-icon" style="display:flex;align-items:center;justify-content:center;">${icons.alert(24, '#DC2626')}</div>
                  <div style="flex-grow: 1;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.35rem;">
                      <span class="doc-token-badge" style="background:#fee2e2; border-color:#fca5a5; color:#991b1b;">
                        ${alert.token}
                      </span>
                      <strong style="font-size: 1.1rem; color: #991b1b;">${alert.patient?.name || 'Patient'}</strong>
                      <span style="font-size: 0.78rem; color: #b91c1c;">
                        (${alert.patient?.age || 'Adult'}, ${alert.patient?.patientIdentifier || 'WALKIN'})
                      </span>
                      <span style="margin-left: auto; font-size: 0.8rem; color: #991b1b; font-weight: 600;">
                        Detected at ${detectedTime}
                      </span>
                    </div>

                    <div style="font-size: 0.95rem; font-weight: 700; color: #7f1d1d; margin-bottom: 0.25rem;">
                      ${alert.title} (Code: <code>${alert.code}</code>)
                    </div>

                    <div style="font-size: 0.88rem; color: #450a0a; line-height: 1.45;">
                      <strong>Patient-Reported Rationale:</strong> ${alert.reason}
                    </div>

                    <div style="margin-top: 0.5rem; font-size: 0.78rem; color: #7f1d1d;">
                      Chief Complaint: <strong>${alert.chiefComplaint}</strong> • Status: <strong>${alert.consultationStatus}</strong>
                    </div>
                  </div>

                  <div>
                    <button class="doc-btn-open doc-open-workspace-btn" data-session-id="${alert.sessionId}" style="background:#dc2626; padding: 0.65rem 1.25rem; font-size: 0.9rem;">
                      Open Workspace
                    </button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `;

      container.querySelectorAll('.doc-open-workspace-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const sessionId = btn.getAttribute('data-session-id');
          await openPatientWorkspace(sessionId);
        });
      });
    } catch (err) {
      container.innerHTML = `
        <div class="doc-state-container">
          <div class="doc-state-icon" style="display:flex;align-items:center;justify-content:center;">${icons.alert(28, '#D97706')}</div>
          <div class="doc-state-title">Server Unavailable</div>
          <div class="doc-state-desc">${err.message}</div>
        </div>
      `;
    }
  }

  return { html, attachEvents };
}
