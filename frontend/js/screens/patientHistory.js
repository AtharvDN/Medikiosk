/**
 * Screen: Patient Medical History & Longitudinal Timeline (Phase 10B)
 * Pure Vanilla HTML5, CSS3, ES Modules.
 */

import { t } from '../i18n.js';
import { appState, resetClinicalSession } from '../state.js';
import { router } from '../router.js';
import { api } from '../api.js';
import { openModal } from '../components/modal.js';

let activeHistoryTab = 'timeline'; // 'timeline' | 'encounters'

export function renderPatientHistoryScreen() {
  const lang = appState.language;
  const p = appState.patient || {};
  const patientName = p.fullName || p.name || 'Patient';

  const html = `
    <div style="max-width: 780px; margin: 0 auto; padding: 0.5rem 0.5rem 80px;">
      <!-- Header row with Back to Dashboard -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        <div>
          <button
            id="btn-history-back"
            type="button"
            class="btn btn--secondary"
            style="padding: 6px 12px; font-size: 13px; min-height: 36px; margin-bottom: 8px;"
          >
            ← ${t('backToDashboard', lang)}
          </button>
          <h1 style="font-size: 24px; color: var(--color-navy); margin: 0; font-weight: 800;">
            ${t('healthHistory', lang)}
          </h1>
          <p style="font-size: 13px; color: var(--color-gray-600); margin: 4px 0 0;">
            ${t('healthHistoryDesc', lang)} (${patientName})
          </p>
        </div>

        <button
          id="btn-history-new-case"
          type="button"
          class="btn btn--teal"
          style="font-size: 13px; min-height: 40px; padding: 8px 16px;"
        >
          <span>➕</span>
          <span>${t('recordNewCase', lang)}</span>
        </button>
      </div>

      <!-- Navigation Tabs: Longitudinal Timeline vs Prior OPD Visits -->
      <div style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 2px solid var(--color-border); padding-bottom: 2px;">
        <button
          id="tab-btn-timeline"
          type="button"
          class="tab ${activeHistoryTab === 'timeline' ? 'tab--active' : ''}"
          style="padding: 8px 16px; font-size: 13px; font-weight: 700; border: none; background: ${activeHistoryTab === 'timeline' ? 'var(--color-navy)' : 'transparent'}; color: ${activeHistoryTab === 'timeline' ? '#FFF' : 'var(--color-gray-600)'}; border-radius: 6px 6px 0 0; cursor: pointer;"
        >
          🩺 My Medical Timeline
        </button>
        <button
          id="tab-btn-encounters"
          type="button"
          class="tab ${activeHistoryTab === 'encounters' ? 'tab--active' : ''}"
          style="padding: 8px 16px; font-size: 13px; font-weight: 700; border: none; background: ${activeHistoryTab === 'encounters' ? 'var(--color-navy)' : 'transparent'}; color: ${activeHistoryTab === 'encounters' ? '#FFF' : 'var(--color-gray-600)'}; border-radius: 6px 6px 0 0; cursor: pointer;"
        >
          🏥 Prior OPD Consultations
        </button>
      </div>

      <!-- Container: Medical Timeline -->
      <div id="container-timeline-view" style="display: ${activeHistoryTab === 'timeline' ? 'block' : 'none'};">
        <div class="card" style="text-align: center; padding: 32px; color: var(--color-gray-600);">
          <span>Loading longitudinal health journey...</span>
        </div>
      </div>

      <!-- Container: Prior OPD Encounters -->
      <div id="container-encounters-view" style="display: ${activeHistoryTab === 'encounters' ? 'block' : 'none'};">
        <div class="card" style="text-align: center; padding: 32px; color: var(--color-gray-600);">
          <span>Loading historical visits...</span>
        </div>
      </div>
    </div>
  `;

  return {
    html,
    attachEvents: async () => {
      // 1. Back button
      document.getElementById('btn-history-back')?.addEventListener('click', () => {
        router.navigate('patientDashboard');
      });

      // 2. Record New Case
      document.getElementById('btn-history-new-case')?.addEventListener('click', () => {
        resetClinicalSession(false);
        router.navigate('opdSelection');
      });

      // Tab switcher
      const timelineBtn = document.getElementById('tab-btn-timeline');
      const encountersBtn = document.getElementById('tab-btn-encounters');
      const timelineView = document.getElementById('container-timeline-view');
      const encountersView = document.getElementById('container-encounters-view');

      timelineBtn?.addEventListener('click', () => {
        activeHistoryTab = 'timeline';
        if (timelineView) timelineView.style.display = 'block';
        if (encountersView) encountersView.style.display = 'none';
        timelineBtn.style.background = 'var(--color-navy)';
        timelineBtn.style.color = '#FFF';
        if (encountersBtn) {
          encountersBtn.style.background = 'transparent';
          encountersBtn.style.color = 'var(--color-gray-600)';
        }
      });

      encountersBtn?.addEventListener('click', () => {
        activeHistoryTab = 'encounters';
        if (timelineView) timelineView.style.display = 'none';
        if (encountersView) encountersView.style.display = 'block';
        encountersBtn.style.background = 'var(--color-navy)';
        encountersBtn.style.color = '#FFF';
        if (timelineBtn) {
          timelineBtn.style.background = 'transparent';
          timelineBtn.style.color = 'var(--color-gray-600)';
        }
      });

      const patientId = appState.patient?.id || appState.patient?.identifier;
      if (!patientId) return;

      // 3. Load Medical Timeline
      try {
        const timelineRes = await api.getPatientTimeline(patientId);
        const events = timelineRes?.data?.events || [];

        if (timelineView) {
          if (events.length === 0) {
            timelineView.innerHTML = `
              <div class="card" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 36px; margin-bottom: 8px;">📋</div>
                <h3 style="font-size: 16px; color: var(--color-navy); margin: 0 0 6px;">No previous medical history has been recorded.</h3>
                <p style="font-size: 13px; color: var(--color-gray-600); max-width: 420px; margin: 0 auto 16px;">
                  No prior surgical procedures, chronic illnesses, or historical hospitalizations have been documented for this profile.
                </p>
              </div>
            `;
          } else {
            timelineView.innerHTML = `
              <div style="display: flex; flex-direction: column; gap: 14px; position: relative; padding-left: 28px;">
                <div style="position: absolute; left: 9px; top: 12px; bottom: 12px; width: 2px; background: #CBD5E1;"></div>
                ${events.map(ev => {
                  let badgeBg = '#E0F2FE';
                  let badgeColor = '#0369A1';
                  let dotColor = 'var(--color-teal)';

                  if (ev.type === 'PAST_SURGERY') {
                    badgeBg = '#FEE2E2'; badgeColor = '#991B1B'; dotColor = '#EF4444';
                  } else if (ev.type === 'CHRONIC_CONDITION') {
                    badgeBg = '#FEF3C7'; badgeColor = '#92400E'; dotColor = '#F59E0B';
                  } else if (ev.type === 'FRACTURE_TRAUMA') {
                    badgeBg = '#F3E8FF'; badgeColor = '#6B21A8'; dotColor = '#A855F7';
                  } else if (ev.type === 'CURRENT_CONSULTATION') {
                    badgeBg = '#DCFCE7'; badgeColor = '#166534'; dotColor = '#22C55E';
                  }

                  return `
                    <div class="card" style="position: relative; padding: 16px 20px;">
                      <div style="position: absolute; left: -25px; top: 18px; width: 14px; height: 14px; border-radius: 50%; background: ${dotColor}; border: 2.5px solid #FFF; box-shadow: 0 0 0 2px #E2E8F0;"></div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
                        <span style="font-size: 13px; font-weight: 800; color: var(--color-navy);">
                          ${ev.displayDate || ev.year || 'Historical'}
                        </span>
                        <span class="status-badge" style="background: ${badgeBg}; color: ${badgeColor}; font-size: 11px;">
                          ${ev.type.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <h4 style="font-size: 15px; color: var(--color-navy); margin: 0 0 4px; font-weight: 700;">
                        ${ev.title || ev.type}
                      </h4>
                      <p style="font-size: 13px; color: var(--color-ink); margin: 0; line-height: 1.45;">
                        ${ev.description || ''}
                      </p>
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }
        }
      } catch (timelineErr) {
        console.warn('[PatientHistory] Failed to load timeline:', timelineErr);
      }

      // 4. Load Encounters History
      try {
        const res = await api.getPatientHistory(patientId);
        const history = res?.data?.history || [];

        if (encountersView) {
          if (history.length === 0) {
            encountersView.innerHTML = `
              <div class="card" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 36px; margin-bottom: 8px;">🏥</div>
                <h3 style="font-size: 16px; color: var(--color-navy); margin: 0 0 6px;">No Previous Consultations Recorded</h3>
                <p style="font-size: 13px; color: var(--color-gray-600); max-width: 400px; margin: 0 auto 16px;">
                  You do not have any past medical consultations on record. Tap below to begin your first clinical intake.
                </p>
                <button id="btn-empty-start-case" class="btn btn--primary" type="button" style="font-size: 13px;">
                  ${t('recordMyCase', lang)}
                </button>
              </div>
            `;
            document.getElementById('btn-empty-start-case')?.addEventListener('click', () => {
              resetClinicalSession(false);
              router.navigate('opdSelection');
            });
          } else {
            encountersView.innerHTML = history.map((item, idx) => `
              <div class="card card--interactive history-encounter-card" data-index="${idx}" style="padding: 20px; margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                      <span style="font-size: 12px; font-weight: 700; color: var(--color-teal); text-transform: uppercase;">
                        ${item.department}
                      </span>
                      <span style="font-size: 12px; color: var(--color-gray-400);">•</span>
                      <span style="font-size: 12px; color: var(--color-gray-600);">
                        ${item.doctor}
                      </span>
                    </div>
                    <h3 style="font-size: 17px; color: var(--color-navy); margin: 0 0 6px; font-weight: 700;">
                      ${item.chiefComplaint}
                    </h3>
                  </div>
                  <span class="status-badge ${item.triageLevel === 'critical' ? 'status-badge--critical' : (item.triageLevel === 'warning' ? 'status-badge--warning' : 'status-badge--normal')}">
                    ${item.status}
                  </span>
                </div>

                <p style="font-size: 13px; color: var(--color-gray-700); line-height: 1.5; margin: 8px 0 10px;">
                  ${item.aiSummary}
                </p>

                ${(item.conclusion || item.doctorRemarks) ? `
                  <div class="doctor-conclusion-box" style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; flex-wrap: wrap; gap: 4px;">
                      <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.05em; display: inline-flex; align-items: center; gap: 4px;">
                        👨‍⚕️ Doctor's Conclusion & Advice
                      </span>
                      <span style="font-size: 11px; color: #15803D; font-weight: 600;">
                        ${item.doctorName || item.doctor || 'Attending Physician'}
                      </span>
                    </div>
                    ${item.conclusion ? `
                      <div style="margin-bottom: 4px;">
                        <span style="font-size: 11px; font-weight: 700; color: #14532D; text-transform: uppercase;">Conclusion / Impression:</span>
                        <div style="font-size: 13px; font-weight: 600; color: #14532D; margin-top: 2px;">
                          ${item.conclusion}
                        </div>
                      </div>
                    ` : ''}
                    ${item.doctorRemarks ? `
                      <div>
                        <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Doctor's Remark / Care Plan:</span>
                        <div style="font-size: 12px; color: #166534; margin-top: 2px; line-height: 1.4;">
                          ${item.doctorRemarks}
                        </div>
                      </div>
                    ` : ''}
                  </div>
                ` : ''}

                <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--color-border-light); padding-top: 10px; font-size: 12px; color: var(--color-gray-600);">
                  <div style="display: flex; align-items: center; gap: 16px;">
                    <span>📅 ${item.date} ${item.time ? `at ${item.time}` : ''}</span>
                    <span>📄 ${item.documentsCount} document(s)</span>
                  </div>
                  <span style="color: var(--color-sky); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                    ${t('viewDetails', lang)} ➔
                  </span>
                </div>
              </div>
            `).join('');

            document.querySelectorAll('.history-encounter-card').forEach(el => {
              el.addEventListener('click', () => {
                const idx = parseInt(el.getAttribute('data-index'), 10);
                const encItem = history[idx];
                if (!encItem) return;

                openModal({
                  title: `Encounter Details — ${encItem.tokenNumber}`,
                  contentHtml: `
                    <div class="history-modal" style="font-size: 13px; color: var(--color-ink); line-height: 1.6;">
                      <div style="background: var(--color-bg); padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 14px;">
                        <div><strong>Department:</strong> ${encItem.department}</div>
                        <div><strong>Attending Physician:</strong> ${encItem.doctorName || encItem.doctor}</div>
                        <div><strong>Date & Time:</strong> ${encItem.date} at ${encItem.time}</div>
                        <div><strong>Consultation Status:</strong> ${encItem.status}</div>
                      </div>
                      <div style="margin-bottom: 12px;">
                        <strong style="color: var(--color-navy); display: block; margin-bottom: 4px;">Reported Chief Complaint</strong>
                        <p style="margin: 0; font-style: italic; color: var(--color-gray-800);">“${encItem.chiefComplaint}”</p>
                      </div>
                      ${(encItem.conclusion || encItem.doctorRemarks) ? `
                        <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 12px;">
                          <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">
                            Doctor's Assessment & Advice (${encItem.doctorName || encItem.doctor})
                          </div>
                          ${encItem.conclusion ? `
                            <div style="margin-bottom: 6px;">
                              <strong style="color: #14532D; font-size: 12px; display: block;">Clinical Conclusion / Impression:</strong>
                              <p style="margin: 2px 0 0; font-size: 13px; font-weight: 600; color: #14532D;">${encItem.conclusion}</p>
                            </div>
                          ` : ''}
                          ${encItem.doctorRemarks ? `
                            <div>
                              <strong style="color: #166534; font-size: 12px; display: block;">Doctor's Remarks & Advice:</strong>
                              <p style="margin: 2px 0 0; font-size: 13px; color: #166534; line-height: 1.4;">${encItem.doctorRemarks}</p>
                            </div>
                          ` : ''}
                        </div>
                      ` : ''}
                      <div>
                        <strong style="color: var(--color-navy); display: block; margin-bottom: 4px;">Clinical Summary</strong>
                        <p style="margin: 0; color: var(--color-gray-700);">${encItem.aiSummary}</p>
                      </div>
                    </div>
                  `,
                });
              });
            });
          }
        }
      } catch (err) {
        console.error('[PatientHistory] Error loading history:', err);
      }
    },
  };
}
