Object.assign(pc, function () {

    /**
     * @class
     * @name pc.AnimComponentLayer
     * @classdesc The Anim Component Layer allows managers a single layer of the animation state graph.
     * @description Create a new AnimComponentLayer.
     * @param {string} name - The name of the layer.
     * @param {pc.AnimController} controller - The controller to manage this layers animations.
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
         * @param {string} name - If provided, will begin playing from the start of the state with this name.
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
         * @name pc.AnimComponentLayer#name
         * @property {string} name - Returns the name of the layer
         */
        name: {
            get: function () {
                return this._name;
            }
        },
        /**
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
         * @name pc.AnimComponentLayer#playable
         * @property {string} playable - Returns true if a state graph has been loaded and all states in the graph have been assigned animation tracks.
         */
        playable: {
            get: function () {
                return this._controller.playable;
            }
        },
        /**
         * @name pc.AnimComponentLayer#activeState
         * @property {string} activeState - Returns the currently active state name.
         */
        activeState: {
            get: function () {
                return this._controller.activeStateName;
            }
        },
        /**
         * @name pc.AnimComponentLayer#previousState
         * @property {string} previousState - Returns the previously active state name.
         */
        previousState: {
            get: function () {
                return this._controller.previousStateName;
            }
        },
        /**
         * @name pc.AnimComponentLayer#activeStateProgress
         * @property {number} activeStateProgress - Returns the currently active states progress as a value normalised by the states animation duration. Looped animations will return values greater than 1.
         */
        activeStateProgress: {
            get: function () {
                return this._controller.activeStateProgress;
            }
        },
        /**
         * @name pc.AnimComponentLayer#transitioning
         * @property {boolean} transitioning - Returns whether the anim component layer is currently transitioning between states.
         */
        transitioning: {
            get: function () {
                return this._controller.transitioning;
            }
        },
        /**
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

    /**
     * @component Anim
     * @class
     * @name pc.AnimComponent
     * @augments pc.Component
     * @classdesc The Anim Component allows an Entity to playback animations on models and entity properties.
     * @description Create a new AnimComponent.
     * @param {pc.AnimComponentSystem} system - The {@link pc.ComponentSystem} that created this Component.
     * @param {pc.Entity} entity - The Entity that this Component is attached to.
     * @property {number} speed Speed multiplier for animation play back speed. 1.0 is playback at normal speed, 0.0 pauses the animation.
     * @property {boolean} activate If true the first animation will begin playing when the scene is loaded.
     */
    var AnimComponent = function (system, entity) {
        pc.Component.call(this, system, entity);
    };
    AnimComponent.prototype = Object.create(pc.Component.prototype);
    AnimComponent.prototype.constructor = AnimComponent;

    Object.assign(AnimComponent.prototype, {
        /**
         * @function
         * @name pc.AnimComponent#loadStateGraph
         * @description Initialises component animation controllers using the provided state graph.
         * @param {object} stateGraph - The state graph asset to load into the component. Contains the states, transitions and parameters used to define a complete animation controller.
         */
        loadStateGraph: function (stateGraph) {
            var graph;
            var modelComponent = this.entity.model;
            if (modelComponent) {
                var m = modelComponent.model;
                if (m) {
                    graph = m.getGraph();
                }
            }

            var data = this.data;

            data.parameters = stateGraph.parameters;
            data.initialParameters = Object.assign({}, stateGraph.parameters);

            function addLayer(name, states, transitions, order) {
                var animBinder = new pc.AnimComponentBinder(this, graph);
                var animEvaluator = new pc.AnimEvaluator(animBinder);
                var controller = new pc.AnimController(
                    animEvaluator,
                    states,
                    transitions,
                    data.parameters,
                    data.activate
                );
                data.layers.push(new AnimComponentLayer(name, controller, this));
                data.layerIndicies[name] = order;
            }

            if (stateGraph.layers) {
                for (var i = 0; i < stateGraph.layers; i++) {
                    var layer = stateGraph.layers[i];
                    addLayer.bind(this)(layer.name, layer.states, layer.transitions, i);
                }
            } else {
                addLayer.bind(this)('DEFAULT_LAYER', stateGraph.states, stateGraph.transitions, 0);
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#removeStateGraph
         * @description Removes all layers from the anim component.
         */
        removeStateGraph: function () {
            this.data.layers = [];
            this.data.layerIndicies = {};
            this.data.parameters = {};
            this.data.initialParameters = {};
        },

        /**
         * @function
         * @name pc.AnimComponent#reset
         * @description Reset all of the components layers and parameters to their initial states. If a layer was playing before it will continue playing
         */
        reset: function () {
            this.data.parameters = Object.assign({}, this.data.initialParameters);
            for (var i = 0; i < this.data.layers.length; i++) {
                var layerPlaying = this.data.layers[i].playing;
                this.data.layers[i].reset();
                this.data.layers[i].playing = layerPlaying;
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#findAnimationLayer
         * @description Finds a pc.AnimComponentLayer in this component.
         * @param {string} layerName - The name of the anim component layer to find
         * @returns {pc.AnimComponentLayer} layer
         */
        findAnimationLayer: function (layerName) {
            var layerIndex = this.data.layerIndicies[layerName];
            return this.data.layers[layerIndex];
        },

        /**
         * @function
         * @name pc.AnimComponent#assignAnimation
         * @description Associates an animation with a state in the loaded state graph. If all states are linked and the pc.AnimComponent.activate value was set to true then the component will begin playing.
         * @param {string} stateName - The name of the state that this animation should be associated with.
         * @param {object} animTrack - The animation track that will be assigned to this state and played whenever this state is active.
         * @param {string?} layerName - The name of the anim component layer to update. If omitted the default layer is used.
         */
        assignAnimation: function (stateName, animTrack, layerName) {
            layerName = layerName || 'DEFAULT_LAYER';
            var layer = this.findAnimationLayer(layerName);
            if (!layer) {
                // #ifdef DEBUG
                console.error('assignAnimation: Trying to assign an anim track before the state graph has been loaded. Have you called loadStateGraph?');
                // #endif
                return;
            }
            layer.assignAnimation(stateName, animTrack);
        },

        /**
         * @function
         * @name pc.AnimComponent#removeStateAnimations
         * @description Removes animations from a state in the loaded state graph.
         * @param {string} stateName - The name of the state that should have its animation tracks removed.
         * @param {string?} layerName - The name of the anim component layer to update. If omitted the default layer is used.
         */
        removeStateAnimations: function (stateName, layerName) {
            layerName = layerName || 'DEFAULT_LAYER';
            var layer = this.findAnimationLayer(layerName);
            if (!layer) {
                // #ifdef DEBUG
                console.error('removeStateAnimations: Trying to remove animation tracks from a state before the state graph has been loaded. Have you called loadStateGraph?');
                // #endif
                return;
            }
            layer.removeStateAnimations(stateName);
        },

        getParameterValue: function (name, type) {
            var param = this.data.parameters[name];
            if (param && param.type === type) {
                return param.value;
            }
            // #ifdef DEBUG
            console.log('Cannot get parameter value. No parameter found in anim controller named "' + name + '" of type "' + type + '"');
            // #endif
        },

        setParameterValue: function (name, type, value) {
            var param = this.data.parameters[name];
            if (param && param.type === type) {
                param.value = value;
                return;
            }
            // #ifdef DEBUG
            console.log('Cannot set parameter value. No parameter found in anim controller named "' + name + '" of type "' + type + '"');
            // #endif
        },

        /**
         * @function
         * @name pc.AnimComponent#getFloat
         * @description Returns a float parameter value by name.
         * @param {string} name - The name of the float to return the value of.
         * @returns {number} A float
         */
        getFloat: function (name) {
            return this.getParameterValue(name, pc.ANIM_PARAMETER_FLOAT);
        },

        /**
         * @function
         * @name pc.AnimComponent#setFloat
         * @description Sets the value of a float parameter that was defined in the animation components state graph.
         * @param {string} name - The name of the parameter to set.
         * @param {number} value - The new float value to set this parameter to.
         */
        setFloat: function (name, value) {
            this.setParameterValue(name, pc.ANIM_PARAMETER_FLOAT, value);
        },

        /**
         * @function
         * @name pc.AnimComponent#getInteger
         * @description Returns an integer parameter value by name.
         * @param {string} name - The name of the integer to return the value of.
         * @returns {number} An integer
         */
        getInteger: function (name) {
            return this.getParameterValue(name, pc.ANIM_PARAMETER_INTEGER);
        },

        /**
         * @function
         * @name pc.AnimComponent#setInteger
         * @description Sets the value of an integer parameter that was defined in the animation components state graph.
         * @param {string} name - The name of the parameter to set.
         * @param {number} value - The new integer value to set this parameter to.
         */
        setInteger: function (name, value) {
            if (typeof value === 'number' && value % 1 === 0) {
                this.setParameterValue(name, pc.ANIM_PARAMETER_INTEGER, Math.floor(value));
            } else {
                // #ifdef DEBUG
                console.error('Attempting to assign non integer value to integer parameter');
                // #endif
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#getBoolean
         * @description Returns a boolean parameter value by name.
         * @param {string} name - The name of the boolean to return the value of.
         * @returns {boolean} A boolean
         */
        getBoolean: function (name) {
            return this.getParameterValue(name, pc.ANIM_PARAMETER_BOOLEAN);
        },

        /**
         * @function
         * @name pc.AnimComponent#setBoolean
         * @description Sets the value of a boolean parameter that was defined in the animation components state graph.
         * @param {string} name - The name of the parameter to set.
         * @param {boolean} value - The new boolean value to set this parameter to.
         */
        setBoolean: function (name, value) {
            this.setParameterValue(name, pc.ANIM_PARAMETER_BOOLEAN, !!value);
        },

        /**
         * @function
         * @name pc.AnimComponent#getTrigger
         * @description Returns a trigger parameter value by name.
         * @param {string} name - The name of the trigger to return the value of.
         * @returns {boolean} A boolean
         */
        getTrigger: function (name) {
            return this.getParameterValue(name, pc.ANIM_PARAMETER_TRIGGER);
        },

        /**
         * @function
         * @name pc.AnimComponent#setTrigger
         * @description Sets the value of a trigger parameter that was defined in the animation components state graph to true.
         * @param {string} name - The name of the parameter to set.
         */
        setTrigger: function (name) {
            this.setParameterValue(name, pc.ANIM_PARAMETER_TRIGGER, true);
        },

        /**
         * @function
         * @name pc.AnimComponent#setTrigger
         * @description Resets the value of a trigger parameter that was defined in the animation components state graph to false.
         * @param {string} name - The name of the parameter to set.
         */
        resetTrigger: function (name) {
            this.setParameterValue(name, pc.ANIM_PARAMETER_TRIGGER, false);
        }
    });

    return {
        AnimComponentLayer: AnimComponentLayer,
        AnimComponent: AnimComponent
    };
}());
