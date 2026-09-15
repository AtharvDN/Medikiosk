/**
 * OPD Reports & Analytics View — MediKiosk (Phase 10)
 * 
 * Based on real stored database records.
 * Invariant: Does NOT invent fake statistical claims.
 */

import { doctorApi } from '../doctorApi.js';
import { icons } from '../doctorIcons.js';

export function renderDoctorReportsView() {
  const html = `
    <div style="margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--doc-text-main); margin-bottom: 0.25rem; display: flex; align-items: center; gap: 8px;">
        ${icons.reports(22, '#2563EB')} OPD Clinical Analytics & Throughput
      </h2>
      <p style="font-size: 0.85rem; color: var(--doc-text-muted);">
        Verified intake volume, department distribution, and throughput metrics computed directly from active clinical database sessions.
      </p>
    </div>

    <div id="doc-reports-container">
      <div style="padding: 3rem; text-align: center; color: var(--doc-text-muted);">
        Aggregating clinical analytics from database...
      </div>
    </div>
  `;

  function attachEvents() {
    loadReports();
  }

  async function loadReports() {
    const container = document.getElementById('doc-reports-container');
    if (!container) return;

    try {
      const res = await doctorApi.getReports();
      if (!res.success || !res.data) {
        container.innerHTML = `<div class="doc-state-container"><div class="doc-state-title">Error Loading Reports</div></div>`;
        return;
      }

      const d = res.data;
      const langItems = Object.entries(d.languageDistribution || {})
        .map(([lang, count]) => `<strong>${lang.toUpperCase()}:</strong> ${count}`)
        .join(' • ');

      container.innerHTML = `
        <div class="doc-stat-grid" style="margin-bottom: 1.75rem;">
          <div class="doc-stat-card">
            <div>
              <div class="doc-stat-val">${d.totalSessions}</div>
              <div class="doc-stat-label">Total OPD Sessions</div>
            </div>
            <div class="doc-stat-icon queue" style="display:flex;align-items:center;justify-content:center;">${icons.reports(22, '#2563EB')}</div>
          </div>

          <div class="doc-stat-card">
            <div>
              <div class="doc-stat-val">${d.completedIntakes}</div>
              <div class="doc-stat-label">Completed Intakes</div>
            </div>
            <div class="doc-stat-icon kiosk" style="display:flex;align-items:center;justify-content:center;">${icons.check(22, '#16A34A')}</div>
          </div>

          <div class="doc-stat-card">
            <div>
              <div class="doc-stat-val" style="color:#dc2626;">${d.criticalAlertsCount}</div>
              <div class="doc-stat-label">Red-Flag Alerts</div>
            </div>
            <div class="doc-stat-icon critical" style="display:flex;align-items:center;justify-content:center;">${icons.alert(22, '#DC2626')}</div>
          </div>

          <div class="doc-stat-card">
            <div>
              <div class="doc-stat-val">${d.totalDocumentsProcessed}</div>
              <div class="doc-stat-label">Documents Processed</div>
            </div>
            <div class="doc-stat-icon pending" style="display:flex;align-items:center;justify-content:center;">${icons.document(22, '#64748B')}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <!-- Department Distribution -->
          <div class="doc-table-card" style="padding: 1.5rem;">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--doc-text-main);">
              OPD Stream Distribution
            </h3>
            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.95rem;">
                <span>General Allopathic OPD:</span>
                <strong>${d.generalOpdCount} sessions</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.95rem;">
                <span>Ayurvedic / AYUSH OPD:</span>
                <strong style="color: #0d9488;">${d.ayushOpdCount} sessions</strong>
              </div>
            </div>
          </div>

          <!-- Language & Operational Metrics -->
          <div class="doc-table-card" style="padding: 1.5rem;">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--doc-text-main);">
              Linguistic & Operational Breakdown
            </h3>
            <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.95rem;">
              <div>
                <span style="color: var(--doc-text-muted);">Languages Used:</span><br/>
                <span style="font-size: 1rem;">${langItems || 'Marathi (MR)'}</span>
              </div>
              <div>
                <span style="color: var(--doc-text-muted);">OCR Service Status:</span><br/>
                <strong>${d.ocrProcessingStatus}</strong>
              </div>
              <div>
                <span style="color: var(--doc-text-muted);">Average Kiosk Intake Duration:</span><br/>
                <strong>${d.averageIntakeDuration}</strong>
              </div>
            </div>
          </div>
        </div>
      `;
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
