/** Owns synthesized effects and the mute preference, which survives mission restarts. */
export function createAudio() {
  let context = null;
  let muted = false;

  function unlock() {
    try {
      if (!context) {
        context = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }
    } catch {
      // Audio is optional: unavailable or blocked audio must not interrupt play.
      context = null;
    }
  }

  function playTone(frequency, duration, waveform = 'square', volume = 0.035,
    endFrequency = frequency) {
    if (muted || !context || context.state !== 'running') return;

    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFrequency), now + duration,
      );
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {
      // Keep the same silent fallback if an individual effect cannot be played.
    }
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return { unlock, playTone, toggleMute };
}
