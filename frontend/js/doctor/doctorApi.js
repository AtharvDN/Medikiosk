/**
 * Doctor Portal API Client — MediKiosk (Phase 10)
 */

import { doctorState, clearDoctorAuth } from './doctorState.js';

const ROOT_API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  (typeof window !== 'undefined' && (window.__MEDIKIOSK_API_URL__ || window.ENV?.VITE_API_URL)) ||
  '/api';
const API_BASE = `${ROOT_API.replace(/\/$/, '')}/doctor`;

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (doctorState.token) {
    headers['Authorization'] = `Bearer ${doctorState.token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && doctorState.token) {
      console.warn('[Doctor API] Session token expired or unauthorized. Logging out.');
      clearDoctorAuth();
    }
    const err = new Error(body?.error?.message || body?.message || 'Doctor API request failed');
    err.status = res.status;
    err.code = body?.error?.code || 'API_ERROR';
    throw err;
  }

  return body;
}

export const doctorApi = {
  async login(credentials) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async getDashboard() {
    return request('/dashboard');
  },

  async getQueue(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/queue${qs ? `?${qs}` : ''}`);
  },

  async getAlerts() {
    return request('/alerts');
  },

  async getPatients(search = '', filter = 'ALL') {
    const qs = new URLSearchParams({ search, filter }).toString();
    return request(`/patients?${qs}`);
  },

  async getWorkspace(sessionId) {
    return request(`/patients/${sessionId}/workspace`);
  },

  async saveNotes(sessionId, noteText) {
    return request(`/patients/${sessionId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ noteText }),
    });
  },

  async updateStatus(sessionId, status) {
    return request(`/patients/${sessionId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  async confirmReview(sessionId, comments = '') {
    return request(`/patients/${sessionId}/review`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    });
  },

  async getReports() {
    return request('/reports');
  },

  async getSettings() {
    return request('/settings');
  },

  async getPatientTimeline(patientId) {
    return request(`/patients/${patientId}/timeline`);
  },

  async recordVitals(patientOrEncounterId, vitals) {
    return request(`/patients/${patientOrEncounterId}/vitals`, {
      method: 'POST',
      body: JSON.stringify(vitals),
    });
  },

  async recordExamination(patientOrEncounterId, examData) {
    return request(`/patients/${patientOrEncounterId}/examination`, {
      method: 'POST',
      body: JSON.stringify(examData),
    });
  },

  async updateSettings(settings) {
    return request('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },
};
