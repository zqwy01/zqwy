/* УШКО — speechSynthesis adapter.
   MVP voice: the browser reads curated Russian phrases. An optional recorded
   whisper layer can be added later without touching the game logic: set
   window.USHKO_SAMPLES to a map of phrase id → audio file path and speak()
   will use it when present. The game never records the microphone. */
window.USHKO_VOICE = (function () {
  'use strict';

  let voices = [];
  let token = 0;

  function supported() {
    return typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  function refreshVoices() {
    if (!supported()) return [];
    try {
      voices = window.speechSynthesis.getVoices().filter((v) => /^ru/i.test(v.lang || ''));
    } catch (err) { voices = []; }
    return voices;
  }

  function pickVoice() {
    if (!voices.length) refreshVoices();
    if (!voices.length) return null;
    const preferred = voices.find((v) => /female|женск|alisa|milena|irina/i.test(v.name || ''));
    return preferred || voices[0];
  }

  function cancel() {
    token += 1;
    if (supported()) {
      try { window.speechSynthesis.cancel(); } catch (err) { /* ignore */ }
    }
  }

  /* opts: { id, text, volume, rate, pitch, onBoundary(charIndex), onEnd(), onError(msg) } */
  function speak(opts) {
    cancel();
    const myToken = token;
    const samples = window.USHKO_SAMPLES || null;
    if (samples && samples[opts.id]) {
      const audio = new Audio(samples[opts.id]);
      audio.volume = opts.volume;
      audio.playbackRate = opts.rate;
      audio.onended = () => { if (myToken === token && opts.onEnd) opts.onEnd(); };
      audio.onerror = () => {
        if (myToken === token && opts.onError) opts.onError('Не удалось открыть запись шёпота.');
      };
      const play = audio.play();
      if (play && typeof play.catch === 'function') {
        play.catch(() => {
          if (myToken === token && opts.onError) opts.onError('Браузер не разрешил воспроизведение.');
        });
      }
      return { kind: 'sample', node: audio };
    }

    if (!supported()) {
      if (opts.onError) opts.onError('Этот браузер не умеет говорить вслух (speechSynthesis).');
      return null;
    }

    const utterance = new SpeechSynthesisUtterance(opts.text);
    utterance.lang = 'ru-RU';
    utterance.volume = Math.max(0, Math.min(1, opts.volume));
    utterance.rate = Math.max(0.5, Math.min(1.5, opts.rate));
    utterance.pitch = Math.max(0.5, Math.min(1.5, opts.pitch));
    const voice = pickVoice();
    if (voice) utterance.voice = voice;

    utterance.onboundary = (event) => {
      if (myToken === token && opts.onBoundary) opts.onBoundary(event.charIndex || 0);
    };
    utterance.onend = () => {
      if (myToken === token && opts.onEnd) opts.onEnd();
    };
    utterance.onerror = (event) => {
      if (myToken !== token) return;
      const message = event && event.error === 'not-allowed'
        ? 'Нажми «Шептать» ещё раз — браузер ждёт подтверждения звука.'
        : 'Русский голос не найден. Проверь голоса речи в системе.';
      if (opts.onError) opts.onError(message);
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      if (opts.onError) opts.onError('Не получилось запустить голос.');
      return null;
    }
    return { kind: 'tts', node: utterance };
  }

  if (supported() && typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  }
  refreshVoices();

  return { supported, refreshVoices, pickVoice, speak, cancel };
})();
