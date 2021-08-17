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
import { AnimEvents } from '../../../anim/evaluator/anim-events.js';

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

        this._stateGraphAsset = null;
        this._animationAssets = {};
        this._speed = 1.0;
        this._activate = true;
        this._playing = false;
        this._rootBone = null;
        this._stateGraph = null;
        this._layers = [];
        this._layerIndices = {};
        this._parameters = {};
    }

    get stateGraphAsset() {
        return this._stateGraphAsset;
    }

    set stateGraphAsset(value) {
        if (value === null) {
            this.removeStateGraph();
            return;
        }

        // remove event from previous asset
        if (this._stateGraphAsset) this.system.app.assets.get(this._stateGraphAsset).off('change', this._onStateGraphAssetChangeEvent);

        let _id;
        let _asset;

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
        if (!_asset || this._stateGraphAsset === _id) {
            return;
        }

        if (_asset.resource) {
            this._stateGraph = _asset.resource;
            this.loadStateGraph(this._stateGraph);
            _asset.on('change', this._onStateGraphAssetChangeEvent);
        } else {
            _asset.once('load', (asset) => {
                this._stateGraph = asset.resource;
                this.loadStateGraph(this._stateGraph);
            });
            _asset.on('change', this._onStateGraphAssetChangeEvent);
            this.system.app.assets.load(_asset);
        }
        this._stateGraphAsset = _id;
    }

    _onStateGraphAssetChangeEvent = (asset) => {
        this._stateGraph = new AnimStateGraph(asset._data);
        this.loadStateGraph(this._stateGraph);
    }


    get animationAssets() {
        return this._animationAssets;
    }

    set animationAssets(value) {
        this._animationAssets = value;
        this.loadAnimationAssets();
    }

    get speed() {
        return this._speed;
    }

    set speed(value) {
        this._speed = value;
    }

    get activate() {
        return this._activate;
    }

    set activate(value) {
        this._activate = value;
    }

    get playing() {
        return this._playing;
    }

    set playing(value) {
        this._playing = value;
    }

    /**
     * @name AnimComponent#rootBone
     * @type {Entity}
     * @description The entity that this anim component should use as the root of the animation hierarchy.
     */
    get rootBone() {
        return this._rootBone;
    }

    set rootBone(value) {
        if (typeof value === 'string') {
            const entity = this.entity.root.findByGuid(value);
            this._rootBone = entity;
            // #if _DEBUG
            if (!entity) {
                console.warn(`rootBone entity for supplied guid:${value} cannot be found in the scene`);
            }
            // #endif
        } else if (value?.constructor.name === 'Entity') {
            this._rootBone = value;
        } else {
            this._rootBone = null;
        }
        this.rebind();
    }

    get stateGraph() {
        return this._stateGraph;
    }

    set stateGraph(value) {
        this._stateGraph = value;
    }

    get layers() {
        return this._layers;
    }

    set layers(value) {
        this._layers = value;
    }

    get layerIndicies() {
        return this._layerIndicies;
    }

    set layerIndicies(value) {
        this._layerIndicies = value;
    }

    get parameters() {
        return this._parameters;
    }

    set parameters(value) {
        this._parameters = value;
    }

    /**
     * @name AnimComponent#playable
     * @type {boolean}
     * @readonly
     * @description Returns whether all component layers are currently playable.
     */
    get playable() {
        for (let i = 0; i < this._layers.length; i++) {
            if (!this._layers[i].playable) {
                return false;
            }
        }
        return true;
    }

    /**
     * @name AnimComponent#baseLayer
     * @type {AnimComponentLayer}
     * @readonly
     * @description Returns the base layer of the state graph.
     */
    get baseLayer() {
        if (this._layers.length > 0) {
            return this._layers[0];
        }
        return null;
    }

    _addLayer(name, states, transitions, order) {
        let graph;
        if (this.rootBone) {
            graph = this.rootBone;
        } else {
            graph = this.entity;
        }
        const animBinder = new AnimComponentBinder(this, graph);
        const animEvaluator = new AnimEvaluator(animBinder);
        const controller = new AnimController(
            animEvaluator,
            states,
            transitions,
            this._parameters,
            this._activate,
            this
        );
        this._layers.push(new AnimComponentLayer(name, controller, this));
        this._layerIndices[name] = order;
    }

    /**
     * @name AnimComponent#addLayer
     * @returns {AnimComponentLayer} - The created anim component layer
     * @description Adds a new anim component layer to the anim component.
     * @param {string} layerName - The name of the layer to create.
     */
    addLayer(layerName) {
        const layer = this.findAnimationLayer(layerName);
        if (layer) return layer;
        const states = [
            {
                "name": "START",
                "speed": 1
            }
        ];
        const transitions = [];
        this._addLayer(layerName, states, transitions, this._layers.length);
    }

    /**
     * @function
     * @name AnimComponent#loadStateGraph
     * @description Initialises component animation controllers using the provided state graph.
     * @param {object} stateGraph - The state graph asset to load into the component. Contains the states, transitions and parameters used to define a complete animation controller.
     * @example
     * entity.anim.loadStateGraph({
     *     "layers": [
     *         {
     *             "name": layerName,
     *             "states": [
     *                 {
     *                     "name": "START",
     *                     "speed": 1
     *                 },
     *                 {
     *                     "name": "Initial State",
     *                     "speed": speed,
     *                     "loop": loop,
     *                     "defaultState": true
     *                 }
     *             ],
     *             "transitions": [
     *                 {
     *                     "from": "START",
     *                     "to": "Initial State"
     *                 }
     *             ]
     *         }
     *     ],
     *     "parameters": {}
     * });
     */
    loadStateGraph(stateGraph) {
        this._stateGraph = stateGraph;
        this._parameters = {};
        const paramKeys = Object.keys(stateGraph.parameters);
        for (let i = 0; i < paramKeys.length; i++) {
            const paramKey = paramKeys[i];
            this._parameters[paramKey] = {
                type: stateGraph.parameters[paramKey].type,
                value: stateGraph.parameters[paramKey].value
            };
        }
        this._layers = [];

        for (let i = 0; i < stateGraph.layers.length; i++) {
            const layer = stateGraph.layers[i];
            this._addLayer.bind(this)(layer.name, layer.states, layer.transitions, i);
        }
        this.setupAnimationAssets();
    }

    setupAnimationAssets() {
        for (let i = 0; i < this._layers.length; i++) {
            const layer = this._layers[i];
            const layerName = layer.name;
            for (let j = 0; j < layer.states.length; j++) {
                const stateName = layer.states[j];
                if (ANIM_CONTROL_STATES.indexOf(stateName) === -1) {
                    const stateKey = layerName + ':' + stateName;
                    if (!this._animationAssets[stateKey]) {
                        this._animationAssets[stateKey] = {
                            asset: null
                        };
                    }
                }
            }
        }
        this.loadAnimationAssets();
    }

    loadAnimationAssets() {
        for (let i = 0; i < this._layers.length; i++) {
            const layer = this._layers[i];
            for (let j = 0; j < layer.states.length; j++) {
                const stateName = layer.states[j];
                if (ANIM_CONTROL_STATES.indexOf(stateName) !== -1) continue;
                const animationAsset = this._animationAssets[layer.name + ':' + stateName];
                if (!animationAsset || !animationAsset.asset) {
                    this.removeNodeAnimations(stateName, layer.name);
                    continue;
                }
                const assetId = animationAsset.asset;
                const asset = this.system.app.assets.get(assetId);
                // check whether assigned animation asset still exists
                if (asset) {
                    if (asset.resource) {
                        const animTrack = asset.resource;
                        if (asset.data.events) {
                            animTrack.events = new AnimEvents(Object.values(asset.data.events));
                        }
                        this.findAnimationLayer(layer.name).assignAnimation(stateName, animTrack);
                    } else {
                        asset.once('load', function (layerName, stateName) {
                            return function (asset) {
                                this.findAnimationLayer(layerName).assignAnimation(stateName, asset.resource);
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
        this._stateGraph = null;
        this._stateGraphAsset = null;
        this._animationAssets = {};
        this._layers = [];
        this._layerIndices = {};
        this._parameters = {};
        this._playing = false;
    }

    resetStateGraph() {
        if (this.stateGraphAsset) {
            const stateGraph = this.system.app.assets.get(this.stateGraphAsset).resource;
            this.loadStateGraph(stateGraph);
        } else {
            this.removeStateGraph();
        }
    }

    /**
     * @function
     * @name AnimComponent#reset
     * @description Reset all of the components layers and parameters to their initial states. If a layer was playing before it will continue playing.
     */
    reset() {
        this._parameters = Object.assign({}, this._stateGraph.parameters);
        for (let i = 0; i < this._layers.length; i++) {
            const layerPlaying = this._layers[i].playing;
            this._layers[i].reset();
            this._layers[i].playing = layerPlaying;
        }
    }

    /**
     * @function
     * @name AnimComponent#rebind
     * @description Rebind all of the components layers.
     */
    rebind() {
        for (let i = 0; i < this._layers.length; i++) {
            this._layers[i].rebind();
        }
    }

    /**
     * @function
     * @name AnimComponent#findAnimationLayer
     * @description Finds a {@link AnimComponentLayer} in this component.
     * @param {string} layerName - The name of the anim component layer to find.
     * @returns {AnimComponentLayer} Layer.
     */
    findAnimationLayer(layerName) {
        const layerIndex = this._layerIndices[layerName];
        return this._layers[layerIndex] || null;
    }

    addAnimationState(nodeName, animTrack, speed = 1, loop = true, layerName = 'Base') {
        if (!this._stateGraph) {
            this.loadStateGraph(new AnimStateGraph({
                "layers": [
                    {
                        "name": layerName,
                        "states": [
                            {
                                "name": "START",
                                "speed": 1
                            },
                            {
                                "name": nodeName,
                                "speed": speed,
                                "loop": loop,
                                "defaultState": true
                            }
                        ],
                        "transitions": [
                            {
                                "from": 'START',
                                "to": nodeName
                            }
                        ]
                    }
                ],
                "parameters": {}
            }));
        }
        const layer = this.findAnimationLayer(layerName);
        if (layer) {
            layer.assignAnimation(nodeName, animTrack, speed, loop);
        } else {
            this.addLayer(layerName)?.assignAnimation(nodeName, animTrack, speed, loop);
        }
    }

    /**
     * @function
     * @name AnimComponent#assignAnimation
     * @description Associates an animation with a state in the loaded state graph. If all states are linked and the {@link AnimComponent#activate} value was set to true then the component will begin playing.
     * If no state graph is loaded, a default state graph will be created with a single state based on the provided nodeName parameter.
     * @param {string} nodeName - The name of the state node that this animation should be associated with.
     * @param {object} animTrack - The animation track that will be assigned to this state and played whenever this state is active.
     * @param {string} [layerName] - The name of the anim component layer to update. If omitted the default layer is used. If no state graph has been previously loaded this parameter is ignored.
     * @param {number} [speed] - Update the speed of the state you are assigning an animation to. Defaults to 1.
     * @param {boolean} [loop] - Update the loop property of the state you are assigning an animation to. Defaults to true.
     */
    assignAnimation(nodeName, animTrack, layerName, speed = 1,  loop = true) {
        if (!this._stateGraph) {
            this.loadStateGraph(new AnimStateGraph({
                "layers": [
                    {
                        "name": "Base",
                        "states": [
                            {
                                "name": "START",
                                "speed": 1
                            },
                            {
                                "name": nodeName,
                                "speed": speed,
                                "loop": loop,
                                "defaultState": true
                            }
                        ],
                        "transitions": [
                            {
                                "from": 'START',
                                "to": nodeName
                            }
                        ]
                    }
                ],
                "parameters": {}
            }));
            this.baseLayer.assignAnimation(nodeName, animTrack);
            return;
        }
        const layer = layerName ? this.findAnimationLayer(layerName) : this.baseLayer;
        if (!layer) {
            // #if _DEBUG
            console.error('assignAnimation: Trying to assign an anim track to a layer that doesn\'t exist');
            // #endif
            return;
        }
        layer.assignAnimation(nodeName, animTrack, speed, loop);
    }

    /**
     * @function
     * @name AnimComponent#removeNodeAnimations
     * @description Removes animations from a node in the loaded state graph.
     * @param {string} nodeName - The name of the node that should have its animation tracks removed.
     * @param {string} [layerName] - The name of the anim component layer to update. If omitted the default layer is used.
     */
    removeNodeAnimations(nodeName, layerName) {
        const layer = layerName ? this.findAnimationLayer(layerName) : this.baseLayer;
        if (!layer) {
            // #if _DEBUG
            console.error('removeStateAnimations: Trying to remove animation tracks from a state before the state graph has been loaded. Have you called loadStateGraph?');
            // #endif
            return;
        }
        layer.removeNodeAnimations(nodeName);
    }

    getParameterValue(name, type) {
        const param = this._parameters[name];
        if (param && param.type === type) {
            return param.value;
        }
        // #if _DEBUG
        console.log('Cannot get parameter value. No parameter found in anim controller named "' + name + '" of type "' + type + '"');
        // #endif
    }

    setParameterValue(name, type, value) {
        const param = this._parameters[name];
        if (param && param.type === type) {
            param.value = value;
            return;
        }
        // #if _DEBUG
        console.log('Cannot set parameter value. No parameter found in anim controller named "' + name + '" of type "' + type + '"');
        // #endif
    }

    /**
     * @function
     * @name AnimComponent#getFloat
     * @description Returns a float parameter value by name.
     * @param {string} name - The name of the float to return the value of.
     * @returns {number} A float.
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
     * @returns {number} An integer.
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
            // #if _DEBUG
            console.error('Attempting to assign non integer value to integer parameter');
            // #endif
        }
    }

    /**
     * @function
     * @name AnimComponent#getBoolean
     * @description Returns a boolean parameter value by name.
     * @param {string} name - The name of the boolean to return the value of.
     * @returns {boolean} A boolean.
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
     * @returns {boolean} A boolean.
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

    onBeforeRemove() {
        if (Number.isFinite(this._stateGraphAsset)) {
            this.system.app.assets.get(this._stateGraphAsset).off('change', this._onStateGraphAssetChangeEvent);
        }
    }
}

export { AnimComponent };
