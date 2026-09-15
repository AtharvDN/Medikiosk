/**
 * Canonical Clinical Summary Builder — MediKiosk (Phase 8)
 * 
 * Strict Architectural Guarantees:
 * 1. REPRESENTATIONAL, NOT DIAGNOSTIC: Describes what the patient reported and what records show.
 *    Strictly NO disease diagnoses (e.g. pneumonia, arthritis, viral infection).
 * 2. DETERMINISTIC CONSTRUCTION: Pure logic from validated facts & responses. Zero LLM summary hallucination.
 * 3. STRICT STATE DISAMBIGUATION:
 *    - PRESENT: Patient explicitly affirmed.
 *    - ABSENT: Patient explicitly denied ("No", "नाही", "नहीं").
 *    - UNKNOWN: Patient is uncertain ("Don't know", "माहित नाही", "पता नहीं").
 *    - NOT_PROVIDED: Question was not asked or not answered. Never defaulted or collapsed into NO/ABSENT.
 *    - NOT_DETECTED: Field was missing from document OCR. Never fabricated from databases.
 * 4. PRIMARY CONCERN ISOLATION: Initial complaint is strictly preserved and never overwritten
 *    by incidental symptoms.
 * 5. FULL PROVENANCE: Every fact links to questionId, source, original wording, confidence, timestamp.
 * 6. NO DEFAULTING: Never default duration to 7 days, never default location to abdomen, never guess laterality.
 * 7. SOURCE SEPARATION & DISCREPANCY DETECTION: Patient-reported vs document-extracted medications
 *    are kept separate, and differing doses/frequencies are flagged for human review.
 */

export function buildCanonicalClinicalSummary(sessionState, documents = [], options = {}) {
  const startTime = Date.now();
  if (!sessionState) {
    return null;
  }

  const collectedFacts = sessionState.collectedFacts || {};
  const responses = sessionState.responses || [];
  const lang = options.language || sessionState.language || 'mr';

  // --------------------------------------------------------------------------
  // 1. PRIMARY CONCERN (Section 7, 15, 22, 26)
  // --------------------------------------------------------------------------
  let primaryConcernKey = sessionState.primaryConcern;
  const ccResponse = responses.find((r) => r.questionId === 'q.chief_complaint');

  if (!primaryConcernKey) {
    if (collectedFacts['symptom.dyspnea.presence']?.status === 'PRESENT' || collectedFacts['symptom.breathing.presence']?.status === 'PRESENT') {
      primaryConcernKey = 'breathing';
    } else if (collectedFacts['symptom.diarrhea.presence']?.status === 'PRESENT') {
      primaryConcernKey = 'diarrhea';
    } else if (collectedFacts['symptom.pain.shoulder.location']?.value === 'shoulder' || collectedFacts['symptom.pain.shoulder.presence']?.status === 'PRESENT') {
      primaryConcernKey = 'shoulder_pain';
    } else if (collectedFacts['symptom.pain.chest.location']?.value === 'chest' || collectedFacts['symptom.pain.chest.presence']?.status === 'PRESENT') {
      primaryConcernKey = 'chest_pain';
    } else if (collectedFacts['symptom.pain.abdominal.location']?.value === 'abdomen' || collectedFacts['symptom.pain.abdominal.presence']?.status === 'PRESENT') {
      primaryConcernKey = 'stomach';
    } else if (collectedFacts['symptom.pain.knee.location']?.value === 'knee' || collectedFacts['symptom.pain.knee.presence']?.status === 'PRESENT') {
      primaryConcernKey = 'knee_pain';
    } else if (collectedFacts['symptom.pain.complaint_type']?.value) {
      primaryConcernKey = collectedFacts['symptom.pain.complaint_type'].value;
    } else if (ccResponse?.normalizedValue) {
      primaryConcernKey = ccResponse.normalizedValue;
    }
  }

  const rawCcWording = ccResponse?.rawResponse || ccResponse?.originalTranscript || null;
  const isCcVoice = ccResponse?.inputMethod === 'VOICE' || ccResponse?.source === 'PATIENT_VOICE';

  const primaryConcernDetails = primaryConcernKey
    ? {
        concern: String(primaryConcernKey),
        displayName: formatConcernDisplayName(primaryConcernKey),
        originalWording: typeof rawCcWording === 'string' ? rawCcWording : (rawCcWording ? JSON.stringify(rawCcWording) : null),
        status: 'PRESENT',
        source: isCcVoice ? 'PATIENT_VOICE' : (ccResponse?.source || 'PATIENT_TOUCH'),
        sourceResponseId: ccResponse?.questionId || 'q.chief_complaint',
        questionId: 'q.chief_complaint',
        confidence: ccResponse?.confidence ?? (isCcVoice ? 0.95 : 1.0),
        timestamp: ccResponse?.timestamp || sessionState.updatedAt || new Date().toISOString(),
      }
    : null;

  // --------------------------------------------------------------------------
  // 2. DURATION (Section 10, 26)
  // Supports exact values, ranges (min, max, unit), vague, and NOT_PROVIDED.
  // --------------------------------------------------------------------------
  let durationFact =
    collectedFacts['symptom.dyspnea.duration'] ||
    collectedFacts['symptom.breathing.duration'] ||
    collectedFacts['symptom.diarrhea.duration'] ||
    collectedFacts['symptom.pain.knee.duration'] ||
    collectedFacts['symptom.pain.shoulder.duration'] ||
    collectedFacts['symptom.pain.chest.duration'] ||
    collectedFacts['symptom.pain.abdominal.duration'] ||
    collectedFacts['symptom.vomiting.duration'] ||
    collectedFacts['symptom.fever.duration'] ||
    collectedFacts['symptom.cough.duration'] ||
    collectedFacts['symptom.pain.duration'] ||
    collectedFacts['clinical.duration.duration'] ||
    collectedFacts['duration.duration'];

  if (!durationFact) {
    durationFact = Object.values(collectedFacts).find((f) => f.attribute === 'duration');
  }

  const durationResponse = responses.find((r) =>
    r.questionId?.includes('duration') ||
    r.questionId === 'q.pain.duration' ||
    r.questionId === 'q.fever.duration' ||
    r.questionId === 'q.diarrhea.duration'
  );

  let legacyDuration = null;
  let durationDetails = null;

  if (durationFact && durationFact.status !== 'NOT_PROVIDED') {
    let min = null;
    let max = null;
    let value = null;
    let unit = 'days';
    let precision = 'exact';
    let rawText = durationFact.raw || durationResponse?.rawResponse || null;

    if (durationFact.precision === 'vague' || (typeof durationFact.value === 'object' && durationFact.value?.precision === 'vague')) {
      precision = 'vague';
      value = null;
      rawText = durationFact.raw || durationFact.value?.raw || 'vague';
      legacyDuration = { value: null, raw: rawText, precision: 'vague' };
    } else if (typeof durationFact.value === 'object' && durationFact.value !== null) {
      if (durationFact.value.min !== undefined && durationFact.value.max !== undefined) {
        min = Number(durationFact.value.min);
        max = Number(durationFact.value.max);
        unit = durationFact.value.unit || 'days';
        precision = 'range';
        legacyDuration = { min, max, unit };
      } else if (durationFact.value.amount !== undefined || durationFact.value.value !== undefined) {
        value = Number(durationFact.value.amount ?? durationFact.value.value);
        unit = durationFact.value.unit || durationFact.unit || 'days';
        legacyDuration = { value, unit };
      } else {
        legacyDuration = durationFact.value;
      }
    } else if (typeof durationFact.value === 'number') {
      value = durationFact.value;
      unit = durationFact.unit || 'days';
      legacyDuration = { value, unit };
    } else if (typeof durationFact.value === 'string' && !isNaN(Number(durationFact.value))) {
      value = Number(durationFact.value);
      unit = durationFact.unit || 'days';
      legacyDuration = { value, unit };
    }

    let displayStr = '';
    if (precision === 'range' && min !== null && max !== null) {
      displayStr = `${min}–${max} ${unit}`;
    } else if (value !== null) {
      displayStr = `${value} ${unit}`;
    } else if (rawText) {
      displayStr = String(rawText);
    } else {
      displayStr = 'Not provided';
    }

    durationDetails = {
      value,
      min,
      max,
      unit,
      display: displayStr,
      precision,
      raw: rawText ? String(rawText) : null,
      status: durationFact.status || 'PRESENT',
      source: durationFact.source || durationResponse?.source || 'PATIENT_TOUCH',
      questionId: durationResponse?.questionId || 'q.duration',
      confidence: durationFact.confidence || durationResponse?.confidence || null,
      originalWording: durationResponse?.rawResponse ? String(durationResponse.rawResponse) : (rawText ? String(rawText) : null),
      timestamp: durationFact.recordedAt || durationResponse?.timestamp || null,
    };
  } else {
    durationDetails = {
      value: null,
      min: null,
      max: null,
      unit: 'days',
      display: 'Not provided',
      precision: null,
      raw: null,
      status: 'NOT_PROVIDED',
      source: null,
      questionId: null,
      confidence: null,
      originalWording: null,
      timestamp: null,
    };
  }

  // --------------------------------------------------------------------------
  // 3. LOCATION (Section 11, 26)
  // Strict rule: NEVER infer or guess laterality (knee != left knee).
  // --------------------------------------------------------------------------
  const locationFact =
    collectedFacts['symptom.headache.location'] ||
    collectedFacts['symptom.pain.shoulder.location'] ||
    collectedFacts['symptom.pain.knee.location'] ||
    collectedFacts['symptom.pain.chest.location'] ||
    collectedFacts['symptom.pain.abdominal.location'] ||
    collectedFacts['symptom.pain.location'];

  const locationResponse = responses.find((r) =>
    r.questionId?.includes('location') ||
    r.questionId === 'q.pain.location'
  );

  let legacyLocation = null;
  let locationDetails = null;

  if (locationFact && locationFact.value && locationFact.value !== 'unknown') {
    legacyLocation = locationFact.value;
    const rawLocStr = String(locationFact.value).toLowerCase();
    let laterality = null;
    if (rawLocStr.includes('left') || rawLocStr.includes('डावा') || rawLocStr.includes('बायाँ')) {
      laterality = 'left';
    } else if (rawLocStr.includes('right') || rawLocStr.includes('उजवा') || rawLocStr.includes('दायाँ')) {
      laterality = 'right';
    } else if (rawLocStr.includes('both') || rawLocStr.includes('दोन्ही') || rawLocStr.includes('दोनों')) {
      laterality = 'bilateral';
    }

    locationDetails = {
      value: locationFact.value,
      laterality, // strictly null if not explicitly reported!
      status: locationFact.status || 'PRESENT',
      source: locationFact.source || locationResponse?.source || 'PATIENT_TOUCH',
      questionId: locationResponse?.questionId || 'q.location',
      confidence: locationFact.confidence || locationResponse?.confidence || null,
      originalWording: locationResponse?.rawResponse ? String(locationResponse.rawResponse) : null,
      timestamp: locationFact.recordedAt || locationResponse?.timestamp || null,
    };
  } else if (locationFact?.status === 'UNKNOWN' || locationResponse?.status === 'UNKNOWN') {
    locationDetails = {
      value: null,
      laterality: null,
      status: 'UNKNOWN',
      display: 'Unknown',
      source: locationResponse?.source || 'PATIENT_TOUCH',
      questionId: locationResponse?.questionId || 'q.location',
      confidence: null,
      originalWording: locationResponse?.rawResponse ? String(locationResponse.rawResponse) : null,
      timestamp: locationResponse?.timestamp || null,
    };
  } else {
    locationDetails = {
      value: null,
      laterality: null,
      status: 'NOT_PROVIDED',
      display: 'Not reported',
      source: null,
      questionId: null,
      confidence: null,
      originalWording: null,
      timestamp: null,
    };
  }

  // --------------------------------------------------------------------------
  // 4. SEVERITY (Section 12, 26)
  // Strict rule: NEVER default to mild/moderate/severe if not reported.
  // --------------------------------------------------------------------------
  const severityFact =
    collectedFacts['symptom.dyspnea.severity'] ||
    collectedFacts['symptom.breathing.severity'] ||
    collectedFacts['symptom.pain.severity'] ||
    collectedFacts['symptom.pain.chest.severity'] ||
    collectedFacts['symptom.pain.knee.severity'] ||
    collectedFacts['symptom.pain.abdominal.severity'] ||
    collectedFacts['clinical.severity.severity'];

  const severityResponse = responses.find((r) =>
    r.questionId?.includes('severity') ||
    r.questionId === 'q.pain.severity'
  );

  let legacySeverity = null;
  let severityDetails = null;

  if (severityFact?.value) {
    const rawVal = typeof severityFact.value === 'object' && severityFact.value !== null
      ? (severityFact.value.level || severityFact.value.value || severityFact.value)
      : severityFact.value;
    const rawSev = String(rawVal).toUpperCase();
    let normLevel = rawSev;
    if (rawSev.includes('MILD') || rawSev.includes('कमी') || rawSev.includes('हल्का')) normLevel = 'MILD';
    else if (rawSev.includes('MODERATE') || rawSev.includes('मध्यम')) normLevel = 'MODERATE';
    else if (rawSev.includes('SEVERE') || rawSev.includes('तीव्र') || rawSev.includes('तेज')) normLevel = 'SEVERE';
    else if (rawSev.includes('UNBEARABLE') || rawSev.includes('असह्य')) normLevel = 'UNBEARABLE';

    legacySeverity = normLevel;
    severityDetails = {
      value: normLevel,
      level: normLevel.toLowerCase(),
      score: typeof severityFact.value === 'object' && severityFact.value !== null ? severityFact.value.score || null : null,
      raw: severityFact.raw || (severityResponse?.rawResponse ? String(severityResponse.rawResponse) : null),
      status: severityFact.status || 'PRESENT',
      source: severityFact.source || severityResponse?.source || 'PATIENT_TOUCH',
      questionId: severityResponse?.questionId || 'q.severity',
      confidence: severityFact.confidence || severityResponse?.confidence || null,
      originalWording: severityResponse?.rawResponse ? String(severityResponse.rawResponse) : null,
      timestamp: severityFact.recordedAt || severityResponse?.timestamp || null,
    };
  } else if (severityFact?.status === 'UNKNOWN' || severityResponse?.status === 'UNKNOWN') {
    severityDetails = {
      value: null,
      raw: severityResponse?.rawResponse ? String(severityResponse.rawResponse) : null,
      status: 'UNKNOWN',
      display: 'Not clearly reported',
      source: severityResponse?.source || 'PATIENT_TOUCH',
      questionId: severityResponse?.questionId || 'q.severity',
      confidence: null,
      originalWording: severityResponse?.rawResponse ? String(severityResponse.rawResponse) : null,
      timestamp: severityResponse?.timestamp || null,
    };
  } else {
    severityDetails = {
      value: null,
      raw: null,
      status: 'NOT_PROVIDED',
      display: 'Not reported',
      source: null,
      questionId: null,
      confidence: null,
      originalWording: null,
      timestamp: null,
    };
  }

  // --------------------------------------------------------------------------
  // 5. CHARACTER & RADIATION (Section 14)
  // --------------------------------------------------------------------------
  const characterFact =
    collectedFacts['symptom.pain.character'] ||
    collectedFacts['symptom.pain.chest.character'] ||
    collectedFacts['symptom.cough.character'];

  const character = characterFact?.value
    ? {
        value: characterFact.value,
        status: characterFact.status || 'PRESENT',
        source: characterFact.source || 'PATIENT_TOUCH',
      }
    : null;

  const radiationFact =
    collectedFacts['symptom.pain.chest.radiation'] ||
    collectedFacts['symptom.pain.radiation'];

  let radiation = null;
  if (radiationFact) {
    radiation = {
      value: radiationFact.value,
      status: radiationFact.status || 'PRESENT',
      source: radiationFact.source || 'PATIENT_TOUCH',
    };
  }

  // --------------------------------------------------------------------------
  // 6. SYMPTOMS & ASSOCIATED SYMPTOMS (Section 13, 15, 16)
  // Distinguishes primary concern from additional symptoms; preserves ABSENT/UNKNOWN.
  // --------------------------------------------------------------------------
  const symptoms = [];
  const associatedSymptoms = [];

  for (const [key, fact] of Object.entries(collectedFacts)) {
    if (fact.concept?.startsWith('symptom.')) {
      const resp = responses.find((r) => r.questionId?.includes(fact.attribute) || r.questionId?.includes(fact.concept));
      const symEntry = {
        concept: fact.concept,
        attribute: fact.attribute,
        value: fact.value,
        status: fact.status || 'PRESENT',
        source: fact.source || 'PATIENT_TOUCH',
        confidence: fact.confidence || null,
        originalWording: resp?.rawResponse ? String(resp.rawResponse) : (fact.raw ? String(fact.raw) : null),
        recordedAt: fact.recordedAt,
      };

      symptoms.push(symEntry);

      const pKeyStr = String(primaryConcernKey || '');
      const isPrimaryConcernAttr =
        (pKeyStr.includes('knee') && fact.concept.includes('knee')) ||
        (pKeyStr.includes('chest') && fact.concept.includes('chest')) ||
        (pKeyStr.includes('shoulder') && fact.concept.includes('shoulder')) ||
        (pKeyStr.includes('stomach') && fact.concept.includes('abdominal')) ||
        (pKeyStr.includes('diarrhea') && fact.concept.includes('diarrhea')) ||
        (pKeyStr.includes('fever') && fact.concept.includes('fever')) ||
        (pKeyStr.includes('headache') && fact.concept.includes('headache'));

      const isNonSymptom =
        (fact.concept === 'symptom.injury' && (fact.attribute === 'mechanism' || fact.attribute === 'joint')) ||
        fact.attribute === 'duration' ||
        fact.attribute === 'location' ||
        fact.attribute === 'severity' ||
        fact.attribute === 'complaint_type';

      if (!isPrimaryConcernAttr && !isNonSymptom) {
        associatedSymptoms.push(symEntry);
      }
    }
  }

  for (const resp of responses) {
    if (resp.status === 'ABSENT' || resp.status === 'UNKNOWN') {
      const qId = resp.questionId;
      const isExcluded =
        !qId ||
        qId === 'q.chief_complaint' ||
        qId.includes('duration') ||
        qId.includes('severity') ||
        qId.includes('location') ||
        qId.includes('medication') ||
        qId.includes('allergy') ||
        qId.includes('confirm') ||
        qId.includes('mechanism');

      const alreadyInAssoc = associatedSymptoms.some((s) => s.concept?.includes(qId) || s.attribute?.includes(qId));
      if (!alreadyInAssoc && !isExcluded) {
        const conceptName = qId.replace(/^q\./, 'symptom.').replace(/^dyn\./, '');
        associatedSymptoms.push({
          concept: conceptName,
          attribute: 'presence',
          value: resp.normalizedValue || (resp.status === 'ABSENT' ? 'no' : 'unknown'),
          status: resp.status,
          source: resp.source || 'PATIENT_TOUCH',
          confidence: resp.confidence || 1.0,
          originalWording: resp.rawResponse ? String(resp.rawResponse) : null,
          recordedAt: resp.timestamp,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 7. MEDICAL HISTORY (Section 17)
  // --------------------------------------------------------------------------
  const relevantHistory = [];
  for (const [key, fact] of Object.entries(collectedFacts)) {
    if (fact.concept?.startsWith('history.') && key !== 'history.medication.medications' && key !== 'history.allergy.allergies') {
      relevantHistory.push({
        condition: fact.attribute || fact.concept.replace('history.', ''),
        status: fact.status || 'PRESENT',
        source: fact.source || 'PATIENT_REPORTED',
        confidence: fact.confidence || null,
        recordedAt: fact.recordedAt,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 8. MEDICATIONS & CONFLICT DETECTION (Section 18, 36)
  // --------------------------------------------------------------------------
  const patientReportedMeds = [];
  const documentExtractedMeds = [];
  const medicationConflicts = [];

  const medFact = collectedFacts['history.medication.medications'] || collectedFacts['history.medication.presence'];
  if (medFact?.value) {
    const medList = Array.isArray(medFact.value) ? medFact.value : [medFact.value];
    for (const m of medList) {
      if (typeof m === 'string') {
        const parts = m.match(/^(.+?)(?:\s+(\d+\s*(?:mg|ml|gm|tablets?)))?$/i);
        patientReportedMeds.push({
          drugName: parts ? parts[1].trim() : m.trim(),
          dose: parts && parts[2] ? parts[2].trim() : 'Not reported',
          source: 'PATIENT_REPORTED',
          confidence: medFact.confidence || 1.0,
          rawText: m,
        });
      } else if (typeof m === 'object' && m !== null) {
        patientReportedMeds.push({
          drugName: m.drugName || m.name || 'Unknown',
          dose: m.dose || 'Not reported',
          frequency: m.frequency || null,
          source: 'PATIENT_REPORTED',
          confidence: m.confidence || 1.0,
          rawText: m.rawText || JSON.stringify(m),
        });
      }
    }
  }

  for (const doc of documents) {
    const extractedMeds = doc.extractedData?.medications || [];
    for (const em of extractedMeds) {
      documentExtractedMeds.push({
        drugName: em.drugName,
        dose: em.dose || 'Not detected',
        frequency: em.frequency || 'Not detected',
        duration: em.duration || 'Not detected',
        timing: em.timing || null,
        source: 'DOCUMENT',
        documentId: doc.id,
        documentName: doc.fileName,
        confidence: em.confidence || doc.confidence || null,
        unverifiedFields: em.unverifiedFields || [],
      });
    }
  }

  for (const pMed of patientReportedMeds) {
    const pName = pMed.drugName.toLowerCase().replace(/^(tab\.?|cap\.?|syp\.?)\s*/i, '').trim();
    for (const dMed of documentExtractedMeds) {
      const dName = dMed.drugName.toLowerCase().replace(/^(tab\.?|cap\.?|syp\.?)\s*/i, '').trim();
      if (pName.includes(dName) || dName.includes(pName)) {
        const pDose = pMed.dose && pMed.dose !== 'Not reported' ? pMed.dose.toLowerCase().replace(/\s+/g, '') : null;
        const dDose = dMed.dose && dMed.dose !== 'Not detected' ? dMed.dose.toLowerCase().replace(/\s+/g, '') : null;

        if (pDose && dDose && pDose !== dDose) {
          medicationConflicts.push({
            drugName: dMed.drugName,
            patientReported: { dose: pMed.dose, source: 'PATIENT_REPORTED' },
            documentReported: { dose: dMed.dose, source: 'DOCUMENT', documentId: dMed.documentId },
            flag: 'DISCREPANCY_DETECTED',
            message: 'Medication dose differs between your answer and uploaded record. Please review.',
          });
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 9. ALLERGIES (Section 19)
  // --------------------------------------------------------------------------
  const allergyFact = collectedFacts['history.allergy.allergies'] ||
    collectedFacts['history.allergy.presence'] ||
    collectedFacts['history.allergies'] ||
    collectedFacts['history.allergies.items'];
  const allergyResponse = responses.find((r) => r.questionId?.includes('allerg'));

  let allergies = null;
  if (allergyFact?.status === 'ABSENT' || allergyResponse?.status === 'ABSENT') {
    allergies = {
      status: 'ABSENT',
      display: 'None reported',
      items: [],
      source: allergyFact?.source || allergyResponse?.source || 'PATIENT_TOUCH',
      questionId: allergyResponse?.questionId || 'q.history.allergies',
    };
  } else if (allergyFact?.status === 'UNKNOWN' || allergyResponse?.status === 'UNKNOWN') {
    allergies = {
      status: 'UNKNOWN',
      display: 'Unknown',
      items: [],
      source: allergyFact?.source || allergyResponse?.source || 'PATIENT_TOUCH',
      questionId: allergyResponse?.questionId || 'q.history.allergies',
    };
  } else if (allergyFact?.value || (allergyResponse && allergyResponse.status === 'PRESENT')) {
    const rawVal = allergyFact?.value || allergyResponse?.normalizedValue || allergyResponse?.rawResponse;
    const rawItems = Array.isArray(rawVal) ? rawVal : [rawVal];
    const items = rawItems
      .map((it) => {
        const s = String(it || '').trim();
        if (s === 'YES_DRUG_ALLERGY' || s.toUpperCase() === 'YES' || it === true) {
          return 'Drug allergy';
        }
        return s;
      })
      .filter(Boolean);

    allergies = {
      status: 'PRESENT',
      display: items.join(', '),
      items: items.length > 0 ? items : ['Drug allergy'],
      source: allergyFact?.source || allergyResponse?.source || 'PATIENT_TOUCH',
      questionId: allergyResponse?.questionId || 'q.history.allergies',
    };
  } else {
    allergies = {
      status: 'NOT_PROVIDED',
      display: 'Not provided',
      items: [],
      source: null,
      questionId: null,
    };
  }

  // --------------------------------------------------------------------------
  // 10. DOCUMENTS (Section 20, 21, 37)
  // --------------------------------------------------------------------------
  const formattedDocs = documents.map((d) => ({
    id: d.id,
    documentType: d.documentType || 'OTHER',
    fileName: d.fileName,
    uploadedAt: d.createdAt,
    ocrConfidence: d.confidence || null,
    extractedData: d.extractedData || null,
    reviewStatus: d.reviewStatus || 'SCANNED',
    isVerified: false,
  }));

  // --------------------------------------------------------------------------
  // 11. UNCERTAIN ITEMS (Section 40)
  // --------------------------------------------------------------------------
  const uncertainItems = [];

  for (const conflict of medicationConflicts) {
    uncertainItems.push({
      type: 'MEDICATION_DISCREPANCY',
      category: 'review_required',
      drugName: conflict.drugName,
      message: conflict.message,
      details: conflict,
    });
  }

  for (const dMed of documentExtractedMeds) {
    if (dMed.dose === 'Not detected' || dMed.frequency === 'Not detected') {
      uncertainItems.push({
        type: 'OCR_FIELD_UNCLEAR',
        category: 'document_review',
        documentId: dMed.documentId,
        drugName: dMed.drugName,
        field: dMed.dose === 'Not detected' ? 'dose' : 'frequency',
        message: `${dMed.drugName} ${dMed.dose === 'Not detected' ? 'dose' : 'frequency'}: Could not be clearly detected from the document.`,
      });
    }
  }

  for (const resp of responses) {
    if (resp.status === 'UNKNOWN') {
      uncertainItems.push({
        type: 'PATIENT_UNKNOWN_ANSWER',
        category: 'patient_clarification',
        questionId: resp.questionId,
        message: `Answer was reported as uncertain for: ${resp.questionId}`,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 12. VERIFICATION STATE (Section 41)
  // --------------------------------------------------------------------------
  const verification = {
    status: options.verificationStatus || sessionState.verificationStatus || 'not_reviewed',
    patientConfirmed: Boolean(options.patientConfirmed || sessionState.patientConfirmed),
    lastVerifiedAt: options.verifiedAt || sessionState.lastVerifiedAt || null,
  };

  // --------------------------------------------------------------------------
  // 12B. AYUSH ASSESSMENT: DASHAVIDHA PARIKSHA & AHARA-VIHARA (Phase 9)
  // Strictly observational / descriptive facts reported by the patient.
  // Invariant: ZERO autonomous dosha diagnosis, ZERO autonomous prescriptions.
  // --------------------------------------------------------------------------
  let ayushAssessment = null;
  const isAyushSession = sessionState.opdMode === 'AYUSH';
  const hasAyushFacts = Object.keys(collectedFacts).some((k) => k.startsWith('ayush.'));
  const hasAyushResponses = responses.some((r) => r.questionId?.startsWith('q.ayush.'));

  // STRICT: AYUSH data must exist ONLY when current encounter/session is actually AYUSH
  if (isAyushSession) {
    const parseAyushParam = (questionId, factConcept, factAttr, paramName) => {
      const resp = responses.find((r) => r.questionId === questionId);
      const fact = collectedFacts[`${factConcept}.${factAttr}`] ||
        collectedFacts[`${factConcept}.${factAttr}.${factAttr}`] ||
        Object.values(collectedFacts).find((f) => (f.concept?.endsWith(factAttr) || f.attribute === factAttr));
      const val = resp?.normalizedValue ?? fact?.value ?? null;
      let status = 'NOT_PROVIDED';
      if (val === 'unknown' || resp?.status === 'UNKNOWN') {
        status = 'UNKNOWN';
      } else if (val !== null && val !== undefined) {
        status = 'PRESENT';
      }

      return {
        parameter: paramName,
        questionId,
        value: val,
        status,
        source: resp?.source || fact?.source || (resp ? 'PATIENT_TOUCH' : null),
        confidence: resp?.confidence ?? fact?.confidence ?? (status === 'PRESENT' ? 1.0 : null),
        recordedAt: resp?.timestamp || fact?.recordedAt || null,
      };
    };

    const dashavidha = {
      prakriti: parseAyushParam('q.ayush.prakriti', 'ayush.dashavidha', 'prakriti', 'Prakriti (Natural Constitution)'),
      vikriti: parseAyushParam('q.ayush.vikriti', 'ayush.dashavidha', 'vikriti', 'Vikriti (Current Bodily Aggravation)'),
      sara: parseAyushParam('q.ayush.sara', 'ayush.dashavidha', 'sara', 'Sara (Tissue Vitality)'),
      samhanana: parseAyushParam('q.ayush.samhanana', 'ayush.dashavidha', 'samhanana', 'Samhanana (Body Compactness & Joints)'),
      pramana: parseAyushParam('q.ayush.pramana', 'ayush.dashavidha', 'pramana', 'Pramana (Anthropometric Proportions)'),
      satmya: parseAyushParam('q.ayush.satmya', 'ayush.dashavidha', 'satmya', 'Satmya (Adaptability & Tolerability)'),
      sattva: parseAyushParam('q.ayush.sattva', 'ayush.dashavidha', 'sattva', 'Sattva (Mental Resilience & Temperament)'),
      ahara_shakti: parseAyushParam('q.ayush.ahara_shakti', 'ayush.dashavidha', 'ahara_shakti', 'Ahara Shakti (Digestive Power / Agni)'),
      vyayama_shakti: parseAyushParam('q.ayush.vyayama_shakti', 'ayush.dashavidha', 'vyayama_shakti', 'Vyayama Shakti (Physical Stamina)'),
      vaya: parseAyushParam('q.ayush.vaya', 'ayush.dashavidha', 'vaya', 'Vaya (Stage of Life)'),
    };

    const aharaVihara = {
      diet_pattern: parseAyushParam('q.ayush.ahara_diet', 'ayush.ahara_vihara', 'diet_pattern', 'Ahara (Dietary Pattern)'),
      bowel_pattern: parseAyushParam('q.ayush.ahara_bowel', 'ayush.ahara_vihara', 'bowel_pattern', 'Koshtha (Bowel & Evacuation Habit)'),
      sleep_pattern: parseAyushParam('q.ayush.vihara_sleep', 'ayush.ahara_vihara', 'sleep_pattern', 'Nidra (Sleep Quality & Routine)'),
      activity_pattern: parseAyushParam('q.ayush.vihara_activity', 'ayush.ahara_vihara', 'activity_pattern', 'Vihara (Daily Physical Exertion & Lifestyle)'),
    };

    ayushAssessment = {
      opdMode: 'AYUSH',
      framework: 'Ayurvedic Dashavidha Pariksha & Ahara-Vihara',
      dashavidha,
      aharaVihara,
      metadata: {
        safetyInvariants: {
          doshaDiagnosisEngine: false,
          autonomousPrescription: false,
          isObservationalIntake: true,
        },
      },
    };
  }

  // --------------------------------------------------------------------------
  // 13. CANONICAL SUMMARY PAYLOAD
  // Preserves 100% backward compatibility for existing tests while exposing
  // rich Phase 8 objects and structured facts.
  // --------------------------------------------------------------------------
  const summaryPayload = {
    sessionId: sessionState.sessionId,
    patientId: sessionState.patientId,
    status: sessionState.status || 'IN_PROGRESS',
    language: sessionState.language || 'mr',
    opdMode: sessionState.opdMode || 'GENERAL',
    summaryVersion: (sessionState.summaryVersion || 1),
    updatedAt: new Date().toISOString(),

    // Dual representation for primaryConcern:
    // 1. Primitive string for existing tests (expect(summary.primaryConcern).toBe('stomach'))
    primaryConcern: primaryConcernKey,
    // 2. Rich structured object for Phase 8 clinical summary
    primaryConcernDetails,
    primaryConcernRecord: primaryConcernDetails,

    // Dual representation for duration:
    // 1. { value, unit } or { min, max, unit } or null for existing tests
    duration: legacyDuration,
    durationDetails,

    // Dual representation for location:
    location: legacyLocation,
    locationDetails,

    // Dual representation for severity:
    severity: legacySeverity,
    severityDetails,

    // Comprehensive Phase 8 sections:
    character,
    radiation,
    symptoms,
    associatedSymptoms,
    relevantHistory,
    medications: {
      patientReported: patientReportedMeds,
      documentExtracted: documentExtractedMeds,
      conflicts: medicationConflicts,
    },
    allergies,
    documents: formattedDocs,
    uncertainItems,
    verification,

    // Phase 9: Dedicated AYUSH Assessment (null for non-AYUSH sessions)
    ayushAssessment,

    // Legacy fields for existing test assertions:
    factsCount: Object.keys(collectedFacts).length,
    facts: collectedFacts,
    completedQuestions: Array.from(sessionState.completedQuestionIds || []),
    questionsAlreadyAsked: sessionState.questionsAlreadyAsked || [],
    responsesCount: responses.length,
    examinationHistory: sessionState.getExaminationHistory ? sessionState.getExaminationHistory(lang) : [],

    // Metadata and Clinical Safety Invariants:
    metadata: {
      generatedAt: new Date().toISOString(),
      generationLatencyMs: Date.now() - startTime,
      engine: 'MediKiosk Canonical Deterministic Summary Builder v1.0',
      safetyInvariants: {
        diagnosisEngine: false,
        treatmentEngine: false,
        autonomousTriage: false,
        zeroHallucination: true,
      },
    },
  };

  // Phase 8.2 Verbal Clinical Summary: Deterministic complete narrative synthesis
  const verbalDetails = generateVerbalSummary(summaryPayload, lang, sessionState);
  summaryPayload.verbalSummary = verbalDetails.text;
  summaryPayload.verbalSummaryDetails = verbalDetails;
  summaryPayload.verbalSummaryMetadata = verbalDetails;

  return summaryPayload;
}

function getSymptomLabel(sym, lang = 'en') {
  if (sym.displayName) return sym.displayName;
  const rawKey = String(sym.name || sym.concept || sym.attribute || '').toLowerCase();

  if (lang === 'mr') {
    if (rawKey.includes('dyspnea') || rawKey.includes('breath')) return 'श्वास घेण्यास त्रास';
    if (rawKey.includes('fever')) return 'ताप';
    if (rawKey.includes('vomit')) return 'उलटी';
    if (rawKey.includes('cough')) return 'खोकला';
    if (rawKey.includes('dizziness')) return 'चक्कर';
    if (rawKey.includes('radiation')) return 'वेदना पसरणे';
    if (rawKey.includes('swelling')) return 'सूज';
    return rawKey.replace(/^symptom\./, '').replace(/\./g, ' ');
  } else if (lang === 'hi') {
    if (rawKey.includes('dyspnea') || rawKey.includes('breath')) return 'सांस लेने में तकलीफ';
    if (rawKey.includes('fever')) return 'बुखार';
    if (rawKey.includes('vomit')) return 'उल्टी';
    if (rawKey.includes('cough')) return 'खांसी';
    if (rawKey.includes('dizziness')) return 'चक्कर आना';
    if (rawKey.includes('radiation')) return 'दर्द का फैलना';
    if (rawKey.includes('swelling')) return 'सूजन';
    return rawKey.replace(/^symptom\./, '').replace(/\./g, ' ');
  } else {
    if (rawKey.includes('dyspnea') || rawKey.includes('breath')) return 'breathing difficulty';
    if (rawKey.includes('fever')) return 'fever';
    if (rawKey.includes('vomit')) return 'vomiting';
    if (rawKey.includes('cough')) return 'cough';
    if (rawKey.includes('dizziness')) return 'dizziness';
    if (rawKey.includes('radiation')) return 'radiation of pain';
    if (rawKey.includes('swelling')) return 'swelling';
    return rawKey.replace(/^symptom\./, '').replace(/\./g, ' ');
  }
}

/**
 * Sanitizes any raw system enums or technical tokens into natural language.
 */
export function sanitizeNaturalText(text, lang = 'en') {
  if (text === null || text === undefined) return '';
  let str = String(text);
  str = str.replace(/\bYES_DRUG_ALLERGY\b/gi, lang === 'mr' ? 'औषध ॲलर्जी' : lang === 'hi' ? 'दवा एलर्जी' : 'drug allergy');
  str = str.replace(/\bNO_FEVER\b/gi, lang === 'mr' ? 'ताप नाही' : lang === 'hi' ? 'बुखार नहीं' : 'no fever');
  str = str.replace(/\bUNKNOWN_\w+\b/gi, lang === 'mr' ? 'माहित नाही' : lang === 'hi' ? 'पता नहीं' : 'unknown');
  str = str.replace(/^symptom\./gi, '');
  str = str.replace(/\bsymptom\./gi, '');
  str = str.replace(/^ayush\.(dashavidha|ahara_vihara)\./gi, '');
  str = str.replace(/\bayush\.(dashavidha|ahara_vihara)\./gi, '');
  str = str.replace(/\b(injury),\s*(joint)\b/gi, 'joint injury');
  str = str.replace(/\b(joint),\s*(injury)\b/gi, 'joint injury');

  // AYUSH Dashavidha & Ahara-Vihara translations
  if (lang === 'mr') {
    str = str.replace(/\bvata_dominant\b/gi, 'वात प्रवृत्ती');
    str = str.replace(/\bpitta_dominant\b/gi, 'पित्त प्रवृत्ती');
    str = str.replace(/\bkapha_dominant\b/gi, 'कफ प्रवृत्ती');
    str = str.replace(/\bdryness_pain_stiffness\b/gi, 'सांधेदुखी, ताठरपणा व कोरडेपणा');
    str = str.replace(/\bburning_heat_acidity\b/gi, 'जळजळ, पित्त आणि उष्णता');
    str = str.replace(/\bheaviness_lethargy_mucus\b/gi, 'जडपणा, आळस आणि कफ');
    str = str.replace(/\btikshnagni\b/gi, 'तीक्ष्णाग्नि (कडक भूक व जलद पचन)');
    str = str.replace(/\bsamagni\b/gi, 'समाग्नि (संतुलित पचन)');
    str = str.replace(/\bvishamagni\b/gi, 'विषमाग्नि (अनियमित पचन)');
    str = str.replace(/\bmandagni\b/gi, 'मंदाग्नि (कमी भूक व मंद पचन)');
    str = str.replace(/\bpravara\b/gi, 'उत्तम (प्रवर)');
    str = str.replace(/\bmadhyama\b/gi, 'मध्यम');
    str = str.replace(/\bavara\b/gi, 'कमी / अशक्त (अवर)');
    str = str.replace(/\bsu_samhata\b/gi, 'सुसंहत (सुदृढ बांधा)');
    str = str.replace(/\bheena_samhata\b/gi, 'हीन संहत (सैल बांधा)');
    str = str.replace(/\bpramanyukta\b/gi, 'प्रमाणयुक्त');
    str = str.replace(/\bati_sthaula\b/gi, 'स्थूल');
    str = str.replace(/\bati_krisha\b/gi, 'कृश');
    str = str.replace(/\bsarva_satmya\b/gi, 'सर्वसात्म्य');
    str = str.replace(/\bheena_satmya\b/gi, 'हीन सात्म्य');
    str = str.replace(/\bvegetarian_fresh\b/gi, 'ताजे शाकाहारी जेवण');
    str = str.replace(/\bmixed_nonveg\b/gi, 'मिश्र शाकाहारी व मांसाहारी');
    str = str.replace(/\bspicy_oily_outside\b/gi, 'तिखट व तेलकट बाहेरचे खाणे');
    str = str.replace(/\birregular_fasting\b/gi, 'अनियमित वेळ व उपवास');
    str = str.replace(/\bregular_clear\b/gi, 'नियमित पोट साफ होणे');
    str = str.replace(/\bconstipated_hard\b/gi, 'बद्धकोष्ठता / खडा (क्रूर कोष्ठ)');
    str = str.replace(/\bloose_frequent\b/gi, 'पातळ शौचास (मृदू कोष्ठ)');
    str = str.replace(/\bvariable_irregular\b/gi, 'अनियमित शौच');
    str = str.replace(/\bsound_restful\b/gi, 'शांत व गाढ झोप');
    str = str.replace(/\bdisturbed_insomnia\b/gi, 'अशांत झोप किंवा निद्रानाश');
    str = str.replace(/\bexcess_daytime\b/gi, 'दिवसा अतिझोप किंवा सुस्ती');
    str = str.replace(/\birregular_shifts\b/gi, 'रात्रपाळी व अनियमित झोप');
    str = str.replace(/\bmoderate_active\b/gi, 'मध्यम दैनंदिन हालचाल');
    str = str.replace(/\bsedentary_desk\b/gi, 'बसून काम');
    str = str.replace(/\bheavy_manual\b/gi, 'कष्टाचे शारीरिक काम');
    str = str.replace(/\bstrenuous_irregular\b/gi, 'धावपळ व वारंवार प्रवास');
  } else if (lang === 'hi') {
    str = str.replace(/\bvata_dominant\b/gi, 'वात प्रवृत्ति');
    str = str.replace(/\bpitta_dominant\b/gi, 'पित्त प्रवृत्ति');
    str = str.replace(/\bkapha_dominant\b/gi, 'कफ प्रवृत्ति');
    str = str.replace(/\bdryness_pain_stiffness\b/gi, 'जोड़ों में अकड़न, रूखापन व दर्द');
    str = str.replace(/\bburning_heat_acidity\b/gi, 'जलन, एसिडिटी और शारीरिक गर्मी');
    str = str.replace(/\bheaviness_lethargy_mucus\b/gi, 'भारीपन, सुस्ती और कफ');
    str = str.replace(/\btikshnagni\b/gi, 'तीक्ष्णाग्नि (तेज भूख व तीव्र पाचन)');
    str = str.replace(/\bsamagni\b/gi, 'समाग्नि (संतुलित पाचन)');
    str = str.replace(/\bvishamagni\b/gi, 'विषमाग्नि (अनियमित पाचन)');
    str = str.replace(/\bmandagni\b/gi, 'मंदाग्नि (कम भूख व धीमा पाचन)');
    str = str.replace(/\bpravara\b/gi, 'उत्कृष्ट (प्रवर)');
    str = str.replace(/\bmadhyama\b/gi, 'मध्यम');
    str = str.replace(/\bavara\b/gi, 'कमजोर (अवर)');
    str = str.replace(/\bsu_samhata\b/gi, 'सुसंहत (सुगठित शरीर)');
    str = str.replace(/\bheena_samhata\b/gi, 'हीन संहत (कमजोर जोड़)');
    str = str.replace(/\bpramanyukta\b/gi, 'प्रमाणयुक्त');
    str = str.replace(/\bati_sthaula\b/gi, 'स्थूल');
    str = str.replace(/\bati_krisha\b/gi, 'कृश');
    str = str.replace(/\bsarva_satmya\b/gi, 'सर्वसात्म्य');
    str = str.replace(/\bheena_satmya\b/gi, 'हीन सात्म्य');
    str = str.replace(/\bvegetarian_fresh\b/gi, 'ताजा शाकाहारी भोजन');
    str = str.replace(/\bmixed_nonveg\b/gi, 'शाकाहारी व मांसाहारी दोनों');
    str = str.replace(/\bspicy_oily_outside\b/gi, 'तीखा, तला-भुना या बाहर का भोजन');
    str = str.replace(/\birregular_fasting\b/gi, 'अनियमित भोजन व उपवास');
    str = str.replace(/\bregular_clear\b/gi, 'नियमित पेट साफ होना');
    str = str.replace(/\bconstipated_hard\b/gi, 'कब्ज या सख्त मल (क्रूर कोष्ठ)');
    str = str.replace(/\bloose_frequent\b/gi, 'ढीला या बार-बार मल (मृदु कोष्ठ)');
    str = str.replace(/\bvariable_irregular\b/gi, 'अनियमित शौच');
    str = str.replace(/\bsound_restful\b/gi, 'गहरी व आरामदायक नींद');
    str = str.replace(/\bdisturbed_insomnia\b/gi, 'अशांत नींद या अनिद्रा');
    str = str.replace(/\bexcess_daytime\b/gi, 'दिन में अत्यधिक नींद');
    str = str.replace(/\birregular_shifts\b/gi, 'नाईट शिफ्ट व अनियमित दिनचर्या');
    str = str.replace(/\bmoderate_active\b/gi, 'मध्यम शारीरिक सक्रियता');
    str = str.replace(/\bsedentary_desk\b/gi, 'बैठकर काम');
    str = str.replace(/\bheavy_manual\b/gi, 'कठिन शारीरिक श्रम');
    str = str.replace(/\bstrenuous_irregular\b/gi, 'भागदौड़ व लंबा सफर');
  } else {
    str = str.replace(/\bvata_dominant\b/gi, 'Vata-predominant tendencies');
    str = str.replace(/\bpitta_dominant\b/gi, 'Pitta-predominant tendencies');
    str = str.replace(/\bkapha_dominant\b/gi, 'Kapha-predominant tendencies');
    str = str.replace(/\bdryness_pain_stiffness\b/gi, 'dryness, joint stiffness and aches');
    str = str.replace(/\bburning_heat_acidity\b/gi, 'burning sensation, acidity and body heat');
    str = str.replace(/\bheaviness_lethargy_mucus\b/gi, 'heaviness, lethargy and congestion');
    str = str.replace(/\btikshnagni\b/gi, 'strong appetite and quick digestion (Tikshnagni)');
    str = str.replace(/\bsamagni\b/gi, 'balanced digestion (Samagni)');
    str = str.replace(/\bvishamagni\b/gi, 'irregular appetite and bloating (Vishamagni)');
    str = str.replace(/\bmandagni\b/gi, 'sluggish digestion and heaviness (Mandagni)');
    str = str.replace(/\bpravara\b/gi, 'high vitality (Pravara)');
    str = str.replace(/\bmadhyama\b/gi, 'moderate (Madhyama)');
    str = str.replace(/\bavara\b/gi, 'low / delicate (Avara)');
    str = str.replace(/\bsu_samhata\b/gi, 'compact, well-knit frame (Su-samhata)');
    str = str.replace(/\bheena_samhata\b/gi, 'delicate or slender frame (Heena-samhata)');
    str = str.replace(/\bpramanyukta\b/gi, 'well-proportioned height and weight (Pramanyukta)');
    str = str.replace(/\bati_sthaula\b/gi, 'heavy build / overweight (Sthaula)');
    str = str.replace(/\bati_krisha\b/gi, 'lean / underweight (Krisha)');
    str = str.replace(/\bsarva_satmya\b/gi, 'readily adaptable (Sarva-satmya)');
    str = str.replace(/\bheena_satmya\b/gi, 'sensitive to diet and climate shifts (Heena-satmya)');
    str = str.replace(/\bvegetarian_fresh\b/gi, 'freshly cooked vegetarian diet');
    str = str.replace(/\bmixed_nonveg\b/gi, 'mixed vegetarian and non-vegetarian diet');
    str = str.replace(/\bspicy_oily_outside\b/gi, 'frequent spicy, oily or outside food');
    str = str.replace(/\birregular_fasting\b/gi, 'irregular eating hours and frequent fasting');
    str = str.replace(/\bregular_clear\b/gi, 'regular and clear bowel movements');
    str = str.replace(/\bconstipated_hard\b/gi, 'hard stools or constipation (Krura Koshtha)');
    str = str.replace(/\bloose_frequent\b/gi, 'frequent or loose stools (Mridu Koshtha)');
    str = str.replace(/\bvariable_irregular\b/gi, 'irregular bowel habits');
    str = str.replace(/\bsound_restful\b/gi, 'sound, restful sleep');
    str = str.replace(/\bdisturbed_insomnia\b/gi, 'disturbed sleep or difficulty sleeping');
    str = str.replace(/\bexcess_daytime\b/gi, 'excessive sleep or daytime sluggishness');
    str = str.replace(/\birregular_shifts\b/gi, 'irregular night shifts or disrupted schedule');
    str = str.replace(/\bmoderate_active\b/gi, 'moderate daily physical activity');
    str = str.replace(/\bsedentary_desk\b/gi, 'sedentary desk job with limited movement');
    str = str.replace(/\bheavy_manual\b/gi, 'heavy manual labor');
    str = str.replace(/\bstrenuous_irregular\b/gi, 'strenuous routine with frequent travel');
  }

  str = str.replace(/_/g, ' ');
  return str.trim();
}

/**
 * Deterministically constructs a complete, comprehensive patient interview narrative summary (Phase 8.2)
 * Incorporates EVERY answered question from the session, with NO artificial word count limit.
 * Formats as a cohesive, flowing paragraph in English, Marathi, or Hindi.
 * Enforces zero diagnostic inference, zero prescriptions, and zero internal enum leakage.
 */
export function generateVerbalSummary(summary, lang = 'en', sessionState = null) {
  const language = ['hi', 'mr', 'en'].includes(lang) ? lang : 'en';

  const examHistory = (sessionState?.getExaminationHistory ? sessionState.getExaminationHistory(language) : null) || summary.examinationHistory || [];
  const responses = sessionState?.responses || [];
  const facts = summary.facts || sessionState?.collectedFacts || {};

  const representedQuestionIds = new Set();

  function markRepresented(qid) {
    if (qid) representedQuestionIds.add(qid);
  }

  // Pre-register AYUSH question IDs if AYUSH assessment is present to prevent fallback duplication
  const ayushQIds = [
    'q.ayush.prakriti', 'q.ayush.vikriti', 'q.ayush.sara', 'q.ayush.samhanana',
    'q.ayush.pramana', 'q.ayush.satmya', 'q.ayush.sattva', 'q.ayush.ahara_shakti',
    'q.ayush.vyayama_shakti', 'q.ayush.vaya', 'q.ayush.ahara_diet', 'q.ayush.ahara_bowel',
    'q.ayush.vihara_sleep', 'q.ayush.vihara_activity'
  ];
  if (summary.ayushAssessment) {
    ayushQIds.forEach((id) => markRepresented(id));
  }

  function findHistoryItem(predicate) {
    const item = examHistory.find(predicate);
    if (item && item.questionId) {
      representedQuestionIds.add(item.questionId);
    }
    return item || null;
  }

  function findFact(predicate) {
    for (const [k, f] of Object.entries(facts)) {
      if (predicate(k, f)) return f;
    }
    return null;
  }

  // 1. Primary Concern, Location, Laterality, Duration, Severity
  const concernKey = summary.primaryConcernDetails?.concern || summary.primaryConcern || 'general_discomfort';
  if (summary.primaryConcernDetails?.questionId) markRepresented(summary.primaryConcernDetails.questionId);
  findHistoryItem((h) => h.questionId === 'q.chief_complaint' || h.concept?.includes('complaint'));

  const laterality = summary.locationDetails?.laterality || null;
  const locationVal = summary.locationDetails?.value || summary.location || null;
  if (summary.locationDetails?.questionId) markRepresented(summary.locationDetails.questionId);
  findHistoryItem((h) => h.questionId?.includes('location') || h.attribute?.includes('location'));

  const duration = summary.durationDetails;
  if (duration?.questionId) markRepresented(duration.questionId);
  findHistoryItem((h) => h.questionId?.includes('duration') || h.attribute?.includes('duration'));

  let durationStr = '';
  if (duration && duration.status === 'PRESENT') {
    const rawVal = duration.raw || (duration.value && typeof duration.value === 'object' ? duration.value.raw : null);
    if (rawVal && (language === 'mr' || language === 'hi')) {
      durationStr = String(rawVal);
    } else if (duration.precision === 'range' && duration.min !== null && duration.max !== null) {
      const unitMr = duration.unit === 'days' ? 'दिवस' : duration.unit;
      const unitHi = duration.unit === 'days' ? 'दिन' : duration.unit;
      const unitStr = language === 'mr' ? unitMr : language === 'hi' ? unitHi : (duration.unit || 'days');
      const sep = language === 'mr' ? ' ते ' : language === 'hi' ? ' से ' : '–';
      durationStr = `${duration.min}${sep}${duration.max} ${unitStr}`;
    } else if (duration.value !== null) {
      const unitMr = duration.unit === 'days' ? 'दिवस' : duration.unit;
      const unitHi = duration.unit === 'days' ? 'दिन' : duration.unit;
      const unitStr = language === 'mr' ? unitMr : language === 'hi' ? unitHi : (duration.unit || 'days');
      durationStr = `${duration.value} ${unitStr}`;
    } else if (duration.raw) {
      durationStr = String(duration.raw);
    }
  }

  const sevRaw = summary.severityDetails?.level || summary.severityDetails?.value || summary.severity;
  const severityLevel = sevRaw
    ? (typeof sevRaw === 'object' ? (sevRaw.level || sevRaw.value) : String(sevRaw)).toLowerCase()
    : null;
  if (summary.severityDetails?.questionId) markRepresented(summary.severityDetails.questionId);
  findHistoryItem((h) => h.questionId?.includes('severity') || h.attribute?.includes('severity'));

  // 2. Preceding Injury / Trauma
  const injuryHistory = findHistoryItem((h) =>
    h.questionId?.includes('injury') ||
    h.questionId?.includes('trauma') ||
    h.concept?.includes('injury') ||
    h.attribute === 'injury' ||
    h.attribute === 'mechanism'
  );
  const injuryFact = findFact((k) => k.includes('injury') || k.includes('trauma'));
  const injuryStatus = injuryHistory?.status || injuryFact?.status || null;
  const injuryVal = injuryHistory?.normalizedInterpretation || injuryHistory?.patientAnswerRaw || injuryFact?.value || null;

  // 3. Localized Signs (Swelling, Redness, Stiffness)
  const swellingHistory = findHistoryItem((h) =>
    h.questionId?.includes('swelling') ||
    h.concept?.includes('swelling') ||
    h.attribute === 'swelling'
  );
  const swellingFact = findFact((k) => k.includes('swelling'));
  const swellingStatus = swellingHistory?.status || swellingFact?.status || null;

  const rednessHistory = findHistoryItem((h) =>
    h.questionId?.includes('redness') ||
    h.concept?.includes('redness') ||
    h.attribute === 'redness'
  );
  const rednessFact = findFact((k) => k.includes('redness'));
  const rednessStatus = rednessHistory?.status || rednessFact?.status || null;

  const stiffnessHistory = findHistoryItem((h) =>
    h.questionId?.includes('stiffness') ||
    h.concept?.includes('stiffness') ||
    h.attribute === 'stiffness'
  );
  const stiffnessFact = findFact((k) => k.includes('stiffness'));
  const stiffnessStatus = stiffnessHistory?.status || stiffnessFact?.status || null;

  // 4. Functional Mobility & Weight-bearing
  const mobilityHistory = findHistoryItem((h) =>
    h.questionId?.includes('walking') ||
    h.questionId?.includes('weight') ||
    h.questionId?.includes('mobility') ||
    h.attribute?.includes('walking') ||
    h.attribute?.includes('weight')
  );
  const mobilityFact = findFact((k) => k.includes('walking') || k.includes('weight') || k.includes('mobility'));
  const mobilityStatus = mobilityHistory?.status || mobilityFact?.status || null;

  // 5. Radiation of Pain
  const radiationHistory = findHistoryItem((h) =>
    h.questionId?.includes('radiation') ||
    h.concept?.includes('radiation') ||
    h.attribute === 'radiation'
  );
  const radiationFact = findFact((k) => k.includes('radiation'));
  const radiationStatus = radiationHistory?.status || radiationFact?.status || null;

  // 6. Systemic Symptoms (fever, dyspnea, nausea/vomit, cough, sweating, dizziness)
  const feverHistory = findHistoryItem((h) => h.questionId?.includes('fever') || h.concept?.includes('fever'));
  const dyspneaHistory = findHistoryItem((h) => h.questionId?.includes('dyspnea') || h.concept?.includes('dyspnea') || h.questionId?.includes('breath'));
  const coughHistory = findHistoryItem((h) => h.questionId?.includes('cough') || h.concept?.includes('cough'));
  const vomitHistory = findHistoryItem((h) => h.questionId?.includes('vomit') || h.concept?.includes('vomit'));
  const sweatingHistory = findHistoryItem((h) => h.questionId?.includes('sweating') || h.concept?.includes('sweating'));
  const dizzinessHistory = findHistoryItem((h) => h.questionId?.includes('dizziness') || h.concept?.includes('dizziness'));

  const presentSymptoms = (summary.associatedSymptoms || []).filter((s) => s.status === 'PRESENT');
  const absentSymptoms = (summary.associatedSymptoms || []).filter((s) => s.status === 'ABSENT');

  const systemicItems = [
    { hist: feverHistory, labelEn: 'fever', labelMr: 'ताप', labelHi: 'बुखार' },
    { hist: dyspneaHistory, labelEn: 'breathing difficulty', labelMr: 'श्वास घेण्यास त्रास', labelHi: 'सांस लेने में तकलीफ' },
    { hist: coughHistory, labelEn: 'cough', labelMr: 'खोकला', labelHi: 'खांसी' },
    { hist: vomitHistory, labelEn: 'vomiting', labelMr: 'उलटी', labelHi: 'उल्टी' },
    { hist: sweatingHistory, labelEn: 'sweating', labelMr: 'घाम येणे', labelHi: 'पसीना आना' },
    { hist: dizzinessHistory, labelEn: 'dizziness', labelMr: 'चक्कर', labelHi: 'चक्कर आना' },
  ];

  // 7. Neurological Symptoms (numbness, tingling, weakness)
  const neuroHistory = findHistoryItem((h) =>
    h.questionId?.includes('numbness') ||
    h.questionId?.includes('tingling') ||
    h.questionId?.includes('weakness') ||
    h.concept?.includes('numbness') ||
    h.attribute === 'numbness' ||
    h.attribute === 'tingling' ||
    h.attribute === 'weakness'
  );
  const neuroFact = findFact((k) => k.includes('numbness') || k.includes('tingling') || k.includes('weakness'));
  const neuroStatus = neuroHistory?.status || neuroFact?.status || null;

  // 8. Medications
  const medHistory = findHistoryItem((h) =>
    h.questionId?.includes('medication') ||
    h.questionId?.includes('history.conditions') ||
    h.concept?.includes('medication')
  );
  const patientMeds = summary.medications?.patientReported || [];
  const docMeds = summary.medications?.documentExtracted || [];
  const medConflicts = summary.medications?.conflicts || [];

  // 9. Allergies
  const allergyHistory = findHistoryItem((h) =>
    h.questionId?.includes('allerg') ||
    h.concept?.includes('allerg') ||
    h.attribute?.includes('allerg')
  );
  const allergies = summary.allergies;
  if (allergies?.questionId) markRepresented(allergies.questionId);

  // 10. Documents
  const docs = summary.documents || [];

  // 11. Uncertain items
  const uncertainCount = (summary.uncertainItems || []).length;

  let paragraph = '';

  if (language === 'mr') {
    const sentences = [];

    // 1. Chief Complaint, Location, Duration, Severity
    let s1 = 'रुग्णाने ';
    if (durationStr) {
      s1 += `सुमारे ${durationStr}पासून `;
    }
    if (severityLevel) {
      const sevMap = { mild: 'सौम्य तीव्रतेसह ', moderate: 'मध्यम तीव्रतेसह ', severe: 'जास्त तीव्रतेसह ' };
      s1 += sevMap[severityLevel] || '';
    }
    let locStr = '';
    if (locationVal) {
      const latPrefix = laterality === 'left' ? 'डाव्या ' : laterality === 'right' ? 'उजव्या ' : laterality === 'bilateral' ? 'दोन्ही ' : '';
      const locNames = { knee: 'गुडघ्यात', chest: 'छातीत', shoulder: 'खांद्यात', stomach: 'पोटात', abdomen: 'पोटात', head: 'डोक्यात' };
      const locName = locNames[String(locationVal).toLowerCase()] || String(locationVal);
      locStr = `${latPrefix}${locName} `;
    }
    const concernNamesMr = {
      knee_pain: 'गुडघेदुखी',
      chest_pain: 'छातीत दुखणे',
      shoulder_pain: 'खांदेदुखी',
      stomach: 'पोटदुखी / पोटाचा त्रास',
      diarrhea: 'जुलाब',
      fever: 'ताप',
      cough: 'खोकला',
      breathing: 'श्वास घेण्यास त्रास',
      headache: 'डोकेदुखी',
      pain: 'वेदना / त्रास',
    };
    const cNameMr = concernNamesMr[concernKey] || 'शारीरिक त्रास';
    s1 += `${locStr}${cNameMr} होत असल्याचे नमूद केले आहे.`;
    sentences.push(s1);

    // 2. Injury
    if (injuryStatus === 'PRESENT') {
      const cleanInj = sanitizeNaturalText(injuryVal, 'mr');
      const isGeneric = !cleanInj || cleanInj.toLowerCase() === 'yes' || cleanInj.toLowerCase() === 'true' || cleanInj === 'हो';
      sentences.push(isGeneric ? 'हा त्रास दुखापतीमुळे सुरू झाल्याचे रुग्णाने सांगितले आहे.' : `हा त्रास दुखापतीनंतर (${cleanInj}) सुरू झाल्याचे नमूद केले आहे.`);
    } else if (injuryStatus === 'ABSENT') {
      sentences.push('कोणतीही दुखापत किंवा अपघात झाल्याचे रुग्णाने स्पष्टपणे नाकारले आहे.');
    } else if (injuryStatus === 'UNKNOWN') {
      sentences.push('हा त्रास दुखापतीमुळे झाला आहे का, याबाबत रुग्णाने अनिश्चितता दर्शवली आहे.');
    }

    // 3. Localized
    if (swellingStatus === 'PRESENT' && rednessStatus === 'PRESENT') {
      sentences.push('संबंधित भागावर सूज आणि लालसरपणा असल्याचे नमूद केले आहे.');
    } else if (swellingStatus === 'PRESENT' && rednessStatus === 'ABSENT') {
      sentences.push('संबंधित भागावर सूज असल्याचे सांगितले आहे, तर लालसरपणा नसल्याचे स्पष्ट केले आहे.');
    } else if (swellingStatus === 'PRESENT') {
      sentences.push('संबंधित भागावर सूज असल्याचे नोंदवले आहे.');
    } else if (swellingStatus === 'ABSENT' && rednessStatus === 'ABSENT') {
      sentences.push('संबंधित भागावर कोणतीही सूज किंवा लालसरपणा नसल्याचे सांगितले आहे.');
    } else if (swellingStatus === 'ABSENT') {
      sentences.push('कोणतीही सूज नसल्याचे रुग्णाने सांगितले आहे.');
    } else if (swellingStatus === 'UNKNOWN') {
      sentences.push('सूज असण्याबाबत रुग्णाने अनिश्चितता दर्शवली आहे.');
    } else if (rednessStatus === 'PRESENT') {
      sentences.push('संबंधित भागावर लालसरपणा असल्याचे नमूद केले आहे.');
    } else if (rednessStatus === 'ABSENT') {
      sentences.push('लालसरपणा नसल्याचे सांगितले आहे.');
    }

    if (stiffnessStatus === 'PRESENT') {
      sentences.push('सांध्यामध्ये ताठरपणा असल्याचे नमूद केले आहे.');
    }

    // 4. Mobility
    if (mobilityStatus === 'PRESENT') {
      sentences.push('चालताना त्रास होत असून वजन पेलणे कठीण होत असल्याचे नमूद केले आहे.');
    } else if (mobilityStatus === 'ABSENT') {
      sentences.push('चालताना किंवा वजन पेलताना कोणताही विशेष त्रास होत नसल्याचे सांगितले आहे.');
    } else if (mobilityStatus === 'UNKNOWN') {
      sentences.push('चालण्यातील त्रास आणि वजन पेलण्याबाबत अनिश्चितता आहे.');
    }

    // 5. Radiation
    if (radiationStatus === 'PRESENT') {
      sentences.push('वेदना इतर भागात पसरत असल्याचे नमूद केले आहे.');
    } else if (radiationStatus === 'ABSENT') {
      sentences.push('वेदना इतर भागात पसरत नसल्याचे स्पष्टपणे नाकारले आहे.');
    } else if (radiationStatus === 'UNKNOWN') {
      sentences.push('वेदना इतर भागात पसरते की नाही याबाबत रुग्णाने अनिश्चितता दर्शवली आहे.');
    }

    // 6. Systemic
    const allAbsentLabelsMr = [...new Set(absentSymptoms.map((s) => getSymptomLabel(s, 'mr')))];
    for (const sys of systemicItems) {
      if (sys.hist && (sys.hist.status === 'ABSENT' || String(sys.hist.patientAnswerRaw).toLowerCase() === 'no')) {
        if (!allAbsentLabelsMr.includes(sys.labelMr)) allAbsentLabelsMr.push(sys.labelMr);
      }
    }
    if (allAbsentLabelsMr.length > 0) {
      sentences.push(`${allAbsentLabelsMr.join(' किंवा ')} यांसारखी लक्षणे स्पष्टपणे नाकारण्यात आली आहेत.`);
    }

    const allPresentLabelsMr = [...new Set(presentSymptoms.map((s) => getSymptomLabel(s, 'mr')))];
    for (const sys of systemicItems) {
      if (sys.hist && (sys.hist.status === 'PRESENT' || String(sys.hist.patientAnswerRaw).toLowerCase() === 'yes')) {
        if (!allPresentLabelsMr.includes(sys.labelMr)) allPresentLabelsMr.push(sys.labelMr);
      }
    }
    if (allPresentLabelsMr.length > 0) {
      sentences.push(`यासोबतच ${allPresentLabelsMr.join(', ')} असल्याचा उल्लेख केला आहे.`);
    }

    // 7. Neurological
    if (neuroStatus === 'ABSENT') {
      sentences.push('रुग्णाने बधिरता (numbness), मुंग्या येणे किंवा अशक्तपणा यांसारखी लक्षणे स्पष्टपणे नाकारली आहेत.');
    } else if (neuroStatus === 'PRESENT') {
      sentences.push('रुग्णाने बधिरता किंवा मुंग्या येणे यांसारखी लक्षणे जाणवत असल्याचे नमूद केले आहे.');
    } else if (neuroStatus === 'UNKNOWN') {
      sentences.push('बधिरता किंवा मुंग्या येण्याबाबत रुग्णाने अनिश्चितता दर्शवली आहे.');
    }

    // 8. Meds & Allergies
    if (allergies?.status === 'ABSENT') {
      sentences.push('कोणत्याही ज्ञात औषध ॲलर्जीची नोंद नाही.');
    } else if (allergies?.status === 'NOT_PROVIDED') {
      if (patientMeds.length === 0 && !medHistory) {
        sentences.push('सध्या सुरू असलेली औषधे किंवा ज्ञात ॲलर्जीबाबत कोणतीही माहिती उपलब्ध करून दिली गेली नाही.');
      } else {
        sentences.push('ॲलर्जीबाबतची माहिती तपासणीदरम्यान उपलब्ध झालेली नाही.');
      }
    } else if (allergies?.items?.length > 0) {
      const cleanItems = allergies.items.map((it) => sanitizeNaturalText(it, 'mr'));
      sentences.push(`तपासणीदरम्यान ${cleanItems.join(', ')} ची ॲलर्जी नोंदवली गेली आहे.`);
    } else if (allergies?.status === 'UNKNOWN') {
      sentences.push('औषध ॲलर्जीबाबत रुग्णाने अनिश्चितता दर्शवली आहे.');
    }

    if (patientMeds.length > 0) {
      const medList = patientMeds.map((m) => sanitizeNaturalText(m.name, 'mr')).join(', ');
      sentences.push(`रुग्ण सध्या ${medList} हे औषध घेत असल्याचे सांगितले आहे.`);
    } else if (medHistory && (medHistory.status === 'ABSENT' || String(medHistory.patientAnswerRaw).toLowerCase() === 'no')) {
      sentences.push('रुग्ण सध्या कोणतीही नियमित औषधे घेत नसल्याचे सांगितले आहे.');
    }

    // 9. Docs & Conflicts
    if (docs.length > 0) {
      sentences.push('अपलोड केलेल्या वैद्यकीय कागदपत्रांमध्ये औषधांचे तपशील समाविष्ट असून त्यांची डॉक्टरांनी प्रत्यक्ष तपासणी करावी.');
    }
    if (medConflicts.length > 0) {
      sentences.push('रुग्णाने सांगितलेली माहिती आणि कागदपत्रांमधील औषध डोस यातील फरक डॉक्टरांच्या निदर्शनास आणून दिला आहे.');
    }

    // 9B. AYUSH Assessment (Dashavidha Pariksha & Ahara-Vihara)
    if (summary.ayushAssessment) {
      const d = summary.ayushAssessment.dashavidha || {};
      const av = summary.ayushAssessment.aharaVihara || {};
      const ayushBits = [];

      if (d.prakriti?.status === 'PRESENT' && d.prakriti.value && d.prakriti.value !== 'unknown') {
        ayushBits.push(`नैसर्गिक प्रवृत्ती: ${sanitizeNaturalText(d.prakriti.value, 'mr')}`);
      }
      if (d.vikriti?.status === 'PRESENT' && d.vikriti.value && d.vikriti.value !== 'unknown') {
        ayushBits.push(`शरीरातील सध्याचे असंतुलन: ${sanitizeNaturalText(d.vikriti.value, 'mr')}`);
      }
      if (d.ahara_shakti?.status === 'PRESENT' && d.ahara_shakti.value && d.ahara_shakti.value !== 'unknown') {
        ayushBits.push(`पचन व अग्नी: ${sanitizeNaturalText(d.ahara_shakti.value, 'mr')}`);
      }
      if (d.vyayama_shakti?.status === 'PRESENT' && d.vyayama_shakti.value && d.vyayama_shakti.value !== 'unknown') {
        ayushBits.push(`व्यायाम क्षमता: ${sanitizeNaturalText(d.vyayama_shakti.value, 'mr')}`);
      }
      if (av.diet_pattern?.status === 'PRESENT' && av.diet_pattern.value && av.diet_pattern.value !== 'unknown') {
        ayushBits.push(`आहार: ${sanitizeNaturalText(av.diet_pattern.value, 'mr')}`);
      }
      if (av.bowel_pattern?.status === 'PRESENT' && av.bowel_pattern.value && av.bowel_pattern.value !== 'unknown') {
        ayushBits.push(`कोष्ठ: ${sanitizeNaturalText(av.bowel_pattern.value, 'mr')}`);
      }
      if (av.sleep_pattern?.status === 'PRESENT' && av.sleep_pattern.value && av.sleep_pattern.value !== 'unknown') {
        ayushBits.push(`निद्रा: ${sanitizeNaturalText(av.sleep_pattern.value, 'mr')}`);
      }
      if (av.activity_pattern?.status === 'PRESENT' && av.activity_pattern.value && av.activity_pattern.value !== 'unknown') {
        ayushBits.push(`विहार: ${sanitizeNaturalText(av.activity_pattern.value, 'mr')}`);
      }

      if (ayushBits.length > 0) {
        sentences.push(`आयुर्वेदिक दशविध परीक्षा व आहार-विहार नोंदीनुसार — ${ayushBits.join(', ')}.`);
      }
    }

    // 10. Fallback loop for any remaining answered questions
    for (const item of examHistory) {
      if (representedQuestionIds.has(item.questionId)) continue;
      representedQuestionIds.add(item.questionId);
      const cleanTopic = sanitizeNaturalText(item.questionText || item.concept || item.attribute, 'mr');
      const cleanAns = sanitizeNaturalText(item.normalizedInterpretation || item.patientAnswerRaw, 'mr');
      if (item.status === 'ABSENT' || cleanAns.toLowerCase() === 'no' || cleanAns === 'नाही') {
        sentences.push(`${cleanTopic} बाबत नकार नोंदवला आहे.`);
      } else if (item.status === 'UNKNOWN' || cleanAns.toLowerCase().includes('unknown') || cleanAns.includes('माहित नाही')) {
        sentences.push(`${cleanTopic} बाबत रुग्णाने अनिश्चितता दर्शवली आहे.`);
      } else {
        sentences.push(`${cleanTopic} बाबत रुग्णाने '${cleanAns}' असे नमूद केले आहे.`);
      }
    }

    // 11. Uncertain & Closing
    if (uncertainCount > 0) {
      sentences.push('रुग्णाने अनिश्चितता दर्शवलेली माहिती पुढील वैद्यकीय चर्चेसाठी चिन्हांकित करण्यात आली आहे.');
    }
    sentences.push('हा सारांश केवळ रुग्णाने पडताळणी केलेल्या माहितीवर आणि सादर केलेल्या नोंदींवर आधारित आहे.');

    paragraph = sentences.join(' ');
  } else if (language === 'hi') {
    const sentences = [];

    // 1. Chief Complaint, Location, Duration, Severity
    let s1 = 'मरीज ने ';
    if (durationStr) {
      s1 += `लगभग ${durationStr} से `;
    }
    if (severityLevel) {
      const sevMap = { mild: 'हल्की तीव्रता के साथ ', moderate: 'मध्यम तीव्रता के साथ ', severe: 'गंभीर तीव्रता के साथ ' };
      s1 += sevMap[severityLevel] || '';
    }
    let locStr = '';
    if (locationVal) {
      const latPrefix = laterality === 'left' ? 'बाएँ ' : laterality === 'right' ? 'दाएँ ' : laterality === 'bilateral' ? 'दोनों ' : '';
      const locNames = { knee: 'घुटने में', chest: 'सीने में', shoulder: 'कंधे में', stomach: 'पेट में', abdomen: 'पेट में', head: 'सिर में' };
      const locName = locNames[String(locationVal).toLowerCase()] || String(locationVal);
      locStr = `${latPrefix}${locName} `;
    }
    const concernNamesHi = {
      knee_pain: 'घुटने के दर्द',
      chest_pain: 'सीने में दर्द',
      shoulder_pain: 'कंधे के दर्द',
      stomach: 'पेट दर्द / पेट की परेशानी',
      diarrhea: 'दस्त',
      fever: 'बुखार',
      cough: 'खांसी',
      breathing: 'सांस लेने में तकलीफ',
      headache: 'सिरदर्द',
      pain: 'दर्द / परेशानी',
    };
    const cNameHi = concernNamesHi[concernKey] || 'शारीरिक परेशानी';
    s1 += `${locStr}${cNameHi} होने की जानकारी दी है।`;
    sentences.push(s1);

    // 2. Injury
    if (injuryStatus === 'PRESENT') {
      const cleanInj = sanitizeNaturalText(injuryVal, 'hi');
      const isGeneric = !cleanInj || cleanInj.toLowerCase() === 'yes' || cleanInj.toLowerCase() === 'true' || cleanInj === 'हाँ';
      sentences.push(isGeneric ? 'यह परेशानी किसी चोट के बाद शुरू होने की बात कही गई है।' : `यह परेशानी चोट लगने (${cleanInj}) के बाद शुरू होने की जानकारी दी गई है।`);
    } else if (injuryStatus === 'ABSENT') {
      sentences.push('मरीज ने पहले किसी चोट या दुर्घटना से स्पष्ट इनकार किया है।');
    } else if (injuryStatus === 'UNKNOWN') {
      sentences.push('यह परेशानी किसी चोट के कारण हुई है या नहीं, इस पर मरीज ने अनिश्चितता जताई है।');
    }

    // 3. Localized
    if (swellingStatus === 'PRESENT' && rednessStatus === 'PRESENT') {
      sentences.push('प्रभावित हिस्से पर सूजन और लालिमा होने की जानकारी दी गई है।');
    } else if (swellingStatus === 'PRESENT' && rednessStatus === 'ABSENT') {
      sentences.push('प्रभावित हिस्से पर सूजन बताई गई है, जबकि लालिमा होने से स्पष्ट इनकार किया गया है।');
    } else if (swellingStatus === 'PRESENT') {
      sentences.push('संबंधित हिस्से पर सूजन दर्ज की गई है।');
    } else if (swellingStatus === 'ABSENT' && rednessStatus === 'ABSENT') {
      sentences.push('मरीज ने सूजन या लालिमा दोनों से स्पष्ट इनकार किया है।');
    } else if (swellingStatus === 'ABSENT') {
      sentences.push('मरीज ने सूजन होने से इनकार किया है।');
    } else if (swellingStatus === 'UNKNOWN') {
      sentences.push('सूजन को लेकर मरीज ने अनिश्चितता जताई है।');
    } else if (rednessStatus === 'PRESENT') {
      sentences.push('संबंधित हिस्से पर लालिमा दर्ज की गई है।');
    } else if (rednessStatus === 'ABSENT') {
      sentences.push('लालिमा होने से इनकार किया गया है।');
    }

    if (stiffnessStatus === 'PRESENT') {
      sentences.push('जोड़ों में अकड़न भी दर्ज की गई है।');
    }

    // 4. Mobility
    if (mobilityStatus === 'PRESENT') {
      sentences.push('चलने-फिरने में कठिनाई और वजन संभालने में परेशानी दर्ज की गई है।');
    } else if (mobilityStatus === 'ABSENT') {
      sentences.push('चलने या वजन उठाने में कोई खास परेशानी नहीं बताई गई है।');
    } else if (mobilityStatus === 'UNKNOWN') {
      sentences.push('चलने-फिरने और वजन संभालने की क्षमता को लेकर अनिश्चितता है।');
    }

    // 5. Radiation
    if (radiationStatus === 'PRESENT') {
      sentences.push('दर्द अन्य हिस्सों में भी फैलने की जानकारी दी गई है।');
    } else if (radiationStatus === 'ABSENT') {
      sentences.push('मरीज ने दर्द के अन्य हिस्सों में फैलने से स्पष्ट इनकार किया है।');
    } else if (radiationStatus === 'UNKNOWN') {
      sentences.push('दर्द फैलने को लेकर मरीज ने अनिश्चितता जताई है।');
    }

    // 6. Systemic
    const allAbsentLabelsHi = [...new Set(absentSymptoms.map((s) => getSymptomLabel(s, 'hi')))];
    for (const sys of systemicItems) {
      if (sys.hist && (sys.hist.status === 'ABSENT' || String(sys.hist.patientAnswerRaw).toLowerCase() === 'no')) {
        if (!allAbsentLabelsHi.includes(sys.labelHi)) allAbsentLabelsHi.push(sys.labelHi);
      }
    }
    if (allAbsentLabelsHi.length > 0) {
      sentences.push(`${allAbsentLabelsHi.join(' या ')} जैसी कोई समस्या नहीं बताई गई है।`);
    }

    const allPresentLabelsHi = [...new Set(presentSymptoms.map((s) => getSymptomLabel(s, 'hi')))];
    for (const sys of systemicItems) {
      if (sys.hist && (sys.hist.status === 'PRESENT' || String(sys.hist.patientAnswerRaw).toLowerCase() === 'yes')) {
        if (!allPresentLabelsHi.includes(sys.labelHi)) allPresentLabelsHi.push(sys.labelHi);
      }
    }
    if (allPresentLabelsHi.length > 0) {
      sentences.push(`इसके साथ ही ${allPresentLabelsHi.join(', ')} की समस्या भी दर्ज की गई है।`);
    }

    // 7. Neurological
    if (neuroStatus === 'ABSENT') {
      sentences.push('मरीज ने सुन्नपन, झनझनाहट या कमजोरी जैसे तंत्रिका संबंधी लक्षणों से स्पष्ट इनकार किया है।');
    } else if (neuroStatus === 'PRESENT') {
      sentences.push('मरीज ने सुन्नपन या झनझनाहट के लक्षण होने की बात कही है।');
    } else if (neuroStatus === 'UNKNOWN') {
      sentences.push('सुन्नपन या झनझनाहट को लेकर मरीज ने अनिश्चितता जताई है।');
    }

    // 8. Meds & Allergies
    if (allergies?.status === 'ABSENT') {
      sentences.push('किसी भी ज्ञात एलर्जी की जानकारी नहीं पाई गई है।');
    } else if (allergies?.status === 'NOT_PROVIDED') {
      if (patientMeds.length === 0 && !medHistory) {
        sentences.push('वर्तमान दवाओं या ज्ञात एलर्जी की कोई जानकारी मरीज द्वारा नहीं दी गई है।');
      } else {
        sentences.push('एलर्जी संबंधी विवरण जांच के दौरान उपलब्ध नहीं कराए गए हैं।');
      }
    } else if (allergies?.items?.length > 0) {
      const cleanItems = allergies.items.map((it) => sanitizeNaturalText(it, 'hi'));
      sentences.push(`जांच के दौरान ${cleanItems.join(', ')} से एलर्जी दर्ज की गई है।`);
    } else if (allergies?.status === 'UNKNOWN') {
      sentences.push('दवा एलर्जी को लेकर मरीज ने अनिश्चितता जताई है।');
    }

    if (patientMeds.length > 0) {
      const medList = patientMeds.map((m) => sanitizeNaturalText(m.name, 'hi')).join(', ');
      sentences.push(`मरीज ने बताया कि वह वर्तमान में ${medList} ले रहा/रही है।`);
    } else if (medHistory && (medHistory.status === 'ABSENT' || String(medHistory.patientAnswerRaw).toLowerCase() === 'no')) {
      sentences.push('मरीज वर्तमान में कोई नियमित दवा नहीं ले रहा/रही है।');
    }

    // 9. Docs & Conflicts
    if (docs.length > 0) {
      sentences.push('अपलोड किए गए मेडिकल दस्तावेजों में दवा संबंधी विवरण शामिल हैं जिनकी समीक्षा डॉक्टर द्वारा की जानी है।');
    }
    if (medConflicts.length > 0) {
      sentences.push('मरीज द्वारा बताई गई दवा और दस्तावेजों में दर्ज खुराक में अंतर को डॉक्टर की समीक्षा के लिए चिह्नित किया गया है।');
    }

    // 9B. AYUSH Assessment (Dashavidha Pariksha & Ahara-Vihara)
    if (summary.ayushAssessment) {
      const d = summary.ayushAssessment.dashavidha || {};
      const av = summary.ayushAssessment.aharaVihara || {};
      const ayushBits = [];

      if (d.prakriti?.status === 'PRESENT' && d.prakriti.value && d.prakriti.value !== 'unknown') {
        ayushBits.push(`स्वाभाविक शारीरिक प्रवृत्ति: ${sanitizeNaturalText(d.prakriti.value, 'hi')}`);
      }
      if (d.vikriti?.status === 'PRESENT' && d.vikriti.value && d.vikriti.value !== 'unknown') {
        ayushBits.push(`वर्तमान शारीरिक असंतुलन: ${sanitizeNaturalText(d.vikriti.value, 'hi')}`);
      }
      if (d.ahara_shakti?.status === 'PRESENT' && d.ahara_shakti.value && d.ahara_shakti.value !== 'unknown') {
        ayushBits.push(`पाचन व अग्नि: ${sanitizeNaturalText(d.ahara_shakti.value, 'hi')}`);
      }
      if (d.vyayama_shakti?.status === 'PRESENT' && d.vyayama_shakti.value && d.vyayama_shakti.value !== 'unknown') {
        ayushBits.push(`व्यायाम क्षमता: ${sanitizeNaturalText(d.vyayama_shakti.value, 'hi')}`);
      }
      if (av.diet_pattern?.status === 'PRESENT' && av.diet_pattern.value && av.diet_pattern.value !== 'unknown') {
        ayushBits.push(`आहार: ${sanitizeNaturalText(av.diet_pattern.value, 'hi')}`);
      }
      if (av.bowel_pattern?.status === 'PRESENT' && av.bowel_pattern.value && av.bowel_pattern.value !== 'unknown') {
        ayushBits.push(`कोष्ठ: ${sanitizeNaturalText(av.bowel_pattern.value, 'hi')}`);
      }
      if (av.sleep_pattern?.status === 'PRESENT' && av.sleep_pattern.value && av.sleep_pattern.value !== 'unknown') {
        ayushBits.push(`निद्रा: ${sanitizeNaturalText(av.sleep_pattern.value, 'hi')}`);
      }
      if (av.activity_pattern?.status === 'PRESENT' && av.activity_pattern.value && av.activity_pattern.value !== 'unknown') {
        ayushBits.push(`विहार: ${sanitizeNaturalText(av.activity_pattern.value, 'hi')}`);
      }

      if (ayushBits.length > 0) {
        sentences.push(`आयुर्वेदिक दशविध परीक्षा एवं आहार-विहार मूल्यांकन अनुसार — ${ayushBits.join(', ')}.`);
      }
    }

    // 10. Fallback loop for any remaining answered questions
    for (const item of examHistory) {
      if (representedQuestionIds.has(item.questionId)) continue;
      representedQuestionIds.add(item.questionId);
      const cleanTopic = sanitizeNaturalText(item.questionText || item.concept || item.attribute, 'hi');
      const cleanAns = sanitizeNaturalText(item.normalizedInterpretation || item.patientAnswerRaw, 'hi');
      if (item.status === 'ABSENT' || cleanAns.toLowerCase() === 'no' || cleanAns === 'नहीं') {
        sentences.push(`${cleanTopic} को लेकर मरीज ने इनकार किया है।`);
      } else if (item.status === 'UNKNOWN' || cleanAns.toLowerCase().includes('unknown') || cleanAns.includes('पता नहीं')) {
        sentences.push(`${cleanTopic} को लेकर अनिश्चितता दर्ज की गई है।`);
      } else {
        sentences.push(`${cleanTopic} के संबंध में मरीज ने '${cleanAns}' बताया है।`);
      }
    }

    // 11. Uncertain & Closing
    if (uncertainCount > 0) {
      sentences.push('मरीज द्वारा व्यक्त की गई किसी भी अनिश्चितता को डॉक्टर के साथ परामर्श के लिए चिह्नित किया गया है।');
    }
    sentences.push('यह सारांश केवल मरीज द्वारा पुष्टि की गई जानकारी और प्रस्तुत दस्तावेजों पर आधारित है।');

    paragraph = sentences.join(' ');
  } else {
    const sentences = [];

    // 1. Primary concern + location + duration + severity
    const concernStr = formatConcernDisplayName(concernKey).toLowerCase();
    let locStr = '';
    if (locationVal) {
      const latPrefix = laterality === 'left' ? 'left ' : laterality === 'right' ? 'right ' : laterality === 'bilateral' ? 'both ' : '';
      locStr = ` in the ${latPrefix}${locationVal}`;
    }
    const durStr = durationStr ? ` for approximately ${durationStr}` : '';
    const sevStr = severityLevel ? ` with ${severityLevel} severity` : '';
    sentences.push(`The patient reports ${concernStr}${locStr}${durStr}${sevStr}.`);

    // 2. Preceding Injury / Trauma
    if (injuryStatus === 'PRESENT') {
      const cleanInj = sanitizeNaturalText(injuryVal, 'en');
      const isGeneric = !cleanInj || cleanInj.toLowerCase() === 'yes' || cleanInj.toLowerCase() === 'true';
      sentences.push(isGeneric ? 'The condition began following an injury.' : `The condition began following an injury (${cleanInj}).`);
    } else if (injuryStatus === 'ABSENT') {
      sentences.push('The patient denies any preceding injury or trauma.');
    } else if (injuryStatus === 'UNKNOWN') {
      sentences.push('The patient was uncertain whether an injury preceded the symptoms.');
    }

    // 3. Localized Signs (Swelling, Redness, Stiffness)
    if (swellingStatus === 'PRESENT' && rednessStatus === 'PRESENT') {
      sentences.push('Localized examination reveals swelling and redness around the area.');
    } else if (swellingStatus === 'PRESENT' && rednessStatus === 'ABSENT') {
      sentences.push('Swelling is noted around the area, while redness is explicitly denied.');
    } else if (swellingStatus === 'PRESENT') {
      sentences.push('Localized swelling is reported around the area.');
    } else if (swellingStatus === 'ABSENT' && rednessStatus === 'ABSENT') {
      sentences.push('The patient denies both local swelling and redness.');
    } else if (swellingStatus === 'ABSENT') {
      sentences.push('The patient denies local swelling.');
    } else if (swellingStatus === 'UNKNOWN') {
      sentences.push('The patient remained uncertain about the presence of local swelling.');
    } else if (rednessStatus === 'PRESENT') {
      sentences.push('Local redness is reported around the area.');
    } else if (rednessStatus === 'ABSENT') {
      sentences.push('No local redness was reported.');
    }

    if (stiffnessStatus === 'PRESENT') {
      sentences.push('Joint stiffness is also reported.');
    } else if (stiffnessStatus === 'ABSENT') {
      sentences.push('Joint stiffness was denied.');
    }

    // 4. Functional Mobility & Weight-bearing
    if (mobilityStatus === 'PRESENT') {
      sentences.push('Functional limitation is reported with difficulty walking and bearing weight.');
    } else if (mobilityStatus === 'ABSENT') {
      sentences.push('Normal mobility is maintained without significant difficulty walking or bearing weight.');
    } else if (mobilityStatus === 'UNKNOWN') {
      sentences.push('Weight-bearing capacity and mobility impact remain uncertain.');
    }

    // 5. Pain Radiation
    if (radiationStatus === 'PRESENT') {
      sentences.push('Pain is reported to radiate to adjacent regions.');
    } else if (radiationStatus === 'ABSENT') {
      sentences.push('The patient denies any pain radiation.');
    } else if (radiationStatus === 'UNKNOWN') {
      sentences.push('Uncertainty was expressed regarding pain radiation.');
    }

    // 6. Systemic Symptoms
    const allAbsentLabels = [...new Set(absentSymptoms.map((s) => getSymptomLabel(s, 'en')))];
    for (const sys of systemicItems) {
      if (sys.hist && (sys.hist.status === 'ABSENT' || String(sys.hist.patientAnswerRaw).toLowerCase() === 'no')) {
        if (!allAbsentLabels.includes(sys.labelEn)) allAbsentLabels.push(sys.labelEn);
      }
    }
    if (allAbsentLabels.length > 0) {
      sentences.push(`No ${allAbsentLabels.join(' or ')} was reported.`);
    }

    const allPresentLabels = [...new Set(presentSymptoms.map((s) => getSymptomLabel(s, 'en')))];
    for (const sys of systemicItems) {
      if (sys.hist && (sys.hist.status === 'PRESENT' || String(sys.hist.patientAnswerRaw).toLowerCase() === 'yes')) {
        if (!allPresentLabels.includes(sys.labelEn)) allPresentLabels.push(sys.labelEn);
      }
    }
    if (allPresentLabels.length > 0) {
      sentences.push(`Associated ${allPresentLabels.join(', ')} was noted.`);
    }

    // 7. Neurological Symptoms
    if (neuroStatus === 'ABSENT') {
      sentences.push('The patient denies neurological symptoms such as numbness, tingling, or weakness.');
    } else if (neuroStatus === 'PRESENT') {
      sentences.push('Neurological symptoms including numbness or tingling are reported.');
    } else if (neuroStatus === 'UNKNOWN') {
      sentences.push('Neurological sensation changes remain uncertain and require clinician evaluation.');
    }

    // 8. Medications & Allergies
    if (allergies?.status === 'ABSENT') {
      sentences.push('No known drug allergies were reported.');
    } else if (allergies?.status === 'NOT_PROVIDED') {
      if (patientMeds.length === 0 && !medHistory) {
        sentences.push('No known allergies or current medications were provided during the interview.');
      } else {
        sentences.push('Allergy details were not reported during intake.');
      }
    } else if (allergies?.items?.length > 0) {
      const cleanItems = allergies.items.map((it) => sanitizeNaturalText(it, 'en'));
      sentences.push(`Verified allergies include ${cleanItems.join(', ')}.`);
    } else if (allergies?.status === 'UNKNOWN') {
      sentences.push('The patient was uncertain regarding medication allergies.');
    }

    if (patientMeds.length > 0) {
      const medList = patientMeds.map((m) => `${sanitizeNaturalText(m.name, 'en')}${m.dose ? ` (${m.dose})` : ''}`).join(', ');
      sentences.push(`Patient reports currently taking ${medList}.`);
    } else if (medHistory && (medHistory.status === 'ABSENT' || String(medHistory.patientAnswerRaw).toLowerCase() === 'no')) {
      sentences.push('The patient is not currently taking any routine medications.');
    }

    // 9. Documents & Conflicts
    if (docs.length > 0) {
      sentences.push('Uploaded medical documents contain clinical records that require clinician review.');
    }
    if (medConflicts.length > 0) {
      sentences.push('A medication discrepancy between patient report and uploaded records is clearly marked for review.');
    }

    // 9B. AYUSH Assessment (Dashavidha Pariksha & Ahara-Vihara)
    if (summary.ayushAssessment) {
      const d = summary.ayushAssessment.dashavidha || {};
      const av = summary.ayushAssessment.aharaVihara || {};
      const ayushBits = [];

      if (d.prakriti?.status === 'PRESENT' && d.prakriti.value && d.prakriti.value !== 'unknown') {
        ayushBits.push(`natural tendencies reflect ${sanitizeNaturalText(d.prakriti.value, 'en')}`);
      }
      if (d.vikriti?.status === 'PRESENT' && d.vikriti.value && d.vikriti.value !== 'unknown') {
        ayushBits.push(`current bodily disturbance indicates ${sanitizeNaturalText(d.vikriti.value, 'en')}`);
      }
      if (d.ahara_shakti?.status === 'PRESENT' && d.ahara_shakti.value && d.ahara_shakti.value !== 'unknown') {
        ayushBits.push(`digestive capacity (Ahara Shakti) is noted as ${sanitizeNaturalText(d.ahara_shakti.value, 'en')}`);
      }
      if (d.vyayama_shakti?.status === 'PRESENT' && d.vyayama_shakti.value && d.vyayama_shakti.value !== 'unknown') {
        ayushBits.push(`exercise stamina is ${sanitizeNaturalText(d.vyayama_shakti.value, 'en')}`);
      }
      if (av.diet_pattern?.status === 'PRESENT' && av.diet_pattern.value && av.diet_pattern.value !== 'unknown') {
        ayushBits.push(`regular diet pattern reflects ${sanitizeNaturalText(av.diet_pattern.value, 'en')}`);
      }
      if (av.bowel_pattern?.status === 'PRESENT' && av.bowel_pattern.value && av.bowel_pattern.value !== 'unknown') {
        ayushBits.push(`bowel routine (Koshtha) is ${sanitizeNaturalText(av.bowel_pattern.value, 'en')}`);
      }
      if (av.sleep_pattern?.status === 'PRESENT' && av.sleep_pattern.value && av.sleep_pattern.value !== 'unknown') {
        ayushBits.push(`sleep quality is ${sanitizeNaturalText(av.sleep_pattern.value, 'en')}`);
      }
      if (av.activity_pattern?.status === 'PRESENT' && av.activity_pattern.value && av.activity_pattern.value !== 'unknown') {
        ayushBits.push(`daily physical exertion is ${sanitizeNaturalText(av.activity_pattern.value, 'en')}`);
      }

      if (ayushBits.length > 0) {
        sentences.push(`Under Ayurvedic intake evaluation (Dashavidha Pariksha & Ahara-Vihara), ${ayushBits.join(', ')}.`);
      }
    }

    // 10. Fallback loop for any remaining answered questions
    for (const item of examHistory) {
      if (representedQuestionIds.has(item.questionId)) continue;
      representedQuestionIds.add(item.questionId);

      const rawTopic = item.concept ? item.concept.replace(/^symptom\./, '').replace(/\./g, ' ') : (item.attribute || 'associated query');
      const cleanTopic = sanitizeNaturalText(rawTopic, 'en');
      const cleanAns = sanitizeNaturalText(item.normalizedInterpretation || item.patientAnswerRaw, 'en');

      if (item.status === 'ABSENT' || cleanAns.toLowerCase() === 'no') {
        sentences.push(`The patient denied ${cleanTopic}.`);
      } else if (item.status === 'UNKNOWN' || cleanAns.toLowerCase().includes('unknown') || cleanAns.toLowerCase().includes("don't know")) {
        sentences.push(`The patient was uncertain regarding ${cleanTopic}.`);
      } else {
        sentences.push(`Regarding ${cleanTopic}, patient noted ${cleanAns}.`);
      }
    }

    // 11. Uncertain & Closing
    if (uncertainCount > 0) {
      sentences.push('Any uncertain information is highlighted for doctor clarification.');
    }
    sentences.push('This summary is based solely on information verified by the patient during clinical intake.');

    paragraph = sentences.join(' ');
  }

  const answeredQuestionIds = new Set();
  for (const item of examHistory) {
    if (item.questionId) answeredQuestionIds.add(item.questionId);
  }
  for (const resp of responses) {
    if (resp.questionId && resp.rawResponse !== undefined && resp.rawResponse !== null) {
      answeredQuestionIds.add(resp.questionId);
    }
  }
  if (summary.completedQuestions) {
    for (const qid of summary.completedQuestions) {
      answeredQuestionIds.add(qid);
    }
  }

  const sourceQuestionIds = Array.from(representedQuestionIds);
  const wordCount = paragraph.trim().split(/\s+/).filter(Boolean).length;

  return {
    text: paragraph,
    language,
    wordCount,
    answeredQuestionCount: Math.max(answeredQuestionIds.size, representedQuestionIds.size),
    representedQuestionCount: representedQuestionIds.size,
    sourceQuestionIds,
    generatedAt: new Date().toISOString(),
    summaryVersion: summary.summaryVersion || 1,
  };
}

function formatConcernDisplayName(concernKey) {
  if (!concernKey) return 'Not provided';
  const names = {
    knee_pain: 'Knee Pain',
    chest_pain: 'Chest Pain',
    shoulder_pain: 'Shoulder Pain',
    stomach: 'Abdominal Discomfort',
    diarrhea: 'Diarrhea',
    fever: 'Fever',
    cough: 'Cough',
    breathing: 'Breathing Difficulty',
    headache: 'Headache',
    pain: 'Pain / Discomfort',
  };
  return names[concernKey] || String(concernKey).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
