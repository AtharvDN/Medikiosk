/**
 * Patient Registry & OPD Directory View — MediKiosk (Phase 10)
 */

import { doctorApi } from '../doctorApi.js';
import { openPatientWorkspace } from './dashboardView.js';
import { icons } from '../doctorIcons.js';

export function renderDoctorRegistryView() {
  const html = `
    <div style="margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
      <div>
        <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--doc-text-main); margin-bottom: 0.25rem; display: flex; align-items: center; gap: 8px;">
          ${icons.users(22, '#2563EB')} Patients Registry & OPD Directory
        </h2>
        <p style="font-size: 0.85rem; color: var(--doc-text-muted);">
          Searchable clinical archive of all MediKiosk intake sessions, encounters, and verified records.
        </p>
      </div>

      <!-- Filter Tabs -->
      <div style="display: flex; gap: 0.5rem;" id="doc-registry-filters">
        <button class="doc-action-btn reg-filter-btn active" data-filter="ALL">All</button>
        <button class="doc-action-btn reg-filter-btn" data-filter="CRITICAL">Critical</button>
        <button class="doc-action-btn reg-filter-btn" data-filter="NEEDS_REVIEW">Needs Review</button>
        <button class="doc-action-btn reg-filter-btn" data-filter="NORMAL">Normal</button>
      </div>
    </div>

    <!-- Search Input Inside Registry -->
    <div style="margin-bottom: 1.25rem; display: flex; gap: 1rem;">
      <div class="doc-search-wrapper" style="width: 100%; max-width: 500px; background: #ffffff; display: flex; align-items: center; padding-left: 10px;">
        <span style="display: flex; align-items: center; margin-right: 0.5rem; color: var(--doc-text-muted);">${icons.search(18, '#64748B')}</span>
        <input
          type="text"
          id="doc-registry-search-input"
          class="doc-search-input"
          placeholder="Search by Patient Name, ABHA ID, Token, or Chief Complaint..."
        />
      </div>
    </div>

    <div class="doc-table-card">
      <div id="doc-registry-table-container">
        <div style="padding: 3rem; text-align: center; color: var(--doc-text-muted);">
          Loading patient directory...
        </div>
      </div>
    </div>
  `;

  function attachEvents() {
    let currentSearch = '';
    let currentFilter = 'ALL';

    loadRegistry(currentSearch, currentFilter);

    const searchInput = document.getElementById('doc-registry-search-input');
    let debounceTimer = null;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      currentSearch = e.target.value;
      debounceTimer = setTimeout(() => {
        loadRegistry(currentSearch, currentFilter);
      }, 250);
    });

    document.querySelectorAll('.reg-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.reg-filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter') || 'ALL';
        loadRegistry(currentSearch, currentFilter);
      });
    });
  }

  async function loadRegistry(search = '', filter = 'ALL') {
    const container = document.getElementById('doc-registry-table-container');
    if (!container) return;

    try {
      const res = await doctorApi.getPatients(search, filter);
      if (!res.success || !res.data) {
        container.innerHTML = `<div class="doc-state-container"><div class="doc-state-title">Error Loading Registry</div></div>`;
        return;
      }

      const { patients } = res.data;

      if (!patients || patients.length === 0) {
        container.innerHTML = `
          <div class="doc-state-container">
            <div class="doc-state-icon" style="display:flex;align-items:center;justify-content:center;">${icons.search(28, '#94A3B8')}</div>
            <div class="doc-state-title">No Matching Records Found</div>
            <div class="doc-state-desc">Try adjusting your search terms or filter selection.</div>
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
              <th>Demographics</th>
              <th>OPD Mode</th>
              <th>Chief Complaint</th>
              <th>Triage Tier</th>
              <th>Consultation Status</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${patients
              .map((p) => {
                let triageClass = 'normal';
                if (p.triageTier === 'CRITICAL') triageClass = 'critical';
                else if (p.triageTier === 'NEEDS_REVIEW') triageClass = 'needs-review';

                const opdBadge =
                  p.opdMode === 'AYUSH'
                    ? '<span class="doc-opd-badge ayush">AYUSH</span>'
                    : '<span class="doc-opd-badge general">General</span>';

                return `
                  <tr>
                    <td><span class="doc-token-badge">${p.token}</span></td>
                    <td>
                      <strong>${p.patient?.name || 'Patient'}</strong>
                      <div style="font-size: 0.75rem; color: var(--doc-text-muted);">
                        ABHA / ID: <code>${p.patient?.patientIdentifier || 'WALKIN'}</code>
                      </div>
                    </td>
                    <td>${p.patient?.age || 'Adult'} • ${p.patient?.phone || 'N/A'}</td>
                    <td>${opdBadge}</td>
                    <td><strong>${p.chiefComplaint}</strong></td>
                    <td>
                      <span class="doc-triage-badge ${triageClass}">
                        ${p.triageTier}
                      </span>
                    </td>
                    <td>
                      <span style="font-size: 0.8rem; font-weight: 600; color: #475569;">
                        ${p.status}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <button class="doc-btn-open doc-open-workspace-btn" data-session-id="${p.sessionId}">
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
