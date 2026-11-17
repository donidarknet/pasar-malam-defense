// Sound, synthesized live with WebAudio: no audio files, no network, just
// oscillators and filtered noise. Everything is guarded, so a browser with
// no gesture yet (or no audio at all) simply stays silent.

export function createAudio() {
  const audio = {
    context: null,
    muted: false,
  };

  function ctx() {
    if (audio.context !== null) return audio.context;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio.context = new Ctx();
    } catch {
      return null;
    }
    return audio.context;
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (audio.muted) return;
    const context = ctx();
    if (context === null || context.state !== 'running') return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.connect(gain).connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + duration);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(duration, volume, cutoff) {
    if (audio.muted) return;
    const context = ctx();
    if (context === null || context.state !== 'running') return;
    try {
      const length = Math.floor(context.sampleRate * duration);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      source.connect(filter).connect(gain).connect(context.destination);
      source.start();
    } catch {
      // Sound is garnish.
    }
  }

  audio.unlock = function unlock() {
    const context = ctx();
    if (context !== null && context.state === 'suspended') context.resume().catch(() => {});
  };

  audio.shoot = function shoot(kind) {
    if (kind === 'kembang') tone(520, 0.12, 'square', 0.05, 180);
    else if (kind === 'penjaga') tone(220, 0.15, 'triangle', 0.08, 90);
    else tone(880, 0.07, 'square', 0.04, 660);
  };

  audio.boom = function boom() {
    noise(0.3, 0.16, 900);
    tone(140, 0.25, 'sine', 0.12, 50);
  };

  audio.coin = function coin() {
    tone(1320, 0.08, 'sine', 0.05);
    setTimeout(() => tone(1760, 0.12, 'sine', 0.05), 70);
  };

  audio.snare = function snare() {
    tone(300, 0.09, 'square', 0.07, 140);
    tone(180, 0.12, 'square', 0.05, 90);
  };

  audio.relic = function relic() {
    [880, 1108, 1318].forEach((freq, i) => setTimeout(() => tone(freq, 0.3, 'sine', 0.07), i * 110));
  };

  audio.horn = function horn() {
    tone(220, 0.5, 'sawtooth', 0.07, 330);
    tone(277, 0.5, 'sawtooth', 0.05, 415);
  };

  audio.hurt = function hurt() {
    tone(160, 0.2, 'sawtooth', 0.09, 70);
  };

  audio.victory = function victory() {
    [523, 659, 784, 1046].forEach((freq, i) => setTimeout(() => tone(freq, 0.35, 'triangle', 0.09), i * 130));
  };

  audio.defeat = function defeat() {
    [392, 330, 262, 196].forEach((freq, i) => setTimeout(() => tone(freq, 0.4, 'sawtooth', 0.06), i * 160));
  };

  return audio;
}
