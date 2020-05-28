Object.assign(pc, function () {

    /**
     * @private
     * @class
     * @name pc.AnimComponentLayer
     * @classdesc The Anim Component Layer allows managers a single layer of the animation state graph.
     * @description Create a new AnimComponentLayer.
     * @param {string} name - The name of the layer.
     * @param {object} controller - The controller to manage this layers animations.
     * @param {pc.AnimComponent} component - The component that this layer is a member of.
     */
    var AnimComponentLayer = function (name, controller, component) {
        this._name = name;
        this._controller = controller;
        this._component = component;
    };

    Object.assign(AnimComponentLayer.prototype, {
        /**
         * @private
         * @function
         * @name pc.AnimComponentLayer#play
         * @description Start playing the animation in the current state.
         * @param {string} name - If provided, will begin playing from the start of the state with this name.
         */
        play: function (name) {
            this._controller.play(name);
        },

        /**
         * @private
         * @function
         * @name pc.AnimComponentLayer#pause
         * @description Start playing the animation in the current state.
         */
        pause: function () {
            this._controller.pause();
        },

        /**
         * @private
         * @function
         * @name pc.AnimComponentLayer#reset
         * @description Reset the animation component to it's initial state, including all parameters. The system will be paused.
         */
        reset: function () {
            this._controller.reset();
        },

        update: function (dt) {
            this._controller.update(dt);
        },

        /**
         * @private
         * @function
         * @name pc.AnimComponentLayer#assignAnimation
         * @description Associates an animation with a state in the loaded state graph. If all states are linked and the pc.AnimComponent.activate value was set to true then the component will begin playing.
         * @param {string} stateName - The name of the state that this animation should be associated with.
         * @param {object} animTrack - The animation track that will be assigned to this state and played whenever this state is active.
         */
        assignAnimation: function (stateName, animTrack) {
            this._controller.assignAnimation(stateName, animTrack);

            if (this._component.activate) {
                for (var i = 0; i < this._component.data.layers.length; i++) {
                    if (!this._component.data.layers[i].playable) {
                        return;
                    }
                    this._component.playing = true;
                }
            }
        },

        /**
         * @private
         * @function
         * @name pc.AnimComponentLayer#removeStateAnimations
         * @description Removes animations from a state in the loaded state graph.
         * @param {string} stateName - The name of the state that should have its animation tracks removed.
         */
        removeStateAnimations: function (stateName) {
            this._controller.removeStateAnimations(stateName);
        },

        getParameterValue: function (name, type) {
            this._controller.getParameterValue(name, type);
        },

        setParameterValue: function (name, type, value) {
            this._controller.setParameterValue(name, type, value);
        }
    });

    Object.defineProperties(AnimComponentLayer.prototype, {
        /**
         * @private
         * @name pc.AnimComponentLayer#name
         * @property {string} name - Returns the name of the layer
         */
        name: {
            get: function () {
                return this._name;
            }
        },
        /**
         * @private
         * @name pc.AnimComponentLayer#playing
         * @property {string} playing - Whether this layer is currently playing
         */
        playing: {
            get: function () {
                return this._controller.playing;
            },
            set: function (value) {
                this._controller.playing = value;
            }
        },
        /**
         * @private
         * @name pc.AnimComponentLayer#playable
         * @property {string} playable - Returns true if a state graph has been loaded and all states in the graph have been assigned animation tracks.
         */
        playable: {
            get: function () {
                return this._controller.playable;
            }
        },
        /**
         * @private
         * @name pc.AnimComponentLayer#activeState
         * @property {string} activeState - Returns the currently active state name.
         */
        activeState: {
            get: function () {
                return this._controller.activeStateName;
            }
        },
        /**
         * @private
         * @name pc.AnimComponentLayer#previousState
         * @property {string} previousState - Returns the previously active state name.
         */
        previousState: {
            get: function () {
                return this._controller.previousStateName;
            }
        },
        /**
         * @private
         * @name pc.AnimComponentLayer#activeStateProgress
         * @property {number} activeStateProgress - Returns the currently active states progress as a value normalised by the states animation duration. Looped animations will return values greater than 1.
         */
        activeStateProgress: {
            get: function () {
                return this._controller.activeStateProgress;
            }
        },
        /**
         * @private
         * @name pc.AnimComponentLayer#transitioning
         * @property {boolean} transitioning - Returns whether the anim component layer is currently transitioning between states.
         */
        transitioning: {
            get: function () {
                return this._controller.transitioning;
            }
        },
        /**
         * @private
         * @name pc.AnimComponentLayer#transitionProgress
         * @property {number} transitionProgress - If the anim component layer is currently transitioning between states, returns the progress. Otherwise returns null.
         */
        transitionProgress: {
            get: function () {
                if (this.transitioning) {
                    return this._controller.transitionProgress;
                }
                return null;
            }
        }
    });

    return {
        AnimComponentLayer: AnimComponentLayer
    };
}());
