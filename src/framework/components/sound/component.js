Object.assign(pc, function () {
    /**
     * @component
     * @constructor
     * @name pc.SoundComponent
     * @classdesc The Sound Component controls playback of {@link pc.Sound}s.
     * @description Create a new Sound Component.
     * @param {pc.SoundComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The entity that the Component is attached to
     * @extends pc.Component
     * @property {Number} volume The volume modifier to play the audio with. In range 0-1.
     * @property {Number} pitch The pitch modifier to play the audio with. Must be larger than 0.01
     * @property {Boolean} positional If true the audio will play back at the location of the Entity in space, so the audio will be affect by the position of the {@link pc.AudioListenerComponent}.
     * @property {String} distanceModel Determines which algorithm to use to reduce the volume of the sound as it moves away from the listener. Can be one of {@link pc.DISTANCE_LINEAR}, {@link pc.DISTANCE_INVERSE} or {@link pc.DISTANCE_EXPONENTIAL}. Default is {@link pc.DISTANCE_LINEAR}.
     * @property {Number} refDistance The reference distance for reducing volume as the sound source moves further from the listener.
     * @property {Number} maxDistance The maximum distance from the listener at which audio falloff stops. Note the volume of the audio is not 0 after this distance, but just doesn't fall off anymore.
     * @property {Number} rollOffFactor The factor used in the falloff equation.
     * @property {Object} slots A dictionary that contains the {@link pc.SoundSlot}s managed by this Component.
     */
    var SoundComponent = function (system, entity) {
        pc.Component.call(this, system, entity);

        this.on('set_slots', this.onSetSlots, this);
        this.on('set_volume', this.onSetVolume, this);
        this.on('set_pitch', this.onSetPitch, this);
        this.on("set_refDistance", this.onSetRefDistance, this);
        this.on("set_maxDistance", this.onSetMaxDistance, this);
        this.on("set_rollOffFactor", this.onSetRollOffFactor, this);
        this.on("set_distanceModel", this.onSetDistanceModel, this);
        this.on("set_positional", this.onSetPositional, this);
    };
    SoundComponent.prototype = Object.create(pc.Component.prototype);
    SoundComponent.prototype.constructor = SoundComponent;

    Object.assign(SoundComponent.prototype, {
        onSetSlots: function (name, oldValue, newValue) {
            var key;

            // stop previous slots
            if (oldValue) {
                for (key in oldValue) {
                    oldValue[key].stop();
                }
            }

            var slots = {};

            // convert data to slots
            for (key in newValue) {
                if (!(newValue[key] instanceof pc.SoundSlot)) {
                    if (newValue[key].name) {
                        slots[newValue[key].name] = new pc.SoundSlot(this, newValue[key].name, newValue[key]);
                    }
                } else {
                    slots[newValue[key].name] = newValue[key];
                }
            }

            this.data.slots = slots;

            // call onEnable in order to start autoPlay slots
            if (this.enabled && this.entity.enabled)
                this.onEnable();
        },

        onSetVolume: function (name, oldValue, newValue) {
            var slots = this.data.slots;
            for (var key in slots) {
                var slot = slots[key];
                // change volume of non-overlapping instances
                if (!slot.overlap) {
                    var instances = slot.instances;
                    for (var i = 0, len = instances.length; i < len; i++) {
                        instances[i].volume = slot.volume * newValue;
                    }
                }
            }
        },

        onSetPitch: function (name, oldValue, newValue) {
            var slots = this.data.slots;
            for (var key in slots) {
                var slot = slots[key];
                // change pitch of non-overlapping instances
                if (!slot.overlap) {
                    var instances = slot.instances;
                    for (var i = 0, len = instances.length; i < len; i++) {
                        instances[i].pitch = slot.pitch * newValue;
                    }
                }
            }
        },

        onSetRefDistance: function (name, oldValue, newValue) {
            var slots = this.data.slots;
            for (var key in slots) {
                var slot = slots[key];
                // change refDistance of non-overlapping instances
                if (!slot.overlap) {
                    var instances = slot.instances;
                    for (var i = 0, len = instances.length; i < len; i++) {
                        instances[i].refDistance = newValue;
                    }
                }
            }
        },

        onSetMaxDistance: function (name, oldValue, newValue) {
            var slots = this.data.slots;
            for (var key in slots) {
                var slot = slots[key];
                // change maxDistance of non-overlapping instances
                if (!slot.overlap) {
                    var instances = slot.instances;
                    for (var i = 0, len = instances.length; i < len; i++) {
                        instances[i].maxDistance = newValue;
                    }
                }
            }
        },

        onSetRollOffFactor: function (name, oldValue, newValue) {
            var slots = this.data.slots;
            for (var key in slots) {
                var slot = slots[key];
                // change rollOffFactor of non-overlapping instances
                if (!slot.overlap) {
                    var instances = slot.instances;
                    for (var i = 0, len = instances.length; i < len; i++) {
                        instances[i].rollOffFactor = newValue;
                    }
                }
            }
        },

        onSetDistanceModel: function (name, oldValue, newValue) {
            var slots = this.data.slots;
            for (var key in slots) {
                var slot = slots[key];
                // change distanceModel of non-overlapping instances
                if (!slot.overlap) {
                    var instances = slot.instances;
                    for (var i = 0, len = instances.length; i < len; i++) {
                        instances[i].distanceModel = newValue;
                    }
                }
            }
        },

        onSetPositional: function (name, oldValue, newValue) {
            var slots = this.data.slots;
            for (var key in slots) {
                var slot = slots[key];
                // recreate non overlapping sounds
                if (!slot.overlap) {
                    var instances = slot.instances;
                    for (var i = 0, len = instances.length; i < len; i++) {
                        var isPlaying = instances[i].isPlaying || instances[i].isSuspended;
                        var currentTime = instances[i].currentTime;
                        if (isPlaying)
                            instances[i].stop();

                        instances[i] = slot._createInstance();
                        if (isPlaying) {
                            instances[i].play();
                            instances[i].currentTime = currentTime;
                        }
                    }
                }
            }
        },

        onEnable: function () {
            // do not run if running in Editor
            if (this.system._inTools) {
                return;
            }

            var slots = this.data.slots;
            var playingBeforeDisable = this.data.playingBeforeDisable;

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
        },

        onDisable: function () {
            var slots = this.data.slots;
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

            this.data.playingBeforeDisable = playingBeforeDisable;
        },

        onRemove: function () {
            this.off();
        },

        /**
         * @function
         * @name pc.SoundComponent#addSlot
         * @description Creates a new {@link pc.SoundSlot} with the specified name.
         * @param {String} name The name of the slot
         * @param {Object} options Settings for the slot
         * @param {Number} [options.volume=1] The playback volume, between 0 and 1.
         * @param {Number} [options.pitch=1] The relative pitch, default of 1, plays at normal pitch.
         * @param {Boolean} [options.loop=false] If true the sound will restart when it reaches the end.
         * @param {Number} [options.startTime=0] The start time from which the sound will start playing.
         * @param {Number} [options.duration=null] The duration of the sound that the slot will play starting from startTime.
         * @param {Boolean} [options.overlap=false] If true then sounds played from slot will be played independently of each other. Otherwise the slot will first stop the current sound before starting the new one.
         * @param {Boolean} [options.autoPlay=false] If true the slot will start playing as soon as its audio asset is loaded.
         * @param {Number} [options.asset=null] The asset id of the audio asset that is going to be played by this slot.
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
        addSlot: function (name, options) {
            var slots = this.data.slots;
            if (slots[name]) {
                logWARNING('A sound slot with name ' + name + ' already exists on Entity ' + this.entity.getPath());
                return null;
            }

            var slot = new pc.SoundSlot(this, name, options);
            slots[name] = slot;

            if (slot.autoPlay && this.enabled && this.entity.enabled) {
                slot.play();
            }

            return slot;
        },

        /**
         * @function
         * @name pc.SoundComponent#removeSlot
         * @description Removes the {@link pc.SoundSlot} with the specified name.
         * @param {String} name The name of the slot
         * @example
         * // remove a slot called 'beep'
         * this.entity.sound.removeSlot('beep');
         */
        removeSlot: function (name) {
            var slots = this.data.slots;
            if (slots[name]) {
                slots[name].stop();
                delete slots[name];
            }
        },

        /**
         * @function
         * @name pc.SoundComponent#slot
         * @description Returns the slot with the specified name
         * @param {String} name The name of the slot
         * @returns {pc.SoundSlot} The slot
         * @example
         * // get a slot and set its volume
         * this.entity.sound.slot('beep').volume = 0.5;
         *
         */
        slot: function (name) {
            return this.data.slots[name];
        },

        /**
         * @function
         * @name pc.SoundComponent#play
         * @description Begins playing the sound slot with the specified name. The slot will restart playing if it is already playing unless the overlap field is true in which case a new sound will be created and played.
         * @param {String} name The name of the {@link pc.SoundSlot} to play
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
        play: function (name) {
            if (!this.enabled || !this.entity.enabled) {
                return null;
            }

            var slot = this.slots[name];
            if (!slot) {
                logWARNING('Trying to play sound slot with name ' + name + ' which does not exist');
                return null;
            }

            return slot.play();
        },

        /**
         * @function
         * @name pc.SoundComponent#pause
         * @description Pauses playback of the slot with the specified name. If the name is undefined then all slots currently played will be paused. The slots can be resumed by calling {@link pc.SoundComponent#resume}.
         * @param {String} [name] The name of the slot to pause. Leave undefined to pause everything.
         * @example
         * // pause all sounds
         * this.entity.sound.pause();
         * // pause a specific sound
         * this.entity.sound.pause('beep');
         */
        pause: function (name) {
            var slot;
            var slots = this.data.slots;

            if (name) {
                slot = slots[name];
                if (!slot) {
                    logWARNING('Trying to pause sound slot with name ' + name + ' which does not exist');
                    return;
                }

                slot.pause();
            } else {
                for (var key in slots) {
                    slots[key].pause();
                }
            }
        },

        /**
         * @function
         * @name pc.SoundComponent#resume
         * @description Resumes playback of the sound slot with the specified name if it's paused. If no name is specified all slots will be resumed.
         * @param {String} name The name of the slot to resume. Leave undefined to resume everything.
         * @example
         * // resume all sounds
         * this.entity.sound.resume();
         * // resume a specific sound
         * this.entity.sound.resume('beep');
         */
        resume: function (name) {
            var slot;
            var slots = this.data.slots;

            if (name) {
                slot = slots[name];
                if (!slot) {
                    logWARNING('Trying to resume sound slot with name ' + name + ' which does not exist');
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
        },

        /**
         * @function
         * @name pc.SoundComponent#stop
         * @description Stops playback of the sound slot with the specified name if it's paused. If no name is specified all slots will be stopped.
         * @param {String} name The name of the slot to stop. Leave undefined to stop everything.
         * @example
         * // stop all sounds
         * this.entity.sound.stop();
         * // stop a specific sound
         * this.entity.sound.stop('beep');
         */
        stop: function (name) {
            var slot;
            var slots = this.data.slots;

            if (name) {
                slot = slots[name];
                if (!slot) {
                    logWARNING('Trying to stop sound slot with name ' + name + ' which does not exist');
                    return;
                }

                slot.stop();
            } else {
                for (var key in slots) {
                    slots[key].stop();
                }
            }
        }
    });

    return {
        SoundComponent: SoundComponent
    };
}());


// Events Documentation

/**
 * @event
 * @name pc.SoundComponent#play
 * @description Fired when a sound instance starts playing
 * @param {pc.SoundSlot} slot The slot whose instance started playing
 * @param {pc.SoundInstance} instance The instance that started playing
 */

/**
 * @event
 * @name pc.SoundComponent#pause
 * @description Fired when a sound instance is paused.
 * @param {pc.SoundSlot} slot The slot whose instance was paused
 * @param {pc.SoundInstance} instance The instance that was paused created to play the sound
 */

/**
 * @event
 * @name pc.SoundComponent#resume
 * @description Fired when a sound instance is resumed..
 * @param {pc.SoundSlot} slot The slot whose instance was resumed
 * @param {pc.SoundInstance} instance The instance that was resumed
 */

/**
 * @event
 * @name pc.SoundComponent#stop
 * @description Fired when a sound instance is stopped.
 * @param {pc.SoundSlot} slot The slot whose instance was stopped
 * @param {pc.SoundInstance} instance The instance that was stopped
 */

/**
 * @event
 * @name pc.SoundComponent#end
 * @description Fired when a sound instance stops playing because it reached its ending.
 * @param {pc.SoundSlot} slot The slot whose instance ended
 * @param {pc.SoundInstance} instance The instance that ended
 */
