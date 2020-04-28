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

        loadStateGraph: function(asset) {
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
                asset.states,
                asset.transitions,
                asset.parameters,
                this.data.activate
            );
        },

        linkAnimAssetToState: function(stateName, asset) {
            if (!this.data.animController)
                // #ifdef DEBUG
                console.error('linkAnimAssetToState: Trying to link an anim asset to non existing state graph. Have you called loadStateMachineAsset?');
                // #endif

            var animTrack = asset.resource;

            if(!animTrack)
                // #ifdef DEBUG
                console.error('linkAnimAssetToState: No animation found for given assetName');
                // #endif

            this.data.animController.linkAnimationToState(stateName, animTrack);
        },

        getFloat: function(name) {
            if (this.data.animController) {
                return this.data.animController.getParameterValue(name, pc.ANIM_PARAMETER_FLOAT);
            }
        },

        setFloat: function(name, value) {
            if (this.data.animController) {
                return this.data.animController.setParameterValue(name, pc.ANIM_PARAMETER_FLOAT, value);
            }
        },

        getInteger: function(name) {
            if (this.data.animController) {
                return this.data.animController.getParameterValue(name, pc.ANIM_PARAMETER_INTEGER);
            }
        },

        setInteger: function(name, value) {
            if (this.data.animController) {
                return this.data.animController.setParameterValue(name, pc.ANIM_PARAMETER_INTEGER, value);
            }
        },

        getBoolean: function(name) {
            if (this.data.animController) {
                return this.data.animController.getParameterValue(name, pc.ANIM_PARAMETER_BOOLEAN);
            }
        },

        setBoolean: function(name, value) {
            if (this.data.animController) {
                return this.data.animController.setParameterValue(name, pc.ANIM_PARAMETER_BOOLEAN, value);
            }
        },

        getTrigger: function(name) {
            if (this.data.animController) {
                return this.data.animController.getParameterValue(name, pc.ANIM_PARAMETER_TRIGGER);
            }
        },

        setTrigger: function(name) {
            if (this.data.animController) {
                return this.data.animController.setParameterValue(name, pc.ANIM_PARAMETER_TRIGGER, true);
            }
        },

        resetTrigger: function(name) {
            if (this.data.animController) {
                return this.data.animController.setParameterValue(name, pc.ANIM_PARAMETER_TRIGGER, false);
            }
        },

        /**
         * @function
         * @name pc.AnimComponent#play
         * @description Start playing an animation.
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

        reset: function() {
            if (this.data.animController) {
                this.data.animController.reset();
            }
        },

        getActiveStateName: function () {
            return this.data.animController ? this.data.animController.getActiveStateName() : null;
        },

        getActiveStateProgress: function () {
            return this.data.animController ? this.data.animController.getActiveStateProgress() : null;
        }
    });

    return {
        AnimComponent: AnimComponent
    };
}());
