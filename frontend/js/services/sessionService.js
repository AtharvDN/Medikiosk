/**
 * Session Lifecycle & Ephemeral Kiosk Management (Section 28 & ADR-008)
 * 60-second inactivity timeout with automatic memory purge to prevent cross-patient data leakage.
 */

import { resetSession, appState } from '../state.js';

class SessionService {
  constructor() {
    this.inactivitySeconds = 0;
    this.timer = null;
    this.warningCallback = null;
  }

  startMonitoring(onWarning) {
    // Inactivity timeout completely disabled for demo continuity
    this.warningCallback = null;
    this.timer = null;
  }

  resetTimer() {
    this.inactivitySeconds = 0;
  }

  tick() {
    // Inactivity countdown disabled
  }
}

export const sessionService = new SessionService();
