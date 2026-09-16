import { ttsService } from './services/ttsService.js';

class AudioController {
  constructor() {
    this.audioCtx = null;
    this.listeners = new Set();
    this.muteListeners = new Set();
    this._muted = false;
  }

  get isSpeaking() {
    return ttsService.isSpeaking;
  }

  get isMuted() {
    return this._muted;
  }

  setMuted(muted) {
    const nextState = Boolean(muted);
    if (this._muted !== nextState) {
      this._muted = nextState;
      if (this._muted && this.isSpeaking) {
        this.stop();
      }
      this._notifyMuteListeners();
    }
  }

  toggleMute() {
    this.setMuted(!this._muted);
    return this._muted;
  }

  onMuteChange(callback) {
    this.muteListeners.add(callback);
    return () => this.muteListeners.delete(callback);
  }

  _notifyMuteListeners() {
    this.muteListeners.forEach((fn) => {
      try {
        fn(this._muted);
      } catch (err) {
        console.error('[Audio] Mute listener error:', err);
      }
    });
  }

  /**
   * Play a subtle, warm kiosk chime via Web Audio API.
   * Gentle Hospital Chime (soft harmonic sine wave).
   */
  playChime() {
    if (this._muted) return;
    try {
      const AudioContextClass = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      // Soft harmonic chime (C5 523Hz -> E5 659Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);

      // Low volume (0.04) so it's a pleasant tactile cue, not a loud beep
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.31);
    } catch (err) {
      // AudioContext not allowed before user gesture
    }
  }

  getBestVoice(lang) {
    return ttsService.getBestVoice(lang);
  }

  getVoiceStatus(lang) {
    return ttsService.getVoiceStatus(lang);
  }

  /**
   * Delegates speech synthesis to centralized ttsService with natural sentence processing.
   */
  async speak(text, lang = 'mr') {
    if (this._muted) {
      return { success: false, reason: 'muted' };
    }
    this.playChime();
    return await ttsService.speak(text, lang);
  }

  preload(text, lang = 'mr') {
    if (this._muted) return;
    ttsService.preload(text, lang);
  }

  stop() {
    ttsService.stop();
  }

  onSpeakingChange(callback) {
    return ttsService.onSpeakingChange(callback);
  }
}

export const audioController = new AudioController();

