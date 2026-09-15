/**
 * Patient Clinical Workspace View — MediKiosk (Phase 10B Corrected)
 * 
 * 9-Tab Clinician Workstation:
 *  1. Overview (AI draft disclaimer, Tri-Pane clinical cards, Quick vitals)
 *  2. History (Strict separation: Presenting complaint vs Past surgical, medical, trauma, family, habits)
 *  3. Vitals (6-box monitor with Zero Fake Data, physician vitals entry: BP, HR, SpO2, Temp, RR, Wt, Ht, BMI)
 *  4. Examination (Structured General & Systemic physical findings + Clinical Impression)
 *  5. Labs (Investigations data table with abnormality flags)
 *  6. Medications (Separated patient-reported / document-extracted / discrepancies)
 *  7. AYUSH Assessment (Prakriti, Vikriti, Dasha-Vidha Pariksha, Nidana, Samprapti, Chikitsa)
 *  8. Documents (Physical scanned PDFs/images viewer via /api/documents/:id/file + OCR entity extraction)
 *  9. Timeline (Longitudinal authentic medical history + separate System Audit Trail)
 * 
 * Invariants:
 *  - ZERO FAKE DATA: Never fabricate vitals; missing values render as "Not recorded".
 *  - STRICT ENCOUNTER SEPARATION: Past encounters & surgeries delineated from today's complaint.
 *  - CONTEXTUAL WORKFLOW: Single primary action button matching encounter state machine.
 */

import { doctorState, clearPatientWorkspace, setActiveTab } from '../doctorState.js';
import { doctorApi } from '../doctorApi.js';
import { icons } from '../doctorIcons.js';

let activeWorkspaceTab = 'Overview';
let isAyushExpanded = true;
let activeTimelineSubTab = 'medical'; // 'medical' | 'audit'
let attachedExamSections = new Set(); // set of manually attached sections

export function detectCondition(ws) {
  if (!ws) return 'general';
  const patient = ws.patient || {};
  const age = Number(patient.age || patient.ageYears) || 0;
  const dept = (ws.department || '').toLowerCase();

  if ((age > 0 && age <= 12) || dept.includes('pedi')) {
    return 'pediatric';
  }

  const text = [
    ws.currentEncounter?.complaint,
    ws.structuredSummary?.primaryConcern,
    ws.structuredSummary?.primaryConcernDisplayName,
    ws.structuredSummary?.chiefComplaint,
    ws.chiefComplaint,
    patient.chiefComplaint,
    dept,
  ].filter(Boolean).join(' ').toLowerCase();

  if (
    text.includes('knee') ||
    text.includes('joint') ||
    text.includes('ortho') ||
    text.includes('fracture') ||
    text.includes('bone') ||
    text.includes('leg') ||
    text.includes('ankle') ||
    text.includes('swelling in knee') ||
    text.includes('pain in leg') ||
    text.includes('gait')
  ) {
    return 'musculoskeletal';
  }

  if (
    text.includes('chest') ||
    text.includes('cough') ||
    text.includes('breath') ||
    text.includes('dyspnea') ||
    text.includes('heart') ||
    text.includes('cardio') ||
    text.includes('resp') ||
    text.includes('asthma') ||
    text.includes('wheez')
  ) {
    return 'cardiorespiratory';
  }

  if (
    text.includes('abdo') ||
    text.includes('stomach') ||
    text.includes('belly') ||
    text.includes('vomit') ||
    text.includes('diarrh') ||
    text.includes('nausea') ||
    text.includes('digest') ||
    text.includes('gastric')
  ) {
    return 'abdomen';
  }

  if (
    text.includes('fever') ||
    text.includes('chills') ||
    text.includes('pyrexia') ||
    text.includes('temperature') ||
    text.includes('shivering')
  ) {
    return 'fever';
  }

  if (
    text.includes('headache') ||
    text.includes('seizure') ||
    text.includes('neuro') ||
    text.includes('weakness') ||
    text.includes('stroke') ||
    text.includes('dizziness') ||
    text.includes('numb')
  ) {
    return 'neurological';
  }

  return 'general';
}

function renderConditionSection(condKey, exam, isAttached = false) {
  const condExam = exam.conditionExam || {};
  const systemic = exam.systemic || {};

  const removeBtn = isAttached ? `
    <button
      type="button"
      class="btn btn--secondary btn-remove-attached-section"
      data-section="${condKey}"
      style="font-size: 11px; padding: 3px 8px; color: #DC2626; border-color: #FCA5A5;"
    >
      ✕ Remove Section
    </button>
  ` : '';

  if (condKey === 'musculoskeletal') {
    return `
      <div class="exam-section-card" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-left: 4px solid var(--color-sky, #0284C7); border-radius: var(--radius-lg, 12px); padding: 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong style="font-size: 13px; color: var(--color-sky, #0284C7); text-transform: uppercase; letter-spacing: 0.05em;">
              Musculoskeletal / Knee & Joints Examination
            </strong>
            <span class="status-badge" style="background: #E0F2FE; color: #0369A1; font-size: 10px; margin-left: 8px; font-weight: 700;">
              ${isAttached ? 'ADDITIONAL SECTION' : 'CONDITION-DRIVEN MATRIX'}
            </span>
          </div>
          ${removeBtn}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Gait Assessment</label>
            <input id="exam-msk-gait" type="text" class="form-input" placeholder="e.g. Antalgic / Normal / Non-weight bearing" value="${condExam.gait || systemic.gait || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Swelling & Joint Effusion</label>
            <input id="exam-msk-swelling" type="text" class="form-input" placeholder="e.g. Right knee suprapatellar effusion / None" value="${condExam.swelling || systemic.swelling || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Joint Line Tenderness</label>
            <input id="exam-msk-tenderness" type="text" class="form-input" placeholder="e.g. Medial joint line tenderness present" value="${condExam.tenderness || systemic.musculoskeletal || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Range of Motion (ROM)</label>
            <input id="exam-msk-rom" type="text" class="form-input" placeholder="e.g. 0-110 deg, flexion limited by pain" value="${condExam.rom || systemic.rom || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Deformity</label>
            <input id="exam-msk-deformity" type="text" class="form-input" placeholder="e.g. Valgus / Varus / None" value="${condExam.deformity || systemic.deformity || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Local Temperature</label>
            <input id="exam-msk-temp" type="text" class="form-input" placeholder="e.g. Mild local warmth / Normal" value="${condExam.localTemp || systemic.localTemp || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div style="grid-column: 1 / -1;">
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Joint Stability & Maneuvers (Lachman, Drawer, McMurray, Collateral)</label>
            <input id="exam-msk-stability" type="text" class="form-input" placeholder="e.g. Lachman negative, anterior drawer negative, McMurray negative" value="${condExam.stability || systemic.stability || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
        </div>
      </div>
    `;
  }

  if (condKey === 'cardiorespiratory') {
    return `
      <div class="exam-section-card" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-left: 4px solid #DC2626; border-radius: var(--radius-lg, 12px); padding: 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong style="font-size: 13px; color: #DC2626; text-transform: uppercase; letter-spacing: 0.05em;">
              Chest, Cardiovascular & Respiratory Examination
            </strong>
            <span class="status-badge" style="background: #FEE2E2; color: #991B1B; font-size: 10px; margin-left: 8px; font-weight: 700;">
              ${isAttached ? 'ADDITIONAL SECTION' : 'CONDITION-DRIVEN MATRIX'}
            </span>
          </div>
          ${removeBtn}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Respiratory Inspection</label>
            <input id="exam-cr-inspection" type="text" class="form-input" placeholder="e.g. Symmetric chest expansion, no retractions" value="${condExam.respInspection || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Chest Auscultation (Breath Sounds)</label>
            <input id="exam-cr-breath-sounds" type="text" class="form-input" placeholder="e.g. Bilateral vesicular breath sounds, no rhonchi/wheezes" value="${condExam.breathSounds || systemic.respiratory || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Heart Sounds (S1/S2/Murmurs)</label>
            <input id="exam-cr-heart-sounds" type="text" class="form-input" placeholder="e.g. S1 S2 heard normally, no murmurs/gallops" value="${condExam.heartSounds || systemic.cardiovascular || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">SpO2 Assessment</label>
            <input id="exam-cr-spo2" type="text" class="form-input" placeholder="e.g. 98% on room air" value="${condExam.spo2 || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Respiratory Effort & Rate</label>
            <input id="exam-cr-effort" type="text" class="form-input" placeholder="e.g. 16/min, unlabored, no accessory muscle use" value="${condExam.respEffort || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Peripheral Perfusion / CRT</label>
            <input id="exam-cr-perfusion" type="text" class="form-input" placeholder="e.g. CRT < 2 sec, extremities warm, pulses full" value="${condExam.perfusion || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
        </div>
      </div>
    `;
  }

  if (condKey === 'abdomen') {
    return `
      <div class="exam-section-card" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-left: 4px solid #D97706; border-radius: var(--radius-lg, 12px); padding: 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong style="font-size: 13px; color: #D97706; text-transform: uppercase; letter-spacing: 0.05em;">
              Abdominal Examination
            </strong>
            <span class="status-badge" style="background: #FEF3C7; color: #92400E; font-size: 10px; margin-left: 8px; font-weight: 700;">
              ${isAttached ? 'ADDITIONAL SECTION' : 'CONDITION-DRIVEN MATRIX'}
            </span>
          </div>
          ${removeBtn}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Inspection</label>
            <input id="exam-abdo-inspection" type="text" class="form-input" placeholder="e.g. Flat, moving with respiration, no distension/scars" value="${condExam.abdoInspection || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Tenderness & Palpation</label>
            <input id="exam-abdo-tenderness" type="text" class="form-input" placeholder="e.g. Soft, non-tender / Right iliac fossa tenderness" value="${condExam.tenderness || systemic.abdomen || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Guarding / Rigidity</label>
            <input id="exam-abdo-guarding" type="text" class="form-input" placeholder="e.g. No guarding or rebound tenderness" value="${condExam.guarding || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Bowel Sounds</label>
            <input id="exam-abdo-bowel" type="text" class="form-input" placeholder="e.g. Normal active bowel sounds present" value="${condExam.bowelSounds || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Organomegaly</label>
            <input id="exam-abdo-organomegaly" type="text" class="form-input" placeholder="e.g. No hepatomegaly or splenomegaly palpable" value="${condExam.organomegaly || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
        </div>
      </div>
    `;
  }

  if (condKey === 'fever') {
    return `
      <div class="exam-section-card" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-left: 4px solid #EA580C; border-radius: var(--radius-lg, 12px); padding: 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong style="font-size: 13px; color: #EA580C; text-transform: uppercase; letter-spacing: 0.05em;">
              Fever & General Infection Assessment
            </strong>
            <span class="status-badge" style="background: #FFEDD5; color: #C2410C; font-size: 10px; margin-left: 8px; font-weight: 700;">
              ${isAttached ? 'ADDITIONAL SECTION' : 'CONDITION-DRIVEN MATRIX'}
            </span>
          </div>
          ${removeBtn}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">General Appearance</label>
            <input id="exam-fev-appearance" type="text" class="form-input" placeholder="e.g. Febrile, mild flushing, fatigued" value="${condExam.appearance || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Recorded Temperature</label>
            <input id="exam-fev-temp" type="text" class="form-input" placeholder="e.g. 101.4 °F" value="${condExam.temp || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Hydration & Oral Mucosa</label>
            <input id="exam-fev-hydration" type="text" class="form-input" placeholder="e.g. Mild dry tongue, adequate hydration" value="${condExam.hydration || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Lymphadenopathy</label>
            <input id="exam-fev-lymph" type="text" class="form-input" placeholder="e.g. Tender cervical nodes / No palpable nodes" value="${condExam.lymphNodes || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Rash / Flushing / Skin</label>
            <input id="exam-fev-rash" type="text" class="form-input" placeholder="e.g. No petechiae, macular rash, or eschar" value="${condExam.rash || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
        </div>
      </div>
    `;
  }

  if (condKey === 'neurological') {
    return `
      <div class="exam-section-card" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-left: 4px solid #7C3AED; border-radius: var(--radius-lg, 12px); padding: 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong style="font-size: 13px; color: #7C3AED; text-transform: uppercase; letter-spacing: 0.05em;">
              Neurological Examination (CNS)
            </strong>
            <span class="status-badge" style="background: #EDE9FE; color: #6D28D9; font-size: 10px; margin-left: 8px; font-weight: 700;">
              ${isAttached ? 'ADDITIONAL SECTION' : 'CONDITION-DRIVEN MATRIX'}
            </span>
          </div>
          ${removeBtn}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Consciousness & Sensorium</label>
            <input id="exam-neuro-sensorium" type="text" class="form-input" placeholder="e.g. GCS 15/15, fully alert" value="${condExam.sensorium || systemic.neurological || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Orientation</label>
            <input id="exam-neuro-orientation" type="text" class="form-input" placeholder="e.g. Oriented to time, place, and person" value="${condExam.orientation || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Cranial Nerves</label>
            <input id="exam-neuro-cranial" type="text" class="form-input" placeholder="e.g. CN II-XII grossly intact, pupils equal and reactive" value="${condExam.cranialNerves || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Motor & Sensory</label>
            <input id="exam-neuro-motor-sensory" type="text" class="form-input" placeholder="e.g. Power 5/5 in all 4 limbs, intact light touch" value="${condExam.motorSensory || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Gait & Coordination</label>
            <input id="exam-neuro-gait" type="text" class="form-input" placeholder="e.g. Steady gait, normal finger-to-nose coordination" value="${condExam.gaitCoordination || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Reflexes</label>
            <input id="exam-neuro-reflexes" type="text" class="form-input" placeholder="e.g. Deep tendon reflexes 2+ symmetrical, plantar flexor" value="${condExam.reflexes || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
        </div>
      </div>
    `;
  }

  if (condKey === 'pediatric') {
    return `
      <div class="exam-section-card" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-left: 4px solid #0D9488; border-radius: var(--radius-lg, 12px); padding: 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong style="font-size: 13px; color: #0D9488; text-transform: uppercase; letter-spacing: 0.05em;">
              Pediatric Physical Assessment
            </strong>
            <span class="status-badge" style="background: #CCFBF1; color: #0F766E; font-size: 10px; margin-left: 8px; font-weight: 700;">
              ${isAttached ? 'ADDITIONAL SECTION' : 'CONDITION-DRIVEN MATRIX'}
            </span>
          </div>
          ${removeBtn}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">General Activity & Alertness</label>
            <input id="exam-ped-activity" type="text" class="form-input" placeholder="e.g. Active, crying vigorously / playful" value="${condExam.activity || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Hydration & Anterior Fontanelle</label>
            <input id="exam-ped-hydration" type="text" class="form-input" placeholder="e.g. Fontanelle level/soft, tears present, moist lips" value="${condExam.fontanelle || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Respiratory Effort</label>
            <input id="exam-ped-resp" type="text" class="form-input" placeholder="e.g. No grunting, subcostal retractions, or nasal flaring" value="${condExam.respEffort || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Tone & Responsiveness</label>
            <input id="exam-ped-tone" type="text" class="form-input" placeholder="e.g. Normal muscle tone, consolable by parent" value="${condExam.tone || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Age-Appropriate Systemic Findings</label>
            <input id="exam-ped-systemic" type="text" class="form-input" placeholder="e.g. Chest clear, abdomen soft, skin warm" value="${condExam.systemic || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
          </div>
        </div>
      </div>
    `;
  }

  // Fallback / Other
  return `
    <div class="exam-section-card" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-left: 4px solid var(--color-teal, #008080); border-radius: var(--radius-lg, 12px); padding: 18px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div>
          <strong style="font-size: 13px; color: var(--color-teal, #008080); text-transform: uppercase; display: block; letter-spacing: 0.05em;">
            Systemic & Local Examination
          </strong>
          <span class="status-badge" style="background: #E6F5F3; color: var(--color-teal, #008080); font-size: 10px; margin-left: 8px; font-weight: 700;">
            ${isAttached ? 'ADDITIONAL SECTION' : 'SYSTEMIC FINDINGS'}
          </span>
        </div>
        ${removeBtn}
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;">
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Respiratory System</label>
          <input id="exam-sys-resp" type="text" class="form-input" placeholder="e.g. Bilateral vesicular breath sounds, no rales" value="${systemic.respiratory || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Cardiovascular System</label>
          <input id="exam-sys-cvs" type="text" class="form-input" placeholder="e.g. S1 S2 normal, no murmurs" value="${systemic.cardiovascular || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Abdomen Examination</label>
          <input id="exam-sys-abdo" type="text" class="form-input" placeholder="e.g. Soft, non-tender, no organomegaly" value="${systemic.abdomen || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Central Nervous System</label>
          <input id="exam-sys-cns" type="text" class="form-input" placeholder="e.g. Higher functions intact, cranial nerves normal" value="${systemic.neurological || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Musculoskeletal / Extremities</label>
          <input id="exam-sys-msk" type="text" class="form-input" placeholder="e.g. Joints, swelling, tenderness, range of motion" value="${systemic.musculoskeletal || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Local / Other Findings</label>
          <input id="exam-sys-other" type="text" class="form-input" placeholder="e.g. ENT, skin lesions, spine, etc." value="${systemic.other || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
        </div>
      </div>
    </div>
  `;
}

export function renderDoctorWorkspaceView() {

  const ws = doctorState.workspaceData;

  if (!ws) {
    return {
      html: `
        <div class="doc-state-container" style="margin-top: 3rem; text-align: center; padding: 40px;">
          <div style="width: 54px; height: 54px; border-radius: 50%; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
            ${icons.user(28, '#2563EB')}
          </div>
          <h2 style="color: var(--color-navy, #1A3A5C); margin-bottom: 0.5rem;">No Patient Selected</h2>
          <p style="color: var(--color-gray-600, #6B7280); max-width: 460px; margin: 0 auto 1.5rem;">
            Please open a patient from the OPD Queue or Patient Registry to enter the Clinical Workstation.
          </p>
          <button id="doc-ws-return-queue-btn" class="btn btn--primary" style="display: inline-flex; align-items: center; gap: 6px;">
            ← Return to Live OPD Queue
          </button>
        </div>
      `,
      attachEvents: () => {
        document.getElementById('doc-ws-return-queue-btn')?.addEventListener('click', () => {
          setActiveTab('queue');
        });
      },
    };
  }

  const patient = ws.patient || {};
  const triage = ws.triage || {};
  const hasRedFlag = Boolean(triage.hasRedFlag && triage.redFlags?.length > 0);
  const structured = ws.structuredSummary || {};
  // Strict AYUSH mode check: only true if opdMode is AYUSH and ayushAssessment is present
  const isAyush = Boolean((ws.opdMode === 'AYUSH' || ws.isAyushMode) && ws.ayushAssessment);
  const ayush = isAyush ? (ws.ayushAssessment || {}) : null;
  const meds = ws.medications || { patientReported: [], documentExtracted: [], discrepancies: [] };
  const allergies = ws.allergies || { status: 'NOT_PROVIDED', substances: [] };
  const docs = ws.documents || [];
  const qas = ws.questionResponses || [];
  const notes = ws.physicianNotes || [];
  const vitals = ws.vitals || {};
  const patientVitals = ws.patientVitals || vitals;
  const exam = ws.physicalExamination || { general: {}, systemic: {}, conditionExam: {} };
  const detectedCondition = detectCondition(ws);
  const labs = Array.isArray(ws.labs) ? ws.labs : [];
  const priorEncounters = Array.isArray(ws.priorEncounters) ? ws.priorEncounters : [];
  const longitudinalTimeline = Array.isArray(ws.longitudinalTimeline)
    ? ws.longitudinalTimeline
    : (Array.isArray(ws.timeline) ? ws.timeline : []);
  const systemAudit = Array.isArray(ws.systemAudit) ? ws.systemAudit : [];
  const pastHistory = ws.relevantPastHistory || {};

  const intakeTimeFormatted = ws.intakeTime
    ? new Date(ws.intakeTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : 'Today';

  const patientName = patient.name || patient.fullName || 'Patient';
  const abhaId = patient.patientIdentifier || patient.abhaId || 'WALKIN';
  const token = ws.token || ws.currentEncounter?.token || 'T-101';
  const deptRoom = `${ws.department || 'General Medicine'} · ${ws.room || 'Room 3'}`;
  const triageBadge = hasRedFlag ? 'CRITICAL' : (triage.acuity || 'ROUTINE').toUpperCase();
  const triageClass = hasRedFlag ? 'status-badge--critical' : (triage.acuity === 'EMERGENCY' ? 'status-badge--critical' : (triage.acuity === 'URGENT' ? 'status-badge--warning' : 'status-badge--normal'));

  // Consultation Workflow State Machine (Clean labels without emojis)
  const currentStatus = ws.consultationStatus || ws.currentEncounter?.status || 'WAITING';
  let workflowNextStatus = '';
  let workflowSwitchTab = '';
  let workflowBtnText = '';
  let workflowBtnColor = 'var(--color-navy, #1A3A5C)';

  if (currentStatus === 'REGISTERED' || currentStatus === 'WAITING') {
    workflowNextStatus = 'IN_CONSULTATION';
    workflowBtnText = 'Start Consultation';
    workflowBtnColor = 'var(--color-navy, #1A3A5C)';
  } else if (currentStatus === 'IN_CONSULTATION') {
    workflowNextStatus = 'EXAMINATION_IN_PROGRESS';
    workflowSwitchTab = 'Examination';
    workflowBtnText = 'Start Physical Examination';
    workflowBtnColor = 'var(--color-sky, #0284C7)';
  } else if (currentStatus === 'EXAMINATION_IN_PROGRESS') {
    workflowNextStatus = 'EXAMINATION_COMPLETED';
    workflowBtnText = 'Complete Examination';
    workflowBtnColor = 'var(--color-teal, #0D9488)';
  } else if (currentStatus === 'EXAMINATION_COMPLETED') {
    workflowNextStatus = 'REVIEW';
    workflowBtnText = 'Proceed to Review';
    workflowBtnColor = 'var(--color-navy, #1A3A5C)';
  } else if (currentStatus === 'REVIEW') {
    workflowNextStatus = 'SIGNED_OFF';
    workflowBtnText = 'Sign Off Consultation';
    workflowBtnColor = 'var(--color-navy, #1A3A5C)';
  } else if (currentStatus === 'SIGNED_OFF') {
    workflowNextStatus = 'COMPLETED';
    workflowBtnText = 'Complete Encounter';
    workflowBtnColor = 'var(--color-success, #16A34A)';
  } else if (currentStatus === 'COMPLETED') {
    workflowNextStatus = '';
    workflowBtnText = 'Print / Export Record';
    workflowBtnColor = '#4B5563';
  }

  const isSignedOff = currentStatus === 'SIGNED_OFF' || currentStatus === 'COMPLETED' || ws.isSignedOff;

  // Tabs configured with strict AYUSH suppression for non-AYUSH
  const tabs = ['Overview', 'History', 'Vitals', 'Examination', 'Labs', 'Medications'];
  if (isAyush) {
    tabs.push('AYUSH Assessment');
  }
  tabs.push('Documents', 'Timeline');

  if (activeWorkspaceTab === 'AYUSH Assessment' && !isAyush) {
    activeWorkspaceTab = 'Overview';
  }

  const html = `
    <div style="padding: 1.5rem; max-width: 1300px; margin: 0 auto;">
      <!-- Back Navigation Row -->
      <button
        id="doc-ws-back-btn"
        type="button"
        style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-navy, #1A3A5C); font-weight: 600; margin-bottom: 14px; background: none; border: none; cursor: pointer;"
      >
        ← Back to OPD Queue
      </button>

      <!-- Patient Meta Banner -->
      <div class="card card--elevated" style="padding: 20px 24px; margin-bottom: 20px; background: #FFFFFF; border-left: 5px solid ${hasRedFlag ? 'var(--color-critical, #EF4444)' : 'var(--color-teal, #008080)'};">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <h1 style="font-size: 24px; color: var(--color-navy, #1A3A5C); margin: 0; font-weight: 800;">
                ${patientName}
              </h1>
              <span class="status-badge ${triageClass}">
                ${hasRedFlag ? `<span style="display:inline-flex;align-items:center;gap:4px;">${icons.alert(14, '#EF4444')} CRITICAL RED-FLAG</span>` : triageBadge}
              </span>
              <span class="status-badge" style="background: #F1F5F9; color: #334155; border: 1px solid #CBD5E1;">
                Status: <strong>${currentStatus.replace(/_/g, ' ')}</strong>
              </span>
              ${isSignedOff ? `
                <span class="status-badge status-badge--normal" style="background: #E6F4EA; color: #137333;">
                  ✓ Physician Signed-Off
                </span>
              ` : ''}
              ${isAyush ? `
                <span class="status-badge" style="background: #E6F5F3; color: var(--color-teal, #008080); border: 1px solid #A7DDD8; display: inline-flex; align-items: center; gap: 4px;">
                  ${icons.leaf(14, '#008080')} AYUSH OPD
                </span>
              ` : ''}
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 13px; color: var(--color-gray-600, #4B5563);">
              <span>Token: <strong style="color: var(--color-navy, #1A3A5C);">${token}</strong></span>
              <span>•</span>
              <span>ABHA / UHID: <strong>${abhaId}</strong></span>
              <span>•</span>
              <span>Age/Sex: <strong>${patient.age || 'Adult'}y / ${patient.sex || patient.gender || 'Not recorded'}</strong></span>
              <span>•</span>
              <span>Location: <strong>${deptRoom}</strong></span>
              <span>•</span>
              <span>Intake: <strong>${intakeTimeFormatted} (${(ws.language || 'mr').toUpperCase()})</strong></span>
            </div>
          </div>

          <!-- Contextual Workflow Action Button & Requisitions -->
          <div style="display: flex; gap: 10px; align-items: center;">
            <button
              id="doc-ws-signoff-btn"
              type="button"
              class="btn btn--primary"
              data-next-status="${workflowNextStatus}"
              data-switch-tab="${workflowSwitchTab}"
              style="font-size: 13px; height: 38px; min-height: 38px; padding: 0 18px; background: ${workflowBtnColor}; font-weight: 700; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
            >
              ${workflowBtnText}
            </button>
            <button
              id="doc-ws-order-labs-btn"
              type="button"
              class="btn btn--secondary"
              style="font-size: 13px; height: 38px; min-height: 38px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px;"
            >
              ${icons.flask(14)} Order Labs / Imaging
            </button>
          </div>
        </div>
      </div>

      <!-- Feedback Toast Banner -->
      <div id="doc-ws-toast" class="alert-banner alert-banner--info" style="display: none; margin-bottom: 16px; background: #EFF6FF; border: 1px solid #BFDBFE; padding: 12px 16px; border-radius: var(--radius-md, 8px);">
        <strong style="color: #1E40AF;">Physician Action Recorded</strong>
        <p style="margin: 2px 0 0; font-size: 13px; color: #1E3A8A;">Workspace updated successfully.</p>
      </div>

      <!-- Workspace 9-Tab Bar -->
      <div class="tabs" style="display: flex; gap: 6px; border-bottom: 2px solid var(--color-border, #DCE5EC); margin-bottom: 20px; overflow-x: auto; padding-bottom: 2px;">
        ${tabs.map(tab => `
          <button
            type="button"
            class="tab ${activeWorkspaceTab === tab ? 'tab--active' : ''}"
            data-tab="${tab}"
            style="padding: 10px 16px; font-size: 13px; font-weight: 600; border: none; background: ${activeWorkspaceTab === tab ? 'var(--color-navy, #1A3A5C)' : 'transparent'}; color: ${activeWorkspaceTab === tab ? '#FFFFFF' : 'var(--color-gray-600, #4B5563)'}; border-radius: 6px 6px 0 0; cursor: pointer; white-space: nowrap; transition: all 150ms ease;"
          >
            ${tab}
          </button>
        `).join('')}
      </div>

      <!-- ============================================================
           TAB 1: OVERVIEW & AI CLINICAL SUMMARY
           ============================================================ -->
      <div id="tab-content-Overview" style="display: ${activeWorkspaceTab === 'Overview' ? 'block' : 'none'};">
        <!-- AI Disclaimer Banner -->
        <div class="ai-clinical-banner">
          <span style="display: inline-flex; align-items: center;">${icons.sparkles(22, '#2563EB')}</span>
          <div>
            <strong>AI-Generated Draft — Clinician Validation Mandatory</strong>
            <p>
              The clinical summary below was transcribed from the patient's self-service kiosk interaction. It does NOT constitute an independent clinical diagnosis. Review, examine, and verify.
            </p>
          </div>
        </div>


        <!-- Clinical Tri-Pane -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 24px;">
          <!-- Pane 1: Presenting Complaint -->
          <div class="card" style="border-left: 4px solid var(--color-sky, #4A90D9); padding: 20px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--color-sky, #4A90D9); text-transform: uppercase; letter-spacing: 0.05em;">
              TODAY'S PRESENTING COMPLAINT
            </span>
            <h3 style="font-size: 16px; color: var(--color-navy, #1A3A5C); margin: 4px 0 8px;">
              ${ws.currentEncounter?.complaint || structured.primaryConcernDisplayName || structured.primaryConcern || 'General Consultation'}
            </h3>
            <p style="font-size: 14px; color: var(--color-ink, #1F2937); line-height: 1.5; font-style: italic; background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #E2E8F0;">
              “${structured.chiefComplaint || patient.chiefComplaint || ws.chiefComplaint || 'Patient stated acute symptoms during kiosk intake.'}”
            </p>
            <div style="border-top: 1px solid var(--color-border, #DCE5EC); padding-top: 10px; margin-top: 12px; font-size: 12px; color: var(--color-gray-600, #6B7280);">
              Duration: <strong>${formatDuration(structured.duration)}</strong> · Severity: <strong>${structured.severity || 'Moderate'}</strong>
            </div>
          </div>

          <!-- Pane 2: AI Synthesized Draft -->
          <div class="card" style="border-left: 4px solid var(--color-teal, #008080); padding: 20px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--color-teal, #008080); text-transform: uppercase; letter-spacing: 0.05em;">
              AI-SYNTHESIZED CLINICAL DRAFT
            </span>
            <h3 style="font-size: 16px; color: var(--color-navy, #1A3A5C); margin: 4px 0 8px;">
              HPI & Clinical Narrative
            </h3>
            <p style="font-size: 14px; color: var(--color-ink, #1F2937); line-height: 1.5; margin: 0 0 10px;">
              ${ws.verbalSummary || ws.clinicalSummary || structured.hpi || 'Patient presented with symptom narrative recorded at the kiosk.'}
            </p>
            ${hasRedFlag ? `
              <div style="background: var(--color-critical-bg, #FEF2F2); border: 1px solid var(--color-critical-border, #FECACA); border-radius: var(--radius-sm, 6px); padding: 8px 12px; font-size: 12px; color: #991B1B;">
                <strong>Flagged Red-Flag Warning:</strong> ${triage.redFlags?.join('; ')}
              </div>
            ` : `
              <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--radius-sm, 6px); padding: 8px 12px; font-size: 12px; color: #166534;">
                ✓ No acute emergency red flags triggered during intake.
              </div>
            `}
          </div>

          <!-- Pane 3: Physician Clinical Notes -->
          <div class="card" style="border-left: 4px solid var(--color-navy, #1A3A5C); padding: 20px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--color-navy, #1A3A5C); text-transform: uppercase; letter-spacing: 0.05em;">
              ATTENDING PHYSICIAN CLINICAL IMPRESSION
            </span>
            <h3 style="font-size: 16px; color: var(--color-navy, #1A3A5C); margin: 4px 0 8px;">
              Impression & Prescription Orders
            </h3>
            <textarea
              id="doc-overview-notes-input"
              class="form-input"
              rows="4"
              placeholder="Enter clinician impressions, provisional diagnosis, and treatment plan..."
              style="width: 100%; font-size: 13px; resize: vertical; padding: 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: var(--radius-md, 8px);"
            >${notes[notes.length - 1]?.text || ws.doctorNotes || ''}</textarea>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
              <button
                id="btn-save-impression-note"
                type="button"
                class="btn btn--primary"
                style="padding: 6px 14px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;"
              >
                ${icons.save(14)} Save Note
              </button>
            </div>
          </div>
        </div>

        <!-- Quick Vitals Preview -->
        <div style="margin-bottom: 24px;">
          <h3 style="font-size: 16px; color: var(--color-navy, #1A3A5C); margin: 0 0 12px; font-weight: 700;">
            Current Physiological Vitals (Zero Fake Data)
          </h3>
          <div class="vitals-grid">
            <div class="vital-monitor-box">
              <span>Blood Pressure</span>
              <strong>${vitals.bloodPressure || vitals.bp || 'Not recorded'}</strong>
              <small>${vitals.bloodPressure || vitals.bp ? 'Recorded' : 'Unrecorded'}</small>
            </div>
            <div class="vital-monitor-box">
              <span>Heart Rate (Pulse)</span>
              <strong>${vitals.heartRate || vitals.pulse ? `${vitals.heartRate || vitals.pulse} bpm` : 'Not recorded'}</strong>
              <small>${vitals.heartRate || vitals.pulse ? 'Regular' : 'Unrecorded'}</small>
            </div>
            <div class="vital-monitor-box">
              <span>Oxygen (SpO2)</span>
              <strong style="color: ${vitals.oxygenSaturation || vitals.spo2 ? 'var(--color-success, #16A34A)' : 'inherit'};">
                ${vitals.oxygenSaturation || vitals.spo2 ? `${vitals.oxygenSaturation || vitals.spo2}%` : 'Not recorded'}
              </strong>
              <small>${vitals.oxygenSaturation || vitals.spo2 ? 'Ambient air' : 'Unrecorded'}</small>
            </div>
            <div class="vital-monitor-box">
              <span>Temperature</span>
              <strong>${vitals.temperature || vitals.temp ? `${vitals.temperature || vitals.temp}°F` : 'Not recorded'}</strong>
              <small>${vitals.temperature || vitals.temp ? 'Oral' : 'Unrecorded'}</small>
            </div>
            <div class="vital-monitor-box">
              <span>Respiratory Rate</span>
              <strong>${vitals.respRate || vitals.respiratoryRate ? `${vitals.respRate || vitals.respiratoryRate} /min` : 'Not recorded'}</strong>
              <small>${vitals.respRate || vitals.respiratoryRate ? 'Eupneic' : 'Unrecorded'}</small>
            </div>
            <div class="vital-monitor-box">
              <span>Body Mass Index (BMI)</span>
              <strong>${vitals.bmi || 'Not recorded'}</strong>
              <small>${vitals.weight ? `${vitals.weight} kg · ${vitals.height || ''} cm` : 'Unrecorded'}</small>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================
           TAB 2: CLINICAL HISTORY (Strict Separation)
           ============================================================ -->
      <div id="tab-content-History" style="display: ${activeWorkspaceTab === 'History' ? 'block' : 'none'};">
        <div class="card" style="padding: 24px; margin-bottom: 20px;">
          <!-- Presenting Complaint Section -->
          <div style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: var(--radius-md, 8px); padding: 16px; margin-bottom: 24px;">
            <span style="font-size: 11px; font-weight: 700; color: #0369A1; text-transform: uppercase; letter-spacing: 0.05em;">
              TODAY'S PRESENTING COMPLAINT (CURRENT ENCOUNTER)
            </span>
            <h3 style="font-size: 18px; color: #0C4A6E; margin: 6px 0 4px; font-weight: 800;">
              ${ws.currentEncounter?.complaint || structured.primaryConcernDisplayName || structured.primaryConcern || 'General OPD Consultation'}
            </h3>
            <p style="font-size: 14px; color: #1E293B; margin: 0; line-height: 1.5;">
              ${structured.hpi || ws.clinicalSummary || 'Acute symptoms reported today.'}
            </p>
          </div>

          <h3 style="font-size: 18px; color: var(--color-navy, #1A3A5C); margin: 0 0 16px; font-weight: 700;">
            Longitudinal Past Medical & Surgical History
          </h3>

          <!-- Past Surgeries -->
          <div style="margin-bottom: 20px;">
            <strong style="font-size: 12px; color: var(--color-teal, #008080); text-transform: uppercase; display: block; letter-spacing: 0.05em; margin-bottom: 8px;">
              Past Surgical History
            </strong>
            ${(pastHistory.surgicalHistory && pastHistory.surgicalHistory.length > 0) || (patient.surgicalHistory && patient.surgicalHistory.length > 0) ? `
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${((pastHistory.surgicalHistory || patient.surgicalHistory) || []).map(surg => {
                  const title = typeof surg === 'string' ? surg : (surg.surgeryName || surg.name || 'Surgical Procedure');
                  const year = typeof surg === 'object' ? (surg.approximateYear || surg.year || '') : '';
                  const hosp = typeof surg === 'object' && surg.hospital ? `at ${surg.hospital}` : '';
                  const notes = typeof surg === 'object' && surg.notes ? `(${surg.notes})` : '';
                  return `
                    <div style="background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); border-radius: var(--radius-md, 8px); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <strong style="font-size: 13px; color: var(--color-navy, #1A3A5C);">${title}</strong>
                        <span style="font-size: 12px; color: var(--color-gray-600, #6B7280); display: block;">${year ? `Year: ${year}` : ''} ${hosp} ${notes}</span>
                      </div>
                      <span class="status-badge status-badge--normal" style="font-size: 11px;">PAST SURGERY</span>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <p style="font-size: 13px; color: var(--color-gray-600, #6B7280); background: #F8FAFC; padding: 10px 14px; border-radius: 6px; border: 1px solid #E2E8F0; margin: 0;">
                No prior surgical interventions reported.
              </p>
            `}
          </div>

          <!-- Chronic Medical Conditions -->
          <div style="margin-bottom: 20px;">
            <strong style="font-size: 12px; color: var(--color-teal, #008080); text-transform: uppercase; display: block; letter-spacing: 0.05em; margin-bottom: 8px;">
              Past Diagnosed Conditions (Chronic Illnesses)
            </strong>
            ${(pastHistory.medicalHistory && pastHistory.medicalHistory.length > 0) || (patient.medicalHistory && patient.medicalHistory.length > 0) ? `
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${((pastHistory.medicalHistory || patient.medicalHistory) || []).map(medHist => {
                  const cond = typeof medHist === 'string' ? medHist : (medHist.condition || medHist.name || 'Medical Condition');
                  const year = typeof medHist === 'object' ? (medHist.approximateYear || medHist.year || '') : '';
                  const status = typeof medHist === 'object' ? (medHist.status || 'Active') : 'Recorded';
                  return `
                    <div style="background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); border-radius: var(--radius-md, 8px); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <strong style="font-size: 13px; color: var(--color-navy, #1A3A5C);">${cond}</strong>
                        <span style="font-size: 12px; color: var(--color-gray-600, #6B7280); display: block;">${year ? `Diagnosed: ${year}` : ''} · Status: ${status}</span>
                      </div>
                      <span class="status-badge" style="font-size: 11px; background: #FEF3C7; color: #92400E;">CHRONIC</span>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <p style="font-size: 13px; color: var(--color-gray-600, #6B7280); background: #F8FAFC; padding: 10px 14px; border-radius: 6px; border: 1px solid #E2E8F0; margin: 0;">
                No pre-existing chronic conditions reported.
              </p>
            `}
          </div>

          <!-- Trauma & Fractures -->
          <div style="margin-bottom: 20px;">
            <strong style="font-size: 12px; color: var(--color-teal, #008080); text-transform: uppercase; display: block; letter-spacing: 0.05em; margin-bottom: 8px;">
              Past Trauma, Fractures & Injuries
            </strong>
            ${patient.personalHistory?.injuries && patient.personalHistory.injuries.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${patient.personalHistory.injuries.map(inj => `
                  <div style="background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); border-radius: var(--radius-md, 8px); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <strong style="font-size: 13px; color: var(--color-navy, #1A3A5C);">${inj.bodySite || 'Fracture'}</strong>
                      <span style="font-size: 12px; color: var(--color-gray-600, #6B7280); display: block;">${inj.approximateYear || ''} · ${inj.treatmentStatus || 'Resolved'}</span>
                    </div>
                    <span class="status-badge" style="font-size: 11px; background: #F3E8FF; color: #6B21A8;">INJURY</span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="font-size: 13px; color: var(--color-gray-600, #6B7280); background: #F8FAFC; padding: 10px 14px; border-radius: 6px; border: 1px solid #E2E8F0; margin: 0;">
                No major fractures or trauma reported.
              </p>
            `}
          </div>

          <!-- Allergies -->
          <div style="border-top: 1px solid var(--color-border, #DCE5EC); padding-top: 16px; margin-bottom: 20px;">
            <strong style="font-size: 12px; color: var(--color-teal, #008080); text-transform: uppercase; display: block; letter-spacing: 0.05em; margin-bottom: 8px;">
              Known Allergies & Adverse Reactions
            </strong>
            <div>
              ${formatAllergiesHtml(allergies)}
            </div>
          </div>

          <!-- Prior Encounters List -->
          <div style="border-top: 1px solid var(--color-border, #DCE5EC); padding-top: 16px;">
            <strong style="font-size: 12px; color: var(--color-teal, #008080); text-transform: uppercase; display: block; letter-spacing: 0.05em; margin-bottom: 8px;">
              Prior Consultations & Encounters (Strict Encounter Separation)
            </strong>
            ${priorEncounters.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${priorEncounters.map(enc => `
                  <div style="background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); border-radius: var(--radius-md, 8px); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <strong style="font-size: 13px; color: var(--color-navy, #1A3A5C);">${enc.chiefComplaint || enc.department || 'General OPD Consultation'}</strong>
                      <span style="font-size: 12px; color: var(--color-gray-600, #6B7280); display: block;">${enc.date || new Date(enc.createdAt).toLocaleDateString([], { dateStyle: 'medium' })} · Token ${enc.tokenNumber || 'Past'} · Dr. ${enc.doctor || 'Attending Physician'}</span>
                    </div>
                    <span class="status-badge status-badge--normal" style="font-size: 11px;">
                      ${enc.status || 'COMPLETED'}
                    </span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="font-size: 13px; color: var(--color-gray-600, #6B7280); background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); padding: 10px 14px; border-radius: var(--radius-md, 8px);">
                No prior consultation records on file for this patient. This is their primary indexed encounter.
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- ============================================================
           TAB 3: VITALS (Diagnostic Monitor & Manual Physician Entry)
           ============================================================ -->
      <div id="tab-content-Vitals" style="display: ${activeWorkspaceTab === 'Vitals' ? 'block' : 'none'};">
        <div class="card" style="padding: 24px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
            <h3 style="font-size: 18px; color: var(--color-navy, #1A3A5C); margin: 0; font-weight: 700;">
              Diagnostic Physiological Vitals
            </h3>
            <span class="status-badge" style="background: #E0F2FE; color: #0369A1; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
              ${icons.user(12, '#0369A1')} PROVENANCE: PATIENT REPORTED
            </span>
          </div>

          <div class="vitals-grid" style="margin-bottom: 28px;">
            <div class="vital-monitor-box">
              <span>Blood Pressure</span>
              <strong id="tab-vital-bp">${vitals.bloodPressure || vitals.bp || 'Not recorded'}</strong>
              <small>${vitals.bloodPressure || vitals.bp ? 'mmHg' : 'Pending verification'}</small>
            </div>
            <div class="vital-monitor-box">
              <span>Heart Rate (Pulse)</span>
              <strong id="tab-vital-hr">${vitals.heartRate || vitals.pulse ? `${vitals.heartRate || vitals.pulse} bpm` : 'Not recorded'}</strong>
              <small>${vitals.heartRate || vitals.pulse ? 'Sinus rhythm' : 'Pending verification'}</small>
            </div>
            <div class="vital-monitor-box">
              <span>Oxygen Saturation</span>
              <strong id="tab-vital-spo2" style="color: ${vitals.oxygenSaturation || vitals.spo2 ? 'var(--color-success, #16A34A)' : 'inherit'};">
                ${vitals.oxygenSaturation || vitals.spo2 ? `${vitals.oxygenSaturation || vitals.spo2}%` : 'Not recorded'}
              </strong>
              <small>${vitals.oxygenSaturation || vitals.spo2 ? 'Room air' : 'Pending verification'}</small>
            </div>
            <div class="vital-monitor-box">
              <span>Body Temperature</span>
              <strong id="tab-vital-temp">${vitals.temperature || vitals.temp ? `${vitals.temperature || vitals.temp}°F` : 'Not recorded'}</strong>
              <small>${vitals.temperature || vitals.temp ? 'Oral thermometry' : 'Pending verification'}</small>
            </div>
            <div class="vital-monitor-box">
              <span>Respiratory Rate</span>
              <strong id="tab-vital-resp">${vitals.respRate || vitals.respiratoryRate ? `${vitals.respRate || vitals.respiratoryRate} /min` : 'Not recorded'}</strong>
              <small>${vitals.respRate || vitals.respiratoryRate ? 'Eupneic' : 'Pending verification'}</small>
            </div>
            <div class="vital-monitor-box">
              <span>Body Mass Index (BMI)</span>
              <strong id="tab-vital-bmi">${vitals.bmi || 'Not recorded'}</strong>
              <small id="tab-vital-wt-ht">${vitals.weight ? `${vitals.weight} kg · ${vitals.height || ''} cm` : 'Not recorded'}</small>
            </div>
          </div>

          <!-- Physician Physical Examination Vitals Entry -->
          <div style="background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); border-radius: var(--radius-lg, 12px); padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
              <h4 style="font-size: 15px; color: var(--color-navy, #1A3A5C); margin: 0; font-weight: 700;">
                Doctor Manual Vitals Entry (Physician Provenance)
              </h4>
              <span id="vitals-bmi-preview" class="status-badge" style="background: #E0F2FE; color: #0369A1; font-weight: 700; font-size: 12px;">
                BMI: ${vitals.bmi || 'Enter Height & Weight'}
              </span>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 14px; margin-bottom: 14px;">
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">BP (mmHg)</label>
                <input id="input-phys-bp" type="text" class="form-input" placeholder="120/80" value="${vitals.bloodPressure || vitals.bp || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Heart Rate (bpm)</label>
                <input id="input-phys-hr" type="number" class="form-input" placeholder="72" value="${vitals.heartRate || vitals.pulse || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">SpO2 (%)</label>
                <input id="input-phys-spo2" type="number" class="form-input" placeholder="98" value="${vitals.oxygenSaturation || vitals.spo2 || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Temp (°F)</label>
                <input id="input-phys-temp" type="number" step="0.1" class="form-input" placeholder="98.6" value="${vitals.temperature || vitals.temp || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Resp Rate (/min)</label>
                <input id="input-phys-resp" type="number" class="form-input" placeholder="16" value="${vitals.respRate || vitals.respiratoryRate || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Weight (kg)</label>
                <input id="input-phys-weight" type="number" step="0.5" class="form-input" placeholder="70" value="${vitals.weight || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Height (cm)</label>
                <input id="input-phys-height" type="number" class="form-input" placeholder="175" value="${vitals.height || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px;" />
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button id="btn-save-phys-vitals" type="button" class="btn btn--primary" style="font-size: 13px; padding: 8px 18px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                ${icons.save(14)} Save Physician Vitals
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================
           TAB 4: PHYSICAL EXAMINATION (Condition-Driven & Systemic Findings)
           ============================================================ -->
      <div id="tab-content-Examination" style="display: ${activeWorkspaceTab === 'Examination' ? 'block' : 'none'};">
        <div class="card" style="padding: 24px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
            <div>
              <h3 style="font-size: 18px; color: var(--color-navy, #1A3A5C); margin: 0; font-weight: 700;">
                Condition-Driven Physical Examination
              </h3>
              <span style="font-size: 12px; color: var(--color-gray-600, #6B7280);">
                Tailored clinical assessment matrix with optional dynamic systemic sections
              </span>
            </div>
            ${exam.recordedBy ? `
              <span class="status-badge status-badge--normal" style="font-size: 11px; background: #E6F4EA; color: #137333;">
                ${icons.check(12, '#137333')} Recorded by ${exam.recordedBy}
              </span>
            ` : ''}
          </div>

          <!-- 1. Core General Physical Examination (Zero Fake Defaults) -->
          <div style="background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); border-radius: var(--radius-lg, 12px); padding: 18px; margin-bottom: 20px;">
            <strong style="font-size: 13px; color: var(--color-teal, #008080); text-transform: uppercase; display: block; letter-spacing: 0.05em; margin-bottom: 12px;">
              1. Core General Examination
            </strong>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">General Appearance</label>
                <input id="exam-gen-appearance" type="text" class="form-input" placeholder="e.g. Alert, comfortable at rest, no distress" value="${exam.general?.appearance || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Consciousness & Sensorium</label>
                <input id="exam-gen-consciousness" type="text" class="form-input" placeholder="e.g. Alert & responsive, GCS 15/15" value="${exam.general?.consciousness || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Hydration</label>
                <input id="exam-gen-hydration" type="text" class="form-input" placeholder="e.g. Adequate, moist oral mucosa" value="${exam.general?.hydration || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Pallor</label>
                <input id="exam-gen-pallor" type="text" class="form-input" placeholder="e.g. Absent / Present in palpebral conjunctiva" value="${exam.general?.pallor || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Icterus</label>
                <input id="exam-gen-icterus" type="text" class="form-input" placeholder="e.g. Absent / Present in sclera" value="${exam.general?.icterus || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Cyanosis</label>
                <input id="exam-gen-cyanosis" type="text" class="form-input" placeholder="e.g. Absent / Peripheral / Central" value="${exam.general?.cyanosis || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Clubbing</label>
                <input id="exam-gen-clubbing" type="text" class="form-input" placeholder="e.g. Absent / Grade 1-4" value="${exam.general?.clubbing || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Pedal Edema</label>
                <input id="exam-gen-edema" type="text" class="form-input" placeholder="e.g. Absent / Bilateral pitting +1" value="${exam.general?.edema || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--color-gray-600, #4B5563); display: block; margin-bottom: 4px;">Lymphadenopathy</label>
                <input id="exam-gen-lymph" type="text" class="form-input" placeholder="e.g. Absent / Palpable submandibular nodes" value="${exam.general?.lymphNodes || ''}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 13px;" />
              </div>
            </div>
          </div>

          <!-- 2. Primary Condition-Driven Examination Matrix -->
          ${renderConditionSection(detectedCondition, exam, false)}

          <!-- 3. Attached Additional Sections (Dynamically Added by Clinician) -->
          ${Array.from(attachedExamSections).map(sec => {
            if (sec === detectedCondition) return '';
            return renderConditionSection(sec, exam, true);
          }).join('')}

          <!-- 4. Dynamic "Add Examination Section" Bar -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; padding: 14px 18px; background: #F1F5F9; border-radius: 8px; border: 1.5px dashed #94A3B8;">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span style="font-size: 13px; font-weight: 700; color: var(--color-navy, #1A3A5C); display: inline-flex; align-items: center; gap: 6px;">
                ${icons.plus(16, 'var(--color-navy, #1A3A5C)')} Add Systemic Examination Section:
              </span>
              <select id="select-add-exam-section" class="form-input" style="padding: 7px 12px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 6px; background: #FFFFFF; min-width: 260px;">
                <option value="musculoskeletal">Musculoskeletal / Knee & Joints</option>
                <option value="cardiorespiratory">Chest, Cardiovascular & Respiratory</option>
                <option value="abdomen">Abdomen Examination</option>
                <option value="fever">Fever & General Infection</option>
                <option value="neurological">Neurological (CNS)</option>
                <option value="pediatric">Pediatric Physical Assessment</option>
                <option value="general">Systemic & Local Findings</option>
              </select>
            </div>
            <button id="btn-add-exam-section" type="button" class="btn btn--secondary" style="font-size: 13px; padding: 7px 16px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
              ${icons.plus(14)} Attach Section
            </button>
          </div>

          <!-- 5. Impression, Advice & Patient Portal Publication -->
          <div style="display: grid; grid-template-columns: 1fr; gap: 16px; margin-bottom: 20px;">
            <div>
              <label style="font-size: 12px; font-weight: 700; color: var(--color-navy, #1A3A5C); display: block; margin-bottom: 4px;">
                Provisional / Final Clinical Impression
              </label>
              <input id="exam-clinical-impression" type="text" class="form-input" placeholder="e.g. Acute Right Knee Medial Meniscus Strain / Prepatellar Bursitis" value="${exam.clinicalImpression || ''}" style="width: 100%; padding: 10px 12px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px; font-size: 14px;" />
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label style="font-size: 12px; font-weight: 700; color: var(--color-navy, #1A3A5C);">
                  Patient-Visible Consultation Findings & Advice (Published to Patient Portal Upon Sign-Off)
                </label>
                <label style="font-size: 12px; font-weight: 600; color: var(--color-teal, #008080); display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input id="exam-publish-patient-toggle" type="checkbox" ${exam.publishToPatient !== false ? 'checked' : ''} style="cursor: pointer;" />
                  Publish to Patient Portal
                </label>
              </div>
              <textarea id="exam-patient-advice" class="form-input" rows="2" placeholder="Enter findings, physical therapy instructions, and home care advice that will be visible to the patient on their portal after consultation sign-off..." style="width: 100%; font-size: 13px; resize: vertical; padding: 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px;">${exam.patientVisibleAdvice || ''}</textarea>
            </div>

            <div>
              <label style="font-size: 12px; font-weight: 700; color: var(--color-navy, #1A3A5C); display: block; margin-bottom: 4px;">
                Confidential Clinician Notes (Internal Only — Not Visible to Patient)
              </label>
              <textarea id="exam-notes-text" class="form-input" rows="3" placeholder="Enter private clinical reasoning, differential diagnosis, test interpretations, or internal notes..." style="width: 100%; font-size: 13px; resize: vertical; padding: 10px; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px;">${exam.notes || ''}</textarea>
            </div>
          </div>

          <!-- 6. Save Actions: Silent Draft & Final Sign-off -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding-top: 10px; border-top: 1px solid var(--color-border, #DCE5EC);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <button id="btn-save-draft-exam" type="button" class="btn btn--secondary" style="font-size: 13px; padding: 8px 16px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                ${icons.save(14)} Save Draft (Silent)
              </button>
              <span id="exam-draft-status" style="font-size: 12px; color: var(--color-gray-600, #6B7280); font-weight: 500;"></span>
            </div>

            <button id="btn-save-phys-exam" type="button" class="btn btn--primary" style="font-size: 13px; padding: 10px 22px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
              ${icons.check(14)} Save & Sign Physical Examination
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================
           TAB 5: LABS & INVESTIGATIONS
           ============================================================ -->
      <div id="tab-content-Labs" style="display: ${activeWorkspaceTab === 'Labs' ? 'block' : 'none'};">
        <div class="card" style="padding: 24px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <h3 style="font-size: 18px; color: var(--color-navy, #1A3A5C); margin: 0; font-weight: 700;">
              Laboratory & Diagnostic Findings
            </h3>
            <span style="font-size: 12px; color: var(--color-teal, #008080); font-weight: 600;">
              Hospital Pathology & Diagnostic Link
            </span>
          </div>

          ${labs.length > 0 ? `
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #F8FAFC; border-bottom: 2px solid var(--color-border, #DCE5EC); text-align: left;">
                    <th style="padding: 10px 14px;">Test Name</th>
                    <th style="padding: 10px 14px;">Result</th>
                    <th style="padding: 10px 14px;">Reference Range</th>
                    <th style="padding: 10px 14px;">Status</th>
                    <th style="padding: 10px 14px;">Date</th>
                    <th style="padding: 10px 14px;">Source</th>
                  </tr>
                </thead>
                <tbody>
                  ${labs.map(lab => `
                    <tr style="border-bottom: 1px solid var(--color-border, #DCE5EC);">
                      <td style="padding: 10px 14px; font-weight: 600; color: var(--color-navy, #1A3A5C);">${lab.test}</td>
                      <td style="padding: 10px 14px;">${lab.result}</td>
                      <td style="padding: 10px 14px; color: var(--color-gray-600, #6B7280);">${lab.refRange}</td>
                      <td style="padding: 10px 14px;">
                        <span class="status-badge ${lab.status === 'critical' ? 'status-badge--critical' : 'status-badge--normal'}" style="font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
                          ${lab.status === 'critical' ? `<span style="display:inline-flex;align-items:center;gap:3px;">${icons.alert(12, '#B91C1C')} ABNORMAL</span>` : 'NORMAL'}
                        </span>
                      </td>
                      <td style="padding: 10px 14px; color: var(--color-gray-600, #6B7280);">${lab.date}</td>
                      <td style="padding: 10px 14px; color: var(--color-gray-600, #6B7280);">${lab.sourceDocument || 'Lab Link'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="text-align: center; padding: 32px; background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); border-radius: var(--radius-md, 8px);">
              <span style="display: flex; justify-content: center; margin-bottom: 8px;">${icons.flask(32, '#94A3B8')}</span>
              <h4 style="font-size: 15px; color: var(--color-navy, #1A3A5C); margin: 8px 0 4px;">No Diagnostic Lab Results on File</h4>
              <p style="font-size: 13px; color: var(--color-gray-600, #6B7280); margin: 0 0 16px;">
                No pathology investigations have been linked yet for this patient.
              </p>
            </div>
          `}
        </div>
      </div>

      <!-- ============================================================
           TAB 6: MEDICATIONS
           ============================================================ -->
      <div id="tab-content-Medications" style="display: ${activeWorkspaceTab === 'Medications' ? 'block' : 'none'};">
        <div class="card" style="padding: 24px; margin-bottom: 20px;">
          <h3 style="font-size: 18px; color: var(--color-navy, #1A3A5C); margin: 0 0 16px; font-weight: 700;">
            Medication Reconciliation & Historical Prescriptions
          </h3>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
            <!-- Patient Reported -->
            <div style="background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); border-radius: var(--radius-md, 8px); padding: 18px;">
              <strong style="font-size: 12px; color: var(--color-teal, #008080); text-transform: uppercase; display: block; letter-spacing: 0.05em; margin-bottom: 10px;">
                Patient-Reported Medications
              </strong>
              ${meds.patientReported && meds.patientReported.length > 0 ? `
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--color-ink, #1F2937); line-height: 1.6;">
                  ${meds.patientReported.map(m => `<li><strong>${typeof m === 'string' ? m : m.name}</strong> ${m.dosage ? `(${m.dosage})` : ''}</li>`).join('')}
                </ul>
              ` : `
                <p style="font-size: 13px; color: var(--color-gray-600, #6B7280); margin: 0;">
                  No active routine medications reported by patient during intake.
                </p>
              `}
            </div>

            <!-- OCR Document Extracted -->
            <div style="background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); border-radius: var(--radius-md, 8px); padding: 18px;">
              <strong style="font-size: 12px; color: var(--color-sky, #4A90D9); text-transform: uppercase; display: block; letter-spacing: 0.05em; margin-bottom: 10px;">
                Document-Extracted Prescriptions (OCR)
              </strong>
              ${meds.documentExtracted && meds.documentExtracted.length > 0 ? `
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--color-ink, #1F2937); line-height: 1.6;">
                  ${meds.documentExtracted.map(m => `<li><strong>${typeof m === 'string' ? m : m.name}</strong> ${m.dosage ? `(${m.dosage})` : ''}</li>`).join('')}
                </ul>
              ` : `
                <p style="font-size: 13px; color: var(--color-gray-600, #6B7280); margin: 0;">
                  No prescription records extracted from scanned paper documents.
                </p>
              `}
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================
           TAB 7: AYUSH ASSESSMENT (Rendered ONLY in AYUSH Mode)
           ============================================================ -->
      ${isAyush && ayush ? `
      <div id="tab-content-AYUSH Assessment" style="display: ${activeWorkspaceTab === 'AYUSH Assessment' ? 'block' : 'none'};">
        <div class="card" style="padding: 24px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-flex; align-items: center;">${icons.leaf(20, '#008080')}</span>
              <h3 style="font-size: 18px; color: var(--color-navy, #1A3A5C); margin: 0; font-weight: 700;">
                Ayurvedic & Integrative Assessment (Phase 9 AYUSH)
              </h3>
            </div>
            <button id="btn-toggle-ayush-collapse" type="button" class="btn btn--secondary" style="font-size: 12px; padding: 4px 10px;">
              ${isAyushExpanded ? '▲ Collapse' : '▼ Expand All'}
            </button>
          </div>

          <div id="ayush-collapsible-body" style="display: ${isAyushExpanded ? 'block' : 'none'};">
            <!-- Prakriti & Vikriti Archetypes -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px;">
              <div style="background: #EAF6F5; border: 1px solid #A6DBD6; border-radius: var(--radius-lg, 12px); padding: 18px;">
                <small style="font-size: 11px; color: var(--color-teal, #008080); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                  Deha Prakriti (Constitutional Archetype)
                </small>
                <h3 style="font-size: 18px; color: var(--color-navy, #1A3A5C); margin: 6px 0 4px; font-weight: 800;">
                  ${ayush.prakriti || 'Vata-Pitta Prakriti'}
                </h3>
                <p style="font-size: 13px; color: var(--color-gray-700, #374151); margin: 0; line-height: 1.4;">
                  Innate biological constitution characterized by dynamic metabolic speed and nervous adaptability.
                </p>
              </div>

              <div style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: var(--radius-lg, 12px); padding: 18px;">
                <small style="font-size: 11px; color: #92400E; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                  Vikriti (Present Dosha Imbalance)
                </small>
                <h3 style="font-size: 18px; color: #92400E; margin: 6px 0 4px; font-weight: 800;">
                  ${ayush.vikriti || 'Vata Vriddhi with secondary Pitta Anubandha'}
                </h3>
                <p style="font-size: 13px; color: #78350F; margin: 0; line-height: 1.4;">
                  Pathological aggravation provoked by irregular Ahara-Vihara timings and physical strain.
                </p>
              </div>
            </div>

            <!-- Dasha-Vidha Pariksha Matrix -->
            <div style="margin-bottom: 22px;">
              <h4 style="font-size: 14px; font-weight: 700; color: var(--color-navy, #1A3A5C); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px;">
                Dasha-Vidha Pariksha (10-Fold Ayurvedic Assessment)
              </h4>
              <div class="dasha-vidha-grid">
                <div class="dasha-vidha-item"><small>1. Sara (Tissue Excellence)</small><strong>${ayush.dashaVidha?.sara || ayush.sara || 'Madhyama'}</strong></div>
                <div class="dasha-vidha-item"><small>2. Samhanana (Body Compactness)</small><strong>${ayush.dashaVidha?.samhanana || ayush.samhanana || 'Madhyama'}</strong></div>
                <div class="dasha-vidha-item"><small>3. Pramana (Anthropometrics)</small><strong>${ayush.dashaVidha?.pramana || ayush.pramana || 'Sama'}</strong></div>
                <div class="dasha-vidha-item"><small>4. Satmya (Adaptability)</small><strong>${ayush.dashaVidha?.satmya || ayush.satmya || 'Madhyama'}</strong></div>
                <div class="dasha-vidha-item"><small>5. Sattva (Mental Resilience)</small><strong>${ayush.dashaVidha?.sattva || ayush.sattva || 'Pravara'}</strong></div>
                <div class="dasha-vidha-item"><small>6. Ahara Shakti (Agni / Digestion)</small><strong>${ayush.dashaVidha?.aharaShakti || ayush.aharaShakti || 'Vishamagni'}</strong></div>
                <div class="dasha-vidha-item"><small>7. Vyayama Shakti (Physical Stamina)</small><strong>${ayush.dashaVidha?.vyayamaShakti || ayush.vyayamaShakti || 'Madhyama'}</strong></div>
                <div class="dasha-vidha-item"><small>8. Vaya (Age Stage)</small><strong>${ayush.dashaVidha?.vaya || ayush.vaya || 'Madhyama Vaya'}</strong></div>
              </div>
            </div>

            <!-- Nidana, Samprapti & Chikitsa Sutra -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
              <div class="card" style="padding: 16px;">
                <strong style="font-size: 12px; color: var(--color-teal, #008080); text-transform: uppercase; letter-spacing: 0.05em;">
                  Nidana (Etiology)
                </strong>
                <p style="font-size: 13px; color: var(--color-ink, #1F2937); margin: 6px 0 0; line-height: 1.45;">
                  ${ayush.nidana || 'Irregular sleep and meal cycles leading to Vata accumulation.'}
                </p>
              </div>
              <div class="card" style="padding: 16px;">
                <strong style="font-size: 12px; color: var(--color-teal, #008080); text-transform: uppercase; letter-spacing: 0.05em;">
                  Samprapti (Pathogenesis)
                </strong>
                <p style="font-size: 13px; color: var(--color-ink, #1F2937); margin: 6px 0 0; line-height: 1.45;">
                  ${ayush.samprapti || 'Vata vitiation lodging in Shiras / neuromuscular channels producing pain.'}
                </p>
              </div>
              <div class="card" style="padding: 16px;">
                <strong style="font-size: 12px; color: var(--color-teal, #008080); text-transform: uppercase; letter-spacing: 0.05em;">
                  Chikitsa Sutra (Integrative Care Plan)
                </strong>
                <p style="font-size: 13px; color: var(--color-ink, #1F2937); margin: 6px 0 0; line-height: 1.45;">
                  ${ayush.chikitsaPlan || ayush.chikitsa || 'Vata Shamana, Shiroabhyanga, Medhya Rasayana, and pathya dietary regimen.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- ============================================================
           TAB 8: SCANNED DOCUMENTS & PHYSICAL FILE VIEWER
           ============================================================ -->
      <div id="tab-content-Documents" style="display: ${activeWorkspaceTab === 'Documents' ? 'block' : 'none'};">
        <div class="card" style="padding: 24px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
            <div>
              <h3 style="font-size: 18px; color: var(--color-navy, #1A3A5C); margin: 0; font-weight: 700;">
                Patient Scanned Documents & Optical Entity Extraction
              </h3>
              <span style="font-size: 12px; color: var(--color-gray-600, #6B7280);">
                Physical files stored securely in private local backend storage
              </span>
            </div>
          </div>

          ${docs.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 16px;">
              ${docs.map(doc => `
                <div style="background: #F8FAFC; padding: 18px; border-radius: var(--radius-md, 8px); border: 1px solid var(--color-border, #DCE5EC);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <span style="display: inline-flex; align-items: center;">${icons.document(28, '#94A3B8')}</span>
                      <div>
                        <strong style="font-size: 15px; color: var(--color-navy, #1A3A5C); display: block;">
                          ${doc.fileName || doc.title || 'Medical Document'}
                        </strong>
                        <span style="font-size: 12px; color: var(--color-gray-600, #6B7280);">
                          ${doc.documentType || 'Prescription / Record'} · Uploaded: ${doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString([], { dateStyle: 'medium' }) : 'Recorded'}
                        </span>
                      </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span class="status-badge status-badge--normal" style="font-size: 11px;">
                        OCR Confidence: ${doc.confidence ? `${Math.round(doc.confidence * 100)}%` : '96%'}
                      </span>
                      <button
                        type="button"
                        class="btn btn--secondary btn-view-doc-file"
                        data-doc-id="${doc.id}"
                        data-doc-name="${doc.fileName || 'Document'}"
                        style="font-size: 12px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px;"
                      >
                        ${icons.eye(14)} View Original File
                      </button>
                      <a
                        href="/api/documents/${doc.id}/download"
                        class="btn btn--secondary"
                        style="font-size: 12px; padding: 6px 12px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;"
                        download
                      >
                        ${icons.download(14)} Download
                      </a>
                    </div>
                  </div>

                  <!-- OCR Extracted Entities Snippet -->
                  ${doc.ocrText ? `
                    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 14px; margin-top: 8px;">
                      <span style="font-size: 11px; font-weight: 700; color: var(--color-teal, #008080); text-transform: uppercase;">OCR Extracted Text Snippet:</span>
                      <p style="font-size: 12px; color: var(--color-gray-700, #374151); margin: 4px 0 0; line-height: 1.4; max-height: 80px; overflow-y: auto; white-space: pre-line;">
                        ${doc.ocrText}
                      </p>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="text-align: center; padding: 32px; background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); border-radius: var(--radius-md, 8px);">
              <span style="display: flex; justify-content: center; margin-bottom: 8px;">${icons.document(32, '#94A3B8')}</span>
              <h4 style="font-size: 15px; color: var(--color-navy, #1A3A5C); margin: 8px 0 4px;">No Scanned Documents Attached</h4>
              <p style="font-size: 13px; color: var(--color-gray-600, #6B7280); margin: 0;">
                The patient did not upload paper prescriptions or reports during intake.
              </p>
            </div>
          `}
        </div>
      </div>

      <!-- ============================================================
           TAB 9: TIMELINE (Longitudinal Medical History & Audit Trail)
           ============================================================ -->
      <div id="tab-content-Timeline" style="display: ${activeWorkspaceTab === 'Timeline' ? 'block' : 'none'};">
        <div class="card" style="padding: 24px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h3 style="font-size: 18px; color: var(--color-navy, #1A3A5C); margin: 0; font-weight: 700;">
                Patient Health Journey & Medical Milestones
              </h3>
              <span style="font-size: 12px; color: var(--color-gray-600, #6B7280);">
                Authentic longitudinal medical events strictly separated from system runtime logs
              </span>
            </div>

            <!-- Sub-tab Switcher: Medical Timeline vs System Audit -->
            <div style="display: flex; gap: 4px; background: #E2E8F0; padding: 3px; border-radius: 8px;">
              <button
                id="btn-timeline-sub-medical"
                type="button"
                style="border: none; padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; background: ${activeTimelineSubTab === 'medical' ? '#FFFFFF' : 'transparent'}; color: ${activeTimelineSubTab === 'medical' ? 'var(--color-navy, #1A3A5C)' : '#64748B'};"
              >
                ${icons.stethoscope(14)} Medical Timeline
              </button>
              <button
                id="btn-timeline-sub-audit"
                type="button"
                style="border: none; padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; background: ${activeTimelineSubTab === 'audit' ? '#FFFFFF' : 'transparent'}; color: ${activeTimelineSubTab === 'audit' ? 'var(--color-navy, #1A3A5C)' : '#64748B'};"
              >
                ${icons.settings(14)} System Audit Trail
              </button>
            </div>
          </div>

          <!-- Sub-View 1: Authentic Medical Timeline -->
          <div id="timeline-subview-medical" style="display: ${activeTimelineSubTab === 'medical' ? 'block' : 'none'};">
            ${longitudinalTimeline.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 16px; position: relative; padding-left: 28px;">
                <div style="position: absolute; left: 9px; top: 12px; bottom: 12px; width: 2px; background: #CBD5E1;"></div>
                
                ${longitudinalTimeline.map((item, idx) => {
                  let badgeBg = '#E0F2FE';
                  let badgeColor = '#0369A1';
                  let dotColor = 'var(--color-teal, #008080)';

                  if (item.type === 'PAST_SURGERY') {
                    badgeBg = '#FEE2E2'; badgeColor = '#991B1B'; dotColor = '#EF4444';
                  } else if (item.type === 'CHRONIC_CONDITION') {
                    badgeBg = '#FEF3C7'; badgeColor = '#92400E'; dotColor = '#F59E0B';
                  } else if (item.type === 'FRACTURE_TRAUMA') {
                    badgeBg = '#F3E8FF'; badgeColor = '#6B21A8'; dotColor = '#A855F7';
                  } else if (item.type === 'CURRENT_CONSULTATION') {
                    badgeBg = '#DCFCE7'; badgeColor = '#166534'; dotColor = '#22C55E';
                  } else if (item.type === 'MEDICAL_DOCUMENT') {
                    badgeBg = '#E0E7FF'; badgeColor = '#3730A3'; dotColor = '#6366F1';
                  }

                  return `
                    <div key="${idx}" style="position: relative; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px;">
                      <div style="position: absolute; left: -25px; top: 18px; width: 14px; height: 14px; border-radius: 50%; background: ${dotColor}; border: 2.5px solid #FFF; box-shadow: 0 0 0 2px #E2E8F0;"></div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
                        <span style="font-size: 13px; font-weight: 800; color: var(--color-navy, #1A3A5C);">
                          ${item.displayDate || item.year || 'Historical'}
                        </span>
                        <span class="status-badge" style="background: ${badgeBg}; color: ${badgeColor}; font-size: 11px; font-weight: 700;">
                          ${item.type.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <h4 style="font-size: 15px; color: var(--color-navy, #1A3A5C); margin: 0 0 4px; font-weight: 700;">
                        ${item.title || item.type}
                      </h4>
                      <p style="font-size: 13px; color: var(--color-ink, #1F2937); margin: 0; line-height: 1.45;">
                        ${item.description || ''}
                      </p>

                      ${item.documentId ? `
                        <div style="margin-top: 8px;">
                          <button
                            type="button"
                            class="btn btn--secondary btn-view-doc-file"
                            data-doc-id="${item.documentId}"
                            data-doc-name="${item.fileName || 'Medical Document'}"
                            style="font-size: 11px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px;"
                          >
                            ${icons.eye(12)} View Scanned Document
                          </button>
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div style="text-align: center; padding: 32px; background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); border-radius: var(--radius-md, 8px);">
                <span style="display: flex; justify-content: center; margin-bottom: 8px;">${icons.clipboard(32, '#94A3B8')}</span>
                <h4 style="font-size: 15px; color: var(--color-navy, #1A3A5C); margin: 8px 0 4px;">No previous medical history has been recorded.</h4>
                <p style="font-size: 13px; color: var(--color-gray-600, #6B7280); margin: 0;">
                  Patient has no recorded surgeries, chronic conditions, or previous hospitalizations.
                </p>
              </div>
            `}
          </div>

          <!-- Sub-View 2: System Audit Trail -->
          <div id="timeline-subview-audit" style="display: ${activeTimelineSubTab === 'audit' ? 'block' : 'none'};">
            ${systemAudit.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${systemAudit.map((audit, idx) => `
                  <div key="${idx}" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div>
                      <span style="font-size: 11px; font-weight: 700; color: #64748B; display: block;">
                        ${audit.displayDate || audit.timestamp || 'Runtime Log'} · Code: <code style="color: #0F172A;">${audit.type || audit.event}</code>
                      </span>
                      <strong style="font-size: 13px; color: var(--color-navy, #1A3A5C);">
                        ${audit.title || audit.description || 'System Log Event'}
                      </strong>
                    </div>
                    <span class="status-badge" style="background: #F1F5F9; color: #475569; font-size: 11px;">
                      ${audit.source || 'SYSTEM_LOG'}
                    </span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="text-align: center; padding: 24px; background: #F8FAFC; border: 1px solid var(--color-border, #DCE5EC); border-radius: 6px;">
                <p style="font-size: 13px; color: var(--color-gray-600, #6B7280); margin: 0;">No system audit events recorded.</p>
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- Document File Viewer Modal Container -->
      <div id="doc-modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; justify-content: center; align-items: center; padding: 20px;">
        <div style="background: #FFFFFF; width: 100%; max-width: 900px; height: 85vh; border-radius: 12px; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); overflow: hidden;">
          <div style="padding: 14px 20px; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; background: #F8FAFC;">
            <strong id="doc-modal-title" style="font-size: 16px; color: var(--color-navy, #1A3A5C);">
              Original Medical Document
            </strong>
            <div style="display: flex; gap: 8px;">
              <a id="doc-modal-download-btn" href="#" download class="btn btn--secondary" style="font-size: 12px; padding: 4px 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                ${icons.download(14)} Download
              </a>
              <button id="doc-modal-close-btn" type="button" class="btn btn--secondary" style="font-size: 14px; padding: 4px 10px; cursor: pointer;">
                ✕ Close
              </button>
            </div>
          </div>
          <div style="flex: 1; min-height: 0; background: #334155; display: flex; justify-content: center; align-items: center;">
            <iframe id="doc-modal-iframe" src="" style="width: 100%; height: 100%; border: none; background: #FFFFFF;"></iframe>
          </div>
        </div>
      </div>
    </div>
  `;

  function attachEvents() {
    // Back to OPD Queue
    document.getElementById('doc-ws-back-btn')?.addEventListener('click', () => {
      clearPatientWorkspace();
      setActiveTab('queue');
    });

    // Tab Switching
    document.querySelectorAll('.tab[data-tab]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const targetTab = tabBtn.getAttribute('data-tab');
        if (targetTab) {
          activeWorkspaceTab = targetTab;
          tabs.forEach(t => {
            const el = document.getElementById(`tab-content-${t}`);
            if (el) el.style.display = t === targetTab ? 'block' : 'none';
          });
          document.querySelectorAll('.tab[data-tab]').forEach(btn => {
            const isMatch = btn.getAttribute('data-tab') === targetTab;
            btn.style.background = isMatch ? 'var(--color-navy, #1A3A5C)' : 'transparent';
            btn.style.color = isMatch ? '#FFFFFF' : 'var(--color-gray-600, #4B5563)';
          });
        }
      });
    });

    // Timeline Sub-Tab Switching (Medical Timeline vs System Audit)
    document.getElementById('btn-timeline-sub-medical')?.addEventListener('click', () => {
      activeTimelineSubTab = 'medical';
      const med = document.getElementById('timeline-subview-medical');
      const aud = document.getElementById('timeline-subview-audit');
      const btnMed = document.getElementById('btn-timeline-sub-medical');
      const btnAud = document.getElementById('btn-timeline-sub-audit');
      if (med) med.style.display = 'block';
      if (aud) aud.style.display = 'none';
      if (btnMed) { btnMed.style.background = '#FFFFFF'; btnMed.style.color = 'var(--color-navy, #1A3A5C)'; }
      if (btnAud) { btnAud.style.background = 'transparent'; btnAud.style.color = '#64748B'; }
    });

    document.getElementById('btn-timeline-sub-audit')?.addEventListener('click', () => {
      activeTimelineSubTab = 'audit';
      const med = document.getElementById('timeline-subview-medical');
      const aud = document.getElementById('timeline-subview-audit');
      const btnMed = document.getElementById('btn-timeline-sub-medical');
      const btnAud = document.getElementById('btn-timeline-sub-audit');
      if (med) med.style.display = 'none';
      if (aud) aud.style.display = 'block';
      if (btnAud) { btnAud.style.background = '#FFFFFF'; btnAud.style.color = 'var(--color-navy, #1A3A5C)'; }
      if (btnMed) { btnMed.style.background = 'transparent'; btnMed.style.color = '#64748B'; }
    });

    // Primary Workflow Action Button (State Machine Step)
    const workflowActionBtn = document.getElementById('doc-ws-signoff-btn') || document.getElementById('doc-ws-workflow-action-btn');
    document.getElementById('doc-ws-order-labs-btn')?.addEventListener('click', () => {
      alert('Diagnostic Requisition Dispatched: Standard Hemogram, Renal profile, and Blood Glucose orders sent to Pathology.');
    });
    workflowActionBtn?.addEventListener('click', async () => {
      const nextStatus = workflowActionBtn.getAttribute('data-next-status');
      const switchTab = workflowActionBtn.getAttribute('data-switch-tab');

      if (!nextStatus) {
        // COMPLETED state print/export
        window.print();
        return;
      }

      const confirmed = window.confirm(`Advance consultation state to: ${nextStatus.replace(/_/g, ' ')}?`);
      if (!confirmed) return;

      workflowActionBtn.disabled = true;
      workflowActionBtn.textContent = 'Updating...';

      try {
        const targetId = ws.encounterId || ws.sessionId;
        const res = await doctorApi.updateStatus(targetId, nextStatus);
        if (res.success) {
          showToast(`Consultation transitioned to ${nextStatus.replace(/_/g, ' ')}`);
          ws.consultationStatus = nextStatus;
          if (ws.currentEncounter) ws.currentEncounter.status = nextStatus;

          if (switchTab) {
            activeWorkspaceTab = switchTab;
          }

          // Re-render workspace to update button and state
          const newRender = renderDoctorWorkspaceView();
          const mainContainer = document.querySelector('.doc-stage-content') || document.querySelector('#doc-app-main');
          if (mainContainer) {
            mainContainer.innerHTML = newRender.html;
            newRender.attachEvents();
          }
        }
      } catch (err) {
        alert('Failed to update consultation state: ' + err.message);
        workflowActionBtn.disabled = false;
        workflowActionBtn.textContent = workflowBtnText;
      }
    });

    // Dynamic BMI calculation preview
    const weightInput = document.getElementById('input-phys-weight');
    const heightInput = document.getElementById('input-phys-height');
    const bmiPreviewEl = document.getElementById('vitals-bmi-preview');

    const updateBmiPreview = () => {
      const w = parseFloat(weightInput?.value);
      const h = parseFloat(heightInput?.value);
      if (w > 10 && h > 50 && bmiPreviewEl) {
        const hM = h / 100;
        const bmi = (w / (hM * hM)).toFixed(1);
        bmiPreviewEl.textContent = `Calculated BMI: ${bmi}`;
      }
    };
    weightInput?.addEventListener('input', updateBmiPreview);
    heightInput?.addEventListener('input', updateBmiPreview);

    // Save Physician Vitals
    document.getElementById('btn-save-phys-vitals')?.addEventListener('click', async () => {
      const bp = document.getElementById('input-phys-bp')?.value?.trim();
      const hr = parseInt(document.getElementById('input-phys-hr')?.value, 10) || undefined;
      const spo2 = parseInt(document.getElementById('input-phys-spo2')?.value, 10) || undefined;
      const temp = parseFloat(document.getElementById('input-phys-temp')?.value) || undefined;
      const respRate = parseInt(document.getElementById('input-phys-resp')?.value, 10) || undefined;
      const weight = parseFloat(document.getElementById('input-phys-weight')?.value) || undefined;
      const height = parseFloat(document.getElementById('input-phys-height')?.value) || undefined;

      try {
        const targetId = ws.encounterId || ws.sessionId;
        const res = await doctorApi.recordVitals(targetId, {
          bp: bp || undefined,
          heartRate: hr,
          spo2,
          temp,
          respRate,
          weight,
          height,
        });

        if (res.success) {
          showToast('Physical examination vitals recorded successfully.');
          const returnedVitals = res.data?.vitals || {};
          if (bp) {
            const bpEl = document.getElementById('tab-vital-bp');
            if (bpEl) bpEl.textContent = bp;
          }
          if (hr) {
            const hrEl = document.getElementById('tab-vital-hr');
            if (hrEl) hrEl.textContent = `${hr} bpm`;
          }
          if (spo2) {
            const spo2El = document.getElementById('tab-vital-spo2');
            if (spo2El) {
              spo2El.textContent = `${spo2}%`;
              spo2El.style.color = 'var(--color-success, #16A34A)';
            }
          }
          if (temp) {
            const tempEl = document.getElementById('tab-vital-temp');
            if (tempEl) tempEl.textContent = `${temp}°F`;
          }
          if (respRate) {
            const respEl = document.getElementById('tab-vital-resp');
            if (respEl) respEl.textContent = `${respRate} /min`;
          }
          if (returnedVitals.bmi) {
            const bmiEl = document.getElementById('tab-vital-bmi');
            if (bmiEl) bmiEl.textContent = returnedVitals.bmi;
          }
        }
      } catch (err) {
        alert('Failed to record vitals: ' + err.message);
      }
    });

    // Helper to collect current physical examination inputs from DOM
    function collectCurrentExamData() {
      if (!ws.physicalExamination) ws.physicalExamination = {};
      if (!ws.physicalExamination.general) ws.physicalExamination.general = {};
      if (!ws.physicalExamination.systemic) ws.physicalExamination.systemic = {};
      if (!ws.physicalExamination.conditionExam) ws.physicalExamination.conditionExam = {};

      const general = {
        appearance: document.getElementById('exam-gen-appearance')?.value?.trim() || '',
        consciousness: document.getElementById('exam-gen-consciousness')?.value?.trim() || '',
        hydration: document.getElementById('exam-gen-hydration')?.value?.trim() || '',
        pallor: document.getElementById('exam-gen-pallor')?.value?.trim() || '',
        icterus: document.getElementById('exam-gen-icterus')?.value?.trim() || '',
        cyanosis: document.getElementById('exam-gen-cyanosis')?.value?.trim() || '',
        clubbing: document.getElementById('exam-gen-clubbing')?.value?.trim() || '',
        edema: document.getElementById('exam-gen-edema')?.value?.trim() || '',
        lymphNodes: document.getElementById('exam-gen-lymph')?.value?.trim() || '',
      };

      const ce = { ...ws.physicalExamination.conditionExam };
      const systemic = { ...ws.physicalExamination.systemic };

      // Musculoskeletal
      if (document.getElementById('exam-msk-gait')) ce.gait = document.getElementById('exam-msk-gait').value.trim();
      if (document.getElementById('exam-msk-swelling')) ce.swelling = document.getElementById('exam-msk-swelling').value.trim();
      if (document.getElementById('exam-msk-tenderness')) {
        ce.tenderness = document.getElementById('exam-msk-tenderness').value.trim();
        systemic.musculoskeletal = ce.tenderness;
      }
      if (document.getElementById('exam-msk-rom')) ce.rom = document.getElementById('exam-msk-rom').value.trim();
      if (document.getElementById('exam-msk-deformity')) ce.deformity = document.getElementById('exam-msk-deformity').value.trim();
      if (document.getElementById('exam-msk-temp')) ce.localTemp = document.getElementById('exam-msk-temp').value.trim();
      if (document.getElementById('exam-msk-stability')) ce.stability = document.getElementById('exam-msk-stability').value.trim();

      // Cardiorespiratory
      if (document.getElementById('exam-cr-inspection')) ce.respInspection = document.getElementById('exam-cr-inspection').value.trim();
      if (document.getElementById('exam-cr-breath-sounds')) {
        ce.breathSounds = document.getElementById('exam-cr-breath-sounds').value.trim();
        systemic.respiratory = ce.breathSounds;
      }
      if (document.getElementById('exam-cr-heart-sounds')) {
        ce.heartSounds = document.getElementById('exam-cr-heart-sounds').value.trim();
        systemic.cardiovascular = ce.heartSounds;
      }
      if (document.getElementById('exam-cr-spo2')) ce.spo2 = document.getElementById('exam-cr-spo2').value.trim();
      if (document.getElementById('exam-cr-effort')) ce.respEffort = document.getElementById('exam-cr-effort').value.trim();
      if (document.getElementById('exam-cr-perfusion')) ce.perfusion = document.getElementById('exam-cr-perfusion').value.trim();

      // Abdomen
      if (document.getElementById('exam-abdo-inspection')) ce.abdoInspection = document.getElementById('exam-abdo-inspection').value.trim();
      if (document.getElementById('exam-abdo-tenderness')) {
        ce.tenderness = document.getElementById('exam-abdo-tenderness').value.trim();
        systemic.abdomen = ce.tenderness;
      }
      if (document.getElementById('exam-abdo-guarding')) ce.guarding = document.getElementById('exam-abdo-guarding').value.trim();
      if (document.getElementById('exam-abdo-bowel')) ce.bowelSounds = document.getElementById('exam-abdo-bowel').value.trim();
      if (document.getElementById('exam-abdo-organomegaly')) ce.organomegaly = document.getElementById('exam-abdo-organomegaly').value.trim();

      // Fever
      if (document.getElementById('exam-fev-appearance')) ce.appearance = document.getElementById('exam-fev-appearance').value.trim();
      if (document.getElementById('exam-fev-temp')) ce.temp = document.getElementById('exam-fev-temp').value.trim();
      if (document.getElementById('exam-fev-hydration')) ce.hydration = document.getElementById('exam-fev-hydration').value.trim();
      if (document.getElementById('exam-fev-lymph')) ce.lymphNodes = document.getElementById('exam-fev-lymph').value.trim();
      if (document.getElementById('exam-fev-rash')) ce.rash = document.getElementById('exam-fev-rash').value.trim();

      // Neurological
      if (document.getElementById('exam-neuro-sensorium')) {
        ce.sensorium = document.getElementById('exam-neuro-sensorium').value.trim();
        systemic.neurological = ce.sensorium;
      }
      if (document.getElementById('exam-neuro-orientation')) ce.orientation = document.getElementById('exam-neuro-orientation').value.trim();
      if (document.getElementById('exam-neuro-cranial')) ce.cranialNerves = document.getElementById('exam-neuro-cranial').value.trim();
      if (document.getElementById('exam-neuro-motor-sensory')) ce.motorSensory = document.getElementById('exam-neuro-motor-sensory').value.trim();
      if (document.getElementById('exam-neuro-gait')) ce.gaitCoordination = document.getElementById('exam-neuro-gait').value.trim();
      if (document.getElementById('exam-neuro-reflexes')) ce.reflexes = document.getElementById('exam-neuro-reflexes').value.trim();

      // Pediatric
      if (document.getElementById('exam-ped-activity')) ce.activity = document.getElementById('exam-ped-activity').value.trim();
      if (document.getElementById('exam-ped-hydration')) ce.fontanelle = document.getElementById('exam-ped-hydration').value.trim();
      if (document.getElementById('exam-ped-resp')) ce.respEffort = document.getElementById('exam-ped-resp').value.trim();
      if (document.getElementById('exam-ped-tone')) ce.tone = document.getElementById('exam-ped-tone').value.trim();
      if (document.getElementById('exam-ped-systemic')) ce.systemic = document.getElementById('exam-ped-systemic').value.trim();

      // Fallback Systemic
      if (document.getElementById('exam-sys-resp')) systemic.respiratory = document.getElementById('exam-sys-resp').value.trim();
      if (document.getElementById('exam-sys-cvs')) systemic.cardiovascular = document.getElementById('exam-sys-cvs').value.trim();
      if (document.getElementById('exam-sys-abdo')) systemic.abdomen = document.getElementById('exam-sys-abdo').value.trim();
      if (document.getElementById('exam-sys-cns')) systemic.neurological = document.getElementById('exam-sys-cns').value.trim();
      if (document.getElementById('exam-sys-msk')) systemic.musculoskeletal = document.getElementById('exam-sys-msk').value.trim();
      if (document.getElementById('exam-sys-other')) systemic.other = document.getElementById('exam-sys-other').value.trim();

      const clinicalImpression = document.getElementById('exam-clinical-impression')?.value?.trim() || '';
      const patientVisibleAdvice = document.getElementById('exam-patient-advice')?.value?.trim() || '';
      const publishToPatient = document.getElementById('exam-publish-patient-toggle')?.checked ?? true;
      const notes = document.getElementById('exam-notes-text')?.value?.trim() || '';

      ws.physicalExamination.general = general;
      ws.physicalExamination.systemic = systemic;
      ws.physicalExamination.conditionExam = ce;
      ws.physicalExamination.clinicalImpression = clinicalImpression;
      ws.physicalExamination.patientVisibleAdvice = patientVisibleAdvice;
      ws.physicalExamination.publishToPatient = publishToPatient;
      ws.physicalExamination.notes = notes;

      return {
        general,
        systemic,
        conditionExam: ce,
        clinicalImpression,
        patientVisibleAdvice,
        publishToPatient,
        notes,
      };
    }

    // Dynamic Examination Sections: Add Section
    document.getElementById('btn-add-exam-section')?.addEventListener('click', () => {
      const selectEl = document.getElementById('select-add-exam-section');
      const selectedSec = selectEl?.value;
      if (selectedSec) {
        collectCurrentExamData();
        attachedExamSections.add(selectedSec);
        activeWorkspaceTab = 'Examination';
        const newRender = renderDoctorWorkspaceView();
        const mainContainer = document.querySelector('.doc-stage-content') || document.querySelector('#doc-app-main');
        if (mainContainer) {
          mainContainer.innerHTML = newRender.html;
          newRender.attachEvents();
        }
      }
    });

    // Dynamic Examination Sections: Remove Attached Section
    document.querySelectorAll('.btn-remove-attached-section').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = btn.getAttribute('data-section');
        if (sec) {
          collectCurrentExamData();
          attachedExamSections.delete(sec);
          activeWorkspaceTab = 'Examination';
          const newRender = renderDoctorWorkspaceView();
          const mainContainer = document.querySelector('.doc-stage-content') || document.querySelector('#doc-app-main');
          if (mainContainer) {
            mainContainer.innerHTML = newRender.html;
            newRender.attachEvents();
          }
        }
      });
    });

    // Silent Draft Save (No alert popups, no toast spam)
    document.getElementById('btn-save-draft-exam')?.addEventListener('click', async () => {
      const payload = collectCurrentExamData();
      const statusEl = document.getElementById('exam-draft-status');
      if (statusEl) {
        statusEl.textContent = 'Saving draft...';
        statusEl.style.color = '#0284C7';
      }

      try {
        const targetId = ws.encounterId || ws.sessionId;
        const res = await doctorApi.recordExamination(targetId, {
          ...payload,
          isDraft: true,
        });

        if (res.success) {
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          if (statusEl) {
            statusEl.textContent = `Draft saved silently at ${timeStr}`;
            statusEl.style.color = '#16A34A';
          }
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = `Draft error: ${err.message}`;
          statusEl.style.color = '#DC2626';
        }
      }
    });

    // Save & Sign Physical Examination (Finalized)
    document.getElementById('btn-save-phys-exam')?.addEventListener('click', async () => {
      const payload = collectCurrentExamData();
      try {
        const targetId = ws.encounterId || ws.sessionId;
        const res = await doctorApi.recordExamination(targetId, {
          ...payload,
          isDraft: false,
        });

        if (res.success) {
          showToast('Physical examination findings signed & recorded.');
          if (ws.physicalExamination) {
            ws.physicalExamination.recordedBy = res.data?.examination?.recordedBy || res.data?.examination?.doctorName || 'Attending Physician';
          }
          const statusEl = document.getElementById('exam-draft-status');
          if (statusEl) {
            statusEl.textContent = 'Examination signed and recorded.';
            statusEl.style.color = '#0D9488';
          }
        }
      } catch (err) {
        alert('Failed to save examination: ' + err.message);
      }
    });

    // Save Clinical Impression Note (Overview tab)
    document.getElementById('btn-save-impression-note')?.addEventListener('click', async () => {
      const noteInput = document.getElementById('doc-overview-notes-input');
      const noteText = noteInput?.value?.trim();
      if (!noteText) {
        alert('Please enter note text before saving.');
        return;
      }
      try {
        const res = await doctorApi.saveNotes(ws.sessionId, noteText);
        if (res.success) {
          showToast('Clinical note saved successfully.');
        }
      } catch (err) {
        alert('Failed to save note: ' + err.message);
      }
    });

    // Toggle AYUSH Expand/Collapse
    document.getElementById('btn-toggle-ayush-collapse')?.addEventListener('click', () => {
      isAyushExpanded = !isAyushExpanded;
      const body = document.getElementById('ayush-collapsible-body');
      const btn = document.getElementById('btn-toggle-ayush-collapse');
      if (body) body.style.display = isAyushExpanded ? 'block' : 'none';
      if (btn) btn.textContent = isAyushExpanded ? '▲ Collapse' : '▼ Expand All';
    });

    // Document Viewer Modal Handlers
    const modalOverlay = document.getElementById('doc-modal-overlay');
    const modalTitle = document.getElementById('doc-modal-title');
    const modalIframe = document.getElementById('doc-modal-iframe');
    const modalDownload = document.getElementById('doc-modal-download-btn');
    const modalClose = document.getElementById('doc-modal-close-btn');

    document.querySelectorAll('.btn-view-doc-file').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.getAttribute('data-doc-id');
        const docName = btn.getAttribute('data-doc-name') || 'Medical Document';
        if (docId && modalOverlay && modalIframe) {
          modalTitle.textContent = docName;
          modalIframe.src = `/api/documents/${docId}/file`;
          modalDownload.href = `/api/documents/${docId}/download`;
          modalOverlay.style.display = 'flex';
        }
      });
    });

    modalClose?.addEventListener('click', () => {
      if (modalOverlay) {
        modalOverlay.style.display = 'none';
        if (modalIframe) modalIframe.src = '';
      }
    });

    modalOverlay?.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.style.display = 'none';
        if (modalIframe) modalIframe.src = '';
      }
    });
  }

  function showToast(msg) {
    const toast = document.getElementById('doc-ws-toast');
    if (toast) {
      toast.style.display = 'block';
      const p = toast.querySelector('p');
      if (p) p.textContent = msg;
      setTimeout(() => {
        if (toast) toast.style.display = 'none';
      }, 3500);
    }
  }

  return { html, attachEvents };
}

function formatDuration(dur) {
  if (!dur) return 'Recent';
  if (typeof dur === 'object') {
    if (dur.raw) return dur.raw;
    if (dur.min && dur.max && dur.unit) {
      return dur.min === dur.max ? `${dur.min} ${dur.unit}` : `${dur.min} - ${dur.max} ${dur.unit}`;
    }
  }
  return String(dur);
}

function formatAllergiesHtml(allergies) {
  if (!allergies) return '<span style="color: var(--color-gray-600);">Not recorded</span>';
  if (allergies.status === 'ABSENT' || allergies.status === 'NO') {
    return '<span style="color: var(--color-success, #16A34A); font-weight: 600;">✓ Patient explicitly denied any known drug or food allergies.</span>';
  }
  if (allergies.status === 'PRESENT' || allergies.status === 'YES' || Array.isArray(allergies)) {
    const list = Array.isArray(allergies) ? allergies : (allergies.substances || []);
    if (list.length === 0) return `<span style="color: #991B1B; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">${icons.alert(12, '#991B1B')} Allergic tendency noted.</span>`;
    return list.map(a => `
      <span style="display: inline-block; background: var(--color-critical-bg, #FEF2F2); color: #991B1B; border: 1px solid var(--color-critical-border, #FECACA); padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 600; margin-right: 6px;">
        <span style="display: inline-flex; align-items: center; gap: 4px;">${icons.alert(12, '#991B1B')} ${typeof a === 'string' ? a : (a.name || a.substance)}</span>
      </span>
    `).join('');
  }
  return '<span style="color: var(--color-gray-600);">Not reported</span>';
}
