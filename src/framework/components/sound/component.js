import { Debug } from '../../../core/debug.js';

import { DISTANCE_LINEAR } from '../../../platform/audio/constants.js';

import { Component } from '../component.js';

import { SoundSlot } from './slot.js';

/**
 * The Sound Component controls playback of {@link Sound}s.
 *
 * @augments Component
 */
class SoundComponent extends Component {
    /**
     * Create a new Sound Component.
     *
     * @param {import('./system.js').SoundComponentSystem} system - The ComponentSystem that
     * created this component.
     * @param {import('../../entity.js').Entity} entity - The entity that the Component is attached
     * to.
     */
    constructor(system, entity) {
        super(system, entity);

        /** @private */
        this._volume = 1;
        /** @private */
        this._pitch = 1;
        /** @private */
        this._positional = true;
        /** @private */
        this._refDistance = 1;
        /** @private */
        this._maxDistance = 10000;
        /** @private */
        this._rollOffFactor = 1;
        /** @private */
        this._distanceModel = DISTANCE_LINEAR;

        /**
         * @type {Object<string, SoundSlot>}
         * @private
         */
        this._slots = {};

        /** @private */
        this._playingBeforeDisable = {};
    }

    /**
     * Fired when a sound instance starts playing.
     *
     * @event SoundComponent#play
     * @param {SoundSlot} slot - The slot whose instance started playing.
     * @param {import('../../../platform/sound/instance.js').SoundInstance} instance - The instance
     * that started playing.
     */

    /**
     * Fired when a sound instance is paused.
     *
     * @event SoundComponent#pause
     * @param {SoundSlot} slot - The slot whose instance was paused.
     * @param {import('../../../platform/sound/instance.js').SoundInstance} instance - The instance
     * that was paused created to play the sound.
     */

    /**
     * Fired when a sound instance is resumed.
     *
     * @event SoundComponent#resume
     * @param {SoundSlot} slot - The slot whose instance was resumed.
     * @param {import('../../../platform/sound/instance.js').SoundInstance} instance - The instance
     * that was resumed.
     */

    /**
     * Fired when a sound instance is stopped.
     *
     * @event SoundComponent#stop
     * @param {SoundSlot} slot - The slot whose instance was stopped.
     * @param {import('../../../platform/sound/instance.js').SoundInstance} instance - The instance
     * that was stopped.
     */

    /**
     * Fired when a sound instance stops playing because it reached its ending.
     *
     * @event SoundComponent#end
     * @param {SoundSlot} slot - The slot whose instance ended.
     * @param {import('../../../platform/sound/instance.js').SoundInstance} instance - The instance
     * that ended.
     */

    /**
     * Update the specified property on all sound instances.
     *
     * @param {string} property - The name of the SoundInstance property to update.
     * @param {string|number} value - The value to set the property to.
     * @param {boolean} isFactor - True if the value is a factor of the slot property or false
     * if it is an absolute value.
     * @private
     */
    _updateSoundInstances(property, value, isFactor) {
        const slots = this._slots;
        for (const key in slots) {
            const slot = slots[key];
            // only change value of non-overlapping instances
            if (!slot.overlap) {
                const instances = slot.instances;
                for (let i = 0, len = instances.length; i < len; i++) {
                    instances[i][property] = isFactor ? slot[property] * value : value;
                }
            }
        }
    }

    /**
     * Determines which algorithm to use to reduce the volume of the sound as it moves away from
     * the listener. Can be:
     *
     * - {@link DISTANCE_LINEAR}
     * - {@link DISTANCE_INVERSE}
     * - {@link DISTANCE_EXPONENTIAL}
     *
     * Defaults to {@link DISTANCE_LINEAR}.
     *
     * @type {string}
     */
    set distanceModel(value) {
        this._distanceModel = value;
        this._updateSoundInstances('distanceModel', value, false);
    }

    get distanceModel() {
        return this._distanceModel;
    }

    /**
     * The maximum distance from the listener at which audio falloff stops. Note the volume of the
     * audio is not 0 after this distance, but just doesn't fall off anymore. Defaults to 10000.
     *
     * @type {number}
     */
    set maxDistance(value) {
        this._maxDistance = value;
        this._updateSoundInstances('maxDistance', value, false);
    }

    get maxDistance() {
        return this._maxDistance;
    }

    /**
     * The reference distance for reducing volume as the sound source moves further from the
     * listener. Defaults to 1.
     *
     * @type {number}
     */
    set refDistance(value) {
        this._refDistance = value;
        this._updateSoundInstances('refDistance', value, false);
    }

    get refDistance() {
        return this._refDistance;
    }

    /**
     * The factor used in the falloff equation. Defaults to 1.
     *
     * @type {number}
     */
    set rollOffFactor(value) {
        this._rollOffFactor = value;
        this._updateSoundInstances('rollOffFactor', value, false);
    }

    get rollOffFactor() {
        return this._rollOffFactor;
    }

    /**
     * The pitch modifier to play the audio with. Must be larger than 0.01. Defaults to 1.
     *
     * @type {number}
     */
    set pitch(value) {
        this._pitch = value;
        this._updateSoundInstances('pitch', value, true);
    }

    get pitch() {
        return this._pitch;
    }

    /**
     * The volume modifier to play the audio with. In range 0-1. Defaults to 1.
     *
     * @type {number}
     */
    set volume(value) {
        this._volume = value;
        this._updateSoundInstances('volume', value, true);
    }

    get volume() {
        return this._volume;
    }

    /**
     * If true the audio will play back at the location of the Entity in space, so the audio will
     * be affected by the position of the {@link AudioListenerComponent}. Defaults to true.
     *
     * @type {boolean}
     */
    set positional(newValue) {
        this._positional = newValue;

        const slots = this._slots;
        for (const key in slots) {
            const slot = slots[key];
            // recreate non overlapping sounds
            if (!slot.overlap) {
                const instances = slot.instances;
                const oldLength = instances.length;

                // When the instance is stopped, it gets removed from the slot.instances array
                // so we are going backwards to compensate for that

                for (let i = oldLength - 1; i >= 0; i--) {
                    const isPlaying = instances[i].isPlaying || instances[i].isSuspended;
                    const currentTime = instances[i].currentTime;
                    if (isPlaying)
                        instances[i].stop();

                    const instance = slot._createInstance();
                    if (isPlaying) {
                        instance.play();
                        instance.currentTime = currentTime;
                    }

                    instances.push(instance);
                }
            }
        }
    }

    get positional() {
        return this._positional;
    }

    /**
     * A dictionary that contains the {@link SoundSlot}s managed by this SoundComponent.
     *
     * @type {Object<string, SoundSlot>}
     */
    set slots(newValue) {
        const oldValue = this._slots;

        // stop previous slots
        if (oldValue) {
            for (const key in oldValue) {
                oldValue[key].stop();
            }
        }

        const slots = {};

        // convert data to slots
        for (const key in newValue) {
            if (!(newValue[key] instanceof SoundSlot)) {
                if (newValue[key].name) {
                    slots[newValue[key].name] = new SoundSlot(this, newValue[key].name, newValue[key]);
                }
            } else {
                slots[newValue[key].name] = newValue[key];
            }
        }

        this._slots = slots;

        // call onEnable in order to start autoPlay slots
        if (this.enabled && this.entity.enabled)
            this.onEnable();
    }

    get slots() {
        return this._slots;
    }

    onEnable() {
        // do not run if running in Editor
        if (this.system._inTools) {
            return;
        }

        const slots = this._slots;
        const playingBeforeDisable = this._playingBeforeDisable;

        for (const key in slots) {
            const slot = slots[key];
            // play if autoPlay is true or
            // if the slot was paused when the component
            // got disabled
            if (slot.autoPlay && slot.isStopped) {
                slot.play();
            } else if (playingBeforeDisable[key]) {
                slot.resume();
            } else if (!slot.isLoaded) {
                // start loading slots
                slot.load();
            }
        }
    }

    onDisable() {
        const slots = this._slots;
        const playingBeforeDisable = {};

        for (const key in slots) {
            // pause non-overlapping sounds
            if (!slots[key].overlap) {
                if (slots[key].isPlaying) {
                    slots[key].pause();
                    // remember sounds playing when we disable
                    // so we can resume them on enable
                    playingBeforeDisable[key] = true;
                }
            }
        }

        this._playingBeforeDisable = playingBeforeDisable;
    }

    onRemove() {
        this.off();
    }

    /**
     * Creates a new {@link SoundSlot} with the specified name.
     *
     * @param {string} name - The name of the slot.
     * @param {object} [options] - Settings for the slot.
     * @param {number} [options.volume=1] - The playback volume, between 0 and 1.
     * @param {number} [options.pitch=1] - The relative pitch, default of 1, plays at normal pitch.
     * @param {boolean} [options.loop=false] - If true the sound will restart when it reaches the end.
     * @param {number} [options.startTime=0] - The start time from which the sound will start playing.
     * @param {number} [options.duration=null] - The duration of the sound that the slot will play
     * starting from startTime.
     * @param {boolean} [options.overlap=false] - If true then sounds played from slot will be
     * played independently of each other. Otherwise the slot will first stop the current sound
     * before starting the new one.
     * @param {boolean} [options.autoPlay=false] - If true the slot will start playing as soon as
     * its audio asset is loaded.
     * @param {number} [options.asset=null] - The asset id of the audio asset that is going to be
     * played by this slot.
     * @returns {SoundSlot|null} The new slot or null if the slot already exists.
     * @example
     * // get an asset by id
     * var asset = app.assets.get(10);
     * // add a slot
     * this.entity.sound.addSlot('beep', {
     *     asset: asset
     * });
     * // play
     * this.entity.sound.play('beep');
     */
    addSlot(name, options) {
        const slots = this._slots;
        if (slots[name]) {
            Debug.warn(`A sound slot with name ${name} already exists on Entity ${this.entity.path}`);
            return null;
        }

        const slot = new SoundSlot(this, name, options);
        slots[name] = slot;

        if (slot.autoPlay && this.enabled && this.entity.enabled) {
            slot.play();
        }

        return slot;
    }

    /**
     * Removes the {@link SoundSlot} with the specified name.
     *
     * @param {string} name - The name of the slot.
     * @example
     * // remove a slot called 'beep'
     * this.entity.sound.removeSlot('beep');
     */
    removeSlot(name) {
        const slots = this._slots;
        if (slots[name]) {
            slots[name].stop();
            delete slots[name];
        }
    }

    /**
     * Returns the slot with the specified name.
     *
     * @param {string} name - The name of the slot.
     * @returns {SoundSlot|undefined} The slot.
     * @example
     * // get a slot and set its volume
     * this.entity.sound.slot('beep').volume = 0.5;
     *
     */
    slot(name) {
        return this._slots[name];
    }

    /**
     * Return a property from the slot with the specified name.
     *
     * @param {string} name - The name of the {@link SoundSlot} to look for.
     * @param {string} property - The name of the property to look for.
     * @returns {*} The value from the looked property inside the slot with specified name. May be undefined if slot does not exist.
     * @private
     */
    _getSlotProperty(name, property) {
        if (!this.enabled || !this.entity.enabled) {
            return undefined;
        }

        const slot = this._slots[name];
        if (!slot) {
            Debug.warn(`Trying to get ${property} from sound slot with name ${name} which does not exist`);
            return undefined;
        }

        return slot[property];
    }

    /**
     * Returns true if the slot with the specified name is currently playing.
     *
     * @param {string} name - The name of the {@link SoundSlot} to look for.
     * @returns {boolean} True if the slot with the specified name exists and is currently playing.
     */
    isPlaying(name) {
        return this._getSlotProperty(name, 'isPlaying') || false;
    }

    /**
     * Returns true if the asset of the slot with the specified name is loaded..
     *
     * @param {string} name - The name of the {@link SoundSlot} to look for.
     * @returns {boolean} True if the slot with the specified name exists and its asset is loaded.
     */
    isLoaded(name) {
        return this._getSlotProperty(name, 'isLoaded') || false;
    }

    /**
     * Returns true if the slot with the specified name is currently paused.
     *
     * @param {string} name - The name of the {@link SoundSlot} to look for.
     * @returns {boolean} True if the slot with the specified name exists and is currently paused.
     */
    isPaused(name) {
        return this._getSlotProperty(name, 'isPaused') || false;
    }

    /**
     * Returns true if the slot with the specified name is currently stopped.
     *
     * @param {string} name - The name of the {@link SoundSlot} to look for.
     * @returns {boolean} True if the slot with the specified name exists and is currently stopped.
     */
    isStopped(name) {
        return this._getSlotProperty(name, 'isStopped') || false;
    }

    /**
     * Begins playing the sound slot with the specified name. The slot will restart playing if it
     * is already playing unless the overlap field is true in which case a new sound will be
     * created and played.
     *
     * @param {string} name - The name of the {@link SoundSlot} to play.
     * @returns {import('../../../platform/sound/instance.js').SoundInstance|null} The sound
     * instance that will be played. Returns null if the component or its parent entity is disabled
     * or if the SoundComponent has no slot with the specified name.
     * @example
     * // get asset by id
     * var asset = app.assets.get(10);
     * // create a slot and play it
     * this.entity.sound.addSlot('beep', {
     *     asset: asset
     * });
     * this.entity.sound.play('beep');
     */
    play(name) {
        if (!this.enabled || !this.entity.enabled) {
            return null;
        }

        const slot = this._slots[name];
        if (!slot) {
            Debug.warn(`Trying to play sound slot with name ${name} which does not exist`);
            return null;
        }

        return slot.play();
    }

    /**
     * Pauses playback of the slot with the specified name. If the name is undefined then all slots
     * currently played will be paused. The slots can be resumed by calling {@link SoundComponent#resume}.
     *
     * @param {string} [name] - The name of the slot to pause. Leave undefined to pause everything.
     * @example
     * // pause all sounds
     * this.entity.sound.pause();
     * // pause a specific sound
     * this.entity.sound.pause('beep');
     */
    pause(name) {
        const slots = this._slots;

        if (name) {
            const slot = slots[name];
            if (!slot) {
                Debug.warn(`Trying to pause sound slot with name ${name} which does not exist`);
                return;
            }

            slot.pause();
        } else {
            for (const key in slots) {
                slots[key].pause();
            }
        }
    }

    /**
     * Resumes playback of the sound slot with the specified name if it's paused. If no name is
     * specified all slots will be resumed.
     *
     * @param {string} [name] - The name of the slot to resume. Leave undefined to resume everything.
     * @example
     * // resume all sounds
     * this.entity.sound.resume();
     * // resume a specific sound
     * this.entity.sound.resume('beep');
     */
    resume(name) {
        const slots = this._slots;

        if (name) {
            const slot = slots[name];
            if (!slot) {
                Debug.warn(`Trying to resume sound slot with name ${name} which does not exist`);
                return;
            }

            if (slot.isPaused) {
                slot.resume();
            }
        } else {
            for (const key in slots) {
                slots[key].resume();
            }
        }
    }

    /**
     * Stops playback of the sound slot with the specified name if it's paused. If no name is
     * specified all slots will be stopped.
     *
     * @param {string} [name] - The name of the slot to stop. Leave undefined to stop everything.
     * @example
     * // stop all sounds
     * this.entity.sound.stop();
     * // stop a specific sound
     * this.entity.sound.stop('beep');
     */
    stop(name) {
        const slots = this._slots;

        if (name) {
            const slot = slots[name];
            if (!slot) {
                Debug.warn(`Trying to stop sound slot with name ${name} which does not exist`);
                return;
            }

            slot.stop();
        } else {
            for (const key in slots) {
                slots[key].stop();
            }
        }
    }
}

export { SoundComponent };
