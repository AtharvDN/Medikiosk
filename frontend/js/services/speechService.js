/**
 * Speech Recognition Service Abstraction (Phase 5 & 8 Sovereign Voice)
 * Strictly response-driven, request-correlated, and dynamic.
 * Zero browser SpeechRecognition production fallback.
 * Discrete states: IDLE | LISTENING | PROCESSING | RECOGNIZED | ERROR | SERVICE_UNAVAILABLE
 */

import { api } from '../api.js';

class SpeechService {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.status = 'IDLE';
    this.timer = null;
    this.activeRequestId = null;
  }

  /**
   * Primary entry point for speech listening.
   * Captures raw acoustic microphone stream and submits to sovereign IndicConformer ASR.
   * Never falls back to browser speech recognition.
   */
  async startListening(lang = 'mr', onStateChange, context = {}) {
    const notify = typeof onStateChange === 'function' ? onStateChange : () => {};
    const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}`;
    this.activeRequestId = requestId;
    this.status = 'LISTENING';

    notify({
      status: this.status,
      requestId,
      transcript: null,
    });

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      console.warn('[Speech] Microphone capture hardware or MediaRecorder API unavailable.');
      this.status = 'SERVICE_UNAVAILABLE';
      notify({
        status: 'SERVICE_UNAVAILABLE',
        error: 'NO_SPEECH_HARDWARE',
        message: 'Voice service is temporarily unavailable. Please try again or use the buttons below.',
        transcript: null,
        requestId,
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const activeTrack = stream.getAudioTracks()[0];
      const deviceSettings = activeTrack?.getSettings?.() || {};
      const startTime = Date.now();

      this.audioChunks = [];

      // Detect supported MIME type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      }

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const durationMs = Date.now() - startTime;
        stream.getTracks().forEach((track) => track.stop());

        if (this.activeRequestId !== requestId) {
          console.warn('[Speech] Discarding recording for stale request:', requestId);
          return;
        }

        const blob = new Blob(this.audioChunks, { type: mimeType });
        await this.processAudioBlob(blob, notify, { ...context, lang, requestId, durationMs, deviceSettings });
      };

      // Collect audio chunks every 250ms for reliable streaming buffer
      this.mediaRecorder.start(250);

      // Automatically stop recording after 8.0 seconds of active speech capture
      this.timer = setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
        }
      }, 8000);

    } catch (err) {
      console.warn('[Speech] getUserMedia failed:', err);
      const isPermissionDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const errorCode = isPermissionDenied ? 'MIC_PERMISSION_DENIED' : 'NO_AUDIO_PROVIDED';
      this.status = 'ERROR';
      notify({
        status: 'ERROR',
        error: errorCode,
        message: isPermissionDenied
          ? 'Microphone permission was denied. Please allow microphone access or select an option below.'
          : 'Could not access microphone hardware. Please select an option below.',
        transcript: null,
        requestId,
      });
    }
  }

  /**
   * Processes a captured audio Blob, converts to base64, runs diagnostics, and invokes ASR
   */
  async processAudioBlob(blob, onStateChange, context = {}) {
    const notify = typeof onStateChange === 'function' ? onStateChange : () => {};
    const requestId = context.requestId || this.activeRequestId || `req_${Date.now()}`;
    const lang = context.lang || 'mr';
    const durationMs = context.durationMs || 0;
    const deviceSettings = context.deviceSettings || {};

    this.status = 'PROCESSING';
    this.lastTranscript = null;
    this.lastError = null;
    notify({ status: this.status, requestId });

    if (!blob || blob.size === 0) {
      this.status = 'ERROR';
      this.lastTranscript = null;
      this.lastError = { code: 'EMPTY_AUDIO', message: 'No speech detected.' };
      notify({
        status: 'ERROR',
        error: 'EMPTY_AUDIO',
        message: 'No speech detected. Please speak clearly at normal volume or select an option below.',
        transcript: null,
        requestId,
      });
      return;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onloadend = async () => {
        if (this.activeRequestId && this.activeRequestId !== requestId) {
          console.warn('[Speech] Discarding base64 conversion for stale request:', requestId);
          resolve();
          return;
        }

        const base64Audio = reader.result ? reader.result.split(',')[1] || '' : '';

        // Diagnostic logging for development & troubleshooting (Section 8)
        console.info('[Speech Diagnostic]', {
          requestId,
          mimeType: blob.type || 'audio/webm',
          sizeBytes: blob.size,
          durationMs,
          deviceId: deviceSettings.deviceId || 'default',
          autoGainControl: deviceSettings.autoGainControl ?? true,
          hasUsableAudio: blob.size > 200,
        });

        if (!base64Audio || blob.size < 200) {
          this.status = 'ERROR';
          this.lastTranscript = null;
          this.lastError = { code: 'EMPTY_AUDIO', message: 'No speech detected.' };
          notify({
            status: 'ERROR',
            error: 'EMPTY_AUDIO',
            message: 'No speech detected. Please speak clearly at normal volume or select an option below.',
            transcript: null,
            requestId,
          });
          resolve();
          return;
        }

        try {
          // Transition to TRANSCRIBING while waiting for backend ASR response (Phase 8.1)
          this.status = 'TRANSCRIBING';
          notify({ status: this.status, requestId });

          // 8-second realistic timeout for backend ASR inference
          const asrPromise = api.transcribeAudio({
            audioBase64: base64Audio,
            language: lang,
            questionId: context.questionId || null,
            sessionId: context.sessionId || null,
            requestId,
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('ASR_TIMEOUT')), 8000)
          );

          const asrStartTime = Date.now();
          let res;
          try {
            res = await Promise.race([asrPromise, timeoutPromise]);
          } catch (raceErr) {
            console.warn('[Speech] ASR network timeout or failure:', raceErr.message);
            const isOffline = raceErr.message?.includes('offline') || raceErr.message?.includes('refused') || raceErr.message?.includes('network');
            res = {
              success: false,
              error: raceErr.message === 'ASR_TIMEOUT' ? 'ASR_TIMEOUT' : (isOffline ? 'ASR_RUNTIME_UNAVAILABLE' : 'ASR_FAILED'),
            };
          }

          const asrLatency = Date.now() - asrStartTime;
          console.info('[Speech ASR Latency]', `${asrLatency}ms`, 'Success:', res?.success);

          if (this.activeRequestId && this.activeRequestId !== requestId) {
            console.warn('[Speech] Discarding ASR result for stale request:', requestId);
            resolve();
            return;
          }

          const resolvedTranscript = res.success && res.data?.transcript ? res.data.transcript.trim() : '';

          if (resolvedTranscript) {
            this.status = 'SUCCESS';
            this.lastTranscript = resolvedTranscript;
            notify({
              status: 'SUCCESS',
              transcript: resolvedTranscript,
              confidence: res.data?.confidence || 0.95,
              provider: res.data?.provider || 'indicconformer-runtime',
              latency: asrLatency,
              requestId,
            });
          } else {
            const rawError = res.error || 'ASR_FAILED';
            let errorCode = 'ASR_FAILED';
            if (rawError === 'ASR_SERVICE_OFFLINE' || rawError === 'ECONNREFUSED' || rawError === 'ASR_RUNTIME_UNAVAILABLE') {
              errorCode = 'ASR_RUNTIME_UNAVAILABLE';
            } else if (rawError === 'ASR_TIMEOUT' || rawError === 'ASR_CLIENT_TIMEOUT') {
              errorCode = 'ASR_TIMEOUT';
            } else if (rawError === 'EMPTY_AUDIO') {
              errorCode = 'EMPTY_AUDIO';
            } else if (rawError === 'NO_AUDIO_PROVIDED') {
              errorCode = 'NO_AUDIO_PROVIDED';
            }

            console.warn('[Speech] ASR failure:', errorCode);
            this.status = 'ERROR';
            this.lastError = { code: errorCode, message: res.message };
            notify({
              status: 'ERROR',
              error: errorCode,
              message: res.message || 'Speech not recognized. Please tap to speak again or choose below.',
              transcript: null,
              requestId,
            });
          }
        } catch (err) {
          console.warn('[Speech] ASR communication error:', err.message);
          this.status = 'ERROR';
          this.lastError = { code: 'ASR_RUNTIME_UNAVAILABLE', message: err.message };
          notify({
            status: 'ERROR',
            error: 'ASR_RUNTIME_UNAVAILABLE',
            message: 'Voice service is temporarily unavailable. Please try again or use the buttons below.',
            transcript: null,
            requestId,
          });
        }
        resolve();
      };

      reader.readAsDataURL(blob);
    });
  }

  isListening() {
    return this.status === 'LISTENING' || (this.mediaRecorder && this.mediaRecorder.state === 'recording');
  }

  stopListening() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.status = 'PROCESSING';
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.warn('[Speech] Error stopping mediaRecorder:', e);
        this.status = 'IDLE';
      }
    } else {
      this.status = 'IDLE';
    }
  }

  getDiagnostics() {
    return {
      status: this.status,
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000,
      activeRequestId: this.activeRequestId,
    };
  }

  /**
   * Test helper for unit test suites
   */
  fallbackMock(lang, onStateChange) {
    if (this.timer) clearTimeout(this.timer);
    this.status = 'IDLE';
    onStateChange({ status: 'IDLE', transcript: null });
  }
}

export const speechService = new SpeechService();
