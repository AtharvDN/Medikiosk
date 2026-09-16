/**
 * Voice Pipeline Configuration (Section 38, 61, 64)
 * Centralized settings for AI4Bharat IndicConformer ASR & IndicF5 TTS runtimes.
 */

import dotenv from 'dotenv';
dotenv.config();

export const voiceConfig = {
  // ASR Configuration (IndicConformer)
  asr: {
    provider: process.env.ASR_PROVIDER || 'indicconformer',
    mode: process.env.ASR_MODE || 'indicconformer', // 'indicconformer' | 'mock'
    endpoint: process.env.ASR_ENDPOINT || (process.env.ASR_URL ? `${process.env.ASR_URL}/asr` : 'http://127.0.0.1:8001/asr'),
    healthUrl: process.env.ASR_HEALTH_URL || (process.env.ASR_URL ? `${process.env.ASR_URL}/health` : 'http://127.0.0.1:8001/health'),
    timeoutMs: parseInt(process.env.ASR_TIMEOUT_MS || '10000', 10),
    sampleRate: 16000,
    channels: 1, // Mono
    encoding: 'LINEAR16', // 16-bit PCM WAV
    supportedLanguages: ['en', 'hi', 'mr'],
    minAudioDurationSec: 0.4, // Reject empty or click noises
  },

  // TTS Configuration (Multilingual Neural TTS)
  tts: {
    provider: process.env.TTS_PROVIDER || 'neural-tts',
    mode: process.env.TTS_MODE || 'neural-tts', // 'neural-tts' | 'mock'
    endpoint: process.env.TTS_ENDPOINT || (process.env.TTS_URL ? `${process.env.TTS_URL}/tts` : 'http://127.0.0.1:8003/tts'),
    healthUrl: process.env.TTS_HEALTH_URL || (process.env.TTS_URL ? `${process.env.TTS_URL}/health` : 'http://127.0.0.1:8003/health'),
    marathiProvider: process.env.TTS_MARATHI_PROVIDER || 'mr-IN-AarohiNeural / facebook/mms-tts-mar',
    hindiProvider: process.env.TTS_HINDI_PROVIDER || 'hi-IN-SwaraNeural / facebook/mms-tts-hin',
    englishProvider: process.env.TTS_ENGLISH_PROVIDER || 'en-IN-NeerjaNeural / facebook/mms-tts-eng',
    timeoutMs: parseInt(process.env.TTS_TIMEOUT_MS || '45000', 10),
    sampleRate: 24000, // 24kHz standard studio quality
    channels: 1, // Mono
    supportedLanguages: ['en', 'hi', 'mr'],
    cacheEnabled: true, // Application-level caching for static question IDs
  },
};
