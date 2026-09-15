/**
 * Screen 9: Document Upload & Classification Review
 * Structured healthcare scanning workflow & medical review tables.
 */

import { t } from '../i18n.js';
import { appState, notifyStateChange } from '../state.js';
import { router } from '../router.js';
import { documentService } from '../services/documentService.js';
import { MOCK_PRESET_DOCUMENTS } from '../mock/mockDocuments.js';

let selectedDocType = 'PRESCRIPTION';
let selectedOcrMode = 'ANALYZE';
let isProcessing = false;
let processingStage = '';
let uploadError = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderDocumentReviewScreen() {
  const lang = appState.language;

  // 1. Processing Stage State
  if (isProcessing) {
    const stageLabel = t(processingStage || 'readingDoc', lang) || 'Analyzing document...';
    return {
      html: `
        <div class="screen-card" style="text-align: center; align-items: center; padding: 4rem 2rem; max-width: 800px; margin: 0 auto;">
          <div style="font-size: 3.5rem; margin-bottom: 1.5rem; color: var(--primary);" aria-hidden="true">🔍</div>
          <h2 class="kiosk-question-title" style="color: var(--primary);">${t('analyzingDoc', lang) || 'Scanning Document...'}</h2>
          <div style="font-size: var(--font-size-md); color: var(--teal); font-weight: 700; margin-top: 1rem;">
            ● ${stageLabel}
          </div>
          <p style="font-size: var(--font-size-sm); color: var(--muted-text); margin-top: 0.5rem;">Running sovereign PaddleOCR & medical entity extraction</p>
        </div>
      `,
      attachEvents: () => {},
    };
  }

  // 2. Render List of Attached Documents with Structured Clinical Tables
  const attachedDocsHtml = appState.documents
    .map((doc, index) => {
      const medications = doc.extractedData?.medications || [];
      const hasMeds = medications.length > 0;

      return `
        <div style="background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.85rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.85rem;">
              <span style="font-size: 2rem;" aria-hidden="true">📄</span>
              <div>
                <div style="font-weight: 800; font-size: var(--font-size-base); color: var(--primary);">${escapeHtml(doc.name)}</div>
                <div style="font-size: var(--font-size-xs); color: var(--muted-text); margin-top: 0.15rem;">
                  ${escapeHtml(doc.type)} • ${((doc.fileSizeBytes || 1048576) / 1024 / 1024).toFixed(1)} MB
                  • <span style="color: var(--teal); font-weight: 700;">✓ Scanned by PaddleOCR</span>
                  ${doc.confidence ? ` • Confidence: ${(doc.confidence * 100).toFixed(0)}%` : ''}
                </div>
              </div>
            </div>
            <button class="btn btn-secondary btn-remove-doc" data-doc-index="${index}" title="Remove Document" style="min-height: 40px; padding: 0 0.85rem; color: var(--danger); border-color: var(--danger);">
              ✕ Remove
            </button>
          </div>

          <!-- Structured Medications Table -->
          ${hasMeds ? `
            <div style="margin-bottom: 1rem;">
              <div style="font-size: var(--font-size-xs); font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.5rem;">
                Extracted Prescription Information:
              </div>
              <div class="clinical-table-wrapper">
                <table class="clinical-table">
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Dose / Strength</th>
                      <th>Frequency</th>
                      <th>Duration</th>
                      <th>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${medications.map((m) => {
                      const doseDisplay = m.dose && m.dose !== 'Not detected' ? escapeHtml(m.dose) : `<span style="color: var(--muted-text); font-style: italic;">Not detected</span>`;
                      const freqDisplay = m.frequency ? escapeHtml(typeof m.frequency === 'object' ? (m.frequency.raw || m.frequency.description || JSON.stringify(m.frequency)) : m.frequency) : `<span style="color: var(--muted-text); font-style: italic;">Not detected</span>`;
                      const durDisplay = m.duration ? escapeHtml(typeof m.duration === 'object' ? (m.duration.raw || `${m.duration.value} ${m.duration.unit}`) : m.duration) : `<span style="color: var(--muted-text); font-style: italic;">Not detected</span>`;
                      const instDisplay = m.instructions ? escapeHtml(m.instructions) : `<span style="color: var(--muted-text); font-style: italic;">—</span>`;

                      return `
                        <tr>
                          <td style="font-weight: 700; color: var(--primary);">💊 ${escapeHtml(m.drugName)}</td>
                          <td>${doseDisplay}</td>
                          <td>${freqDisplay}</td>
                          <td>${durDisplay}</td>
                          <td>${instDisplay}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : `
            <div style="font-size: var(--font-size-xs); color: var(--muted-text); padding: 0.5rem 0;">
              No structured items detected. Document preserved for clinician review.
            </div>
          `}

          <!-- Raw OCR Collapsible View -->
          ${doc.ocrText ? `
            <details style="margin-top: 0.75rem;">
              <summary style="font-size: var(--font-size-xs); font-weight: 700; color: var(--secondary); cursor: pointer;">
                View Raw OCR Text (Preserved UTF-8)
              </summary>
              <pre class="ocr-raw-display" style="margin-top: 0.5rem; padding: 0.75rem; background: var(--surface-subtle); border-radius: var(--radius-sm); font-size: var(--font-size-xs); color: var(--text); max-height: 140px; overflow-y: auto; white-space: pre-wrap; font-family: inherit; border-left: 3px solid var(--primary);">${escapeHtml(doc.ocrText)}</pre>
            </details>
          ` : ''}
        </div>
      `;
    })
    .join('');

  const html = `
    <div class="screen-card" style="max-width: 1060px; margin: 0 auto;">
      <h1 class="kiosk-question-title" style="color: var(--primary);">
        ${t('docUploadTitle', lang)}
      </h1>
      <p class="kiosk-question-subtitle">
        ${t('docSupportedTypes', lang)}
      </p>

      <!-- Scanning Progression Workflow Indicator -->
      <div class="upload-workflow-steps">
        <div class="workflow-step-item completed">
          <span>✓</span> <span>1. Select Type</span>
        </div>
        <div class="workflow-step-item ${appState.documents.length > 0 ? 'completed' : 'active'}">
          <span>●</span> <span>2. Scan / Upload</span>
        </div>
        <div class="workflow-step-item ${appState.documents.length > 0 ? 'completed' : ''}">
          <span>●</span> <span>3. Reading & OCR</span>
        </div>
        <div class="workflow-step-item ${appState.documents.length > 0 ? 'active' : ''}">
          <span>●</span> <span>4. Review Medicines</span>
        </div>
        <div class="workflow-step-item">
          <span>○</span> <span>5. Saved</span>
        </div>
      </div>

      ${uploadError ? `
        <div style="background: var(--danger-bg); border: 1px solid var(--danger-border); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem; color: var(--danger); display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.25rem;" aria-hidden="true">⚠️</span>
          <div style="flex: 1; font-size: var(--font-size-sm); font-weight: 600;">
            ${escapeHtml(uploadError)}
          </div>
          <button id="btn-dismiss-error" class="btn btn-secondary" style="min-height: 32px; padding: 0 0.65rem; font-size: var(--font-size-xs);">✕</button>
        </div>
      ` : ''}

      <!-- Document Type Selection -->
      <div style="margin-bottom: 1.25rem;">
        <div style="font-size: var(--font-size-xs); font-weight: 700; color: var(--muted-text); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.5rem;">
          ${t('docTypeQuestion', lang) || 'Select Document Type:'}
        </div>
        <div class="doc-type-pill-group">
          <button class="doc-type-pill ${selectedDocType === 'PRESCRIPTION' ? 'selected' : ''}" data-type="PRESCRIPTION">
            💊 ${t('typePrescription', lang)}
          </button>
          <button class="doc-type-pill ${selectedDocType === 'LAB_REPORT' ? 'selected' : ''}" data-type="LAB_REPORT">
            🧪 ${t('typeLabReport', lang)}
          </button>
          <button class="doc-type-pill ${selectedDocType === 'DISCHARGE' ? 'selected' : ''}" data-type="DISCHARGE">
            📋 ${t('typeDischarge', lang)}
          </button>
          <button class="doc-type-pill ${selectedDocType === 'OTHER' ? 'selected' : ''}" data-type="OTHER">
            📁 ${t('typeOther', lang)}
          </button>
        </div>
      </div>

      <!-- OCR Mode Option: Full OCR vs Original Only -->
      <div style="margin-bottom: 1.25rem;">
        <div style="font-size: var(--font-size-xs); font-weight: 700; color: var(--muted-text); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.5rem;">
          Document Processing Option:
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button id="btn-mode-analyze" type="button" class="btn ${selectedOcrMode === 'ANALYZE' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 14px; font-size: 13px; border-radius: var(--radius-md);">
            🔍 Upload & Analyze (OCR Extraction)
          </button>
          <button id="btn-mode-original" type="button" class="btn ${selectedOcrMode === 'ORIGINAL_ONLY' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 14px; font-size: 13px; border-radius: var(--radius-md);">
            📎 Upload Original Only (Bypass OCR)
          </button>
        </div>
      </div>

      <!-- Kiosk Healthcare Scanning Dropzone -->
      <div id="dropzone-upload" class="upload-dropzone">
        <div style="font-size: 3rem; margin-bottom: 0.5rem; color: var(--primary);" aria-hidden="true">📷</div>
        <div style="font-size: var(--font-size-md); font-weight: 700; color: var(--primary);">
          ${t('docUploadPrompt', lang)}
        </div>
        <div style="font-size: var(--font-size-xs); color: var(--muted-text); margin-top: 0.35rem;">
          ${selectedOcrMode === 'ORIGINAL_ONLY' ? 'Original document will be stored safely without running text recognition' : 'Hold prescription or report in front of kiosk scanner or tap to select image (JPG, PNG, PDF up to 15 MB)'}
        </div>
      </div>
      <input type="file" id="file-input" style="display: none;" accept="image/*,application/pdf" capture="environment" />

      <!-- Attached Documents Section -->
      ${appState.documents.length > 0 ? `
        <div style="margin: 1.5rem 0;">
          <div style="font-size: var(--font-size-sm); font-weight: 700; color: var(--primary); margin-bottom: 0.75rem;">
            Attached Medical Documents (${appState.documents.length}):
          </div>
          ${attachedDocsHtml}
        </div>
      ` : ''}

      <!-- Bottom Navigation Row -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.75rem; padding-top: 1.25rem; border-top: 1px solid var(--border-subtle);">
        <button id="btn-docreview-back" class="btn btn-secondary" style="min-height: 50px;">
          ← ${t('back', lang)}
        </button>

        <div style="display: flex; gap: 1rem; align-items: center;">
          <!-- Demo Preset Shortcut -->
          <button id="btn-add-demo-doc" class="btn btn-secondary" style="font-size: var(--font-size-xs); min-height: 50px; border-style: dashed;">
            <span>⚡</span>
            <span>Add Sample Prescription</span>
          </button>

          <button id="btn-docs-continue" class="btn btn-primary btn-huge" style="min-width: 220px;">
            <span>${t('continue', lang)}</span>
            <span aria-hidden="true">➔</span>
          </button>
        </div>
      </div>
    </div>
  `;

  return {
    html,
    attachEvents: () => {
      const dropzone = document.getElementById('dropzone-upload');
      const fileInput = document.getElementById('file-input');

      dropzone?.addEventListener('click', () => {
        if (!isProcessing) fileInput?.click();
      });

      // Type Selector Pills
      document.querySelectorAll('.doc-type-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
          selectedDocType = pill.getAttribute('data-type');
          document.querySelectorAll('.doc-type-pill').forEach((p) => p.classList.remove('selected'));
          pill.classList.add('selected');
        });
      });

      // OCR Mode Toggle
      document.getElementById('btn-mode-analyze')?.addEventListener('click', () => {
        selectedOcrMode = 'ANALYZE';
        router.renderCurrentScreen();
      });
      document.getElementById('btn-mode-original')?.addEventListener('click', () => {
        selectedOcrMode = 'ORIGINAL_ONLY';
        router.renderCurrentScreen();
      });

      document.getElementById('btn-dismiss-error')?.addEventListener('click', () => {
        uploadError = null;
        router.renderCurrentScreen();
      });

      // File Input Change
      fileInput?.addEventListener('change', async (e) => {
        if (isProcessing) return;
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 15 * 1024 * 1024) {
            uploadError = "File exceeds 15 MB limit. Please scan a smaller document.";
            fileInput.value = '';
            router.renderCurrentScreen();
            return;
          }

          uploadError = null;
          isProcessing = true;
          router.renderCurrentScreen();

          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result ? reader.result.split(',')[1] || '' : '';
            const processed = await documentService.processDocument(
              { name: file.name, type: selectedDocType, size: file.size, mimeType: file.type, base64, ocrMode: selectedOcrMode },
              (stage) => {
                processingStage = stage;
                router.renderCurrentScreen();
              }
            );

            isProcessing = false;
            fileInput.value = '';
            if (processed && !processed.isFailed && processed.success !== false) {
              appState.documents.push(processed);
              notifyStateChange('documents');
            } else {
              uploadError = processed?.message || "Could not read this document clearly. Please try another image.";
            }
            router.renderCurrentScreen();
          };
          reader.readAsDataURL(file);
        }
      });

      // Demo Sample Add
      document.getElementById('btn-add-demo-doc')?.addEventListener('click', async () => {
        uploadError = null;
        isProcessing = true;
        router.renderCurrentScreen();

        const preset = MOCK_PRESET_DOCUMENTS[appState.documents.length % MOCK_PRESET_DOCUMENTS.length];
        const processed = await documentService.processDocument(preset, (stage) => {
          processingStage = stage;
          router.renderCurrentScreen();
        });

        isProcessing = false;
        if (processed && !processed.isFailed && processed.success !== false) {
          appState.documents.push(processed);
          notifyStateChange('documents');
        } else {
          uploadError = processed?.message || "Could not read this document clearly.";
        }
        router.renderCurrentScreen();
      });

      // Remove Doc Buttons
      document.querySelectorAll('.btn-remove-doc').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-doc-index'), 10);
          appState.documents.splice(idx, 1);
          notifyStateChange('documents');
          router.renderCurrentScreen();
        });
      });

      // Navigation Actions
      document.getElementById('btn-docs-continue')?.addEventListener('click', () => {
        router.navigate('patientReview');
      });

      document.getElementById('btn-docreview-back')?.addEventListener('click', () => {
        router.navigate('documents');
      });
    },
  };
}
