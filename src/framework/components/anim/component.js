import { Asset } from '../../../asset/asset.js';

import { AnimEvaluator } from '../../../anim/evaluator/anim-evaluator.js';
import { AnimController } from '../../../anim/controller/anim-controller.js';

import { Component } from '../component.js';

import {
    ANIM_PARAMETER_BOOLEAN, ANIM_PARAMETER_FLOAT, ANIM_PARAMETER_INTEGER, ANIM_PARAMETER_TRIGGER, ANIM_CONTROL_STATES
} from '../../../anim/controller/constants.js';
import { AnimComponentBinder } from './component-binder.js';
import { AnimComponentLayer } from './component-layer.js';
import { AnimStateGraph } from '../../../anim/state-graph/anim-state-graph.js';
import { EntityReference } from '../../utils/entity-reference.js';

/**
 * @component
 * @class
 * @name AnimComponent
 * @augments Component
 * @classdesc The Anim Component allows an Entity to playback animations on models and entity properties.
 * @description Create a new AnimComponent.
 * @param {AnimComponentSystem} system - The {@link ComponentSystem} that created this Component.
 * @param {Entity} entity - The Entity that this Component is attached to.
 * @property {number} speed Speed multiplier for animation play back speed. 1.0 is playback at normal speed, 0.0 pauses the animation.
 * @property {boolean} activate If true the first animation will begin playing when the scene is loaded.
 * @property {boolean} playing Plays or pauses all animations in the component.
 */
class AnimComponent extends Component {
    constructor(system, entity) {
        super(system, entity);
    }

    /**
     * @function
     * @name AnimComponent#loadStateGraph
     * @description Initialises component animation controllers using the provided state graph.
     * @param {object} stateGraph - The state graph asset to load into the component. Contains the states, transitions and parameters used to define a complete animation controller.
     */
    loadStateGraph(stateGraph) {
        var i;
        var data = this.data;
        data.stateGraph = stateGraph;
        data.parameters = {};
        var paramKeys = Object.keys(stateGraph.parameters);
        for (i = 0; i < paramKeys.length; i++) {
            var paramKey = paramKeys[i];
            data.parameters[paramKey] = {
                type: stateGraph.parameters[paramKey].type,
                value: stateGraph.parameters[paramKey].value
            };
        }
        data.layers = [];

        var graph;
        if (this.rootBone) {
            graph = this.rootBone;
        } else {
            graph = this.entity;
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

        for (i = 0; i < stateGraph.layers.length; i++) {
            var layer = stateGraph.layers[i];
            addLayer.bind(this)(layer.name, layer.states, layer.transitions, i);
        }
        this.setupAnimationAssets();
    }

    setupAnimationAssets() {
        for (var i = 0; i < this.data.layers.length; i++) {
            var layer = this.data.layers[i];
            var layerName = layer.name;
            for (var j = 0; j < layer.states.length; j++) {
                var stateName = layer.states[j];
                if (ANIM_CONTROL_STATES.indexOf(stateName) === -1) {
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
    }

    loadAnimationAssets() {
        for (var i = 0; i < this.data.layers.length; i++) {
            var layer = this.data.layers[i];
            for (var j = 0; j < layer.states.length; j++) {
                var stateName = layer.states[j];
                if (ANIM_CONTROL_STATES.indexOf(stateName) !== -1) continue;
                var animationAsset = this.data.animationAssets[layer.name + ':' + stateName];
                if (!animationAsset || !animationAsset.asset) {
                    this.removeNodeAnimations(stateName, layer.name);
                    continue;
                }
                var assetId = animationAsset.asset;
                var asset = this.system.app.assets.get(assetId);
                // check whether assigned animation asset still exists
                if (asset) {
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
        }
    }

    /**
     * @function
     * @name AnimComponent#removeStateGraph
     * @description Removes all layers from the anim component.
     */
    removeStateGraph() {
        this.data.stateGraph = null;
        this.data.stateGraphAsset = null;
        this.data.animationAssets = {};
        this.data.layers = [];
        this.data.layerIndices = {};
        this.data.parameters = {};
        this.data.playing = false;
    }

    resetStateGraph() {
        if (this.stateGraphAsset) {
            var stateGraph = this.system.app.assets.get(this.stateGraphAsset).resource;
            this.loadStateGraph(stateGraph);
        } else {
            this.removeStateGraph();
        }
    }

    /**
     * @function
     * @name AnimComponent#reset
     * @description Reset all of the components layers and parameters to their initial states. If a layer was playing before it will continue playing
     */
    reset() {
        this.data.parameters = Object.assign({}, this.data.stateGraph.parameters);
        for (var i = 0; i < this.data.layers.length; i++) {
            var layerPlaying = this.data.layers[i].playing;
            this.data.layers[i].reset();
            this.data.layers[i].playing = layerPlaying;
        }
    }

    /**
     * @function
     * @name AnimComponent#rebind
     * @description Rebind all of the components layers
     */
    rebind() {
        for (var i = 0; i < this.data.layers.length; i++) {
            this.data.layers[i].rebind();
        }
    }

    /**
     * @function
     * @name AnimComponent#findAnimationLayer
     * @description Finds a {@link AnimComponentLayer} in this component.
     * @param {string} layerName - The name of the anim component layer to find
     * @returns {AnimComponentLayer} layer
     */
    findAnimationLayer(layerName) {
        var layerIndex = this.data.layerIndices[layerName];
        return this.data.layers[layerIndex] || null;
    }

    /**
     * @function
     * @name AnimComponent#assignAnimation
     * @description Associates an animation with a state in the loaded state graph. If all states are linked and the {@link AnimComponent#activate} value was set to true then the component will begin playing.
     * @param {string} nodeName - The name of the state node that this animation should be associated with.
     * @param {object} animTrack - The animation track that will be assigned to this state and played whenever this state is active.
     * @param {string?} layerName - The name of the anim component layer to update. If omitted the default layer is used.
     */
    assignAnimation(nodeName, animTrack, layerName) {
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
    }

    /**
     * @function
     * @name AnimComponent#removeNodeAnimations
     * @description Removes animations from a node in the loaded state graph.
     * @param {string} nodeName - The name of the node that should have its animation tracks removed.
     * @param {string?} layerName - The name of the anim component layer to update. If omitted the default layer is used.
     */
    removeNodeAnimations(nodeName, layerName) {
        var layer = layerName ? this.findAnimationLayer(layerName) : this.baseLayer;
        if (!layer) {
            // #ifdef DEBUG
            console.error('removeStateAnimations: Trying to remove animation tracks from a state before the state graph has been loaded. Have you called loadStateGraph?');
            // #endif
            return;
        }
        layer.removeNodeAnimations(nodeName);
    }

    getParameterValue(name, type) {
        var param = this.data.parameters[name];
        if (param && param.type === type) {
            return param.value;
        }
        // #ifdef DEBUG
        console.log('Cannot get parameter value. No parameter found in anim controller named "' + name + '" of type "' + type + '"');
        // #endif
    }

    setParameterValue(name, type, value) {
        var param = this.data.parameters[name];
        if (param && param.type === type) {
            param.value = value;
            return;
        }
        // #ifdef DEBUG
        console.log('Cannot set parameter value. No parameter found in anim controller named "' + name + '" of type "' + type + '"');
        // #endif
    }

    /**
     * @function
     * @name AnimComponent#getFloat
     * @description Returns a float parameter value by name.
     * @param {string} name - The name of the float to return the value of.
     * @returns {number} A float
     */
    getFloat(name) {
        return this.getParameterValue(name, ANIM_PARAMETER_FLOAT);
    }

    /**
     * @function
     * @name AnimComponent#setFloat
     * @description Sets the value of a float parameter that was defined in the animation components state graph.
     * @param {string} name - The name of the parameter to set.
     * @param {number} value - The new float value to set this parameter to.
     */
    setFloat(name, value) {
        this.setParameterValue(name, ANIM_PARAMETER_FLOAT, value);
    }

    /**
     * @function
     * @name AnimComponent#getInteger
     * @description Returns an integer parameter value by name.
     * @param {string} name - The name of the integer to return the value of.
     * @returns {number} An integer
     */
    getInteger(name) {
        return this.getParameterValue(name, ANIM_PARAMETER_INTEGER);
    }

    /**
     * @function
     * @name AnimComponent#setInteger
     * @description Sets the value of an integer parameter that was defined in the animation components state graph.
     * @param {string} name - The name of the parameter to set.
     * @param {number} value - The new integer value to set this parameter to.
     */
    setInteger(name, value) {
        if (typeof value === 'number' && value % 1 === 0) {
            this.setParameterValue(name, ANIM_PARAMETER_INTEGER, value);
        } else {
            // #ifdef DEBUG
            console.error('Attempting to assign non integer value to integer parameter');
            // #endif
        }
    }

    /**
     * @function
     * @name AnimComponent#getBoolean
     * @description Returns a boolean parameter value by name.
     * @param {string} name - The name of the boolean to return the value of.
     * @returns {boolean} A boolean
     */
    getBoolean(name) {
        return this.getParameterValue(name, ANIM_PARAMETER_BOOLEAN);
    }

    /**
     * @function
     * @name AnimComponent#setBoolean
     * @description Sets the value of a boolean parameter that was defined in the animation components state graph.
     * @param {string} name - The name of the parameter to set.
     * @param {boolean} value - The new boolean value to set this parameter to.
     */
    setBoolean(name, value) {
        this.setParameterValue(name, ANIM_PARAMETER_BOOLEAN, !!value);
    }

    /**
     * @function
     * @name AnimComponent#getTrigger
     * @description Returns a trigger parameter value by name.
     * @param {string} name - The name of the trigger to return the value of.
     * @returns {boolean} A boolean
     */
    getTrigger(name) {
        return this.getParameterValue(name, ANIM_PARAMETER_TRIGGER);
    }

    /**
     * @function
     * @name AnimComponent#setTrigger
     * @description Sets the value of a trigger parameter that was defined in the animation components state graph to true.
     * @param {string} name - The name of the parameter to set.
     */
    setTrigger(name) {
        this.setParameterValue(name, ANIM_PARAMETER_TRIGGER, true);
    }

    /**
     * @function
     * @name AnimComponent#resetTrigger
     * @description Resets the value of a trigger parameter that was defined in the animation components state graph to false.
     * @param {string} name - The name of the parameter to set.
     */
    resetTrigger(name) {
        this.setParameterValue(name, ANIM_PARAMETER_TRIGGER, false);
    }

    /**
     * @name AnimComponent#rootBone
     * @type {Entity}
     * @description The entity that this anim component should use as the root of the animation hierarchy
     */
    get rootBone() {
        return this.data.rootBone;
    }

    set rootBone(value) {
        if (typeof value === 'string') {
            const entity = this.entity.root.findByGuid(value);
            if (entity) this.data.rootBone = entity;
        } else if (value?.constructor.name === 'Entity') {
            this.data.rootBone = value;
        } else {
            this.data.rootBone = null;
        }
        this.rebind();
    }

    /**
     * @name AnimComponent#stateGraphAsset
     * @type {number}
     * @description The state graph asset this component should use to generate it's animation state graph
     */
    get stateGraphAsset() {
        return this.data.stateGraphAsset;
    }

    set stateGraphAsset(value) {
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

    /**
     * @private
     * @name AnimComponent#animationAssets
     * @type {object}
     * @description The animation assets used to load each states animation tracks
     */
    get animationAssets() {
        return this.data.animationAssets;
    }

    set animationAssets(value) {
        this.data.animationAssets = value;
        this.loadAnimationAssets();
    }

    /**
     * @name AnimComponent#playable
     * @type {boolean}
     * @readonly
     * @description Returns whether all component layers are currently playable
     */
    get playable() {
        for (var i = 0; i < this.data.layers.length; i++) {
            if (!this.data.layers[i].playable) {
                return false;
            }
        }
        return true;
    }

    /**
     * @name AnimComponent#baseLayer
     * @type {AnimComponentLayer}
     * @readonly
     * @description Returns the base layer of the state graph
     */
    get baseLayer() {
        if (this.data.layers.length > 0) {
            return this.data.layers[0];
        }
        return null;
    }
}

export { AnimComponent };
