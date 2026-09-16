/**
 * Screen 8: Documents Prompt Screen
 * Multimodal choice asking if patient has physical papers/reports to scan.
 * Supports both high-contrast touch buttons and live voice commands.
 */

import { t } from '../i18n.js';
import { appState, notifyStateChange } from '../state.js';
import { router } from '../router.js';
import { audioController } from '../audio.js';
import { speechService } from '../services/speechService.js';
import { renderVoiceButton } from '../components/voiceButton.js';
import { ttsService } from '../services/ttsService.js';

export function renderDocumentsScreen() {
  const lang = appState.language;

  const voiceBoxHtml = renderVoiceButton({
    status: appState.voice.status,
    transcript: appState.voice.transcript,
    interpreted: appState.voice.interpreted,
  });

  const html = `
    <div class="screen-card" style="max-width: 920px; margin: 0 auto; text-align: center; align-items: center;">
      <!-- Audio Narration Pill -->
      <button id="btn-docs-audio" class="audio-prompt-bar">
        <span aria-hidden="true">🔊</span>
        <span>${t('listen', lang)}</span>
      </button>

      <div style="font-size: 3.5rem; margin-bottom: 0.75rem; color: var(--primary);" aria-hidden="true">📄</div>

      <h1 class="kiosk-question-title" style="color: var(--primary); max-width: 720px; margin-bottom: 0.5rem;">
        ${t('docQuestionTitle', lang)}
      </h1>

      <p style="font-size: var(--font-size-base); max-width: 640px; margin-bottom: 1.75rem; color: var(--text-secondary); line-height: 1.6;">
        ${t('docQuestionSubtitle', lang)}
      </p>

      <!-- Multimodal Voice Command Section -->
      <div style="width: 100%; max-width: 520px; margin-bottom: 1.75rem;">
        ${voiceBoxHtml}
      </div>

      <!-- Large Clear Choices -->
      <div style="display: flex; flex-direction: column; gap: 1.25rem; width: 100%; max-width: 520px;">
        <button id="btn-docs-yes" class="btn btn-primary btn-huge" style="width: 100%;">
          <span aria-hidden="true">📸</span>
          <span>${t('haveDocsYes', lang) || 'Yes, I have records to scan'}</span>
        </button>

        <button id="btn-docs-no" class="btn btn-secondary btn-huge" style="width: 100%;">
          <span>${t('haveDocsNo', lang) || 'No, continue without papers'}</span>
          <span aria-hidden="true">➔</span>
        </button>
      </div>

      <div style="margin-top: 2.25rem; display: flex; justify-content: flex-start; width: 100%;">
        <button id="btn-docs-back" class="btn btn-secondary" style="min-height: 48px;">
          ← ${t('back', lang)}
        </button>
      </div>
    </div>
  `;

  return {
    html,
    attachEvents: () => {
      // 1. Touch Actions
      document.getElementById('btn-docs-yes')?.addEventListener('click', () => {
        ttsService.stop();
        speechService.stopListening();
        appState.voice.status = 'IDLE';
        appState.voice.transcript = null;
        router.navigate('documentReview');
      });

      document.getElementById('btn-docs-no')?.addEventListener('click', () => {
        ttsService.stop();
        speechService.stopListening();
        appState.voice.status = 'IDLE';
        appState.voice.transcript = null;
        router.navigate('patientReview');
      });

      document.getElementById('btn-docs-back')?.addEventListener('click', () => {
        ttsService.stop();
        speechService.stopListening();
        appState.voice.status = 'IDLE';
        appState.voice.transcript = null;
        router.navigate('conversation');
      });

      // 2. Audio Listen Prompt
      const audioBtn = document.getElementById('btn-docs-audio');
      audioBtn?.addEventListener('click', async () => {
        if (audioController.isSpeaking) {
          audioController.stop();
          audioBtn.classList.remove('playing');
          return;
        }
        audioBtn.classList.add('playing');
        await audioController.speak(t('docQuestionTitle', appState.language), appState.language);
        audioBtn.classList.remove('playing');
      });

      // 3. Voice Microphone & Voice Commands
      document.getElementById('btn-voice-mic')?.addEventListener('click', () => {
        ttsService.stop();

        if (speechService.isListening()) {
          speechService.stopListening();
          return;
        }

        const micBtn = document.getElementById('btn-voice-mic');
        const statusText = document.querySelector('.voice-status-text');

        speechService.startListening(appState.language, ({ status, transcript, error, message }) => {
          appState.voice.status = status;

          if (status === 'LISTENING') {
            if (micBtn) micBtn.classList.add('listening');
            if (statusText) statusText.textContent = t('tapListening', lang) || 'Listening... Please speak';
            return;
          }

          if (status === 'PROCESSING') {
            if (micBtn) {
              micBtn.classList.remove('listening');
              micBtn.setAttribute('disabled', 'true');
            }
            if (statusText) statusText.textContent = t('processingVoice', lang) || 'Understanding your speech...';
            return;
          }

          if (status === 'TRANSCRIBING') {
            if (micBtn) {
              micBtn.classList.remove('listening');
              micBtn.setAttribute('disabled', 'true');
            }
            if (statusText) statusText.textContent = t('transcribingVoice', lang) || 'Transcribing your speech...';
            return;
          }

          if ((status === 'RECOGNIZED' || status === 'SUCCESS') && transcript) {
            const lower = transcript.toLowerCase();
            console.info('[Documents Screen Voice]', transcript);

            // Check for negative intent (No documents, Skip, Bypass OCR)
            const isNegative =
              /no|don't|dont|nahi|nah|skip|bypass|none|without|नाही|नको|नाहित|नाय|काही नाही|नहीं|मत|छोड़ो|कुछ नहीं|कागदपत्रे नाहीत|कागज नहीं/i.test(
                lower
              );

            // Check for positive intent (Yes, Have documents, Scan, Upload)
            const isPositive =
              /yes|yeah|yep|scan|upload|sure|have|record|paper|हो|आहे|आहेत|हाँ|हां|है|कागद|दस्तावेज|दाखव/i.test(
                lower
              );

            if (isNegative) {
              appState.voice.status = 'IDLE';
              appState.voice.transcript = null;
              notifyStateChange('voice');
              router.navigate('patientReview');
              return;
            }

            if (isPositive) {
              appState.voice.status = 'IDLE';
              appState.voice.transcript = null;
              notifyStateChange('voice');
              router.navigate('documentReview');
              return;
            }

            // Unclassified speech: prompt confirmation
            appState.voice.transcript = transcript;
            appState.voice.interpreted = transcript;
            notifyStateChange('voice');
            router.renderCurrentScreen();
            return;
          }

          // Error or no speech detected
          if (micBtn) {
            micBtn.classList.remove('listening');
            micBtn.removeAttribute('disabled');
          }
          if (statusText) {
            const fallbackMsg =
              lang === 'mr'
                ? 'आवाज स्पष्ट आला नाही. पुन्हा बोला किंवा खालील बटण दाबा.'
                : lang === 'hi'
                ? 'आवाज़ स्पष्ट नहीं आई। पुनः बोलें या नीचे बटन दबाएं।'
                : 'Could not hear speech clearly. Please speak again or select below.';
            statusText.textContent = message || fallbackMsg;
          }
          notifyStateChange('voice');
        });
      });

      // 4. Voice Confirmation Buttons (if unclassified speech shown)
      document.getElementById('btn-voice-confirm')?.addEventListener('click', () => {
        appState.voice.status = 'IDLE';
        appState.voice.transcript = null;
        notifyStateChange('voice');
        // By default proceed to review
        router.navigate('patientReview');
      });

      document.getElementById('btn-voice-retry')?.addEventListener('click', () => {
        appState.voice.status = 'IDLE';
        appState.voice.transcript = null;
        notifyStateChange('voice');
        router.renderCurrentScreen();
      });
    },
  };
}
