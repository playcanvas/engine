import { Asset } from '../../../asset/asset.js';

import { AnimEvaluator } from '../../../anim/anim.js';

import { Component } from '../component.js';

import {
    ANIM_PARAMETER_BOOLEAN, ANIM_PARAMETER_FLOAT, ANIM_PARAMETER_INTEGER, ANIM_PARAMETER_TRIGGER
} from './constants.js';
import { AnimComponentBinder } from './binder.js';
import { AnimComponentLayer } from './layer.js';
import { AnimController } from './controller.js';
import { AnimStateGraph } from './state-graph.js';

/**
 * @private
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
function AnimComponent(system, entity) {
    Component.call(this, system, entity);
}
AnimComponent.prototype = Object.create(Component.prototype);
AnimComponent.prototype.constructor = AnimComponent;

Object.assign(AnimComponent.prototype, {
    /**
     * @private
     * @function
     * @name pc.AnimComponent#loadStateGraph
     * @description Initialises component animation controllers using the provided state graph.
     * @param {object} stateGraph - The state graph asset to load into the component. Contains the states, transitions and parameters used to define a complete animation controller.
     */
    loadStateGraph: function (stateGraph) {
        var data = this.data;
        data.stateGraph = stateGraph;
        data.parameters = stateGraph.parameters;
        data.layers = [];

        var graph;
        var modelComponent = this.entity.model;
        if (modelComponent) {
            var m = modelComponent.model;
            if (m) {
                graph = m.getGraph();
            }
        }

        function addLayer(name, states, transitions, order) {
            var animBinder = new AnimComponentBinder(this, graph);
            var animEvaluator = new AnimEvaluator(animBinder);
            var controller = new AnimController(
                animEvaluator,
                states,
                transitions,
                data.parameters,
                data.activate
            );
            data.layers.push(new AnimComponentLayer(name, controller, this));
            data.layerIndices[name] = order;
        }

        for (var i = 0; i < stateGraph.layers.length; i++) {
            var layer = stateGraph.layers[i];
            addLayer.bind(this)(layer.name, layer.states, layer.transitions, i);
        }
        this.setupAnimationAssets();
    },

    setupAnimationAssets: function () {
        for (var i = 0; i < this.data.layers.length; i++) {
            var layer = this.data.layers[i];
            var layerName = layer.name;
            for (var j = 0; j < layer.states.length; j++) {
                var stateName = layer.states[j];
                if (stateName !== 'START' && stateName !== 'END') {
                    var stateKey = layerName + ':' + stateName;
                    if (!this.data.animationAssets[stateKey]) {
                        this.data.animationAssets[stateKey] = {
                            asset: null
                        };
                    }
                }
            }
        }
        this.loadAnimationAssets();
    },

    loadAnimationAssets: function () {
        for (var i = 0; i < this.data.layers.length; i++) {
            var layer = this.data.layers[i];
            for (var j = 0; j < layer.states.length; j++) {
                var stateName = layer.states[j];
                var animationAsset = this.data.animationAssets[layer.name + ':' + stateName];
                if (!animationAsset || !animationAsset.asset) {
                    this.removeNodeAnimations(stateName, layer.name);
                    continue;
                }
                var assetId = animationAsset.asset;
                var asset = this.system.app.assets.get(assetId);
                if (asset.resource) {
                    this.assignAnimation(stateName, asset.resource, layer.name);
                } else {
                    asset.once('load', function (layerName, stateName) {
                        return function (asset) {
                            this.assignAnimation(stateName, asset.resource, layerName);
                        }.bind(this);
                    }.bind(this)(layer.name, stateName));
                    this.system.app.assets.load(asset);
                }
            }
        }
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#removeStateGraph
     * @description Removes all layers from the anim component.
     */
    removeStateGraph: function () {
        this.data.stateGraph = null;
        this.data.stateGraphAsset = null;
        this.data.animationAssets = {};
        this.data.layers = [];
        this.data.layerIndices = {};
        this.data.parameters = {};
        this.data.playing = false;
    },

    resetStateGraph: function () {
        if (this.stateGraphAsset) {
            var stateGraph = this.system.app.assets.get(this.stateGraphAsset).resource;
            this.loadStateGraph(stateGraph);
        } else {
            this.removeStateGraph();
        }
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#reset
     * @description Reset all of the components layers and parameters to their initial states. If a layer was playing before it will continue playing
     */
    reset: function () {
        this.data.parameters = Object.assign({}, this.data.stateGraph.parameters);
        for (var i = 0; i < this.data.layers.length; i++) {
            var layerPlaying = this.data.layers[i].playing;
            this.data.layers[i].reset();
            this.data.layers[i].playing = layerPlaying;
        }
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#findAnimationLayer
     * @description Finds a pc.AnimComponentLayer in this component.
     * @param {string} layerName - The name of the anim component layer to find
     * @returns {pc.AnimComponentLayer} layer
     */
    findAnimationLayer: function (layerName) {
        var layerIndex = this.data.layerIndices[layerName];
        return this.data.layers[layerIndex] || null;
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#assignAnimation
     * @description Associates an animation with a state in the loaded state graph. If all states are linked and the pc.AnimComponent.activate value was set to true then the component will begin playing.
     * @param {string} nodeName - The name of the state node that this animation should be associated with.
     * @param {object} animTrack - The animation track that will be assigned to this state and played whenever this state is active.
     * @param {string?} layerName - The name of the anim component layer to update. If omitted the default layer is used.
     */
    assignAnimation: function (nodeName, animTrack, layerName) {
        if (!this.data.stateGraph) {
            // #ifdef DEBUG
            console.error('assignAnimation: Trying to assign an anim track before the state graph has been loaded. Have you called loadStateGraph?');
            // #endif
            return;
        }
        var layer = layerName ? this.findAnimationLayer(layerName) : this.baseLayer;
        if (!layer) {
            // #ifdef DEBUG
            console.error('assignAnimation: Trying to assign an anim track to a layer that doesn\'t exist');
            // #endif
            return;
        }
        layer.assignAnimation(nodeName, animTrack);
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#removeStateAnimations
     * @description Removes animations from a state in the loaded state graph.
     * @param {string} nodeName - The name of the state node that should have its animation tracks removed.
     * @param {string?} layerName - The name of the anim component layer to update. If omitted the default layer is used.
     */
    removeNodeAnimations: function (nodeName, layerName) {
        var layer = layerName ? this.findAnimationLayer(layerName) : this.baseLayer;
        if (!layer) {
            // #ifdef DEBUG
            console.error('removeStateAnimations: Trying to remove animation tracks from a state before the state graph has been loaded. Have you called loadStateGraph?');
            // #endif
            return;
        }
        layer.removeNodeAnimations(nodeName);
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
     * @private
     * @function
     * @name pc.AnimComponent#getFloat
     * @description Returns a float parameter value by name.
     * @param {string} name - The name of the float to return the value of.
     * @returns {number} A float
     */
    getFloat: function (name) {
        return this.getParameterValue(name, ANIM_PARAMETER_FLOAT);
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#setFloat
     * @description Sets the value of a float parameter that was defined in the animation components state graph.
     * @param {string} name - The name of the parameter to set.
     * @param {number} value - The new float value to set this parameter to.
     */
    setFloat: function (name, value) {
        this.setParameterValue(name, ANIM_PARAMETER_FLOAT, value);
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#getInteger
     * @description Returns an integer parameter value by name.
     * @param {string} name - The name of the integer to return the value of.
     * @returns {number} An integer
     */
    getInteger: function (name) {
        return this.getParameterValue(name, ANIM_PARAMETER_INTEGER);
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#setInteger
     * @description Sets the value of an integer parameter that was defined in the animation components state graph.
     * @param {string} name - The name of the parameter to set.
     * @param {number} value - The new integer value to set this parameter to.
     */
    setInteger: function (name, value) {
        if (typeof value === 'number' && value % 1 === 0) {
            this.setParameterValue(name, ANIM_PARAMETER_INTEGER, value);
        } else {
            // #ifdef DEBUG
            console.error('Attempting to assign non integer value to integer parameter');
            // #endif
        }
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#getBoolean
     * @description Returns a boolean parameter value by name.
     * @param {string} name - The name of the boolean to return the value of.
     * @returns {boolean} A boolean
     */
    getBoolean: function (name) {
        return this.getParameterValue(name, ANIM_PARAMETER_BOOLEAN);
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#setBoolean
     * @description Sets the value of a boolean parameter that was defined in the animation components state graph.
     * @param {string} name - The name of the parameter to set.
     * @param {boolean} value - The new boolean value to set this parameter to.
     */
    setBoolean: function (name, value) {
        this.setParameterValue(name, ANIM_PARAMETER_BOOLEAN, !!value);
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#getTrigger
     * @description Returns a trigger parameter value by name.
     * @param {string} name - The name of the trigger to return the value of.
     * @returns {boolean} A boolean
     */
    getTrigger: function (name) {
        return this.getParameterValue(name, ANIM_PARAMETER_TRIGGER);
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#setTrigger
     * @description Sets the value of a trigger parameter that was defined in the animation components state graph to true.
     * @param {string} name - The name of the parameter to set.
     */
    setTrigger: function (name) {
        this.setParameterValue(name, ANIM_PARAMETER_TRIGGER, true);
    },

    /**
     * @private
     * @function
     * @name pc.AnimComponent#setTrigger
     * @description Resets the value of a trigger parameter that was defined in the animation components state graph to false.
     * @param {string} name - The name of the parameter to set.
     */
    resetTrigger: function (name) {
        this.setParameterValue(name, ANIM_PARAMETER_TRIGGER, false);
    }
});

Object.defineProperties(AnimComponent.prototype, {
    /**
     * @private
     * @name pc.AnimComponent#stateGraphAsset
     * @type {number}
     * @description The state graph asset this component should use to generate it's animation state graph
     */
    stateGraphAsset: {
        get: function () {
            return this.data.stateGraphAsset;
        },
        set: function (value) {
            if (value === null) {
                this.removeStateGraph();
                return;
            }

            var _id;
            var _asset;

            if (value instanceof Asset) {
                _id = value.id;
                _asset = this.system.app.assets.get(_id);
                if (!_asset) {
                    this.system.app.assets.add(value);
                    _asset = this.system.app.assets.get(_id);
                }
            } else {
                _id = value;
                _asset = this.system.app.assets.get(_id);
            }
            if (!_asset || this.data.stateGraphAsset === _id) {
                return;
            }

            if (_asset.resource) {
                this.data.stateGraph = _asset.resource;
                this.loadStateGraph(this.data.stateGraph);
                _asset.on('change', function (asset) {
                    this.data.stateGraph = new AnimStateGraph(asset._data);
                    this.loadStateGraph(this.data.stateGraph);
                }.bind(this));
            } else {
                _asset.once('load', function (asset) {
                    this.data.stateGraph = asset.resource;
                    this.loadStateGraph(this.data.stateGraph);
                }.bind(this));
                _asset.on('change', function (asset) {
                    this.data.stateGraph = new AnimStateGraph(asset._data);
                    this.loadStateGraph(this.data.stateGraph);
                }.bind(this));
                this.system.app.assets.load(_asset);
            }
            this.data.stateGraphAsset = _id;
        }
    },
    /**
     * @private
     * @name pc.AnimComponent#animationAssets
     * @type {object}
     * @description The animation assets used to load each states animation tracks
     */
    animationAssets: {
        get: function () {
            return this.data.animationAssets;
        },
        set: function (value) {
            this.data.animationAssets = value;
            this.loadAnimationAssets();
        }
    },
    /**
     * @private
     * @name pc.AnimComponent#playable
     * @type {boolean}
     * @readonly
     * @description Returns whether all component layers are currently playable
     */
    playable: {
        get: function () {
            for (var i = 0; i < this.data.layers.length; i++) {
                if (!this.data.layers[i].playable) {
                    return false;
                }
            }
            return true;
        }
    },
    /**
     * @private
     * @name pc.AnimComponent#baseLayer
     * @type {pc.AnimComponentLayer}
     * @readonly
     * @description Returns the base layer of the state graph
     */
    baseLayer: {
        get: function () {
            if (this.data.layers.length > 0) {
                return this.data.layers[0];
            }
            return null;
        }
    }
});

export { AnimComponent };
