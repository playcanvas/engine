// Sound for the Splash One demo.
//
// The engine, the missile launches and the missile warning are recordings from Freesound, credited in
// assets/sounds/splash-one.credits.txt. The rest - the blasts, the gun, the flares and the seeker
// tone - is shaped from noise and oscillators with the Web Audio API, on the audio context of the
// engine's sound manager, which takes care of unlocking it on the first key press or click.
// Everything is mixed through a compressor, so a close blast can be loud without clipping, and the
// one-shot sounds share an outdoor echo, from a generated impulse response.

/**
 * @import { SoundManager } from 'playcanvas'
 */

// Sound reaches the listener late from far away. The real speed of sound would bring the bang of a
// kill four kilometers out twelve seconds after the flash, so an arcade one is used, and capped.
const SOUND_SPEED = 900;
const MAX_SOUND_DELAY = 2.2;

// The level of the engine under everything else, which leaves room above it for the launches and
// the blasts.
const ENGINE_LEVEL = 0.32;

// How the engine spools - how quickly it winds up and down, in seconds, and how long it takes to
// die away after the jet is hit.
const SPOOL_UP = 0.7;
const SPOOL_DOWN = 0.9;
const ENGINE_DEATH = 1.4;

// The recorded loops are padded with their own wrap around at each end, and loop between these
// points, in seconds, so the loop holds however the decoder trims the start of the file.
const ENGINE_LOOP = [0.3, 15.3];
const ALARM_LOOP = [0.3, 2.7975];

/**
 * Scales a buffer so its root mean square level is the given level.
 *
 * @param {Float32Array} data - The samples.
 * @param {number} level - The level.
 */
const normalizeRms = (data, level) => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
    }
    const scale = level / Math.sqrt(sum / data.length || 1);
    for (let i = 0; i < data.length; i++) {
        data[i] *= scale;
    }
};

export class Sounds {
    /**
     * @param {SoundManager} soundManager - The engine's sound manager.
     * @param {object} samples - The recordings.
     * @param {AudioBuffer} samples.engine - The engine, a loop.
     * @param {AudioBuffer} samples.launch - A missile motor lighting.
     * @param {AudioBuffer} samples.alarm - The missile warning, a loop.
     */
    constructor(soundManager, samples) {
        /** @type {AudioContext} */
        const context = soundManager.context;
        this.context = context;
        this.samples = samples;

        // the mix, through a compressor, to the speakers
        this.compressor = context.createDynamicsCompressor();
        this.compressor.threshold.value = -9;
        this.compressor.knee.value = 8;
        this.compressor.ratio.value = 4;
        this.compressor.attack.value = 0.004;
        this.compressor.release.value = 0.25;
        this.master = context.createGain();
        this.master.gain.value = 0.7;
        this.mix = context.createGain();
        this.mix.connect(this.compressor).connect(this.master).connect(context.destination);

        // the echo the one-shot sounds are sent to
        this.reverb = context.createConvolver();
        this.reverb.buffer = this._impulseResponse(2.4);
        const reverbReturn = context.createGain();
        reverbReturn.gain.value = 0.7;
        this.reverb.connect(reverbReturn).connect(this.mix);

        this._createNoise();
        this._createEngine();
        this._createFlyby();
        this._createTones();

        // the engine's spool, and how alive it is - it fades out when the jet is hit
        this.power = 0;
        this.life = 0;

        /**
         * Eases a parameter towards a value, from now.
         *
         * @param {AudioParam} param - The parameter.
         * @param {number} value - The value.
         * @param {number} [smoothing] - How quickly it gets there, in seconds.
         */
        this._set = (param, value, smoothing = 0.05) => {
            param.setTargetAtTime(value, context.currentTime, smoothing);
        };
    }

    /**
     * Generates the raw material - white, pink and brown noise, sparse crackle, and a slow random
     * wobble that turbulence is modulated with.
     *
     * @private
     */
    _createNoise() {
        const context = this.context;
        const rate = context.sampleRate;
        const length = rate * 3;
        const buffer = () => context.createBuffer(1, length, rate);

        this.white = buffer();
        this.pink = buffer();
        this.brown = buffer();
        this.crackle = buffer();
        this.wobble = buffer();
        const white = this.white.getChannelData(0);
        const pink = this.pink.getChannelData(0);
        const brown = this.brown.getChannelData(0);
        const crackle = this.crackle.getChannelData(0);
        const wobble = this.wobble.getChannelData(0);

        // pink noise with Paul Kellet's filter, brown noise as leaky integrated white noise
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        let b3 = 0;
        let b4 = 0;
        let b5 = 0;
        let b6 = 0;
        let last = 0;
        for (let i = 0; i < length; i++) {
            const w = Math.random() * 2 - 1;
            white[i] = w;
            b0 = 0.99886 * b0 + w * 0.0555179;
            b1 = 0.99332 * b1 + w * 0.0750759;
            b2 = 0.969 * b2 + w * 0.153852;
            b3 = 0.8665 * b3 + w * 0.3104856;
            b4 = 0.55 * b4 + w * 0.5329522;
            b5 = -0.7616 * b5 - w * 0.016898;
            pink[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
            b6 = w * 0.115926;
            last = (last + 0.02 * w) / 1.02;
            brown[i] = last;
        }
        normalizeRms(white, 0.3);
        normalizeRms(pink, 0.3);
        normalizeRms(brown, 0.3);

        // Crackle - random sharp pops, each a few milliseconds long, the texture of a rocket motor,
        // an afterburner and burning debris.
        let t = 0;
        while (t < length) {
            t += Math.floor((-Math.log(1 - Math.random()) * rate) / 90);
            const amplitude = (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * Math.random() * 0.8);
            const decay = rate * (0.0006 + Math.random() * 0.002);
            for (let i = 0; i < decay * 5 && t + i < length; i++) {
                crackle[t + i] += amplitude * Math.exp(-i / decay) * (Math.random() * 2 - 1);
            }
        }
        let peak = 0;
        for (let i = 0; i < length; i++) {
            peak = Math.max(peak, Math.abs(crackle[i]));
        }
        for (let i = 0; i < length; i++) {
            crackle[i] *= 0.9 / (peak || 1);
        }

        // the wobble - random values ten times a second, smoothly joined, between -1 and 1
        const step = rate / 10;
        let from = Math.random() * 2 - 1;
        let to = Math.random() * 2 - 1;
        for (let i = 0; i < length; i++) {
            const phase = (i % step) / step;
            if (i > 0 && phase === 0) {
                from = to;
                to = Math.random() * 2 - 1;
            }
            wobble[i] = from + (to - from) * (0.5 - 0.5 * Math.cos(phase * Math.PI));
        }
    }

    /**
     * Generates the echo of open country - a few early reflections off the ground and the hills,
     * then a diffuse tail that darkens as it dies away.
     *
     * @param {number} duration - The length of the echo, in seconds.
     * @returns {AudioBuffer} The impulse response.
     * @private
     */
    _impulseResponse(duration) {
        const context = this.context;
        const rate = context.sampleRate;
        const length = Math.floor(rate * duration);
        const buffer = context.createBuffer(2, length, rate);
        const echoes = [
            [0.045, 0.6],
            [0.11, 0.42],
            [0.19, 0.3],
            [0.34, 0.22],
            [0.58, 0.14],
            [0.9, 0.08]
        ];
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            let low = 0;
            for (let i = 0; i < length; i++) {
                const t = i / rate;
                low += (Math.random() * 2 - 1 - low) * (0.45 * Math.exp(-t * 3) + 0.02);
                data[i] = low * Math.exp(-t / 0.55) * Math.min(1, t / 0.03) * 0.35;
            }
            for (const [time, amplitude] of echoes) {
                const start = Math.floor(time * (0.9 + Math.random() * 0.2) * rate);
                for (let i = 0; i < rate * 0.004 && start + i < length; i++) {
                    data[start + i] += amplitude * (Math.random() * 2 - 1) * Math.exp(-i / (rate * 0.0012));
                }
            }
        }
        return buffer;
    }

    /**
     * A looping source of one of the noise buffers, started straight away at a random point.
     *
     * @param {AudioBuffer} buffer - The buffer.
     * @param {number} [rate] - The playback rate.
     * @returns {AudioBufferSourceNode} The source.
     * @private
     */
    _loop(buffer, rate = 1) {
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.playbackRate.value = rate;
        source.start(0, Math.random() * buffer.duration);
        return source;
    }

    /**
     * A filter.
     *
     * @param {BiquadFilterType} type - The kind of filter.
     * @param {number} frequency - Its frequency.
     * @param {number} [q] - Its quality.
     * @returns {BiquadFilterNode} The filter.
     * @private
     */
    _filter(type, frequency, q = 0.7) {
        const filter = this.context.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = q;
        return filter;
    }

    /**
     * A gain.
     *
     * @param {number} value - The gain.
     * @returns {GainNode} The node.
     * @private
     */
    _gain(value) {
        const gain = this.context.createGain();
        gain.gain.value = value;
        return gain;
    }

    /**
     * Wobbles a parameter about its value at random, for turbulence. Returns the depth, which can be
     * changed later.
     *
     * @param {AudioParam} param - The parameter.
     * @param {number} rate - How fast it wobbles, relative to ten times a second.
     * @param {number} depth - How far it wobbles.
     * @returns {GainNode} The depth.
     * @private
     */
    _wobble(param, rate, depth) {
        const amount = this._gain(depth);
        this._loop(this.wobble, rate).connect(amount).connect(param);
        return amount;
    }

    /**
     * A looping source of one of the recordings, started straight away.
     *
     * @param {AudioBuffer} buffer - The recording.
     * @param {number[]} loop - Where it loops, from and to, in seconds.
     * @param {number} [rate] - The playback rate.
     * @param {number} [offset] - Where it starts, in seconds, at random within the loop by default.
     * @returns {AudioBufferSourceNode} The source.
     * @private
     */
    _sampleLoop(buffer, loop, rate = 1, offset = loop[0] + Math.random() * (loop[1] - loop[0])) {
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = loop[0];
        source.loopEnd = loop[1];
        source.playbackRate.value = rate;
        source.start(this.context.currentTime, offset);
        return source;
    }

    /**
     * The player's engine, heard from behind - the recorded loop, with a second, slower and darker
     * copy of it under the afterburner for the thunder, and the rush of the air.
     *
     * @private
     */
    _createEngine() {
        this.engine = this._gain(0);
        this.engine.connect(this.mix);

        this.engineSource = this._sampleLoop(this.samples.engine, ENGINE_LOOP);
        this.engineFilter = this._filter('lowpass', 6000, 0.5);
        this.engineGain = this._gain(0);
        this.engineSource.connect(this.engineFilter).connect(this.engineGain).connect(this.engine);

        this.burnSource = this._sampleLoop(this.samples.engine, ENGINE_LOOP, 0.72);
        this.burnGain = this._gain(0);
        this.burnSource.connect(this._filter('lowpass', 650)).connect(this.burnGain).connect(this.engine);

        this.windFilter = this._filter('bandpass', 900, 0.9);
        this.windGain = this._gain(0);
        this._loop(this.pink).connect(this.windFilter).connect(this.windGain).connect(this.mix);
        this.windWobble = this._wobble(this.windGain.gain, 1.6, 0);
    }

    /**
     * The nearest enemy jet - the engine recording again, swelling as it passes, its pitch dropping
     * as it goes.
     *
     * @private
     */
    _createFlyby() {
        this.flybySource = this._sampleLoop(this.samples.engine, ENGINE_LOOP);
        this.flybyFilter = this._filter('lowpass', 2000, 0.6);
        this.flybyGain = this._gain(0);
        this.flybySource.connect(this.flybyFilter).connect(this.flybyGain).connect(this.mix);
        const send = this._gain(0.25);
        this.flybyGain.connect(send).connect(this.reverb);
    }

    /**
     * The cockpit sounds - the growl of the seeker and the missile warning.
     *
     * @private
     */
    _createTones() {
        const context = this.context;

        // the seeker growls, broken up, while it acquires, and sings a steady higher note when locked
        this.lockTone = context.createOscillator();
        this.lockTone.type = 'triangle';
        this.lockTone.frequency.value = 820;
        this.lockGrowl = this._gain(1);
        this.lockGain = this._gain(0);
        this.lockTone.connect(this.lockGrowl).connect(this.lockGain).connect(this.mix);
        this.lockTone.start();
        const growl = context.createOscillator();
        growl.type = 'square';
        growl.frequency.value = 19;
        this.lockGrowlDepth = this._gain(0);
        growl.connect(this.lockGrowlDepth).connect(this.lockGrowl.gain);
        growl.start();

        // the missile warning, the recorded alarm, which plays only while a missile is tracking
        this.warningGain = this._gain(0);
        this.warningGain.connect(this.mix);
        /** @type {AudioBufferSourceNode|null} */
        this.warningSource = null;
    }

    /**
     * Updates the continuous sounds.
     *
     * @param {number} dt - The time step.
     * @param {object} state - The state of the player.
     * @param {boolean} state.alive - Whether the player is flying.
     * @param {number} state.throttle - The throttle, from zero to one, above which is afterburner.
     * @param {number} state.speed - The airspeed, in meters per second.
     * @param {number} state.lock - Zero with no target, between zero and one while acquiring, one
     * when locked.
     * @param {number} state.warning - How close the nearest missile tracking the player is, from zero
     * when there is none to one when it is about to hit.
     * @param {number} state.flybyDistance - The distance to the nearest enemy jet, in meters.
     * @param {number} state.flybyClosing - How fast the nearest enemy jet is closing, in meters per
     * second, negative when it is moving away.
     */
    update(dt, { alive, throttle, speed, lock, warning, flybyDistance = Infinity, flybyClosing = 0 }) {
        const now = this.context.currentTime;
        const set = this._set;

        // the engine spools towards the throttle, and dies away once the jet is hit
        const target = alive ? throttle : 0;
        const spool = target > this.power ? SPOOL_UP : alive ? SPOOL_DOWN : ENGINE_DEATH;
        this.power += (target - this.power) * (1 - Math.exp(-dt / spool));
        this.life += ((alive ? 1 : 0) - this.life) * (1 - Math.exp(-dt / (alive ? 0.3 : ENGINE_DEATH)));
        const power = Math.min(this.power, 1);
        const burner = Math.min(Math.max((this.power - 1) / 0.6, 0), 1);

        set(this.engine.gain, this.life * ENGINE_LEVEL);
        // the recording pitches up with the spool, and opens up and swells with the afterburner,
        // which brings in the thunder of the slow copy under it
        set(this.engineSource.playbackRate, 0.78 + power * 0.32 + burner * 0.08, 0.1);
        set(this.engineFilter.frequency, 1500 + power * 5000 + burner * 9000, 0.1);
        set(this.engineGain.gain, 0.55 + power * 0.35 + burner * 0.4);
        set(this.burnSource.playbackRate, 0.66 + power * 0.1 + burner * 0.06, 0.1);
        set(this.burnGain.gain, burner * 0.9);

        const rush = alive ? Math.min(1, speed / 320) : 0;
        const wind = rush * rush * 0.07;
        set(this.windGain.gain, wind, 0.2);
        set(this.windWobble.gain, wind * 0.4);
        set(this.windFilter.frequency, 500 + rush * 1500, 0.2);

        // the nearest enemy jet, louder and brighter as it closes, and higher pitched while it does
        const near = Math.max(0, 1 - flybyDistance / 900);
        const doppler = Math.min(Math.max(1 + flybyClosing / 650, 0.6), 1.6);
        set(this.flybyGain.gain, near * near * 0.8, 0.08);
        set(this.flybyFilter.frequency, 500 + near * near * 9000, 0.08);
        set(this.flybySource.playbackRate, doppler, 0.08);

        // a growl while the seeker acquires, a steady tone once locked
        const acquiring = alive && lock > 0 && lock < 1;
        const locked = alive && lock >= 1;
        set(this.lockGain.gain, locked ? 0.05 : acquiring ? 0.04 : 0, 0.02);
        set(this.lockTone.frequency, locked ? 1280 : 780 + lock * 200, 0.03);
        set(this.lockGrowl.gain, acquiring ? 0.5 : 1, 0.01);
        set(this.lockGrowlDepth.gain, acquiring ? 0.5 : 0, 0.01);

        // the alarm starts on a beep with each new warning, and runs faster as the missile closes
        const warned = alive && warning > 0;
        if (warned && !this.warningSource) {
            this.warningSource = this._sampleLoop(this.samples.alarm, ALARM_LOOP, 1, ALARM_LOOP[0]);
            this.warningSource.connect(this.warningGain);
        } else if (!warned && this.warningSource) {
            this.warningSource.stop(now + 0.08);
            this.warningSource = null;
        }
        if (this.warningSource) {
            set(this.warningSource.playbackRate, 1 + warning * 0.18);
        }
        set(this.warningGain.gain, warned ? 0.45 + warning * 0.3 : 0, 0.01);
    }

    /**
     * Starts a one-shot sound - an input that leads through the air, which dulls it with distance,
     * to the mix and to the echo.
     *
     * @param {number} air - The frequency above which the air has absorbed the sound.
     * @param {number} wet - How much of it goes to the echo.
     * @returns {AudioNode} The input.
     * @private
     */
    _oneShot(air, wet) {
        const input = this._filter('lowpass', Math.min(air, 18000), 0.5);
        input.connect(this.mix);
        input.connect(this._gain(wet)).connect(this.reverb);
        return input;
    }

    /**
     * Plays a noise buffer, shaped by a filter and an envelope.
     *
     * @param {AudioNode} output - Where it plays to.
     * @param {object} options - The sound.
     * @param {AudioBuffer} options.buffer - The noise.
     * @param {number} options.start - When it starts, in context time.
     * @param {number} options.volume - Its peak volume.
     * @param {number} options.attack - How long it takes to swell, in seconds.
     * @param {number} options.decay - How long it takes to die away, in seconds.
     * @param {BiquadFilterType} options.type - The filter.
     * @param {number} options.from - The filter frequency it starts at.
     * @param {number} [options.to] - The filter frequency it ends at.
     * @param {number} [options.q] - The filter quality.
     * @param {number} [options.rate] - The playback rate it starts at.
     * @param {number} [options.rateTo] - The playback rate it ends at.
     * @param {number} [options.wobble] - How much the volume wobbles at random.
     * @private
     */
    _noise(
        output,
        { buffer, start, volume, attack, decay, type, from, to = from, q = 0.7, rate = 1, rateTo = rate, wobble = 0 }
    ) {
        if (volume <= 0.0001) {
            return;
        }
        const end = start + attack + decay;
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.playbackRate.setValueAtTime(rate, start);
        source.playbackRate.exponentialRampToValueAtTime(rateTo, end);
        const filter = this._filter(type, from, q);
        filter.frequency.setValueAtTime(from, start);
        filter.frequency.exponentialRampToValueAtTime(Math.max(to, 20), end);
        const gain = this._gain(0);
        this._envelope(gain.gain, start, volume, attack, decay);
        if (wobble > 0) {
            const amount = this._gain(0);
            this._envelope(amount.gain, start, volume * wobble, attack, decay);
            const modulator = this.context.createBufferSource();
            modulator.buffer = this.wobble;
            modulator.loop = true;
            modulator.playbackRate.value = 2.5;
            modulator.connect(amount).connect(gain.gain);
            modulator.start(start, Math.random() * this.wobble.duration);
            modulator.stop(end + 0.05);
        }
        source.connect(filter).connect(gain).connect(output);
        source.start(start, Math.random() * buffer.duration);
        source.stop(end + 0.05);
    }

    /**
     * Plays a tone that sweeps in pitch, shaped by an envelope.
     *
     * @param {AudioNode} output - Where it plays to.
     * @param {object} options - The sound.
     * @param {OscillatorType} options.type - The waveform.
     * @param {number} options.start - When it starts, in context time.
     * @param {number} options.volume - Its peak volume.
     * @param {number} options.attack - How long it takes to swell, in seconds.
     * @param {number} options.decay - How long it takes to die away, in seconds.
     * @param {number} options.from - The frequency it starts at.
     * @param {number} [options.to] - The frequency it ends at.
     * @param {number} [options.drive] - How hard it is saturated, for punch.
     * @private
     */
    _tone(output, { type, start, volume, attack, decay, from, to = from, drive = 0 }) {
        if (volume <= 0.0001) {
            return;
        }
        const end = start + attack + decay;
        const oscillator = this.context.createOscillator();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, start);
        oscillator.frequency.exponentialRampToValueAtTime(to, end);
        const gain = this._gain(0);
        this._envelope(gain.gain, start, volume, attack, decay);
        if (drive > 0) {
            oscillator.connect(this._saturator(drive)).connect(gain);
        } else {
            oscillator.connect(gain);
        }
        gain.connect(output);
        oscillator.start(start);
        oscillator.stop(end + 0.05);
    }

    /**
     * A soft saturator.
     *
     * @param {number} drive - How hard it drives.
     * @returns {WaveShaperNode} The saturator.
     * @private
     */
    _saturator(drive) {
        const shaper = this.context.createWaveShaper();
        const curve = new Float32Array(1024);
        for (let i = 0; i < curve.length; i++) {
            const x = (i / (curve.length - 1)) * 2 - 1;
            curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
        }
        shaper.curve = curve;
        return shaper;
    }

    /**
     * Shapes a parameter with a swell and a natural fall - quick at first, then a long tail, down
     * to about -40 dB by the end of the decay.
     *
     * @param {AudioParam} param - The parameter.
     * @param {number} start - When it starts, in context time.
     * @param {number} peak - The peak value.
     * @param {number} attack - How long it takes to swell, in seconds.
     * @param {number} decay - How long it takes to fall away, in seconds.
     * @private
     */
    _envelope(param, start, peak, attack, decay) {
        param.setValueAtTime(0.0001, start);
        param.exponentialRampToValueAtTime(peak, start + attack);
        param.setTargetAtTime(0, start + attack, decay / 4.6);
    }

    /**
     * How a sound from some distance away arrives - how late, how loud, and how dull.
     *
     * @param {number} distance - The distance, in meters.
     * @param {number} reach - The distance at which it is at half volume.
     * @returns {{ start: number, near: number, air: number, wet: number }} When it starts, its volume
     * from zero to one, the frequency the air has absorbed above, and how much echo it has.
     * @private
     */
    _arrival(distance, reach) {
        const near = 1 / (1 + distance / reach);
        return {
            start: this.context.currentTime + Math.min(distance / SOUND_SPEED, MAX_SOUND_DELAY),
            near,
            air: 16000 / (1 + distance / 220),
            wet: 0.2 + 0.6 * (1 - near)
        };
    }

    /**
     * A missile's motor lighting - the recorded afterburner, which roars and fades as the missile
     * races off. Each one is pitched a little differently, so a salvo does not repeat itself.
     *
     * @param {number} distance - The distance to the missile, in meters.
     */
    launch(distance) {
        const { start, near, air, wet } = this._arrival(distance, 120);
        if (near < 0.04) {
            return;
        }
        const source = this.context.createBufferSource();
        source.buffer = this.samples.launch;
        source.playbackRate.value = 0.94 + Math.random() * 0.12;
        source.connect(this._gain(Math.min(1, near * 1.1))).connect(this._oneShot(air, wet * 0.5));
        source.start(start);
    }

    /**
     * A detonation - a sharp crack from close by, the body of the blast sweeping down, a low boom,
     * a rumble that rolls on, and the crackle of debris. Further away it arrives later, quieter,
     * duller, and with more of the echo.
     *
     * @param {number} distance - The distance to the blast, in meters.
     * @param {number} size - How big the blast is.
     */
    explosion(distance, size) {
        const { start, near, air, wet } = this._arrival(distance, 700);
        if (near < 0.03) {
            return;
        }
        const vary = () => 0.85 + Math.random() * 0.3;
        const v = Math.min(1.3, near * (0.6 + size * 0.5));
        const tail = (3 + size * 1.5) * vary();
        const output = this._oneShot(air, wet);
        const close = Math.max(0, 1 - distance / 900);

        this._noise(output, {
            buffer: this.white,
            start,
            volume: 1.1 * v * close,
            attack: 0.001,
            decay: 0.07,
            type: 'highpass',
            from: 900,
            to: 400
        });
        this._noise(output, {
            buffer: this.pink,
            start,
            volume: 1.1 * v,
            attack: 0.004,
            decay: (1 + size * 0.4) * vary(),
            type: 'lowpass',
            from: 4200 * vary(),
            to: 160,
            q: 0.4
        });
        this._tone(output, {
            type: 'sine',
            start,
            volume: 1.2 * v,
            attack: 0.006,
            decay: (1.4 + size * 0.5) * vary(),
            from: 78 * vary(),
            to: 26,
            drive: 3
        });
        this._noise(output, {
            buffer: this.brown,
            start: start + 0.05,
            volume: 0.9 * v,
            attack: 0.18,
            decay: tail,
            type: 'lowpass',
            from: 220,
            to: 70,
            wobble: 0.6
        });
        this._noise(output, {
            buffer: this.crackle,
            start: start + 0.03,
            volume: 0.45 * v * Math.max(0, 1 - distance / 1500),
            attack: 0.02,
            decay: 1.4 * vary(),
            type: 'bandpass',
            from: 2600,
            to: 1200,
            q: 0.5,
            rate: vary()
        });
    }

    /**
     * The player taking a hit - a close blast with the clang of the airframe.
     */
    hit() {
        this.explosion(25, 0.6);
        const { start, air } = this._arrival(0, 1);
        const output = this._oneShot(air, 0.2);
        for (const partial of [380, 1015, 1730, 2650]) {
            this._tone(output, {
                type: 'sine',
                start,
                volume: 0.12,
                attack: 0.002,
                decay: 0.25 + Math.random() * 0.4,
                from: partial * (0.95 + Math.random() * 0.1),
                to: partial * 0.97
            });
        }
    }

    /**
     * A salvo of flares popping, each with a fizz as it burns.
     */
    flare() {
        const { start, air } = this._arrival(0, 1);
        const output = this._oneShot(air, 0.35);
        for (let i = 0; i < 4; i++) {
            const t = start + i * (0.06 + Math.random() * 0.03);
            this._noise(output, {
                buffer: this.white,
                start: t,
                volume: 0.45,
                attack: 0.001,
                decay: 0.03,
                type: 'bandpass',
                from: 2600,
                q: 0.8
            });
            this._tone(output, { type: 'sine', start: t, volume: 0.25, attack: 0.002, decay: 0.08, from: 180, to: 70 });
            this._noise(output, {
                buffer: this.white,
                start: t + 0.02,
                volume: 0.06,
                attack: 0.05,
                decay: 0.6,
                type: 'highpass',
                from: 5000,
                to: 3000
            });
        }
    }

    /**
     * The missile defense gun - a rotary cannon, firing so fast the shots blur into one ripping buzz.
     */
    gun() {
        const context = this.context;
        const { start, air } = this._arrival(0, 1);
        const length = 0.42;
        const output = this._oneShot(air, 0.4);
        const fireRate = 70 + Math.random() * 6;

        // the shots - noise chopped at the fire rate
        const source = context.createBufferSource();
        source.buffer = this.white;
        source.loop = true;
        const chop = this._gain(0.5);
        const shots = context.createOscillator();
        shots.type = 'square';
        shots.frequency.value = fireRate;
        shots.connect(this._gain(0.5)).connect(chop.gain);
        const level = this._gain(0);
        level.gain.setValueAtTime(0.0001, start);
        level.gain.exponentialRampToValueAtTime(0.3, start + 0.03);
        level.gain.setValueAtTime(0.3, start + length - 0.06);
        level.gain.exponentialRampToValueAtTime(0.0001, start + length);
        source
            .connect(this._filter('bandpass', 1400, 0.9))
            .connect(chop)
            .connect(level)
            .connect(output);

        // and the low buzz of the barrels
        const buzz = context.createOscillator();
        buzz.type = 'sawtooth';
        buzz.frequency.value = fireRate;
        const buzzLevel = this._gain(0);
        buzzLevel.gain.setValueAtTime(0.0001, start);
        buzzLevel.gain.exponentialRampToValueAtTime(0.2, start + 0.03);
        buzzLevel.gain.setValueAtTime(0.2, start + length - 0.06);
        buzzLevel.gain.exponentialRampToValueAtTime(0.0001, start + length);
        buzz.connect(this._saturator(2.5)).connect(this._filter('lowpass', 900)).connect(buzzLevel).connect(output);

        for (const node of [source, shots, buzz]) {
            node.start(start);
            node.stop(start + length + 0.05);
        }
    }

    /**
     * The radar warning of a missile launch - two quick, high pings.
     */
    ping() {
        const { start } = this._arrival(0, 1);
        for (let i = 0; i < 2; i++) {
            this._tone(this.mix, {
                type: 'sine',
                start: start + i * 0.16,
                volume: 0.12,
                attack: 0.008,
                decay: 0.12,
                from: 1750
            });
        }
    }
}
