pc.extend(pc, function () {
    /**
     * @component
     * @name pc.SoundComponent
     * @class The Sound Component controls playback of an audio sample.
     * @description Create a new Sound Component
     * @param {pc.SoundComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The entity that the Component is attached to
     * @extends pc.Component
     * @property {Number} volume The volume modifier to play the audio with. In range 0-1.
     * @property {Number} pitch The pitch modifier to play the audio with. Must be larger than 0.01
     * @property {Boolean} positional If true the audio will play back at the location of the Entity in space, so the audio will be affect by the position of the {@link pc.AudioListenerComponent}
     * @property {String} distanceModel Determines which algorithm to use to reduce the volume of the audio as it moves away from the listener. Can be one of 'linear', 'inverse' or 'exponential'. Default is 'inverse'.
     * @property {Number} refDistance The reference distance for reducing volume as the sound source moves further from the listener.
     * @property {Number} maxDistance The maximum distance from the listener at which audio falloff stops. Note the volume of the audio is not 0 after this distance, but just doesn't fall off anymore
     * @property {Number} rollOffFactor The factor used in the falloff equation.
     */

    var SoundComponent = function (system, entity) {
        this.on('set_slots', this.onSetSlots, this);
    };

    SoundComponent = pc.inherits(SoundComponent, pc.Component);

    pc.extend(SoundComponent.prototype, {
        onSetSlots: function (name, oldValue, newValue) {
            for (var key in newValue) {
                if (! (newValue[key] instanceof pc.SoundSlot)) {
                    this.data.slots[key] = new pc.SoundSlot(this, key, newValue[key]);
                }
            }

            if (this.enabled && this.entity.enabled)
                this.onEnable();
        },

        onEnable: function () {
            SoundComponent._super.onEnable.call(this);

            // load assets that haven't been loaded yet
            var slots = this.data.slots;
            for (var key in slots) {
                var slot = slots[key];
                if (slot.autoPlay) {
                    if (slot.isPaused) {
                        slot.resume();
                    }
                    else {
                        slot.play();
                    }
                } else if (slot.asset && !slot.asset.resource) {
                    slot.load();
                }
            }
        },

        onDisable: function () {
            SoundComponent._super.onDisable.call(this);
            this.pause();

            // TODO: only pause non overlapping sounds
        },

        addSlot: function (name, options) {
            var slots = this.data.slots;
            if (slots[name]) {
                logERROR('A sound slot with name ' + name + ' already exists on Entity ' + this.entity.getPath());
                return;
            }

            var slot = new pc.SoundSlot(this, name, options);
            slots[name] = slot;

            if (slot.autoPlay && this.enabled && this.entity.enabled) {
                slot.play();
            }
        },

        removeSlot: function (name) {
            var slots = this.data.slots;
            if (slots[name]) {
                slots[name].stop();
                delete slots[name];
            }
        },

        slot: function (name) {
            return this.data.slots[name];
        },

        /**
        * @function
        * @name pc.SoundComponent#play
        * @description Begin playback of an audio asset in the component attached to an entity
        * @param {String} name The name of the Asset to play
        */
        play: function (name) {
            if (!this.enabled || !this.entity.enabled) {
                return;
            }

            var slot = this.slots[name];
            if (! slot) {
                logWARNING('Trying to play sound slot with name ' + name + ' which does not exist');
                return;
            }

            return slot.play();
        },

        /**
        * @function
        * @name pc.SoundComponent#pause
        * @description Pause playback of the audio that is playing on the Entity. Playback can be resumed by calling {@link pc.SoundComponent#unpause}
        */
        pause: function (name) {
            var slot;
            var slots = this.data.slots;

            if (name) {
                slot = slots[name];
                if (! slot) {
                    logWARNING('Trying to pause sound slot with name ' + name + ' which does not exist');
                    return;
                }

                slot.pause();

                this.fire('pause', slot);
            } else {
                for (var key in slots) {
                    slots[key].pause();
                }

                this.fire('pause');
            }
        },

        /**
        * @function
        * @name pc.SoundComponent#resume
        * @description Resume playback of the audio if paused. Playback is resumed at the time it was paused.
        */
        resume: function (name) {
            var slot;
            var slots = this.data.slots;

            if (name) {
                slot = slots[name];
                if (! slot) {
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

                this.fire('resume');
            }
        },

        /**
        * @function
        * @name pc.SoundComponent#stop
        * @description Stop playback on an Entity. Playback can not be resumed after being stopped.
        */
        stop: function (name) {
            var slot;
            var slots = this.data.slots;

            if (name) {
                slot = slots[name];
                if (! slot) {
                    logWARNING('Trying to stop sound slot with name ' + name + ' which does not exist');
                    return;
                }

                slot.stop();

                this.fire('stop', slot);
            } else {
                for (var key in slots) {
                    slots[key].stop();
                }

                this.fire('stop');
            }
        }
    });

    return {
        SoundComponent: SoundComponent
    };
}());
