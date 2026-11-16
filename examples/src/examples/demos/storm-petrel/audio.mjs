// Sound for the Storm Petrel demo. There are no recordings: every sound is a square, triangle or
// saw wave or a burst of noise, with its pitch swept and its level faded, made with the Web Audio
// API on the audio context of the engine's sound manager, which unlocks it on the first key press
// or touch.

/**
 * @import { SoundManager } from 'playcanvas'
 */

export class Sounds {
    /**
     * @param {SoundManager} soundManager - The engine's sound manager.
     */
    constructor(soundManager) {
        /** @type {AudioContext|null} */
        this.context = soundManager.context;
        if (!this.context) return;
        const context = this.context;

        // the mix, through a compressor, so a screen of explosions does not clip
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.ratio.value = 6;
        const master = context.createGain();
        master.gain.value = 0.45;
        this.mix = context.createGain();
        this.mix.connect(compressor).connect(master).connect(context.destination);

        // a second of white noise, for the explosions
        this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
            samples[i] = Math.random() * 2 - 1;
        }

        // when each sound last played, so that a sound does not pile up on itself
        /** @type {Record<string, number>} */
        this._last = {};
    }

    /**
     * @param {string} name - The name of a sound.
     * @param {number} gap - The least time between two plays of the sound, in seconds.
     * @returns {number} The time to play the sound at, or -1 if it should not play.
     * @private
     */
    _when(name, gap) {
        const context = this.context;
        if (!context || context.state !== 'running') return -1;
        const now = context.currentTime;
        if (now - (this._last[name] ?? -1) < gap) return -1;
        this._last[name] = now;
        return now;
    }

    /**
     * A note whose pitch slides and whose level fades to nothing.
     *
     * @param {number} at - The time the note starts.
     * @param {OscillatorType} type - The wave.
     * @param {number} from - The pitch it starts at, in hertz.
     * @param {number} to - The pitch it ends at.
     * @param {number} time - How long it lasts, in seconds.
     * @param {number} level - How loud it is.
     * @private
     */
    _tone(at, type, from, to, time, level) {
        const context = /** @type {AudioContext} */ (this.context);
        const oscillator = context.createOscillator();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, at);
        oscillator.frequency.exponentialRampToValueAtTime(to, at + time);
        const gain = context.createGain();
        gain.gain.setValueAtTime(level, at);
        gain.gain.exponentialRampToValueAtTime(0.001, at + time);
        oscillator.connect(gain).connect(this.mix);
        oscillator.start(at);
        oscillator.stop(at + time);
    }

    /**
     * A burst of noise through a low pass filter that closes as the burst fades.
     *
     * @param {number} at - The time the burst starts.
     * @param {number} from - The frequency the filter starts at, in hertz.
     * @param {number} to - The frequency the filter ends at.
     * @param {number} time - How long it lasts, in seconds.
     * @param {number} level - How loud it is.
     * @private
     */
    _burst(at, from, to, time, level) {
        const context = /** @type {AudioContext} */ (this.context);
        const source = context.createBufferSource();
        source.buffer = this.noise;
        source.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(from, at);
        filter.frequency.exponentialRampToValueAtTime(to, at + time);
        const gain = context.createGain();
        gain.gain.setValueAtTime(level, at);
        gain.gain.exponentialRampToValueAtTime(0.001, at + time);
        source.connect(filter).connect(gain).connect(this.mix);
        source.start(at, Math.random() * 0.5);
        source.stop(at + time);
    }

    // the player's guns
    shot() {
        const at = this._when('shot', 0.09);
        if (at < 0) return;
        this._tone(at, 'square', 980, 420, 0.07, 0.1);
    }

    // a shot landing on something that is still flying
    hit() {
        const at = this._when('hit', 0.05);
        if (at < 0) return;
        this._tone(at, 'square', 260, 170, 0.05, 0.14);
    }

    // a small raider going up
    boom() {
        const at = this._when('boom', 0.05);
        if (at < 0) return;
        this._burst(at, 2400, 220, 0.3, 0.6);
        this._tone(at, 'triangle', 190, 50, 0.22, 0.5);
    }

    // a big one
    blast() {
        const at = this._when('blast', 0.08);
        if (at < 0) return;
        this._burst(at, 3200, 90, 0.9, 0.9);
        this._tone(at, 'triangle', 120, 30, 0.7, 0.8);
        this._tone(at + 0.08, 'sawtooth', 90, 35, 0.4, 0.3);
    }

    // a power up collected
    pickup() {
        const at = this._when('pickup', 0.1);
        if (at < 0) return;
        [660, 880, 1320].forEach((pitch, i) => {
            this._tone(at + i * 0.06, 'square', pitch, pitch, 0.09, 0.12);
        });
    }

    // the player's seaplane going down
    crash() {
        const at = this._when('crash', 0.2);
        if (at < 0) return;
        this._tone(at, 'sawtooth', 520, 40, 0.8, 0.35);
        this._burst(at, 2600, 120, 0.8, 0.8);
    }

    // the game starting
    start() {
        const at = this._when('start', 0.3);
        if (at < 0) return;
        [392, 523, 659, 784].forEach((pitch, i) => {
            this._tone(at + i * 0.09, 'square', pitch, pitch, 0.14, 0.12);
        });
    }

    // the airship arriving
    alarm() {
        const at = this._when('alarm', 1);
        if (at < 0) return;
        for (let i = 0; i < 6; i++) {
            this._tone(at + i * 0.3, 'square', i % 2 ? 370 : 494, i % 2 ? 370 : 494, 0.26, 0.11);
        }
    }
}
