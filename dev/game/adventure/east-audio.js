export class AudioManager {
  constructor(musicMap) {
    this.musicMap = musicMap;
    this.audio = new Audio();
    this.audio.loop = true;
    this.audio.preload = 'none';
    this.currentId = null;
    this.enabled = true;
    this.unlocked = false;
    this.fadeFrame = 0;
    this.ctx = null;
    this.userPaused = false;
    this.masterVolume = 0.8;
    this.listeners = new Set();
    this.audio.addEventListener('timeupdate', () => this.emit());
    this.audio.addEventListener('play', () => this.emit());
    this.audio.addEventListener('pause', () => this.emit());
    this.audio.addEventListener('loadedmetadata', () => this.emit());
    this.audio.addEventListener('ended', () => this.emit());
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) {
      try { listener(this.snapshot()); } catch { /* ignore listener errors */ }
    }
  }

  async unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.ctx = new AudioContextClass();
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
    } catch {
      this.ctx = null;
    }
    if (this.currentId) await this.playTrack(this.currentId, { force: true });
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.audio) return;
    if (!this.enabled) {
      this.audio.pause();
    } else if (this.currentId) {
      this.playTrack(this.currentId, { force: true });
    }
    this.emit();
  }

  setVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1, Number(value) || 0));
    const track = this.currentId ? this.musicMap[this.currentId] : null;
    const target = (track?.volume ?? 0.3) * this.masterVolume;
    if (!this.audio.paused) this.fadeTo(target);
    else this.audio.volume = target;
    this.emit();
  }

  async playTrack(id, options = {}) {
    const track = this.musicMap[id];
    if (!track) return;
    this.currentId = id;
    this.userPaused = false;
    if (!this.enabled || !this.unlocked) return;
    if (!options.force && this.audio.src.endsWith(track.src) && !this.audio.paused) return;

    const source = `${track.src}?v=1`;
    if (!this.audio.src.endsWith(source)) {
      this.audio.src = source;
      this.audio.currentTime = 0;
    }
    this.audio.volume = 0;
    try {
      await this.audio.play();
      this.fadeTo((track.volume ?? 0.3) * this.masterVolume);
    } catch {
      // Browser may still block audio until the next explicit gesture.
      // The next pointer/keyboard event calls unlock() again.
    }
    this.emit();
  }

  async pause() {
    this.userPaused = true;
    this.audio.pause();
    this.emit();
  }

  async resume() {
    if (!this.currentId) return;
    this.userPaused = false;
    if (!this.enabled || !this.unlocked) return;
    try {
      await this.audio.play();
    } catch { /* blocked */ }
    this.emit();
  }

  stop() {
    this.userPaused = true;
    this.audio.pause();
    try { this.audio.currentTime = 0; } catch { /* ignore */ }
    this.emit();
  }

  seek(seconds) {
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    const value = Math.max(0, Math.min(duration || Number(seconds) || 0, Number(seconds) || 0));
    try { this.audio.currentTime = value; } catch { /* ignore */ }
    this.emit();
  }

  snapshot() {
    const track = this.currentId ? this.musicMap[this.currentId] : null;
    return {
      id: this.currentId,
      title: track?.title || null,
      playing: Boolean(this.currentId && !this.audio.paused && this.enabled),
      paused: Boolean(this.currentId && this.audio.paused),
      enabled: this.enabled,
      currentTime: Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
      volume: this.masterVolume,
    };
  }

  fadeTo(target) {
    cancelAnimationFrame(this.fadeFrame);
    const step = () => {
      const value = this.audio.volume;
      const next = value + (target - value) * 0.18;
      this.audio.volume = Math.max(0, Math.min(1, next));
      if (Math.abs(next - target) > 0.01 && !this.audio.paused) {
        this.fadeFrame = requestAnimationFrame(step);
      } else {
        this.audio.volume = Math.max(0, Math.min(1, target));
      }
    };
    this.fadeFrame = requestAnimationFrame(step);
  }

  tone(frequency = 440, duration = 0.12, type = 'sine', gain = 0.035) {
    if (!this.enabled || !this.unlocked) return;
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        this.ctx = new AudioContextClass();
      }
      const ctx = this.ctx;
      if (ctx.state === 'suspended') ctx.resume();
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      const now = ctx.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(gain, now + 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(envelope);
      envelope.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    } catch {
      // Sound is decorative. Never let it break the game.
    }
  }

  beat(strong = false) {
    this.tone(strong ? 330 : 220, strong ? 0.08 : 0.045, 'triangle', strong ? 0.045 : 0.022);
  }

  death() {
    this.tone(110, 0.7, 'sine', 0.06);
    this.tone(73, 0.9, 'triangle', 0.035);
  }

  chime() {
    this.tone(523.25, 0.3, 'sine', 0.04);
    this.tone(659.25, 0.45, 'sine', 0.03);
    this.tone(783.99, 0.7, 'sine', 0.025);
  }

  pickup() {
    this.tone(440, 0.1, 'triangle', 0.03);
    this.tone(587, 0.16, 'triangle', 0.02);
  }
}
