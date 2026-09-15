/**
 * Doctor Dashboard View — MediKiosk (Phase 10)
 */

import { doctorState, setPatientWorkspace, setActiveTab } from '../doctorState.js';
import { doctorApi } from '../doctorApi.js';
import { icons } from '../doctorIcons.js';

export function renderDoctorDashboardView() {
  const doctor = doctorState.doctor || {
    name: 'Dr. Priya Deshmukh',
    department: 'General Medicine / OPD-3',
    hospital: 'District Civil Hospital, Pune',
  };

  const html = `
    <div class="doc-welcome-banner">
      <div>
        <h2 class="doc-welcome-title" style="color: #ffffff !important; margin: 0 0 0.25rem 0;">Welcome, ${doctor.name}</h2>
        <p class="doc-welcome-subtitle" style="color: #f8fafc !important; margin: 0; opacity: 0.95;">
          ${doctor.department} • Room 03 • ${doctor.hospital}
        </p>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 0.8rem; background: rgba(255,255,255,0.15); padding: 0.35rem 0.75rem; border-radius: 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22C55E;"></span> Clinical Station Online
        </span>
      </div>
    </div>

    <!-- Summary KPI Stat Cards -->
    <div class="doc-stat-grid">
      <div class="doc-stat-card">
        <div>
          <div id="metric-today-queue" class="doc-stat-val">...</div>
          <div class="doc-stat-label">Today's OPD Queue</div>
        </div>
        <div class="doc-stat-icon queue" style="display:flex;align-items:center;justify-content:center;">${icons.queue(22, '#2563EB')}</div>
      </div>

      <div class="doc-stat-card">
        <div>
          <div id="metric-kiosk-intakes" class="doc-stat-val">...</div>
          <div class="doc-stat-label">Kiosk Self-Intakes</div>
        </div>
        <div class="doc-stat-icon kiosk" style="display:flex;align-items:center;justify-content:center;">${icons.stethoscope(22, '#0D9488')}</div>
      </div>

      <div class="doc-stat-card">
        <div>
          <div id="metric-pending-reviews" class="doc-stat-val">...</div>
          <div class="doc-stat-label">Pending Reviews</div>
        </div>
        <div class="doc-stat-icon pending" style="display:flex;align-items:center;justify-content:center;">${icons.clock(22, '#D97706')}</div>
      </div>

      <div class="doc-stat-card">
        <div>
          <div id="metric-critical-alerts" class="doc-stat-val">...</div>
          <div class="doc-stat-label">Critical Red-Flags</div>
        </div>
        <div class="doc-stat-icon critical" style="display:flex;align-items:center;justify-content:center;">${icons.alert(22, '#DC2626')}</div>
      </div>
    </div>

    <!-- Priority Red-Flag Banner (if active) -->
    <div id="doc-dash-critical-box" style="display:none; margin-bottom: 1.75rem;"></div>

    <!-- Live Recent Queue -->
    <div class="doc-table-card">
      <div class="doc-table-header">
        <h3 class="doc-table-title">Recent Kiosk Submissions (Ready for Consultation)</h3>
        <button id="doc-view-full-queue-btn" class="doc-action-btn">
          View Full OPD Queue →
        </button>
      </div>

      <div id="doc-dash-table-wrap">
        <div style="padding: 2rem; text-align: center; color: var(--doc-text-muted);">
          Loading patient queue...
        </div>
      </div>
    </div>
  `;

  function attachEvents() {
    // Load dashboard metrics from backend
    loadDashboardData();

    document.getElementById('doc-view-full-queue-btn')?.addEventListener('click', () => {
      setActiveTab('queue');
    });
  }

  async function loadDashboardData() {
    try {
      const res = await doctorApi.getDashboard();
      if (!res.success || !res.data) return;

      const { metrics, recentQueue } = res.data;
      doctorState.dashboardData = res.data;

      // Update KPIs
      const qEl = document.getElementById('metric-today-queue');
      const kEl = document.getElementById('metric-kiosk-intakes');
      const pEl = document.getElementById('metric-pending-reviews');
      const cEl = document.getElementById('metric-critical-alerts');

      if (qEl) qEl.textContent = metrics.todayQueue ?? 0;
      if (kEl) kEl.textContent = metrics.kioskIntakes ?? 0;
      if (pEl) pEl.textContent = metrics.pendingReviews ?? 0;
      if (cEl) cEl.textContent = metrics.criticalRedFlags ?? 0;

      // Render critical red flag alert if any
      const critBox = document.getElementById('doc-dash-critical-box');
      if (critBox && metrics.criticalRedFlags > 0) {
        const firstCrit = recentQueue.find((q) => q.hasRedFlag);
        critBox.style.display = 'block';
        critBox.innerHTML = `
          <div class="doc-critical-banner">
            <div class="doc-critical-icon" style="display:flex;align-items:center;justify-content:center;">${icons.alert(24, '#DC2626')}</div>
            <div style="flex-grow: 1;">
              <div class="doc-critical-heading">PRIORITY CLINICAL ALERT: RED-FLAG INTAKE DETECTED</div>
              <div class="doc-critical-text">
                Patient <strong>${firstCrit?.patient?.name || 'Walk-in'}</strong> (Token: <code>${firstCrit?.token || 'N/A'}</code>) reported high-risk clinical features: <em>${firstCrit?.redFlagReason || 'Emergency clinical criteria met'}</em>.
              </div>
            </div>
            ${
              firstCrit
                ? `<button class="doc-btn-open doc-open-workspace-btn" data-session-id="${firstCrit.sessionId}" style="background: #dc2626;">
                    Open Workspace Immediately →
                   </button>`
                : ''
            }
          </div>
        `;
      }

      // Render Queue Table
      const tableWrap = document.getElementById('doc-dash-table-wrap');
      if (tableWrap) {
        if (!recentQueue || recentQueue.length === 0) {
          tableWrap.innerHTML = `
            <div class="doc-state-container">
              <div class="doc-state-icon" style="display:flex;align-items:center;justify-content:center;">${icons.user(28, '#94A3B8')}</div>
              <div class="doc-state-title">No Patients in Queue</div>
              <div class="doc-state-desc">Waiting for patient kiosk self-intakes to be completed.</div>
            </div>
          `;
          return;
        }

        tableWrap.innerHTML = `
          <table class="doc-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient Name</th>
                <th>OPD Mode</th>
                <th>Chief Complaint</th>
                <th>Triage Tier</th>
                <th>Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${recentQueue
                .map((item) => {
                  let triageClass = 'normal';
                  if (item.triageTier === 'CRITICAL') triageClass = 'critical';
                  else if (item.triageTier === 'NEEDS_REVIEW') triageClass = 'needs-review';

                  const opdBadge =
                    item.opdMode === 'AYUSH'
                      ? '<span class="doc-opd-badge ayush">AYUSH</span>'
                      : '<span class="doc-opd-badge general">General</span>';

                  return `
                    <tr>
                      <td><span class="doc-token-badge">${item.token}</span></td>
                      <td>
                        <strong>${item.patient?.name || 'Patient'}</strong>
                        <div style="font-size: 0.78rem; color: var(--doc-text-muted);">
                          ${item.patient?.age || 'Adult'} • ${item.patient?.patientIdentifier || ''}
                        </div>
                      </td>
                      <td>${opdBadge}</td>
                      <td><strong>${item.chiefComplaint}</strong></td>
                      <td>
                        <span class="doc-triage-badge ${triageClass}">
                          ${item.triageTier}
                        </span>
                      </td>
                      <td>
                        <span style="font-size: 0.8rem; font-weight: 600; color: #475569;">
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

        // Attach workspace button listeners
        tableWrap.querySelectorAll('.doc-open-workspace-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const sessionId = btn.getAttribute('data-session-id');
            await openPatientWorkspace(sessionId);
          });
        });
      }

      critBox?.querySelectorAll('.doc-open-workspace-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const sessionId = btn.getAttribute('data-session-id');
          await openPatientWorkspace(sessionId);
        });
      });
    } catch (err) {
      console.error('[Dashboard] Error loading data:', err);
    }
  }

  return { html, attachEvents };
}

export async function openPatientWorkspace(sessionId) {
  if (!sessionId) return;
  try {
    const res = await doctorApi.getWorkspace(sessionId);
    if (res.success && res.data) {
      setPatientWorkspace(res.data);
    } else {
      alert('Unable to load patient workspace: ' + (res.error?.message || 'Session unavailable'));
    }
  } catch (err) {
    alert('Error loading patient workspace: ' + err.message);
  }
}
