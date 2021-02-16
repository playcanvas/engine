import { DISTANCE_LINEAR } from '../../../audio/constants.js';

import { Component } from '../component.js';

import { SoundSlot } from './slot.js';

/**
 * @component
 * @class
 * @name SoundComponent
 * @augments pc.Component
 * @classdesc The Sound Component controls playback of {@link pc.Sound}s.
 * @description Create a new Sound Component.
 * @param {pc.SoundComponentSystem} system - The ComponentSystem that created this
 * component.
 * @param {pc.Entity} entity - The entity that the Component is attached to.
 * @property {number} volume The volume modifier to play the audio with. In range 0-1.
 * Defaults to 1.
 * @property {number} pitch The pitch modifier to play the audio with. Must be larger
 * than 0.01. Defaults to 1.
 * @property {boolean} positional If true the audio will play back at the location
 * of the Entity in space, so the audio will be affected by the position of the
 * {@link pc.AudioListenerComponent}. Defaults to true.
 * @property {string} distanceModel Determines which algorithm to use to reduce the
 * volume of the sound as it moves away from the listener. Can be:
 *
 * * {@link pc.DISTANCE_LINEAR}
 * * {@link pc.DISTANCE_INVERSE}
 * * {@link pc.DISTANCE_EXPONENTIAL}
 *
 * Defaults to {@link pc.DISTANCE_LINEAR}.
 * @property {number} refDistance The reference distance for reducing volume as the
 * sound source moves further from the listener. Defaults to 1.
 * @property {number} maxDistance The maximum distance from the listener at which audio
 * falloff stops. Note the volume of the audio is not 0 after this distance, but just
 * doesn't fall off anymore. Defaults to 10000.
 * @property {number} rollOffFactor The factor used in the falloff equation. Defaults to 1.
 * @property {object} slots A dictionary that contains the {@link pc.SoundSlot}s managed
 * by this SoundComponent.
 */
class SoundComponent extends Component {
    constructor(system, entity) {
        super(system, entity);

        this._volume = 1;
        this._pitch = 1;
        this._positional = true;
        this._refDistance = 1;
        this._maxDistance = 10000;
        this._rollOffFactor = 1;
        this._distanceModel = DISTANCE_LINEAR;
        this._slots = {};

        this._playingBeforeDisable = {};
    }

    get positional() {
        return this._positional;
    }

    set positional(newValue) {
        this._positional = newValue;

        var slots = this._slots;
        for (var key in slots) {
            var slot = slots[key];
            // recreate non overlapping sounds
            if (!slot.overlap) {
                var instances = slot.instances;
                var oldLength = instances.length;

                // When the instance is stopped, it gets removed from the slot.instances array
                // so we are going backwards to compenstate for that

                for (var i = oldLength - 1; i >= 0; i--) {
                    var isPlaying = instances[i].isPlaying || instances[i].isSuspended;
                    var currentTime = instances[i].currentTime;
                    if (isPlaying)
                        instances[i].stop();

                    var instance = slot._createInstance();
                    if (isPlaying) {
                        instance.play();
                        instance.currentTime = currentTime;
                    }

                    instances.push(instance);
                }
            }
        }
    }

    get slots() {
        return this._slots;
    }

    set slots(newValue) {
        var key;
        var oldValue = this._slots;

        // stop previous slots
        if (oldValue) {
            for (key in oldValue) {
                oldValue[key].stop();
            }
        }

        var slots = {};

        // convert data to slots
        for (key in newValue) {
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

    onEnable() {
        // do not run if running in Editor
        if (this.system._inTools) {
            return;
        }

        var slots = this._slots;
        var playingBeforeDisable = this._playingBeforeDisable;

        for (var key in slots) {
            var slot = slots[key];
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
        var slots = this._slots;
        var playingBeforeDisable = {};
        for (var key in slots) {
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
     * @function
     * @name SoundComponent#addSlot
     * @description Creates a new {@link pc.SoundSlot} with the specified name.
     * @param {string} name - The name of the slot.
     * @param {object} [options] - Settings for the slot.
     * @param {number} [options.volume=1] - The playback volume, between 0 and 1.
     * @param {number} [options.pitch=1] - The relative pitch, default of 1, plays at normal pitch.
     * @param {boolean} [options.loop=false] - If true the sound will restart when it reaches the end.
     * @param {number} [options.startTime=0] - The start time from which the sound will start playing.
     * @param {number} [options.duration=null] - The duration of the sound that the slot will play starting from startTime.
     * @param {boolean} [options.overlap=false] - If true then sounds played from slot will be played independently of each other. Otherwise the slot will first stop the current sound before starting the new one.
     * @param {boolean} [options.autoPlay=false] - If true the slot will start playing as soon as its audio asset is loaded.
     * @param {number} [options.asset=null] - The asset id of the audio asset that is going to be played by this slot.
     * @returns {pc.SoundSlot} The new slot.
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
        var slots = this._slots;
        if (slots[name]) {
            // #ifdef DEBUG
            console.warn('A sound slot with name ' + name + ' already exists on Entity ' + this.entity.path);
            // #endif
            return null;
        }

        var slot = new SoundSlot(this, name, options);
        slots[name] = slot;

        if (slot.autoPlay && this.enabled && this.entity.enabled) {
            slot.play();
        }

        return slot;
    }

    /**
     * @function
     * @name SoundComponent#removeSlot
     * @description Removes the {@link pc.SoundSlot} with the specified name.
     * @param {string} name - The name of the slot.
     * @example
     * // remove a slot called 'beep'
     * this.entity.sound.removeSlot('beep');
     */
    removeSlot(name) {
        var slots = this._slots;
        if (slots[name]) {
            slots[name].stop();
            delete slots[name];
        }
    }

    /**
     * @function
     * @name SoundComponent#slot
     * @description Returns the slot with the specified name.
     * @param {string} name - The name of the slot.
     * @returns {pc.SoundSlot} The slot.
     * @example
     * // get a slot and set its volume
     * this.entity.sound.slot('beep').volume = 0.5;
     *
     */
    slot(name) {
        return this._slots[name];
    }

    /**
     * @function
     * @name SoundComponent#play
     * @description Begins playing the sound slot with the specified name. The slot will restart playing if it is already playing unless the overlap field is true in which case a new sound will be created and played.
     * @param {string} name - The name of the {@link pc.SoundSlot} to play.
     * @example
     * // get asset by id
     * var asset = app.assets.get(10);
     * // create a slot and play it
     * this.entity.sound.addSlot('beep', {
     *     asset: asset
     * });
     * this.entity.sound.play('beep');
     * @returns {pc.SoundInstance} The sound instance that will be played.
     */
    play(name) {
        if (!this.enabled || !this.entity.enabled) {
            return null;
        }

        var slot = this._slots[name];
        if (!slot) {
            // #ifdef DEBUG
            console.warn('Trying to play sound slot with name ' + name + ' which does not exist');
            // #endif
            return null;
        }

        return slot.play();
    }

    /**
     * @function
     * @name SoundComponent#pause
     * @description Pauses playback of the slot with the specified name. If the name is undefined then all slots currently played will be paused. The slots can be resumed by calling {@link pc.SoundComponent#resume}.
     * @param {string} [name] - The name of the slot to pause. Leave undefined to pause everything.
     * @example
     * // pause all sounds
     * this.entity.sound.pause();
     * // pause a specific sound
     * this.entity.sound.pause('beep');
     */
    pause(name) {
        var slot;
        var slots = this._slots;

        if (name) {
            slot = slots[name];
            if (!slot) {
                // #ifdef DEBUG
                console.warn('Trying to pause sound slot with name ' + name + ' which does not exist');
                // #endif
                return;
            }

            slot.pause();
        } else {
            for (var key in slots) {
                slots[key].pause();
            }
        }
    }

    /**
     * @function
     * @name SoundComponent#resume
     * @description Resumes playback of the sound slot with the specified name if it's paused. If no
     * name is specified all slots will be resumed.
     * @param {string} [name] - The name of the slot to resume. Leave undefined to resume everything.
     * @example
     * // resume all sounds
     * this.entity.sound.resume();
     * // resume a specific sound
     * this.entity.sound.resume('beep');
     */
    resume(name) {
        var slots = this._slots;

        if (name) {
            var slot = slots[name];
            if (!slot) {
                // #ifdef DEBUG
                console.warn('Trying to resume sound slot with name ' + name + ' which does not exist');
                // #endif
                return;
            }

            if (slot.isPaused) {
                slot.resume();
            }
        } else {
            for (var key in slots) {
                slots[key].resume();
            }
        }
    }

    /**
     * @function
     * @name SoundComponent#stop
     * @description Stops playback of the sound slot with the specified name if it's paused. If no
     * name is specified all slots will be stopped.
     * @param {string} [name] - The name of the slot to stop. Leave undefined to stop everything.
     * @example
     * // stop all sounds
     * this.entity.sound.stop();
     * // stop a specific sound
     * this.entity.sound.stop('beep');
     */
    stop(name) {
        var slots = this._slots;

        if (name) {
            var slot = slots[name];
            if (!slot) {
                // #ifdef DEBUG
                console.warn('Trying to stop sound slot with name ' + name + ' which does not exist');
                // #endif
                return;
            }

            slot.stop();
        } else {
            for (var key in slots) {
                slots[key].stop();
            }
        }
    }
}

function defineSoundPropertyBasic(publicName, privateName) {
    Object.defineProperty(SoundComponent.prototype, publicName, {
        get: function () {
            return this[privateName];
        },
        set: function (newValue) {
            this[privateName] = newValue;

            var slots = this._slots;
            for (var key in slots) {
                var slot = slots[key];
                // only change value of non-overlapping instances
                if (!slot.overlap) {
                    var instances = slot.instances;
                    for (var i = 0, len = instances.length; i < len; i++) {
                        instances[i][publicName] = newValue;
                    }
                }
            }
        }
    });
}

function defineSoundPropertyFactor(publicName, privateName) {
    Object.defineProperty(SoundComponent.prototype, publicName, {
        get: function () {
            return this[privateName];
        },
        set: function (newValue) {
            this[privateName] = newValue;

            var slots = this._slots;
            for (var key in slots) {
                var slot = slots[key];
                // only change value of non-overlapping instances
                if (!slot.overlap) {
                    var instances = slot.instances;
                    for (var i = 0, len = instances.length; i < len; i++) {
                        instances[i][publicName] = slot[publicName] * newValue;
                    }
                }
            }
        }
    });
}

defineSoundPropertyFactor('pitch', '_pitch');
defineSoundPropertyFactor('volume', '_volume');
defineSoundPropertyBasic('refDistance', '_refDistance');
defineSoundPropertyBasic('maxDistance', '_maxDistance');
defineSoundPropertyBasic('rollOffFactor', '_rollOffFactor');
defineSoundPropertyBasic('distanceModel', '_distanceModel');

// Events Documentation

/**
 * @event
 * @name SoundComponent#play
 * @description Fired when a sound instance starts playing.
 * @param {pc.SoundSlot} slot - The slot whose instance started playing.
 * @param {pc.SoundInstance} instance - The instance that started playing.
 */

/**
 * @event
 * @name SoundComponent#pause
 * @description Fired when a sound instance is paused.
 * @param {pc.SoundSlot} slot - The slot whose instance was paused.
 * @param {pc.SoundInstance} instance - The instance that was paused created to play the sound.
 */

/**
 * @event
 * @name SoundComponent#resume
 * @description Fired when a sound instance is resumed..
 * @param {pc.SoundSlot} slot - The slot whose instance was resumed.
 * @param {pc.SoundInstance} instance - The instance that was resumed.
 */

/**
 * @event
 * @name SoundComponent#stop
 * @description Fired when a sound instance is stopped.
 * @param {pc.SoundSlot} slot - The slot whose instance was stopped.
 * @param {pc.SoundInstance} instance - The instance that was stopped.
 */

/**
 * @event
 * @name SoundComponent#end
 * @description Fired when a sound instance stops playing because it reached its ending.
 * @param {pc.SoundSlot} slot - The slot whose instance ended.
 * @param {pc.SoundInstance} instance - The instance that ended.
 */

export { SoundComponent };
