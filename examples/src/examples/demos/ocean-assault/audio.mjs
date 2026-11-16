// Sound for the Ocean Assault demo. As every sprite is a part of one sheet, every sound is a part
// of one audio file: a JSON file beside it says where each sound starts and how long it is, and a
// slot of a sound component plays each part.

import { Entity } from 'playcanvas';

/**
 * @import { AppBase, Asset, SoundSlot } from 'playcanvas'
 */

/**
 * Where the sounds are in the audio file, as assets/sounds/ocean-assault.json has them.
 *
 * @typedef {object} SoundMap
 * @property {Record<string, { start: number, duration: number }>} sounds - Each sound by name:
 * where it starts and how long it is, in seconds.
 */

export class Sounds {
    /**
     * @param {AppBase} app - The app.
     * @param {Asset} audio - The audio asset that holds every sound.
     * @param {SoundMap} map - Where each sound is in it.
     */
    constructor(app, audio, map) {
        this.entity = new Entity('sounds');
        this.entity.addComponent('sound', { positional: false, volume: 0.7 });
        app.root.addChild(this.entity);

        // Sounds that play at once add up, and a screen of explosions adds up to more than the
        // output can carry, which distorts. The slots do the overlapping; this compressor, a Web
        // Audio node, only turns the loudest moments down. Every slot plays through it.
        const context = app.soundManager.context;
        const compressor = context?.createDynamicsCompressor();
        if (compressor) {
            compressor.threshold.value = -12;
            compressor.ratio.value = 6;
        }

        // A slot for each sound, which plays its part of the file. With overlap on, a sound that is
        // still playing goes on when it is played again, so shots and explosions overlap.
        for (const [name, { start, duration }] of Object.entries(map.sounds)) {
            const slot = this.entity.sound.addSlot(name, {
                asset: audio.id,
                startTime: start,
                duration,
                overlap: true
            });
            if (compressor) slot?.setExternalNodes(compressor);
        }

        // when each sound last played, so that a sound does not pile up on itself
        /** @type {Record<string, number>} */
        this._last = {};
    }

    /**
     * @param {string} name - The name of a sound.
     * @returns {SoundSlot} Its slot.
     * @private
     */
    _slot(name) {
        return /** @type {SoundSlot} */ (this.entity.sound.slot(name));
    }

    /**
     * @param {string} name - The name of a sound.
     * @param {number} gap - The least time between two plays of the sound, in seconds.
     * @param {number} [pitch] - How much higher or lower to play it: 1 is as it was recorded.
     * @private
     */
    _play(name, gap, pitch = 1) {
        const now = performance.now() / 1000;
        if (now - (this._last[name] ?? -Infinity) < gap) return;
        this._last[name] = now;

        // the pitch of an overlapping slot is that of the sounds it plays from now on
        const slot = this._slot(name);
        slot.pitch = pitch;
        slot.play();
    }

    // the player's guns
    shot() {
        this._play('shot', 0.09);
    }

    // a shot landing on something that is still flying
    hit() {
        this._play('hit', 0.05);
    }

    // a gunboat's missile leaving its deck
    launch() {
        this._play('launch', 0.15);
    }

    // a small raider going up: no two the same
    boom() {
        this._play('boom', 0.05, 0.85 + Math.random() * 0.3);
    }

    // a big one
    blast() {
        this._play('blast', 0.08, 0.85 + Math.random() * 0.3);
    }

    // a power up collected
    pickup() {
        this._play('pickup', 0.1);
    }

    // the player's seaplane going down
    crash() {
        this._play('crash', 0.2);
    }

    // the game starting
    start() {
        this._play('start', 0.3);
    }

    // the airship arriving
    alarm() {
        this._play('alarm', 1);
    }
}
