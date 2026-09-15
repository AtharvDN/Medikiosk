/**
 * Screen 4: Informed Patient Consent Screen
 * Digital Personal Data Protection (DPDP) compliant clear presentation.
 */

import { t } from '../i18n.js';
import { appState, notifyStateChange } from '../state.js';
import { router } from '../router.js';
import { audioController } from '../audio.js';

export function renderConsentScreen() {
  const lang = appState.language;

  const html = `
    <div class="screen-card" style="max-width: 980px; margin: 0 auto;">
      <!-- Audio Explanation Bar -->
      <button id="btn-consent-audio" class="audio-prompt-bar">
        <span aria-hidden="true">🔊</span>
        <span>${t('consentAudioExplanation', lang)}</span>
      </button>

      <h1 class="kiosk-question-title" style="color: var(--primary);">
        ${t('consentTitle', lang)}
      </h1>
      <p class="kiosk-question-subtitle">
        ${t('consentSubtitle', lang)}
      </p>

      <!-- Clear, High-Contrast Bullet Points in Clean Container -->
      <div style="background: var(--surface-subtle); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.75rem 2rem; margin-bottom: 2rem;">
        <ul style="list-style: none; display: flex; flex-direction: column; gap: 1rem; font-size: var(--font-size-base); color: var(--text);">
          <li style="display: flex; gap: 0.875rem; align-items: flex-start;">
            <span style="font-size: 1.25rem; color: var(--teal); font-weight: 800;" aria-hidden="true">✓</span>
            <span>${t('consentPoint1', lang)}</span>
          </li>
          <li style="display: flex; gap: 0.875rem; align-items: flex-start;">
            <span style="font-size: 1.25rem; color: var(--teal); font-weight: 800;" aria-hidden="true">✓</span>
            <span>${t('consentPoint2', lang)}</span>
          </li>
          <li style="display: flex; gap: 0.875rem; align-items: flex-start;">
            <span style="font-size: 1.25rem; color: var(--teal); font-weight: 800;" aria-hidden="true">✓</span>
            <span>${t('consentPoint3', lang)}</span>
          </li>
          <li style="display: flex; gap: 0.875rem; align-items: flex-start;">
            <span style="font-size: 1.25rem; color: var(--teal); font-weight: 800;" aria-hidden="true">✓</span>
            <span>${t('consentPoint4', lang)}</span>
          </li>
          <li style="display: flex; gap: 0.875rem; align-items: flex-start;">
            <span style="font-size: 1.25rem; color: var(--teal); font-weight: 800;" aria-hidden="true">✓</span>
            <span>${t('consentPoint5', lang)}</span>
          </li>
        </ul>
      </div>

      <!-- Action Row -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
        <button id="btn-consent-back" class="btn btn-secondary" style="min-height: 54px;">
          ← ${t('back', lang)}
        </button>

        <div style="display: flex; gap: 1rem;">
          <button id="btn-consent-decline" class="btn btn-secondary" style="min-width: 160px; min-height: 54px; color: var(--text-secondary);">
            ${t('consentDecline', lang)}
          </button>
          <button id="btn-consent-agree" class="btn btn-primary" style="min-width: 260px; min-height: 54px; font-size: var(--font-size-md);">
            <span>${t('consentAgree', lang)}</span>
            <span aria-hidden="true">➔</span>
          </button>
        </div>
      </div>
    </div>
  `;

  return {
    html,
    attachEvents: () => {
      const consentAudioBtn = document.getElementById('btn-consent-audio');
      consentAudioBtn?.addEventListener('click', async () => {
        if (audioController.isSpeaking) {
          audioController.stop();
          consentAudioBtn.classList.remove('playing');
          return;
        }
        consentAudioBtn.classList.add('playing');
        const fullExplanation = `${t('consentTitle', lang)}. ${t('consentPoint1', lang)}. ${t('consentPoint2', lang)}. ${t('consentPoint4', lang)}.`;
        await audioController.speak(fullExplanation, lang);
        consentAudioBtn.classList.remove('playing');
      });

      document.getElementById('btn-consent-agree')?.addEventListener('click', () => {
        appState.consent = {
          granted: true,
          timestamp: new Date().toISOString(),
          version: '1.0',
        };
        notifyStateChange('consent');
        router.navigate('patientDashboard');
      });

      document.getElementById('btn-consent-decline')?.addEventListener('click', () => {
        appState.consent = {
          granted: false,
          timestamp: new Date().toISOString(),
          version: '1.0',
        };
        notifyStateChange('consent');
        router.openHelpModal(
          'Consent is required to continue. A hospital attendant can assist you with manual paper OPD registration.'
        );
      });

      document.getElementById('btn-consent-back')?.addEventListener('click', () => {
        router.navigate('identify');
      });
    },
  };
}
