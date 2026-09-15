/**
 * Doctor Portal Shell Controller — MediKiosk (Phase 10)
 * 
 * Manages the clinician layout, sidebar navigation, top bar controls,
 * and renders active views.
 */

import {
  doctorState,
  subscribeDoctorState,
  setActiveTab,
  clearDoctorAuth,
  clearPatientWorkspace,
} from './doctorState.js';

import { renderDoctorLoginView } from './views/loginView.js';
import { renderDoctorDashboardView } from './views/dashboardView.js';
import { renderDoctorQueueView } from './views/queueView.js';
import { renderDoctorAlertsView } from './views/alertsView.js';
import { renderDoctorRegistryView } from './views/registryView.js';
import { renderDoctorWorkspaceView } from './views/workspaceView.js';
import { renderDoctorReportsView } from './views/reportsView.js';
import { renderDoctorSettingsView } from './views/settingsView.js';
import { icons } from './doctorIcons.js';

export function initDoctorShell(containerEl) {
  if (!containerEl) return;

  function render() {
    // If not authenticated, render login view
    if (!doctorState.token || doctorState.activeTab === 'login') {
      containerEl.innerHTML = '';
      const { html, attachEvents } = renderDoctorLoginView();
      containerEl.innerHTML = html;
      if (attachEvents) attachEvents();
      return;
    }

    const doc = doctorState.doctor || {
      name: 'Dr. Priya Deshmukh',
      employeeId: 'DOC-8942',
      department: 'General Medicine / OPD-3',
      hospital: 'District Civil Hospital, Pune',
    };

    const currentTab = doctorState.activeTab;

    containerEl.innerHTML = `
      <div class="doc-shell">
        <!-- 1. Left Navigation Sidebar -->
        <aside class="doc-sidebar">
          <div class="doc-sidebar-header">
            <div class="doc-logo-badge" style="display:flex;align-items:center;justify-content:center;">
              ${icons.stethoscope(22, '#2563EB')}
            </div>
            <div>
              <div class="doc-brand-title">MediKiosk</div>
              <div class="doc-brand-sub">Clinical Workstation</div>
            </div>
          </div>

          <ul class="doc-nav-list">
            <li class="doc-nav-item ${currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
              <div class="doc-nav-label-wrap">
                <span class="doc-nav-icon" style="display:inline-flex;align-items:center;">${icons.dashboard(18)}</span>
                <span>Doctor Dashboard</span>
              </div>
            </li>

            <li class="doc-nav-item ${currentTab === 'queue' ? 'active' : ''}" data-tab="queue">
              <div class="doc-nav-label-wrap">
                <span class="doc-nav-icon" style="display:inline-flex;align-items:center;">${icons.queue(18)}</span>
                <span>Live OPD Queue</span>
              </div>
            </li>

            <li class="doc-nav-item ${currentTab === 'alerts' ? 'active' : ''}" data-tab="alerts">
              <div class="doc-nav-label-wrap">
                <span class="doc-nav-icon" style="display:inline-flex;align-items:center;">${icons.alert(18)}</span>
                <span>Priority Clinical Alerts</span>
              </div>
            </li>

            <li class="doc-nav-item ${currentTab === 'registry' ? 'active' : ''}" data-tab="registry">
              <div class="doc-nav-label-wrap">
                <span class="doc-nav-icon" style="display:inline-flex;align-items:center;">${icons.users(18)}</span>
                <span>Patients Registry</span>
              </div>
            </li>

            ${
              currentTab === 'workspace'
                ? `
              <li class="doc-nav-item active" data-tab="workspace" style="border-left: 3px solid #60a5fa;">
                <div class="doc-nav-label-wrap">
                  <span class="doc-nav-icon" style="display:inline-flex;align-items:center;">${icons.user(18)}</span>
                  <span>Active Workspace</span>
                </div>
                <span class="doc-badge-pill" style="background:#2563eb; color:#fff;">OPEN</span>
              </li>
            `
                : ''
            }

            <li class="doc-nav-item ${currentTab === 'reports' ? 'active' : ''}" data-tab="reports">
              <div class="doc-nav-label-wrap">
                <span class="doc-nav-icon" style="display:inline-flex;align-items:center;">${icons.reports(18)}</span>
                <span>Reports & Analytics</span>
              </div>
            </li>

            <li class="doc-nav-item ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
              <div class="doc-nav-label-wrap">
                <span class="doc-nav-icon" style="display:inline-flex;align-items:center;">${icons.settings(18)}</span>
                <span>Settings</span>
              </div>
            </li>
          </ul>

          <!-- Sidebar Doctor Profile Footer -->
          <div class="doc-sidebar-footer">
            <div class="doc-user-info">
              <div class="doc-user-avatar">
                ${doc.name?.split(' ')?.[1]?.[0] || 'D'}
              </div>
              <div>
                <div class="doc-user-name">${doc.name}</div>
                <div class="doc-user-role">${doc.department}</div>
              </div>
            </div>
            <button id="doc-sidebar-logout-btn" class="doc-logout-btn" title="Sign Out" style="display:inline-flex;align-items:center;justify-content:center;">
              ${icons.logout(18)}
            </button>
          </div>
        </aside>

        <!-- 2. Main Workstation Pane -->
        <div class="doc-main-container">
          <!-- Top Bar -->
          <header class="doc-topbar">
            <div class="doc-search-wrapper">
              <span style="color:var(--doc-text-muted); margin-right:0.4rem; display:inline-flex; align-items:center;">
                ${icons.search(16)}
              </span>
              <input
                type="text"
                id="doc-topbar-search-input"
                class="doc-search-input"
                placeholder="Universal search (Name, ABHA, Token, Symptom)..."
              />
            </div>

            <div class="doc-topbar-actions">
              <div class="doc-hospital-tag">
                <span style="display:inline-flex;align-items:center;">${icons.document(14)}</span>
                <span>${doc.hospital}</span>
              </div>

              <button id="doc-contrast-toggle-btn" class="doc-action-btn" title="Toggle Contrast Mode">
                Contrast
              </button>

              <button id="doc-switch-kiosk-btn" class="doc-kiosk-switch-btn" title="Switch to Patient Intake Kiosk">
                Patient Kiosk
              </button>
            </div>
          </header>

          <!-- Dynamic Stage Content -->
          <main id="doc-main-stage" class="doc-stage-content"></main>
        </div>
      </div>
    `;

    // Attach Topbar & Navigation Events
    attachShellEvents();

    // Render Active Content View
    renderCurrentTab();
  }

  function renderCurrentTab() {
    const stage = document.getElementById('doc-main-stage');
    if (!stage) return;

    stage.innerHTML = '';
    let viewRenderer = renderDoctorDashboardView;

    switch (doctorState.activeTab) {
      case 'dashboard':
        viewRenderer = renderDoctorDashboardView;
        break;
      case 'queue':
        viewRenderer = renderDoctorQueueView;
        break;
      case 'alerts':
        viewRenderer = renderDoctorAlertsView;
        break;
      case 'registry':
        viewRenderer = renderDoctorRegistryView;
        break;
      case 'workspace':
        viewRenderer = renderDoctorWorkspaceView;
        break;
      case 'reports':
        viewRenderer = renderDoctorReportsView;
        break;
      case 'settings':
        viewRenderer = renderDoctorSettingsView;
        break;
      default:
        viewRenderer = renderDoctorDashboardView;
    }

    const { html, attachEvents } = viewRenderer();
    stage.innerHTML = html;
    if (attachEvents) attachEvents();
  }

  function attachShellEvents() {
    // Nav item switching
    containerEl.querySelectorAll('.doc-nav-item').forEach((item) => {
      item.addEventListener('click', () => {
        const tab = item.getAttribute('data-tab');
        if (tab) {
          if (tab !== 'workspace' && doctorState.activeTab === 'workspace') {
            // If navigating away from patient workspace, clear patient data to guarantee isolation
            clearPatientWorkspace();
          }
          setActiveTab(tab);
        }
      });
    });

    // Logout button
    document.getElementById('doc-sidebar-logout-btn')?.addEventListener('click', () => {
      const confirmLogout = window.confirm('Are you sure you want to log out of the Clinical Portal?');
      if (confirmLogout) {
        clearDoctorAuth();
      }
    });

    // Switch to Patient Kiosk button
    document.getElementById('doc-switch-kiosk-btn')?.addEventListener('click', () => {
      window.location.hash = '#/kiosk';
    });

    // Contrast Toggle
    document.getElementById('doc-contrast-toggle-btn')?.addEventListener('click', () => {
      doctorState.highContrastMode = !doctorState.highContrastMode;
      document.body.classList.toggle('doc-high-contrast', doctorState.highContrastMode);
    });

    // Universal Topbar Search (Enter triggers registry search)
    const searchInput = document.getElementById('doc-topbar-search-input');
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          setActiveTab('registry');
          setTimeout(() => {
            const regInput = document.getElementById('doc-registry-search-input');
            if (regInput) {
              regInput.value = query;
              regInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, 50);
        }
      }
    });
  }

  // Subscribe to state updates
  subscribeDoctorState(() => {
    render();
  });

  // Initial render
  render();
}
