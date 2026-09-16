/**
 * Centralized API Client (Section 45 & Phase 10 Master Integration)
 * Communicates with the Express backend foundation.
 * Production configurable for Vercel/cloud deployments without hardcoded hostnames.
 */

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  (typeof window !== 'undefined' && (window.__MEDIKIOSK_API_URL__ || window.ENV?.VITE_API_URL)) ||
  '/api';

export const api = {
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const result = await response.json();
      return result;
    } catch (error) {
      console.warn('[API] Health check unreachable:', error.message);
      return { success: false, error: error.message };
    }
  },

  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: { message: error.message } };
    }
  },

  // ----------------------------------------------------
  // Phase 10: Institutional Hierarchy & Encounters
  // ----------------------------------------------------
  async getHospitals() {
    try {
      const response = await fetch(`${API_BASE}/hospitals`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to fetch hospitals:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  async getDepartments(hospitalId) {
    try {
      const response = await fetch(`${API_BASE}/hospitals/${hospitalId}/departments`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to fetch departments:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  async getDoctors(departmentId) {
    try {
      const response = await fetch(`${API_BASE}/departments/${departmentId}/doctors`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to fetch doctors:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  async createPatient(patientData) {
    try {
      const response = await fetch(`${API_BASE}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData),
      });
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to register/update patient:', error);
      return { success: false, error: error.message };
    }
  },

  async searchPatients(query) {
    try {
      const response = await fetch(`${API_BASE}/patients/search?q=${encodeURIComponent(query)}`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Patient search failed:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  async getPatientById(id) {
    try {
      const response = await fetch(`${API_BASE}/patients/${id}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async createEncounter(encounterData) {
    try {
      const response = await fetch(`${API_BASE}/encounters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encounterData),
      });
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to create encounter:', error);
      return { success: false, error: error.message };
    }
  },

  async getEncounter(id) {
    try {
      const response = await fetch(`${API_BASE}/encounters/${id}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // ----------------------------------------------------
  // Phase 3-9: Clinical Question Engine Endpoints
  // ----------------------------------------------------
  async createClinicalSession({ patientId = null, encounterId = null, language = 'mr', opdMode = 'GENERAL' }) {
    try {
      const response = await fetch(`${API_BASE}/clinical/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, encounterId, language, opdMode }),
      });
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to create clinical session:', error);
      return { success: false, error: error.message };
    }
  },

  async getNextClinicalQuestion(sessionId, lang = 'mr') {
    try {
      const response = await fetch(`${API_BASE}/clinical/sessions/${sessionId}/next-question?lang=${lang}`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to fetch next clinical question:', error);
      return { success: false, error: error.message };
    }
  },

  async recordClinicalResponse(sessionId, responseData) {
    try {
      const response = await fetch(`${API_BASE}/clinical/sessions/${sessionId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(responseData),
      });
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to record response:', error);
      return { success: false, error: error.message };
    }
  },

  async getClinicalProgress(sessionId) {
    try {
      const response = await fetch(`${API_BASE}/clinical/sessions/${sessionId}/progress`);
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getClinicalSummary(sessionId) {
    try {
      const response = await fetch(`${API_BASE}/clinical/sessions/${sessionId}/summary`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to fetch clinical summary:', error);
      return { success: false, error: error.message };
    }
  },

  async getExaminationHistory(sessionId, lang = 'mr') {
    try {
      const response = await fetch(`${API_BASE}/clinical/sessions/${sessionId}/examination-history?lang=${lang}`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to fetch examination history:', error);
      return { success: false, error: error.message };
    }
  },

  async updateClinicalResponse(sessionId, questionId, updateData) {
    try {
      const response = await fetch(`${API_BASE}/clinical/sessions/${sessionId}/responses/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to update response:', error);
      return { success: false, error: error.message };
    }
  },

  async submitToDoctor(sessionId) {
    try {
      const response = await fetch(`${API_BASE}/clinical/sessions/${sessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to dispatch to doctor:', error);
      return { success: false, error: error.message };
    }
  },

  async resetClinicalSessionBackend(sessionId) {
    try {
      const response = await fetch(`${API_BASE}/clinical/sessions/${sessionId}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // ----------------------------------------------------
  // Phase 7: Medical Document & OCR Endpoints
  // ----------------------------------------------------
  async uploadDocument(sessionId, documentData) {
    try {
      const response = await fetch(`${API_BASE}/clinical/sessions/${sessionId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentData),
      });
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to upload document:', error);
      return { success: false, error: error.message };
    }
  },

  async getSessionDocuments(sessionId) {
    try {
      const response = await fetch(`${API_BASE}/clinical/sessions/${sessionId}/documents`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to get session documents:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteDocument(sessionId, docId) {
    try {
      const response = await fetch(`${API_BASE}/clinical/sessions/${sessionId}/documents/${docId}`, {
        method: 'DELETE',
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // ----------------------------------------------------
  // Phase 5: Multilingual Voice Pipeline (ASR & TTS)
  // ----------------------------------------------------
  async transcribeAudio({ audioBase64, language = 'mr', sessionId = null, questionId = null }) {
    try {
      const response = await fetch(`${API_BASE}/voice/asr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, language, sessionId, questionId }),
      });
      return await response.json();
    } catch (error) {
      console.warn('[API] Voice ASR transcription request failed:', error);
      return { success: false, error: error.message, fallbackToTouch: true };
    }
  },

  async synthesizeSpeech({ text, language = 'mr', questionId = null }) {
    try {
      const response = await fetch(`${API_BASE}/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language, questionId }),
      });
      return await response.json();
    } catch (error) {
      console.warn('[API] Voice TTS synthesis request failed:', error);
      return { success: false, error: error.message };
    }
  },

  async getVoiceStatus() {
    try {
      const response = await fetch(`${API_BASE}/voice/status`);
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // ----------------------------------------------------
  // Phase 10B: Longitudinal Patient Record & Timeline
  // ----------------------------------------------------
  async getPatientDashboard(patientId) {
    try {
      const response = await fetch(`${API_BASE}/patients/${patientId}/dashboard`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to get patient dashboard:', error);
      return { success: false, error: error.message };
    }
  },

  async getPatientHistory(patientId) {
    try {
      const response = await fetch(`${API_BASE}/patients/${patientId}/history`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to get patient history:', error);
      return { success: false, error: error.message };
    }
  },

  async getPatientDocuments(patientId) {
    try {
      const response = await fetch(`${API_BASE}/patients/${patientId}/documents`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to get patient documents:', error);
      return { success: false, error: error.message };
    }
  },

  async getPatientSummary(patientId) {
    try {
      const response = await fetch(`${API_BASE}/patients/${patientId}/summary`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to get patient summary:', error);
      return { success: false, error: error.message };
    }
  },

  async getPatientTimeline(patientId) {
    try {
      const response = await fetch(`${API_BASE}/patients/${patientId}/timeline`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to get patient timeline:', error);
      return { success: false, error: error.message };
    }
  },

  async getPatientProfile(patientId) {
    try {
      const response = await fetch(`${API_BASE}/patients/${patientId}/profile`);
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to get patient profile:', error);
      return { success: false, error: error.message };
    }
  },

  async cancelEncounter(id) {
    try {
      const response = await fetch(`${API_BASE}/encounters/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to cancel encounter:', error);
      return { success: false, error: error.message };
    }
  },

  async recordPatientVitals(patientId, vitalsData) {
    try {
      const response = await fetch(`${API_BASE}/patients/${patientId}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'PATIENT', ...vitalsData }),
      });
      return await response.json();
    } catch (error) {
      console.warn('[API] Failed to record patient vitals:', error);
      return { success: false, error: error.message };
    }
  },
};
