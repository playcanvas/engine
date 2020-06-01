Object.assign(pc, function () {

    /**
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
         * @function
         * @name pc.AnimComponentLayer#play
         * @description Start playing the animation in the current state.
         * @param {string} [name] - If provided, will begin playing from the start of the state with this name.
         */
        play: function (name) {
            this._controller.play(name);
        },

        /**
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
         * @description Associates an animation with a state node in the loaded state graph. If all states nodes are linked and the pc.AnimComponent.activate value was set to true then the component will begin playing.
         * @param {string} nodeName - The name of the node that this animation should be associated with.
         * @param {object} animTrack - The animation track that will be assigned to this state and played whenever this state is active.
         */
        assignAnimation: function (nodeName, animTrack) {
            this._controller.assignAnimation(nodeName, animTrack);

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
         * @name pc.AnimComponentLayer#removeNodeAnimations
         * @description Removes animations from a node in the loaded state graph.
         * @param {string} nodeName - The name of the node that should have its animation tracks removed.
         */
        removeNodeAnimations: function (nodeName) {
            this._controller.removeNodeAnimations(nodeName);
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
         * @readonly
         * @name pc.AnimComponentLayer#name
         * @type {string}
         * @description Returns the name of the layer
         */
        name: {
            get: function () {
                return this._name;
            }
        },
        /**
         * @private
         * @name pc.AnimComponentLayer#playing
         * @type {string}
         * @description Whether this layer is currently playing
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
         * @readonly
         * @name pc.AnimComponentLayer#playable
         * @type {string}
         * @description Returns true if a state graph has been loaded and all states in the graph have been assigned animation tracks.
         */
        playable: {
            get: function () {
                return this._controller.playable;
            }
        },
        /**
         * @private
         * @readonly
         * @name pc.AnimComponentLayer#activeState
         * @type {string}
         * @description Returns the currently active state name.
         */
        activeState: {
            get: function () {
                return this._controller.activeStateName;
            }
        },
        /**
         * @private
         * @readonly
         * @name pc.AnimComponentLayer#previousState
         * @type {string}
         * @description Returns the previously active state name.
         */
        previousState: {
            get: function () {
                return this._controller.previousStateName;
            }
        },
        /**
         * @private
         * @readonly
         * @name pc.AnimComponentLayer#activeStateProgress
         * @type {number}
         * @description Returns the currently active states progress as a value normalised by the states animation duration. Looped animations will return values greater than 1.
         */
        activeStateProgress: {
            get: function () {
                return this._controller.activeStateProgress;
            }
        },
        /**
         * @private
         * @readonly
         * @name pc.AnimComponentLayer#transitioning
         * @type {boolean}
         * @description Returns whether the anim component layer is currently transitioning between states.
         */
        transitioning: {
            get: function () {
                return this._controller.transitioning;
            }
        },
        /**
         * @private
         * @readonly
         * @name pc.AnimComponentLayer#transitionProgress
         * @type {number}
         * @description If the anim component layer is currently transitioning between states, returns the progress. Otherwise returns null.
         */
        transitionProgress: {
            get: function () {
                if (this.transitioning) {
                    return this._controller.transitionProgress;
                }
                return null;
            }
        },
        /**
         * @private
         * @readonly
         * @name pc.AnimComponentLayer#states
         * @type {string[]}
         * @description Lists all available states in this layers state graph
         */
        states: {
            get: function () {
                return this._controller.states;
            }
        }
    });

    return {
        AnimComponentLayer: AnimComponentLayer
    };
}());
