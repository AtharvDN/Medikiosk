/**
 * Screen: Patient Medical Records & Reports (Phase 10B)
 * Pure Vanilla HTML5, CSS3, ES Modules.
 */

import { t } from '../i18n.js';
import { appState } from '../state.js';
import { router } from '../router.js';
import { api } from '../api.js';
import { openModal } from '../components/modal.js';

export function renderPatientRecordsScreen() {
  const lang = appState.language;
  const p = appState.patient || {};
  const patientName = p.fullName || p.name || 'Patient';
  const abhaId = p.abhaId || p.identifier || '91-4812-7392-1049';

  const html = `
    <div style="max-width: 760px; margin: 0 auto; padding: 0.5rem 0.5rem 80px;">
      <!-- Header row with Back to Dashboard -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <div>
          <button
            id="btn-records-back"
            type="button"
            class="btn btn--secondary"
            style="padding: 6px 12px; font-size: 13px; min-height: 36px; margin-bottom: 8px;"
          >
            ← ${t('backToDashboard', lang)}
          </button>
          <h1 style="font-size: 24px; color: var(--color-navy); margin: 0; font-weight: 800;">
            ${t('medicalRecords', lang)}
          </h1>
          <p style="font-size: 13px; color: var(--color-gray-600); margin: 4px 0 0;">
            ABDM linked records for ${patientName} (${abhaId})
          </p>
        </div>

        <button
          id="btn-upload-record"
          type="button"
          class="btn btn--secondary"
          style="font-size: 13px; min-height: 40px; padding: 8px 16px;"
        >
          <span>📤</span>
          <span>Upload New Record</span>
        </button>
      </div>

      <!-- Document Category Filters -->
      <div style="display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto;">
        <button id="filter-all" type="button" class="btn btn--primary" style="font-size: 12px; padding: 6px 14px; min-height: 32px;">All Documents</button>
        <button id="filter-prescriptions" type="button" class="btn btn--secondary" style="font-size: 12px; padding: 6px 14px; min-height: 32px;">Prescriptions</button>
        <button id="filter-labs" type="button" class="btn btn--secondary" style="font-size: 12px; padding: 6px 14px; min-height: 32px;">Diagnostic Labs</button>
      </div>

      <!-- Records List Container -->
      <div id="patient-records-container" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="card" style="text-align: center; padding: 32px; color: var(--color-gray-600);">
          <span>Loading medical records & diagnostic reports...</span>
        </div>
      </div>
    </div>
  `;

  return {
    html,
    attachEvents: async () => {
      // 1. Back button
      document.getElementById('btn-records-back')?.addEventListener('click', () => {
        router.navigate('patientDashboard');
      });

      // 2. Upload New Record
      document.getElementById('btn-upload-record')?.addEventListener('click', () => {
        router.navigate('documents');
      });

      // 3. Fetch real records from backend
      const container = document.getElementById('patient-records-container');
      if (!container) return;

      const patientId = appState.patient?.id || appState.patient?.identifier;
      if (!patientId) {
        container.innerHTML = `
          <div class="card" style="text-align: center; padding: 32px;">
            <p style="color: var(--color-gray-600); margin: 0;">No active patient record found. Please sign in or register.</p>
          </div>
        `;
        return;
      }

      try {
        const res = await api.getPatientDocuments(patientId);
        const documents = res?.data?.documents || [];

        if (documents.length === 0) {
          container.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px 20px;">
              <div style="font-size: 36px; margin-bottom: 8px;">📑</div>
              <h3 style="font-size: 16px; color: var(--color-navy); margin: 0 0 6px;">No Uploaded Medical Records</h3>
              <p style="font-size: 13px; color: var(--color-gray-600); max-width: 420px; margin: 0 auto 16px;">
                You haven't uploaded any prescriptions, lab reports, or discharge summaries yet. Scan your documents to assist your doctor.
              </p>
              <button id="btn-empty-upload-doc" class="btn btn--teal" type="button" style="font-size: 13px;">
                Upload Prescription or Lab Report
              </button>
            </div>
          `;
          document.getElementById('btn-empty-upload-doc')?.addEventListener('click', () => {
            router.navigate('documents');
          });
          return;
        }

        container.innerHTML = documents.map((doc, idx) => `
          <div class="card" style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
              <div style="display: flex; align-items: flex-start; gap: 14px;">
                <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--color-teal-light); color: var(--color-teal); display: grid; place-items: center; font-size: 22px; flex-shrink: 0;">
                  📄
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <h3 style="font-size: 16px; color: var(--color-navy); margin: 0; font-weight: 700;">
                      ${doc.title || doc.fileName}
                    </h3>
                    <span class="status-badge status-badge--normal" style="font-size: 11px; padding: 2px 8px;">
                      ${doc.type || doc.documentType || 'DOCUMENT'}
                    </span>
                  </div>
                  <span style="font-size: 12px; color: var(--color-gray-600); display: block; margin-top: 3px;">
                    Issued by ${doc.issuer || 'Healthcare Provider'} · Date: ${doc.date || 'Recorded'} ${doc.size ? `· ${doc.size}` : ''}
                  </span>

                  <!-- Highlights from OCR -->
                  <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                    ${(doc.highlights || []).map(h => `
                      <span style="font-size: 11px; background: ${h.includes('Flagged') || h.includes('critical') ? 'var(--color-warning-bg)' : 'var(--color-bg)'}; border: 1px solid ${h.includes('Flagged') || h.includes('critical') ? 'var(--color-warning-border)' : 'var(--color-border)'}; color: ${h.includes('Flagged') || h.includes('critical') ? '#92400E' : 'var(--color-ink)'}; padding: 2px 8px; border-radius: var(--radius-sm); font-weight: 600;">
                        ${h}
                      </span>
                    `).join('')}
                  </div>
                </div>
              </div>

              <div style="display: flex; gap: 8px;">
                <button
                  type="button"
                  class="btn btn--secondary btn-view-doc"
                  data-index="${idx}"
                  style="padding: 8px 12px; font-size: 12px; min-height: 36px;"
                >
                  <span>👁️ View File</span>
                </button>
                <a
                  href="/api/documents/${doc.id}/download"
                  download
                  class="btn btn--secondary"
                  style="padding: 8px 12px; font-size: 12px; min-height: 36px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;"
                >
                  <span>⬇️ Download</span>
                </a>
              </div>
            </div>
          </div>
        `).join('');

        // View Document Details Modal (Displaying physical file alongside OCR)
        document.querySelectorAll('.btn-view-doc').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            const doc = documents[idx];
            if (!doc) return;

            openModal({
              title: `Medical Document: ${doc.title || doc.fileName}`,
              contentHtml: `
                <div style="font-size: 13px; color: var(--color-ink); line-height: 1.6;">
                  <div style="background: var(--color-bg); padding: 12px; border-radius: var(--radius-md); margin-bottom: 12px;">
                    <div><strong>Document Type:</strong> ${doc.type || doc.documentType || 'Medical Record'}</div>
                    <div><strong>Date / Year:</strong> ${doc.date || 'Recorded'}</div>
                    <div><strong>Issuing Facility:</strong> ${doc.issuer || 'Healthcare Facility'}</div>
                    <div><strong>OCR Confidence:</strong> ${doc.ocrConfidence || '95%'}</div>
                  </div>

                  <!-- Physical File Preview -->
                  <div style="margin-bottom: 16px;">
                    <strong style="color: var(--color-navy); display: block; margin-bottom: 6px;">Original Uploaded Document</strong>
                    <div style="width: 100%; height: 320px; background: #334155; border-radius: 6px; overflow: hidden; border: 1px solid #CBD5E1;">
                      <iframe src="/api/documents/${doc.id}/file" style="width: 100%; height: 100%; border: none; background: #FFF;"></iframe>
                    </div>
                  </div>

                  <!-- Extracted Text -->
                  <div>
                    <strong style="color: var(--color-navy); display: block; margin-bottom: 4px;">Extracted OCR Text Content</strong>
                    <pre style="background: #F8FAFC; border: 1px solid var(--color-border); padding: 12px; border-radius: var(--radius-md); font-family: monospace; font-size: 12px; white-space: pre-wrap; max-height: 180px; overflow-y: auto;">${doc.ocrText || 'No raw OCR text available.'}</pre>
                  </div>
                </div>
              `,
            });
          });
        });

      } catch (err) {
        console.error('[PatientRecords] Error loading documents:', err);
        container.innerHTML = `
          <div class="card" style="text-align: center; padding: 24px; color: var(--color-critical);">
            Failed to load medical records. Please retry.
          </div>
        `;
      }
    },
  };
}
