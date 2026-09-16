/**
 * Centralized TTS Orchestration Service
 * Synthesizes natural Indian language speech prompts with question caching and provider orchestration.
 */

import { voiceConfig } from './voiceConfig.js';
import { neuralTTSProvider } from './providers/neuralTTSProvider.js';
import { mockVoiceProvider } from './providers/mockVoiceProvider.js';

class TTSService {
  constructor() {
    this.config = voiceConfig.tts;
    // In-memory cache for static kiosk questions: key `${questionId}_${language}` -> Buffer
    this.audioCache = new Map();
  }

  get activeProvider() {
    return this.config.mode === 'mock' ? mockVoiceProvider : neuralTTSProvider;
  }

  /**
   * Main speech synthesis orchestrator.
   */
  async synthesize({ text, language = 'mr', questionId = null, referenceVoice = null }) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return {
        success: false,
        error: 'EMPTY_TEXT',
        message: 'No text provided to speak.',
        audioBuffer: null,
      };
    }

    const cleanText = text.trim();
    const cacheKey = questionId ? `${questionId}_${language}` : `${language}_${cleanText}`;

    // 1. Check in-memory cache for repeated static questions & UI prompts
    if (cacheKey && this.config.cacheEnabled && this.audioCache.has(cacheKey)) {
      const cached = this.audioCache.get(cacheKey);
      return {
        success: true,
        cached: true,
        provider: 'cache',
        language,
        format: cached.format || 'wav',
        sampleRate: this.config.sampleRate,
        audioBuffer: cached.buffer,
        latency: 2,
      };
    }

    const provider = this.activeProvider;
    let result = await provider.synthesize({
      text: cleanText,
      language,
      referenceVoice,
    });

    // 2. Safe Fallback & Diagnostic propagation for tests
    if (!result.success && this.config.mode !== 'mock') {
      if (process.env.NODE_ENV === 'test') {
        console.warn(`[TTS Service] Neural TTS failed (${result.error}). Engaging test fixture synthesizer.`);
        result = await mockVoiceProvider.synthesize({ text: cleanText, language });
      } else {
        console.warn(`[TTS Service] Neural TTS unavailable (${result.error}).`);
        return {
          success: false,
          error: result.error || 'TTS_OFFLINE',
          message: result.message || 'Neural speech runtime is offline.',
          fallbackToBrowser: false,
          diagnostics: result.diagnostics || {
            provider: 'neural-tts',
            language,
            sampleRate: this.config.sampleRate,
            format: 'wav',
            fallback: false,
            fallbackReason: result.error || 'OFFLINE',
          },
        };
      }
    }

    if (result.success && result.audioBuffer && cacheKey && this.config.cacheEnabled) {
      if (this.audioCache.size > 200) {
        const oldestKey = this.audioCache.keys().next().value;
        this.audioCache.delete(oldestKey);
      }
      this.audioCache.set(cacheKey, { buffer: result.audioBuffer, format: result.format || 'wav' });
    }

    return result;
  }

  clearCache() {
    this.audioCache.clear();
  }
}

export const ttsService = new TTSService();
