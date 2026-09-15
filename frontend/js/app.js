/**
 * MediKiosk Patient Kiosk Application Entrypoint (Phase 2)
 * Pure Vanilla HTML5, CSS3, JavaScript (ES Modules).
 */

import { router } from './router.js';
import { subscribe, appState } from './state.js';
import { a11y } from './accessibility.js';
import { sessionService } from './services/sessionService.js';
import { api } from './api.js';
import { openModal } from './components/modal.js';
import { t } from './i18n.js';
import { initDoctorState } from './doctor/doctorState.js';
import { initDoctorShell } from './doctor/doctorShell.js';

let doctorShellInitialized = false;

function handleModeSwitch() {
  const isDoctorMode = window.location.hash.startsWith('#/doctor') || window.location.hash.startsWith('#doctor');
  const kioskEl = document.getElementById('kiosk-app');
  const doctorEl = document.getElementById('doctor-app');

  if (isDoctorMode) {
    if (kioskEl) kioskEl.style.display = 'none';
    if (doctorEl) {
      doctorEl.style.display = 'flex';
      if (!doctorShellInitialized) {
        initDoctorState();
        initDoctorShell(doctorEl);
        doctorShellInitialized = true;
      }
    }
  } else {
    if (doctorEl) doctorEl.style.display = 'none';
    if (kioskEl) kioskEl.style.display = 'flex';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[MediKiosk] Bootstrapping MediKiosk Frontend (Patient Kiosk & Doctor Portal)...');

  // 1. Accessibility initialization
  a11y.init();

  // 2. Router initialization
  router.init();

  // 3. React to language changes
  subscribe((state, changedKey) => {
    if (changedKey === 'language' || changedKey === 'reset') {
      router.renderCurrentScreen();
    }
  });

  // 4. Portal Mode Switcher (Kiosk vs Doctor Workstation)
  handleModeSwitch();
  window.addEventListener('hashchange', handleModeSwitch);

  // 5. Inactivity Monitor disabled for demo continuity


  // 6. Backend Connection Check
  try {
    const health = await api.checkHealth();
    if (health?.success && health?.data?.status === 'ok') {
      console.log('[MediKiosk] Backend Express API connection confirmed:', health.data);
    } else {
      console.warn('[MediKiosk] Backend Express API offline or returned error.');
    }
  } catch (err) {
    console.warn('[MediKiosk] Backend check error:', err);
  }
});
