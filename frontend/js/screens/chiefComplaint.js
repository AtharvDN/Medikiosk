/**
 * Screen 6: Chief Complaint Screen
 * Multimodal Landscape Split: Left Voice Interaction + Right Common Touch Options.
 */

import { t } from '../i18n.js';
import { appState, notifyStateChange, resetClinicalSession } from '../state.js';
import { router } from '../router.js';
import { renderVoiceButton } from '../components/voiceButton.js';
import { speechService } from '../services/speechService.js';
import { ttsService } from '../services/ttsService.js';
import { audioController } from '../audio.js';

export function renderChiefComplaintScreen() {
  const lang = appState.language;

  // Clean isolation: wipe any old clinical session when entering chief complaint
  if (appState.backendSessionId) {
    resetClinicalSession(false);
  }

  const complaintOptions = [
    { id: 'CHEST_PAIN', labelKey: 'cChestPain', icon: '🫀' },
    { id: 'SHOULDER_PAIN', labelKey: 'cShoulderPain', icon: '💪' },
    { id: 'KNEE_PAIN', labelKey: 'cKneePain', icon: '🦵' },
    { id: 'DIARRHEA', labelKey: 'cDiarrhea', icon: '💩' },
    { id: 'FEVER', labelKey: 'cFever', icon: '🤒' },
    { id: 'COUGH', labelKey: 'cCough', icon: '🤧' },
    { id: 'BREATHING', labelKey: 'cBreathing', icon: '😮‍💨' },
    { id: 'HEADACHE', labelKey: 'cHeadache', icon: '🤕' },
    { id: 'STOMACH', labelKey: 'cStomach', icon: '🤢' },
    { id: 'MEDICATION', labelKey: 'cMedication', icon: '💊' },
    { id: 'OTHER', labelKey: 'cOther', icon: '❓' },
  ];

  const tilesHtml = complaintOptions
    .map(
      (opt) => `
      <div class="option-tile ${appState.complaint.id === opt.id ? 'selected' : ''}" data-complaint-id="${opt.id}">
        <div class="option-tile-icon">${opt.icon}</div>
        <div>
          <div class="option-tile-text">${t(opt.labelKey, lang)}</div>
        </div>
      </div>
    `
    )
    .join('');

  // Map interpreted entity for the confirmation box if recognized
  let interpretedText = null;
  if (appState.complaint.id && appState.complaint.id !== 'OTHER') {
    const optObj = complaintOptions.find((o) => o.id === appState.complaint.id);
    if (optObj) {
      interpretedText = t(optObj.labelKey, lang);
      if (appState.complaint.duration?.value) {
        interpretedText += ` • ${appState.complaint.duration.value} days`;
      }
    }
  } else if (appState.voice.transcript) {
    interpretedText = appState.voice.transcript;
  }

  const voiceBoxHtml = renderVoiceButton({
    status: appState.voice.status,
    transcript: appState.voice.transcript,
    interpreted: interpretedText,
  });

  const html = `
    <div class="screen-card" style="max-width: 1120px; margin: 0 auto;">
      <!-- Audio Narration Pill -->
      <button id="btn-complaint-audio" class="audio-prompt-bar">
        <span aria-hidden="true">🔊</span>
        <span>${t('listen', lang)}</span>
      </button>

      <!-- 2-Column Split: Left Voice Interaction, Right Touch Options -->
      <div class="screen-card-split" style="padding: 0; align-items: start;">
        <!-- Left: Voice Interaction Card -->
        <div style="display: flex; flex-direction: column; justify-content: center; background: var(--surface-subtle); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 2rem 1.75rem;">
          <h2 style="font-size: var(--font-size-lg); color: var(--primary); font-weight: 800; margin-bottom: 0.5rem;">
            ${t('complaintTitle', lang)}
          </h2>
          <p style="font-size: var(--font-size-xs); color: var(--muted-text); margin-bottom: 1.25rem;">
            ${t('complaintSubtitle', lang)}
          </p>

          ${voiceBoxHtml}
        </div>

        <!-- Right: Touch Options Grid -->
        <div>
          <div style="font-size: var(--font-size-xs); font-weight: 700; color: var(--muted-text); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">
            ${t('orChooseBelow', lang)}
          </div>

          <div class="option-grid" style="grid-template-columns: repeat(2, 1fr); margin: 0; max-height: 480px; overflow-y: auto; padding-right: 0.5rem;">
            ${tilesHtml}
          </div>
        </div>
      </div>

      <!-- Back Action -->
      <div style="margin-top: 1.5rem; display: flex; justify-content: flex-start;">
        <button id="btn-complaint-back" class="btn btn-secondary" style="min-height: 48px;">
          ← ${t('back', lang)}
        </button>
      </div>
    </div>
  `;

  return {
    html,
    attachEvents: () => {
      // 1. Microphone Click
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
            appState.voice.transcript = transcript;
            appState.complaint.textPatientSpoken = transcript;

            const lower = transcript.toLowerCase();
            if (
              lower.includes('जुलाब') ||
              lower.includes('अतिसार') ||
              lower.includes('दस्त') ||
              lower.includes('diarrhea') ||
              lower.includes('loose motion') ||
              lower.includes('julaab') ||
              lower.includes('dast')
            ) {
              appState.complaint.id = 'DIARRHEA';
              appState.complaint.location = null;
            } else if (
              lower.includes('गुडघ') ||
              lower.includes('घुटन') ||
              lower.includes('knee') ||
              lower.includes('gudgha') ||
              lower.includes('ghutna') ||
              lower.includes('पाय') ||
              lower.includes('leg pain')
            ) {
              appState.complaint.id = 'KNEE_PAIN';
              appState.complaint.location = 'knee';
            } else if (
              lower.includes('खांद') ||
              lower.includes('कंध') ||
              lower.includes('shoulder') ||
              lower.includes('khanda') ||
              lower.includes('kandha') ||
              lower.includes('हाथ') ||
              lower.includes('हात') ||
              lower.includes('arm pain')
            ) {
              appState.complaint.id = 'SHOULDER_PAIN';
              appState.complaint.location = 'shoulder';
            } else if (
              lower.includes('छाती') ||
              lower.includes('सीना') ||
              lower.includes('chest') ||
              lower.includes('chhati') ||
              lower.includes('seena') ||
              lower.includes('heart') ||
              lower.includes('ह्रदय')
            ) {
              appState.complaint.id = 'CHEST_PAIN';
              appState.complaint.location = 'chest';
            } else if (
              lower.includes('उलटी') ||
              lower.includes('उल्टी') ||
              lower.includes('vomit') ||
              lower.includes('मळमळ') ||
              lower.includes('पोट') ||
              lower.includes('पेट') ||
              lower.includes('stomach') ||
              lower.includes('potat') ||
              lower.includes('pet dard') ||
              lower.includes('abdomen')
            ) {
              appState.complaint.id = 'STOMACH';
              appState.complaint.location = 'abdomen';
            } else if (
              lower.includes('ताप') ||
              lower.includes('बुखार') ||
              lower.includes('fever') ||
              lower.includes('taap') ||
              lower.includes('bukhar') ||
              lower.includes('temperature') ||
              lower.includes('garam')
            ) {
              appState.complaint.id = 'FEVER';
            } else if (
              lower.includes('खोकला') ||
              lower.includes('खांसी') ||
              lower.includes('cough') ||
              lower.includes('khokla') ||
              lower.includes('khansi') ||
              lower.includes('cold') ||
              lower.includes('सर्दी') ||
              lower.includes('sardi')
            ) {
              appState.complaint.id = 'COUGH';
            } else if (
              lower.includes('श्वास') ||
              lower.includes('सांस') ||
              lower.includes('breath') ||
              lower.includes('shwas') ||
              lower.includes('saans') ||
              lower.includes('asthma') ||
              lower.includes('दम')
            ) {
              appState.complaint.id = 'BREATHING';
            } else if (
              lower.includes('डोके') ||
              lower.includes('सिर') ||
              lower.includes('head') ||
              lower.includes('doke') ||
              lower.includes('sir dard') ||
              lower.includes('sar dard') ||
              lower.includes('माथा')
            ) {
              appState.complaint.id = 'HEADACHE';
              appState.complaint.location = 'head';
            } else if (
              lower.includes('गोळी') ||
              lower.includes('गोळ्या') ||
              lower.includes('औषध') ||
              lower.includes('दवा') ||
              lower.includes('दवाई') ||
              lower.includes('medicine') ||
              lower.includes('tablet') ||
              lower.includes('prescription')
            ) {
              appState.complaint.id = 'MEDICATION';
            } else {
              appState.complaint.id = 'OTHER';
            }

            // Extract duration if explicitly spoken
            if (lower.includes('६-७') || lower.includes('६ ते ७') || lower.includes('6-7') || lower.includes('6 to 7') || lower.includes('छह सात') || lower.includes('सहा सात')) {
              appState.complaint.duration = { min: 6, max: 7, unit: 'days' };
            } else if (lower.includes('चार दिवस') || lower.includes('चार दिन') || lower.includes('4 दिन') || lower.includes('४ दिन') || lower.includes('four days') || lower.includes('4 days') || lower.includes('४ दिवस')) {
              appState.complaint.duration = { value: 4, unit: 'days' };
            } else if (lower.includes('तीन दिवस') || lower.includes('तीन दिन') || lower.includes('3 दिन') || lower.includes('३ दिन') || lower.includes('three days') || lower.includes('3 days') || lower.includes('३ दिवस')) {
              appState.complaint.duration = { value: 3, unit: 'days' };
            } else if (lower.includes('दोन दिवस') || lower.includes('दो दिन') || lower.includes('2 दिन') || lower.includes('२ दिन') || lower.includes('two days') || lower.includes('2 days') || lower.includes('२ दिवस')) {
              appState.complaint.duration = { value: 2, unit: 'days' };
            } else if (lower.includes('एक दिवस') || lower.includes('एक दिन') || lower.includes('1 दिन') || lower.includes('१ दिन') || lower.includes('one day') || lower.includes('1 day') || lower.includes('काल')) {
              appState.complaint.duration = { value: 1, unit: 'days' };
            } else if (lower.includes('हफ्ते') || lower.includes('हफ्ता') || lower.includes('week') || lower.includes('आठवडा')) {
              appState.complaint.duration = { min: 7, max: 7, unit: 'days' };
            } else if (lower.includes('काफी समय') || lower.includes('बहुत दिनों') || lower.includes('खूप दिवसां')) {
              appState.complaint.duration = { value: null, raw: 'काफी समय से', precision: 'vague' };
            } else {
              appState.complaint.duration = null;
            }

            notifyStateChange('voice');
            router.renderCurrentScreen();
            return;
          }

          // Safe non-technical error handling
          if (micBtn) {
            micBtn.classList.remove('listening');
            micBtn.removeAttribute('disabled');
          }
          if (statusText) {
            const fallbackMsg = lang === 'mr' 
              ? 'आवाज स्पष्ट ऐकू आला नाही. पुन्हा बोलण्यासाठी माईक दाबा किंवा खालील पर्याय निवडा.' 
              : (lang === 'hi' ? 'आवाज़ स्पष्ट सुनाई नहीं दी। पुनः बोलने के लिए माइक दबाएं या नीचे विकल्प चुनें।' : 'Could not hear speech clearly. Tap microphone to speak again or select below.');
            statusText.textContent = (error === 'ASR_RUNTIME_UNAVAILABLE') 
              ? (t('voiceUnavailable', lang) || 'Voice service is temporarily unavailable. Please select below.') 
              : (message || fallbackMsg);
          }
          notifyStateChange('voice');
        });
      });

      // 2. Voice Confirm Click
      document.getElementById('btn-voice-confirm')?.addEventListener('click', () => {
        appState.voice.status = 'IDLE';
        appState.complaint.initialComplaintTranscript = appState.complaint.textPatientSpoken;
        notifyStateChange('complaint');
        router.navigate('conversation');
      });

      // 3. Voice Retry Click
      document.getElementById('btn-voice-retry')?.addEventListener('click', () => {
        appState.voice.status = 'IDLE';
        appState.voice.transcript = null;
        notifyStateChange('voice');
        router.renderCurrentScreen();
      });

      // 4. Touch Option Tile Click
      document.querySelectorAll('.option-tile[data-complaint-id]').forEach((tile) => {
        tile.addEventListener('click', () => {
          const complaintId = tile.getAttribute('data-complaint-id');
          resetClinicalSession(false);
          appState.complaint.id = complaintId;
          appState.complaint.textPatientSpoken = null;
          appState.complaint.initialComplaintTranscript = null;
          appState.complaint.duration = null;
          if (complaintId === 'KNEE_PAIN') appState.complaint.location = 'knee';
          else if (complaintId === 'SHOULDER_PAIN') appState.complaint.location = 'shoulder';
          else if (complaintId === 'CHEST_PAIN') appState.complaint.location = 'chest';
          else if (complaintId === 'STOMACH') appState.complaint.location = 'abdomen';
          else if (complaintId === 'HEADACHE') appState.complaint.location = 'head';
          else appState.complaint.location = null;

          notifyStateChange('complaint');
          router.navigate('conversation');
        });
      });

      // 5. Back Action
      document.getElementById('btn-complaint-back')?.addEventListener('click', () => {
        router.navigate('opdSelection');
      });

      // 6. Audio Prompt Click
      const audioBtn = document.getElementById('btn-complaint-audio');
      audioBtn?.addEventListener('click', async () => {
        if (audioController.isSpeaking) {
          audioController.stop();
          audioBtn.classList.remove('playing');
          return;
        }
        if (audioController.isMuted) {
          audioController.setMuted(false);
        }
        audioBtn.classList.add('playing');
        await audioController.speak(t('complaintTitle', appState.language), appState.language);
        audioBtn.classList.remove('playing');
      });
    },
  };
}
