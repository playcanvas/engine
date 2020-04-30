Object.assign(pc, function () {

    /**
     * @component Anim
     * @class
     * @name pc.AnimComponent
     * @augments pc.Component
     * @classdesc The Anim Component allows an Entity to playback animations on models.
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
         * @description Loads a state graph asset resource into the component. Then initialises the components animation controller.
         * @param {object} stateGraph - The state graph asset to load into the component. Contains the states, transitions and parameters used to define a complete animation controller.
         */
        loadStateGraph: function(stateGraph) {
            var data = this.data;

            var graph;
            var modelComponent = this.entity.model;
            if (modelComponent) {
                var m = modelComponent.model;
                if (m) {
                    graph = m.getGraph();
                }
            }

            var animBinder = new pc.AnimComponentBinder(this, graph);
            var animEvaluator = new pc.AnimEvaluator(animBinder);

            data.animController = new pc.AnimController(
                animEvaluator,
                stateGraph.states,
                stateGraph.transitions,
                stateGraph.parameters,
                this.data.activate
            );
        },

        /**
         * @function
         * @name pc.AnimComponent#linkAnimationToState
         * @description Associates an animation with a state in the loaded state graph. If all states are linked and the pc.AnimComponent.activate value was set to true then the component will begin playing.
         * @param {string} stateName - The name of the state that this animation should be associated with.
         * @param {pc.AnimTrack} animTrack - The animation that will linked to this state and played whenever this state is active.
         */
        linkAnimationToState: function(stateName, animTrack) {
            if (!this.data.animController) {
                // #ifdef DEBUG
                console.error('linkAnimationToState: Trying to link an anim track before the state graph has been loaded. Have you called loadStateGraph?');
                // #endif
                return;
            }
            this.data.animController.linkAnimationToState(stateName, animTrack);
        },

        /**
         * @function
         * @name pc.AnimComponent#play
         * @description Start playing the animation in the current state.
         * @param {string} name - The name of the animation asset to begin playing.
         */
        play: function (name) {
            if (!this.enabled || !this.entity.enabled) {
                return;
            }

            if (!this.data.animController) {
                // #ifdef DEBUG
                console.error('Trying to play an animation when no animation state machine has been loaded. Have you called loadStateMachineAsset?');
                // #endif
                return;
            }

            this.data.animController.play(name);
        },

        /**
         * @function
         * @name pc.AnimComponent#reset
         * @description Reset the animation component to it's initial state, including all parameters. The system will be paused.
         */
        reset: function() {
            if (this.data.animController) {
                this.data.animController.reset();
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#getActiveStateName
         * @description Returns the currently active state name.
         */
        getActiveStateName: function () {
            return this.data.animController ? this.data.animController.getActiveStateName() : null;
        },

        /**
         * @function
         * @name pc.AnimComponent#getActiveStateProgress
         * @description Returns the currently active states progress as a value normalised by the states animation duration.
         */
        getActiveStateProgress: function () {
            return this.data.animController ? this.data.animController.getActiveStateProgress() : null;
        },

        /**
         * @function
         * @name pc.AnimComponent#getFloat
         * @description Returns a float parameter value by name.
         * @param {string} name - The name of the float to return the value of.
         */
        getFloat: function(name) {
            if (this.data.animController) {
                return this.data.animController.getParameterValue(name, pc.ANIM_PARAMETER_FLOAT);
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#setFloat
         * @description Sets the value of a float parameter that was defined in the animation components state graph.
         * @param {string} name - The name of the parameter to set.
         * @param {number} value - The new float value to set this parameter to.
         */
        setFloat: function(name, value) {
            if (this.data.animController) {
                return this.data.animController.setParameterValue(name, pc.ANIM_PARAMETER_FLOAT, value);
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#getInteger
         * @description Returns an integer parameter value by name.
         * @param {string} name - The name of the integer to return the value of.
         */
        getInteger: function(name) {
            if (this.data.animController) {
                return this.data.animController.getParameterValue(name, pc.ANIM_PARAMETER_INTEGER);
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#setInteger
         * @description Sets the value of an integer parameter that was defined in the animation components state graph.
         * @param {string} name - The name of the parameter to set.
         * @param {number} value - The new integer value to set this parameter to.
         */
        setInteger: function(name, value) {
            if (this.data.animController) {
                return this.data.animController.setParameterValue(name, pc.ANIM_PARAMETER_INTEGER, value);
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#getBoolean
         * @description Returns a boolean parameter value by name.
         * @param {string} name - The name of the boolean to return the value of.
         */
        getBoolean: function(name) {
            if (this.data.animController) {
                return this.data.animController.getParameterValue(name, pc.ANIM_PARAMETER_BOOLEAN);
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#setBoolean
         * @description Sets the value of a boolean parameter that was defined in the animation components state graph.
         * @param {string} name - The name of the parameter to set.
         * @param {boolean} value - The new boolean value to set this parameter to.
         */
        setBoolean: function(name, value) {
            if (this.data.animController) {
                return this.data.animController.setParameterValue(name, pc.ANIM_PARAMETER_BOOLEAN, value);
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#getTrigger
         * @description Returns a trigger parameter value by name.
         * @param {string} name - The name of the trigger to return the value of.
         */
        getTrigger: function(name) {
            if (this.data.animController) {
                return this.data.animController.getParameterValue(name, pc.ANIM_PARAMETER_TRIGGER);
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#setTrigger
         * @description Sets the value of a trigger parameter that was defined in the animation components state graph to true.
         * @param {string} name - The name of the parameter to set.
         */
        setTrigger: function(name) {
            if (this.data.animController) {
                return this.data.animController.setParameterValue(name, pc.ANIM_PARAMETER_TRIGGER, true);
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#setTrigger
         * @description Resets the value of a trigger parameter that was defined in the animation components state graph to false.
         * @param {string} name - The name of the parameter to set.
         */
        resetTrigger: function(name) {
            if (this.data.animController) {
                return this.data.animController.setParameterValue(name, pc.ANIM_PARAMETER_TRIGGER, false);
            }
        },
    });

    Object.defineProperties(AnimComponent.prototype, {
        /**
         * @property
         * @name pc.AnimComponent#activeState
         * @description Returns the currently active state name.
         */
        activeState: {
            get: function() {
                if (this.data.animController) {
                    return this.data.animController.getActiveStateName();
                }
            }
        },
        /**
         * @property
         * @name pc.AnimComponent#activeStateProgress
         * @description Returns the currently active states progress as a value normalised by the states animation duration. Looped animations will return values greater than 1.
         */
        activeStateProgress: {
            get: function() {
                if (this.data.animController) {
                    return this.data.animController.getActiveStateProgress();
                }
            }
        }

        // speed: {
        //     get: function () {
        //         return this.data.speed;
        //     },
        //     set: function (value) {
        //         console.log('hello');
        //         if (typeof value === "number") {
        //             this.data.speed = value;
        //             return;
        //         }
        //         // #ifdef DEBUG
        //         console.error('Anim component speed attribute must be a numeric value');
        //         // #endif
        //     }
        // }
    });

    return {
        AnimComponent: AnimComponent
    };
}());
