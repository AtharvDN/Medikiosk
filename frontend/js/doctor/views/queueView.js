/**
 * Live OPD Queue View — MediKiosk (Phase 10)
 */

import { doctorApi } from '../doctorApi.js';
import { openPatientWorkspace } from './dashboardView.js';
import { icons } from '../doctorIcons.js';

export function renderDoctorQueueView() {
  const html = `
    <div style="margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
      <div>
        <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--doc-text-main); margin-bottom: 0.25rem; display: flex; align-items: center; gap: 8px;">
          ${icons.queue(22, '#2563EB')} Live OPD Consultation Queue
        </h2>
        <p style="font-size: 0.85rem; color: var(--doc-text-muted);">
          Real-time patient check-ins and completed MediKiosk intakes ready for physician consultation.
        </p>
      </div>

      <!-- Queue Filters -->
      <div style="display: flex; gap: 0.5rem;" id="doc-queue-filter-group">
        <button class="doc-action-btn queue-filter-btn active" data-filter="">All Patients</button>
        <button class="doc-action-btn queue-filter-btn" data-filter="WAITING">Waiting</button>
        <button class="doc-action-btn queue-filter-btn" data-triage="CRITICAL">Critical Red-Flags</button>
        <button class="doc-action-btn queue-filter-btn" data-opd="AYUSH">AYUSH</button>
        <button class="doc-action-btn queue-filter-btn" data-filter="COMPLETED">Completed</button>
      </div>
    </div>

    <div class="doc-table-card">
      <div id="doc-queue-table-container">
        <div style="padding: 3rem; text-align: center; color: var(--doc-text-muted);">
          Loading live OPD queue...
        </div>
      </div>
    </div>
  `;

  function attachEvents() {
    loadQueueData();

    document.querySelectorAll('.queue-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.queue-filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const status = btn.getAttribute('data-filter') || undefined;
        const triage = btn.getAttribute('data-triage') || undefined;
        const opdMode = btn.getAttribute('data-opd') || undefined;
        loadQueueData({ status, triage, opdMode });
      });
    });
  }

  async function loadQueueData(params = {}) {
    const container = document.getElementById('doc-queue-table-container');
    if (!container) return;

    try {
      const res = await doctorApi.getQueue(params);
      if (!res.success || !res.data) {
        container.innerHTML = `<div class="doc-state-container"><div class="doc-state-title">Error Loading Queue</div></div>`;
        return;
      }

      const { queue } = res.data;

      if (!queue || queue.length === 0) {
        container.innerHTML = `
          <div class="doc-state-container">
            <div class="doc-state-icon" style="display:flex;align-items:center;justify-content:center;">${icons.check(28, '#16A34A')}</div>
            <div class="doc-state-title">No Patients in This Filter</div>
            <div class="doc-state-desc">All caught up! No patients are currently waiting under this selection.</div>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <table class="doc-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Patient Name</th>
              <th>Age / Sex</th>
              <th>Chief Complaint</th>
              <th>OPD</th>
              <th>Triage Tier</th>
              <th>Intake Time</th>
              <th>Status</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${queue
              .map((item) => {
                let triageClass = 'normal';
                if (item.triageTier === 'CRITICAL') triageClass = 'critical';
                else if (item.triageTier === 'NEEDS_REVIEW') triageClass = 'needs-review';

                const opdBadge =
                  item.opdMode === 'AYUSH'
                    ? '<span class="doc-opd-badge ayush">AYUSH</span>'
                    : '<span class="doc-opd-badge general">General</span>';

                const timeStr = item.intakeTime
                  ? new Date(item.intakeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'N/A';

                return `
                  <tr>
                    <td><span class="doc-token-badge">${item.token}</span></td>
                    <td>
                      <strong>${item.patient?.name || 'Patient'}</strong>
                      <div style="font-size: 0.75rem; color: var(--doc-text-muted);">
                        ID: ${item.patient?.patientIdentifier || 'WALKIN'}
                      </div>
                    </td>
                    <td>${item.patient?.age || 'Adult'} • ${item.patient?.sex || 'Adult'}</td>
                    <td><strong>${item.chiefComplaint}</strong></td>
                    <td>${opdBadge}</td>
                    <td>
                      <span class="doc-triage-badge ${triageClass}">
                        ${item.triageTier}
                      </span>
                    </td>
                    <td><span style="font-size: 0.82rem; color: var(--doc-text-muted);">${timeStr}</span></td>
                    <td>
                      <span style="font-size: 0.8rem; font-weight: 700; color: #334155;">
                        ${item.status}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <button class="doc-btn-open doc-open-workspace-btn" data-session-id="${item.sessionId}">
                        Open Workspace
                      </button>
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
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
