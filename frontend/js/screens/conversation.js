/**
 * Screen 7: Dynamic Conversational History Screen
 * Driven entirely by the backend Clinical Question Engine.
 */

import { t } from '../i18n.js';
import { appState, notifyStateChange, registerResetCallback } from '../state.js';
import { router } from '../router.js';
import { api } from '../api.js';
import { ttsService } from '../services/ttsService.js';
import { audioController } from '../audio.js';
import { renderVoiceButton } from '../components/voiceButton.js';
import { speechService } from '../services/speechService.js';
import { MOCK_QUESTION_FLOW } from '../mock/mockQuestions.js';

let currentBackendQuestion = null;
let currentProgress = null;
let isInitializing = false;
let fallbackIndex = 0;

export function resetConversationState() {
  currentBackendQuestion = null;
  currentProgress = null;
  isInitializing = false;
  fallbackIndex = 0;
}
export const resetConversationIndex = resetConversationState;

registerResetCallback(() => {
  resetConversationState();
});

export function renderConversationScreen() {
  const lang = appState.language;

  // 1. Initializing state
  if (!appState.backendSessionId && !isInitializing && !currentBackendQuestion) {
    isInitializing = true;
    initBackendSession(lang);
    return {
      html: `
        <div class="screen-card" style="text-align: center; align-items: center; padding: 4rem 2rem; max-width: 800px; margin: 0 auto;">
          <div style="font-size: 3rem; margin-bottom: 1rem; color: var(--primary);">🩺</div>
          <h2 class="kiosk-question-title" style="color: var(--primary);">${t('processingVoice', lang) || 'Connecting to clinical engine...'}</h2>
          <p style="font-size: var(--font-size-sm); color: var(--muted-text); margin-top: 0.5rem;">Preparing your clinical history questions</p>
        </div>
      `,
      attachEvents: () => {},
    };
  }

  // 2. Resolve Active Question (Backend Engine or Fallback)
  let qText = '';
  let qOptions = [];
  let qId = '';
  let qInputType = 'single-choice';

  if (currentBackendQuestion) {
    qId = currentBackendQuestion.id;
    qText = currentBackendQuestion.text;
    qInputType = currentBackendQuestion.inputType;
    qOptions = (currentBackendQuestion.options || []).map((opt) => {
      if (typeof opt === 'object' && opt !== null) {
        return {
          value: opt.value ?? opt.id ?? opt.label ?? opt,
          label: opt.label || opt.labels?.[lang] || opt.labels?.mr || opt.labels?.en || opt.value || String(opt),
          icon: opt.icon || '👉',
        };
      }
      return {
        value: opt,
        label: String(opt),
        icon: '👉',
      };
    });
  } else {
    // Fallback static question
    const fallbackNode = MOCK_QUESTION_FLOW[fallbackIndex] || MOCK_QUESTION_FLOW[0];
    qId = fallbackNode.id;
    qText = t(fallbackNode.titleKey, lang);
    qInputType = fallbackNode.inputType;
    qOptions = fallbackNode.options.map((opt) => ({
      value: opt.value,
      label: t(opt.labelKey, lang),
      icon: opt.icon,
    }));
  }

  appState.activeQuestionId = qId;

  // Render Options
  const optionsHtml = qOptions
    .map((opt, idx) => {
      return `
        <div class="option-tile" data-opt-idx="${idx}">
          <div class="option-tile-icon">${opt.icon || '👉'}</div>
          <div class="option-tile-text">${opt.label}</div>
        </div>
      `;
    })
    .join('');

  // Voice widget integration
  const voiceWidgetHtml = renderVoiceButton({
    status: appState.voice.status,
    transcript: appState.voice.transcript,
    interpreted: appState.latestNormalizedAnswer,
  });

  const progressLabel = currentProgress
    ? `${currentProgress.completed} / ~${currentProgress.totalEstimated}`
    : `${fallbackIndex + 1} / 3`;

  const html = `
    <div class="screen-card" style="max-width: 1040px; margin: 0 auto;">
      <!-- Audio Prompt Listener -->
      <button id="btn-question-audio" class="audio-prompt-bar">
        <span aria-hidden="true">🔊</span>
        <span>${t('listen', lang)}</span>
      </button>

      <!-- Active Clinical Question Header -->
      <h1 class="kiosk-question-title" style="color: var(--primary); font-size: var(--font-size-2xl); margin-bottom: 0.35rem;">
        ${qText}
      </h1>
      <p style="font-size: var(--font-size-sm); color: var(--muted-text); margin-bottom: 1.5rem;">
        Speak your answer using the microphone or select one of the options below.
      </p>

      <!-- Multimodal Voice Section -->
      ${voiceWidgetHtml}

      <!-- Options Grid -->
      <div class="option-grid">
        ${optionsHtml}
      </div>

      <!-- Footer Action Row -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid var(--border-subtle);">
        <button id="btn-conv-back" class="btn btn-secondary" style="min-height: 50px;">
          ← ${t('back', lang)}
        </button>

        <div style="display: flex; align-items: center; gap: 1.5rem;">
          <div style="font-size: var(--font-size-xs); font-weight: 700; color: var(--muted-text);">
            ${t('step', lang)}: ${progressLabel}
          </div>

          <button id="btn-conv-skip" class="btn btn-secondary" style="font-size: var(--font-size-xs); min-height: 50px;">
            ${t('skip', lang)} ➔
          </button>
        </div>
      </div>
    </div>
  `;

  return {
    html,
    attachEvents: () => {
      // 1. Audio Speak Button
      const audioBtn = document.getElementById('btn-question-audio');
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
        await audioController.speak(qText, lang);
        audioBtn.classList.remove('playing');
      });

      // 2. Option Selection Click
      document.querySelectorAll('.option-tile[data-opt-idx]').forEach((tile) => {
        tile.addEventListener('click', async () => {
          ttsService.stop();

          const idx = parseInt(tile.getAttribute('data-opt-idx'), 10);
          const selectedOption = qOptions[idx];
          if (!selectedOption) return;

          tile.classList.add('selected');
          const chosenLabel = typeof selectedOption === 'object' && selectedOption !== null
            ? (selectedOption.label || selectedOption.value)
            : String(selectedOption);
          const chosenValue = typeof selectedOption === 'object' && selectedOption !== null
            ? (selectedOption.value ?? selectedOption.id ?? selectedOption.label)
            : selectedOption;
          appState.latestPatientResponseTranscript = chosenLabel;
          await handleAnswerSubmission(chosenValue, 'TOUCH');
        });
      });

      // 3. Voice Mic Click
      document.getElementById('btn-voice-mic')?.addEventListener('click', () => {
        ttsService.stop();

        if (speechService.isListening()) {
          speechService.stopListening();
          return;
        }

        const micBtn = document.getElementById('btn-voice-mic');
        const statusText = document.querySelector('.voice-status-text');

        speechService.startListening(
          appState.language,
          ({ status, transcript, message }) => {
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
              notifyStateChange('voice');
              router.renderCurrentScreen();
              return;
            }

            // Safe error fallback
            if (micBtn) {
              micBtn.classList.remove('listening');
              micBtn.removeAttribute('disabled');
            }
            if (statusText) {
              const fallbackMsg = lang === 'mr' 
                ? 'आवाज स्पष्ट ऐकू आला नाही. पुन्हा बोलण्यासाठी माईक दाबा किंवा खालील पर्याय निवडा.' 
                : (lang === 'hi' ? 'आवाज़ स्पष्ट सुनाई नहीं दी। पुनः बोलने के लिए माइक दबाएं या नीचे विकल्प चुनें।' : 'Could not hear speech clearly. Tap microphone to speak again or select below.');
              statusText.textContent = (message || fallbackMsg);
            }
            notifyStateChange('voice');
          },
          {
            questionId: qId,
            sessionId: appState.backendSessionId,
          }
        );
      });

      // 4. Voice Confirm Click
      document.getElementById('btn-voice-confirm')?.addEventListener('click', async () => {
        ttsService.stop();
        const transcript = appState.voice.transcript;
        appState.voice.status = 'IDLE';
        appState.voice.transcript = null;
        appState.latestPatientResponseTranscript = transcript;
        notifyStateChange('voice');

        await handleAnswerSubmission(transcript, 'VOICE');
      });

      // 5. Voice Retry Click
      document.getElementById('btn-voice-retry')?.addEventListener('click', () => {
        appState.voice.status = 'IDLE';
        appState.voice.transcript = null;
        notifyStateChange('voice');
        router.renderCurrentScreen();
      });

      // 6. Skip Button
      document.getElementById('btn-conv-skip')?.addEventListener('click', async () => {
        await handleAnswerSubmission('unknown', 'TOUCH');
      });

      // 7. Back Button
      document.getElementById('btn-conv-back')?.addEventListener('click', () => {
        router.navigate('chiefComplaint');
      });
    },
  };
}

async function initBackendSession(lang) {
  try {
    const sessionRes = await api.createClinicalSession({
      patientId: appState.patient?.id || null,
      encounterId: appState.encounter?.id || null,
      language: lang,
      opdMode: appState.opdMode || 'GENERAL',
    });

    if (sessionRes?.success && sessionRes.data?.sessionId) {
      appState.backendSessionId = sessionRes.data.sessionId;

      let complaintValue = null;
      if (appState.complaint?.id === 'DIARRHEA') complaintValue = 'diarrhea';
      else if (appState.complaint?.id === 'KNEE_PAIN') complaintValue = 'knee_pain';
      else if (appState.complaint?.id === 'SHOULDER_PAIN') complaintValue = 'shoulder_pain';
      else if (appState.complaint?.id === 'CHEST_PAIN') complaintValue = 'chest_pain';
      else if (appState.complaint?.id === 'FEVER') complaintValue = 'fever';
      else if (appState.complaint?.id === 'COUGH') complaintValue = 'cough';
      else if (appState.complaint?.id === 'BREATHING') complaintValue = 'breathing';
      else if (appState.complaint?.id === 'HEADACHE') complaintValue = 'headache';
      else if (appState.complaint?.id === 'STOMACH') complaintValue = 'stomach';
      else if (appState.complaint?.textPatientSpoken) complaintValue = appState.complaint.textPatientSpoken;
      else complaintValue = 'unknown';

      const isSpoken = Boolean(appState.complaint?.textPatientSpoken);
      const recordRes = await api.recordClinicalResponse(appState.backendSessionId, {
        questionId: 'q.chief_complaint',
        rawResponse: appState.complaint?.textPatientSpoken || complaintValue,
        normalizedValue: isSpoken ? null : complaintValue,
        inputMethod: isSpoken ? 'VOICE' : 'TOUCH',
        language: lang,
      });

      if (recordRes?.success) {
        if (recordRes.data?.clinicalSummary) {
          const sum = recordRes.data.clinicalSummary;
          if (sum.primaryConcern) appState.complaint.primaryConcern = sum.primaryConcern;
          if (sum.duration !== undefined) appState.complaint.duration = sum.duration;
          if (sum.severity) appState.complaint.severity = sum.severity;
          if (sum.location) appState.complaint.location = sum.location;
        }

        const ccQuestionText = lang === 'mr' ? 'तुम्हाला काय त्रास होतोय?' : lang === 'hi' ? 'आपको क्या तकलीफ हो रही है?' : 'What problem are you experiencing?';
        appState.conversationHistory = [{
          questionId: 'q.chief_complaint',
          questionText: ccQuestionText,
          patientResponse: appState.complaint?.textPatientSpoken || complaintValue,
          originalTranscript: isSpoken ? appState.complaint.textPatientSpoken : null,
          normalizedAnswer: recordRes.data?.recorded || complaintValue,
          selectedOption: appState.complaint?.textPatientSpoken || complaintValue,
          inputMethod: isSpoken ? 'VOICE' : 'TOUCH',
          timestamp: new Date().toISOString(),
        }];

        if (recordRes.data?.next?.question) {
          currentBackendQuestion = recordRes.data.next.question;
          currentProgress = recordRes.data.next.progress;
          appState.currentQuestionSource = currentBackendQuestion.source || 'LLM_DYNAMIC';
        } else if (sessionRes.data.next?.question) {
          currentBackendQuestion = sessionRes.data.next.question;
          currentProgress = sessionRes.data.next.progress;
          appState.currentQuestionSource = currentBackendQuestion.source || 'LLM_DYNAMIC';
        }
      } else if (sessionRes.data.next?.question) {
        currentBackendQuestion = sessionRes.data.next.question;
        currentProgress = sessionRes.data.next.progress;
        appState.currentQuestionSource = currentBackendQuestion.source || 'LLM_DYNAMIC';
      }
    }
  } catch (err) {
    console.warn('[Conversation] Backend session init error, using fallback:', err);
  } finally {
    isInitializing = false;
    router.renderCurrentScreen();
  }
}

async function handleAnswerSubmission(value, inputMethod) {
  if (appState.backendSessionId && currentBackendQuestion) {
    appState.latestAnswerQuestionId = currentBackendQuestion.id;
    try {
      const isVoice = inputMethod === 'VOICE';
      const recordRes = await api.recordClinicalResponse(appState.backendSessionId, {
        questionId: currentBackendQuestion.id,
        rawResponse: value,
        normalizedValue: isVoice ? null : value,
        inputMethod,
        language: appState.language,
      });

      if (recordRes?.status === 409 || recordRes?.error === 'STALE_QUESTION_SUBMISSION') {
        console.warn('[Conversation] Stale question submission detected. Re-synchronizing...');
        const refreshRes = await api.getNextClinicalQuestion(appState.backendSessionId, appState.language);
        if (refreshRes?.data?.question) {
          currentBackendQuestion = refreshRes.data.question;
          appState.activeQuestionId = currentBackendQuestion.id;
          currentProgress = refreshRes.data.progress;
          appState.currentQuestionSource = currentBackendQuestion.source || 'LLM_DYNAMIC';
        }
        notifyStateChange('conversation');
        router.renderCurrentScreen();
        return;
      }

      if (recordRes?.success) {
        if (recordRes.data?.clinicalSummary) {
          const sum = recordRes.data.clinicalSummary;
          if (sum.primaryConcern) appState.complaint.primaryConcern = sum.primaryConcern;
          if (sum.duration !== undefined) appState.complaint.duration = sum.duration;
          if (sum.severity) appState.complaint.severity = sum.severity;
          if (sum.location) appState.complaint.location = sum.location;
        }

        if (recordRes.data?.answersCurrentQuestion === false) {
          appState.latestNormalizedAnswer = 'INCIDENTAL_FACT_RECORDED';
          appState.latestSelectedOption = null;
          notifyStateChange('conversation');
          router.renderCurrentScreen();
          return;
        }

        const selectedOption = recordRes.data?.selectedOption;
        const mappedLabel =
          typeof selectedOption === 'object' && selectedOption !== null
            ? (selectedOption.label || selectedOption.value)
            : selectedOption;

        appState.latestSelectedOption =
          mappedLabel || (typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? ''));

        if (recordRes.data?.recorded?.attribute) {
          appState.latestNormalizedAnswer = `${recordRes.data.recorded.attribute} = ${recordRes.data.recorded.value}`;
        } else if (recordRes.data?.recorded) {
          appState.latestNormalizedAnswer = JSON.stringify(recordRes.data.recorded);
        } else {
          appState.latestNormalizedAnswer = String(recordRes.data?.recorded?.value ?? value ?? 'null');
        }

        appState.conversationHistory.push({
          questionId: currentBackendQuestion.id,
          questionText: currentBackendQuestion.text,
          patientResponse: value,
          originalTranscript: isVoice && typeof value === 'string' ? value : null,
          normalizedAnswer: recordRes.data?.recorded || null,
          selectedOption: appState.latestSelectedOption,
          inputMethod,
          options: currentBackendQuestion.options || [],
          timestamp: new Date().toISOString(),
        });

        const nextResult = recordRes.data?.next;
        if (nextResult?.status === 'complete') {
          router.navigate('documents');
          return;
        }
        currentBackendQuestion = nextResult?.question;
        currentProgress = nextResult?.progress;
        appState.currentQuestionSource = currentBackendQuestion?.source || 'LLM_DYNAMIC';
        appState.activeQuestionId = currentBackendQuestion?.id || null;
        notifyStateChange('conversation');
        router.renderCurrentScreen();
        return;
      } else {
        appState.latestNormalizedAnswer = 'UNVERIFIED_VOICE';
        appState.latestSelectedOption = null;
        notifyStateChange('conversation');
        router.renderCurrentScreen();
        return;
      }
    } catch (e) {
      console.warn('[Conversation] Answer recording error:', e);
      appState.latestNormalizedAnswer = 'ERROR';
      appState.latestSelectedOption = null;
      notifyStateChange('conversation');
      router.renderCurrentScreen();
      return;
    }
  }

  // Fallback progression ONLY if offline / zero backendSessionId
  if (!appState.backendSessionId) {
    if (fallbackIndex < MOCK_QUESTION_FLOW.length - 1) {
      fallbackIndex++;
      router.renderCurrentScreen();
    } else {
      fallbackIndex = 0;
      router.navigate('documents');
    }
  }
}
