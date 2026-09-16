/**
 * MediKiosk TTS Service & Provider Abstraction (Section 10 - 25)
 * Solves voice quality bottleneck, provides clean provider abstraction ready for Phase 5 (IndicF5),
 * selects language-specific voices (en-IN, hi-IN, mr-IN), chunks utterances naturally,
 * and gracefully falls back to Indian synthesizer voices when native voices are missing.
 */

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  (typeof window !== 'undefined' && (window.__MEDIKIOSK_API_URL__ || window.ENV?.VITE_API_URL)) ||
  '/api';

export class BrowserTTSProvider {
  constructor() {
    this.name = 'browser-speech-synthesis';
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.audioCtx = null;
    this.voices = [];
    this.activeUtterances = [];
    this._initVoices();
  }

  _initVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices() || [];
    if (typeof this.synth.onvoiceschanged !== 'undefined') {
      this.synth.onvoiceschanged = () => {
        const updated = this.synth.getVoices();
        if (updated && updated.length > 0) {
          this.voices = updated;
        }
      };
    }
  }

  getVoices() {
    if (!this.synth) return this.voices || [];
    const current = this.synth.getVoices();
    if (current && current.length > 0) {
      this.voices = current;
    }
    return this.voices || [];
  }

  /**
   * Identifies if an authentic, native voice exists for the target language.
   */
  getNativeVoice(lang) {
    const voices = this.getVoices();
    if (!voices || voices.length === 0) return null;
    const normalized = (lang || 'en').toLowerCase().trim();

    if (normalized.startsWith('mr')) {
      return (
        voices.find((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('mr')) ||
        voices.find((v) => v.name && (v.name.toLowerCase().includes('marathi') || v.name.includes('मराठी'))) ||
        null
      );
    }

    if (normalized.startsWith('hi')) {
      return (
        voices.find((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('hi')) ||
        voices.find(
          (v) =>
            v.name &&
            (v.name.toLowerCase().includes('hindi') ||
              v.name.includes('हिन्दी') ||
              v.name.toLowerCase().includes('kalpana') ||
              v.name.toLowerCase().includes('hemant'))
        ) ||
        null
      );
    }

    if (normalized.startsWith('en')) {
      return (
        voices.find(
          (v) => v.lang && (v.lang.toLowerCase() === 'en-in' || v.lang.toLowerCase().replace('_', '-') === 'en-in')
        ) ||
        voices.find(
          (v) =>
            v.lang &&
            v.lang.toLowerCase().startsWith('en') &&
            (v.name.toLowerCase().includes('india') ||
              v.name.toLowerCase().includes('heera') ||
              v.name.toLowerCase().includes('ravi'))
        ) ||
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en')) ||
        null
      );
    }

    return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(normalized)) || null;
  }

  /**
   * Prioritized language-specific voice discovery & fallback chain (Section 12, 13, 14, 23)
   * Selection Priority:
   * 1. Exact native locale voice (mr-IN, hi-IN, en-IN)
   * 2. If allowFallback is true:
   *    - For Marathi: Native Hindi voice -> Indian English (Heera/Ravi) -> Default
   *    - For Hindi: Indian English (Heera/Ravi) -> Default
   *    - For English: Indian English -> Any English -> Default
   */
  getBestVoice(lang = 'en', allowFallback = true) {
    const native = this.getNativeVoice(lang);
    if (native) return native;
    if (!allowFallback) return null;

    const voices = this.getVoices();
    if (!voices || voices.length === 0) return null;

    const normalized = (lang || 'en').toLowerCase().trim();

    // 1. Marathi Fallback Chain (Section 23)
    if (normalized.startsWith('mr')) {
      // 1a. Native Hindi voice reads Devanagari phonetically closest
      const hiVoice = this.getNativeVoice('hi');
      if (hiVoice) return hiVoice;

      // 1b. Indian English voice (Heera / Ravi) with Indian phonological cadence
      const indianVoice = voices.find(
        (v) =>
          v.lang &&
          v.lang.toLowerCase().startsWith('en') &&
          (v.lang.toLowerCase().includes('in') ||
            v.name.toLowerCase().includes('india') ||
            v.name.toLowerCase().includes('heera') ||
            v.name.toLowerCase().includes('ravi'))
      );
      if (indianVoice) return indianVoice;

      return voices.find((v) => v.default) || voices[0] || null;
    }

    // 2. Hindi Fallback Chain
    if (normalized.startsWith('hi')) {
      const indianVoice = voices.find(
        (v) =>
          v.lang &&
          v.lang.toLowerCase().startsWith('en') &&
          (v.lang.toLowerCase().includes('in') ||
            v.name.toLowerCase().includes('india') ||
            v.name.toLowerCase().includes('heera') ||
            v.name.toLowerCase().includes('ravi'))
      );
      if (indianVoice) return indianVoice;

      return voices.find((v) => v.default) || voices[0] || null;
    }

    // 3. English Fallback Chain
    if (normalized.startsWith('en')) {
      const indianVoice = voices.find(
        (v) =>
          v.lang &&
          v.lang.toLowerCase().startsWith('en') &&
          (v.lang.toLowerCase().includes('in') ||
            v.name.toLowerCase().includes('india') ||
            v.name.toLowerCase().includes('heera') ||
            v.name.toLowerCase().includes('ravi'))
      );
      if (indianVoice) return indianVoice;

      const anyEnglish = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
      if (anyEnglish) return anyEnglish;

      return voices.find((v) => v.default) || voices[0] || null;
    }

    return (
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(normalized)) ||
      voices.find((v) => v.default) ||
      voices[0] ||
      null
    );
  }

  /**
   * Honest voice status inspection (Section 14 & 25)
   * Clearly distinguishes:
   * - 'natively_supported'
   * - 'fallback'
   * - 'unavailable'
   */
  getVoiceStatus(lang = 'en') {
    const native = this.getNativeVoice(lang);
    const fallback = this.getBestVoice(lang, true);
    const normalized = (lang || 'en').toLowerCase().trim();

    if (normalized.startsWith('mr')) {
      if (native) {
        return {
          supported: true,
          status: 'natively_supported',
          isFallback: false,
          voiceName: native.name,
          locale: native.lang,
          message: `Marathi TTS: Supported natively (${native.name})`,
        };
      }
      return {
        supported: Boolean(fallback),
        status: fallback ? 'fallback' : 'unavailable',
        isFallback: true,
        voiceName: fallback?.name || null,
        locale: 'mr-IN',
        fallbackLocale: fallback?.lang || null,
        message: fallback
          ? `Marathi TTS: fallback (${fallback.name} - Host OS lacks native mr-IN voice)`
          : 'Marathi TTS: unavailable (No speech synthesizer voices found on device)',
      };
    }

    if (normalized.startsWith('hi')) {
      if (native) {
        return {
          supported: true,
          status: 'natively_supported',
          isFallback: false,
          voiceName: native.name,
          locale: native.lang,
          message: `Hindi TTS: Supported natively (${native.name})`,
        };
      }
      return {
        supported: Boolean(fallback),
        status: fallback ? 'fallback' : 'unavailable',
        isFallback: true,
        voiceName: fallback?.name || null,
        locale: 'hi-IN',
        fallbackLocale: fallback?.lang || null,
        message: fallback
          ? `Hindi TTS: fallback (${fallback.name} - Host OS lacks native hi-IN voice)`
          : 'Hindi TTS: unavailable (No speech synthesizer voices found on device)',
      };
    }

    if (native) {
      const isIndian = native.lang?.toLowerCase().includes('in') || native.name?.toLowerCase().includes('india');
      return {
        supported: true,
        status: isIndian ? 'natively_supported' : 'fallback',
        isFallback: !isIndian,
        voiceName: native.name,
        locale: native.lang,
        message: `English TTS: Supported (${native.name})`,
      };
    }

    return {
      supported: Boolean(fallback),
      status: fallback ? 'fallback' : 'unavailable',
      isFallback: true,
      voiceName: fallback?.name || null,
      locale: 'en-IN',
      message: fallback ? `English TTS: fallback (${fallback.name})` : 'English TTS: unavailable',
    };
  }

  /**
   * Sentence Processing & Natural Chunking (Section 20)
   * Breaks compound/complex sentences into natural conversational utterances.
   */
  processUtterances(text) {
    if (!text || typeof text !== 'string') return [];

    // 1. Strip HTML tags, markdown symbols, and bracketed hints
    let cleaned = text
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 2. Split on natural punctuation boundaries: Danda (।), Question Mark (?), Exclamation (!), Period (.)
    const sentenceDelimiters = /([।?!.])/;
    const parts = cleaned.split(sentenceDelimiters);

    const chunks = [];
    for (let i = 0; i < parts.length; i += 2) {
      const sentence = parts[i]?.trim();
      const punct = parts[i + 1] || '';
      if (sentence) {
        if (sentence.length > 80 && /[,;]/.test(sentence)) {
          const subClauses = sentence.split(/[,;]/);
          subClauses.forEach((sc, idx) => {
            const scTrimmed = sc.trim();
            if (scTrimmed) {
              chunks.push(idx === subClauses.length - 1 ? `${scTrimmed}${punct}` : `${scTrimmed},`);
            }
          });
        } else {
          chunks.push(`${sentence}${punct}`);
        }
      }
    }

    return chunks.length > 0 ? chunks : [cleaned];
  }

  /**
   * Soft harmonic hospital chime (tactile feedback)
   */
  playChime() {
    try {
      const AudioContextClass = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
      if (!AudioContextClass) return;
      if (!this.audioCtx) this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.31);
    } catch (e) {
      // AudioContext warning suppressed
    }
  }

  /**
   * Speak text with natural speech tuning, multi-utterance queueing, and fallback voice handling (Section 19, 20, 23)
   */
  speak(text, lang = 'en', options = {}) {
    return new Promise((resolve) => {
      if (!this.synth) {
        console.warn('[TTS] SpeechSynthesis API unavailable in current environment');
        resolve({ success: false, reason: 'synth_unavailable' });
        return;
      }

      this.stop();

      const status = this.getVoiceStatus(lang);
      const voice = this.getBestVoice(lang, true);

      if (!voice) {
        console.warn(`[TTS] No synthesizer voices available for language: "${lang}". Preserving touch UI.`);
        resolve({ success: false, reason: 'no_voice_available', status });
        return;
      }

      if (status.isFallback) {
        console.info(`[TTS] ${status.message}`);
      }

      const chunks = this.processUtterances(text);
      if (chunks.length === 0) {
        resolve({ success: true, chunks: 0 });
        return;
      }

      // Natural Pacing Parameters (Section 19)
      // If using fallback voice for Marathi/Hindi, rate 0.88 gives deliberate, clear syllable pronunciation
      const defaultRate = status.isFallback ? 0.88 : (lang === 'en' ? 0.95 : 0.92);
      const rate = options.rate || defaultRate;
      const pitch = options.pitch || 1.0;
      const volume = options.volume || 1.0;

      let currentIndex = 0;

      const speakNextChunk = () => {
        if (currentIndex >= chunks.length) {
          resolve({ success: true, chunks: chunks.length, voice: voice.name });
          return;
        }

        const chunkText = chunks[currentIndex++];
        const UtteranceClass =
          typeof SpeechSynthesisUtterance !== 'undefined'
            ? SpeechSynthesisUtterance
            : typeof window !== 'undefined' && window.SpeechSynthesisUtterance
            ? window.SpeechSynthesisUtterance
            : class MockUtterance {
                constructor(t) {
                  this.text = t;
                  this.voice = null;
                  this.lang = 'en';
                  this.rate = 1.0;
                  this.pitch = 1.0;
                  this.volume = 1.0;
                  this.onend = null;
                  this.onerror = null;
                }
              };
        const utterance = new UtteranceClass(chunkText);

        if (voice) {
          utterance.voice = voice;
          // Set utterance.lang to match voice.lang so Chromium does not discard selected Devanagari voice
          utterance.lang = voice.lang || (lang === 'mr' ? 'hi-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN');
        } else {
          utterance.lang = lang === 'mr' ? 'mr-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
        }

        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;

        // Retain reference to prevent Chromium garbage collection bug
        this.activeUtterances.push(utterance);

        utterance.onend = () => {
          this.activeUtterances = this.activeUtterances.filter((u) => u !== utterance);
          // 80ms natural pause between clauses
          setTimeout(speakNextChunk, 80);
        };

        utterance.onerror = (e) => {
          console.warn('[TTS] Utterance playback warning:', e.error);
          this.activeUtterances = this.activeUtterances.filter((u) => u !== utterance);
          resolve({ success: false, error: e.error });
        };

        try {
          this.synth.speak(utterance);
        } catch (err) {
          console.warn('[TTS] Synth speak error:', err);
          resolve({ success: false, error: err.message });
        }
      };

      speakNextChunk();
    });
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.activeUtterances = [];
  }
}

// Global browser audio unlock for kiosk environments
let isAudioUnlocked = false;
export function unlockAudioContext() {
  if (isAudioUnlocked || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      ctx.resume().then(() => {
        isAudioUnlocked = true;
        ctx.close().catch(() => {});
      }).catch(() => {});
    }
    const dummy = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    dummy.play().then(() => {
      isAudioUnlocked = true;
    }).catch(() => {});
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  ['click', 'touchstart'].forEach((evt) => {
    window.addEventListener(evt, unlockAudioContext, { once: true, passive: true });
  });
}

/**
 * Multilingual Neural TTS Provider
 * Fetches high-quality 24kHz natural Indian language speech from the backend neural TTS service
 * and plays via HTML5 Audio / Web Audio API with instant stop/cancellation.
 */
export class NeuralTTSProvider {
  constructor(fallbackProvider = null) {
    this.name = 'neural-tts';
    this.fallback = fallbackProvider || new BrowserTTSProvider();
    this.currentAudio = null;
    this.lastDiagnostics = null;
    this.clientAudioCache = new Map();
  }

  /**
   * Background audio pre-fetch: preloads and caches audio before patient clicks.
   * Ensures the very first click plays with 0ms delay.
   */
  async preload(text, language = 'mr', options = {}) {
    if (!text || typeof text !== 'string') return;
    const cleanText = text.trim();
    if (!cleanText) return;
    const cacheKey = `${language}:${cleanText}`;
    if (this.clientAudioCache.has(cacheKey)) return;

    try {
      const res = await fetch(`${API_BASE}/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          language,
          questionId: options.questionId || null,
          requestId: `preload-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.data?.audioBase64) {
        const format = data.data.format || 'wav';
        const mime = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
        const audioSrc = `data:${mime};base64,${data.data.audioBase64}`;
        if (this.clientAudioCache.size > 150) {
          const oldestKey = this.clientAudioCache.keys().next().value;
          this.clientAudioCache.delete(oldestKey);
        }
        this.clientAudioCache.set(cacheKey, { audioSrc, format, model: data.data?.model });
        console.log(`[TTS Preload] Cached: "${cleanText.slice(0, 25)}..." (${language})`);
      }
    } catch (e) {
      // Preload silently ignores any network hiccups
    }
  }

  async speak(arg1, arg2 = 'mr', arg3 = {}) {
    let text;
    let language = 'mr';
    let options = {};

    if (typeof arg1 === 'object' && arg1 !== null) {
      text = arg1.text;
      language = arg1.language || arg1.lang || 'mr';
      options = arg1.options || arg1;
    } else {
      text = arg1;
      language = arg2 || 'mr';
      options = arg3 || {};
    }

    if (!text || typeof text !== 'string') {
      return { success: false, reason: 'empty_text' };
    }

    const requestId = options.requestId || `tts-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.activeRequestId = requestId;

    // 1. Instant Playback from Client-Side Audio Cache (0ms latency)
    const cacheKey = `${language}:${text.trim()}`;
    if (this.clientAudioCache.has(cacheKey)) {
      const cached = this.clientAudioCache.get(cacheKey);
      this.stop();
      const audio = new Audio(cached.audioSrc);
      this.currentAudio = audio;
      console.log(`[TTS] [${requestId}] Instant playback from client audio cache (${language})`);

      return new Promise((resolve) => {
        audio.onended = () => {
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          resolve({
            success: true,
            provider: 'client-cache',
            model: cached.model || 'neural-tts',
            requestId,
            cached: true,
          });
        };

        audio.onerror = async () => {
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          if (this.fallback) {
            const fbRes = await this.fallback.speak(text, language, options);
            resolve(fbRes);
          } else {
            resolve({ success: false, error: 'AUDIO_PLAYBACK_FAILED', requestId });
          }
        };

        audio.play().catch(async (playErr) => {
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          if (this.fallback) {
            const fbRes = await this.fallback.speak(text, language, options);
            resolve(fbRes);
          } else {
            resolve({ success: false, error: 'AUDIO_PLAYBACK_FAILED', message: playErr.message, requestId });
          }
        });
      });
    }

    try {
      this.stop();

      // Request synthesized neural audio from backend with requestId
      const res = await fetch(`${API_BASE}/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language,
          questionId: options.questionId || null,
          requestId,
        }),
      });

      if (!res.ok) {
        return {
          success: false,
          error: 'TTS_RUNTIME_UNAVAILABLE',
          message: `TTS service unavailable (HTTP ${res.status})`,
          requestId,
        };
      }

      const data = await res.json();
      if (data.diagnostics) {
        this.lastDiagnostics = data.diagnostics;
      }

      if (!data.success || !data.data?.audioBase64) {
        console.warn(`[NeuralTTS Provider] Speech synthesis unavailable (${data.error || 'NO_AUDIO'}). Request ID: ${requestId}`);
        return {
          success: false,
          error: data.error || 'TTS_FAILED',
          message: data.message || 'Speech synthesis failed',
          requestId,
        };
      }

      // Check if a newer speak request was issued while waiting for fetch
      if (this.activeRequestId !== requestId) {
        console.info(`[NeuralTTS Provider] Superseded request ${requestId} cancelled in favor of ${this.activeRequestId}`);
        return { success: false, error: 'SUPERSEDED', requestId };
      }

      const format = data.data.format || 'wav';
      const mime = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
      const audioSrc = `data:${mime};base64,${data.data.audioBase64}`;

      // Store in client-side cache for future zero-latency instant replays
      if (this.clientAudioCache.size > 150) {
        const oldestKey = this.clientAudioCache.keys().next().value;
        this.clientAudioCache.delete(oldestKey);
      }
      this.clientAudioCache.set(cacheKey, { audioSrc, format, model: data.data?.model });

      const audio = new Audio(audioSrc);
      this.currentAudio = audio;

      console.log(`[TTS] [${requestId}] Playing authentic neural speech via ${data.data.model || data.data.provider || 'neural-tts'} (${language}, ${data.data.audioBase64.length} b64 chars)`);

      return new Promise((resolve) => {
        audio.onended = () => {
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          resolve({
            success: true,
            provider: 'neural-tts',
            model: data.data?.model || 'neural-tts',
            requestId,
            cached: data.data?.cached || false,
            diagnostics: data.data?.diagnostics || this.lastDiagnostics,
          });
        };

        audio.onerror = (err) => {
          console.warn(`[NeuralTTS Provider] [${requestId}] Audio playback error:`, err);
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          resolve({ success: false, error: 'AUDIO_PLAYBACK_FAILED', requestId });
        };

        audio.play().catch((playErr) => {
          console.warn(`[NeuralTTS Provider] [${requestId}] Audio play error:`, playErr);
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          resolve({ success: false, error: 'AUDIO_PLAYBACK_FAILED', message: playErr.message, requestId });
        });
      });
    } catch (err) {
      console.warn(`[NeuralTTS Provider] [${requestId}] Neural server speech error: ${err.message}`);
      return { success: false, error: 'TTS_RUNTIME_UNAVAILABLE', message: err.message, requestId };
    }
  }

  stop() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
    if (this.fallback) {
      this.fallback.stop();
    }
  }

  getVoiceStatus(language = 'mr') {
    return {
      supported: true,
      status: 'optimal',
      provider: 'neural-tts',
      sampleRate: 24000,
    };
  }

  getNativeVoice(language = 'mr') {
    return { name: `Neural ${language.toUpperCase()} Voice`, lang: `${language}-IN` };
  }

  getBestVoice(language = 'mr', allowFallback = true) {
    return { name: `Neural ${language.toUpperCase()} Voice`, lang: `${language}-IN`, quality: 'natural' };
  }

  processUtterances(text) {
    return [text];
  }
}

// Backward compatibility export alias
export const IndicF5TTSProvider = NeuralTTSProvider;

/**
 * Centralized TTS Service Abstraction
 */
class TTSService {
  constructor() {
    const browserFallback = new BrowserTTSProvider();
    // Default to Multilingual Neural TTS with emergency browser synthesis fallback
    this.provider = new NeuralTTSProvider(browserFallback);
    this.isSpeaking = false;
    this.listeners = new Set();
  }

  /**
   * Plug an alternative TTS provider (e.g. BrowserTTSProvider)
   */
  setProvider(provider) {
    if (this.isSpeaking) {
      this.stop();
    }
    this.provider = provider;
  }

  /**
   * Main speech entrypoint (Section 18)
   */
  async speak(arg1, arg2 = 'mr', arg3 = {}) {
    let text;
    let language = 'mr';
    let options = {};

    if (typeof arg1 === 'object' && arg1 !== null) {
      text = arg1.text;
      language = arg1.language || arg1.lang || 'mr';
      options = arg1.options || arg1;
    } else {
      text = arg1;
      language = arg2 || 'mr';
      options = arg3 || {};
    }

    if (!text) return { success: false, reason: 'empty_text' };

    this.isSpeaking = true;
    this._notifyListeners(true);

    try {
      const result = await this.provider.speak(text, language, options);
      return result;
    } finally {
      this.isSpeaking = false;
      this._notifyListeners(false);
    }
  }

  stop() {
    if (this.provider) {
      this.provider.stop();
    }
    this.isSpeaking = false;
    this._notifyListeners(false);
  }

  /**
   * Unlocks the browser audio context on initial user interaction (touch/click).
   * Prevents autoplay blocking on iOS Safari, Chrome, and kiosk touchscreens.
   */
  async unlockAudioContext() {
    try {
      const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AudioContextClass) return true;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      const buffer = this.audioCtx.createBuffer(1, 1, 22050);
      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioCtx.destination);
      source.start(0);
      return true;
    } catch (e) {
      console.warn('[TTS] unlockAudioContext warning:', e);
      return false;
    }
  }

  getVoiceStatus(language = 'mr') {
    return this.provider ? this.provider.getVoiceStatus(language) : { supported: false, status: 'unavailable' };
  }

  getNativeVoice(language = 'mr') {
    return this.provider ? this.provider.getNativeVoice(language) : null;
  }

  getBestVoice(language = 'mr', allowFallback = true) {
    return this.provider ? this.provider.getBestVoice(language, allowFallback) : null;
  }

  processUtterances(text) {
    return this.provider ? this.provider.processUtterances(text) : [text];
  }

  preload(text, language = 'mr', options = {}) {
    if (this.provider && typeof this.provider.preload === 'function') {
      this.provider.preload(text, language, options);
    }
  }

  onSpeakingChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notifyListeners(speaking) {
    this.listeners.forEach((fn) => {
      try {
        fn(speaking);
      } catch (err) {
        console.error('[TTS] Listener error:', err);
      }
    });
  }
}

export const ttsService = new TTSService();
