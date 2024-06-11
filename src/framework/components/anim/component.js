import { Debug } from '../../../core/debug.js';
import { Asset } from '../../asset/asset.js';

import { AnimEvaluator } from '../../anim/evaluator/anim-evaluator.js';
import { AnimController } from '../../anim/controller/anim-controller.js';

import { Component } from '../component.js';

import {
    ANIM_PARAMETER_BOOLEAN, ANIM_PARAMETER_FLOAT, ANIM_PARAMETER_INTEGER, ANIM_PARAMETER_TRIGGER, ANIM_CONTROL_STATES
} from '../../anim/controller/constants.js';
import { AnimComponentBinder } from './component-binder.js';
import { AnimComponentLayer } from './component-layer.js';
import { AnimStateGraph } from '../../anim/state-graph/anim-state-graph.js';
import { Entity } from '../../entity.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';

/**
 * The Anim Component allows an Entity to playback animations on models and entity properties.
 *
 * @category Animation
 */
class AnimComponent extends Component {
    /**
     * Create a new AnimComponent instance.
     *
     * @param {import('./system.js').AnimComponentSystem} system - The {@link ComponentSystem} that
     * created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
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
        // a collection of animated property targets
        this._targets = {};
        this._consumedTriggers = new Set();
        this._normalizeWeights = false;
    }

    set stateGraphAsset(value) {
        if (value === null) {
            this.removeStateGraph();
            return;
        }

        // remove event from previous asset
        if (this._stateGraphAsset) {
            const stateGraphAsset = this.system.app.assets.get(this._stateGraphAsset);
            stateGraphAsset.off('change', this._onStateGraphAssetChangeEvent, this);
        }

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
            _asset.on('change', this._onStateGraphAssetChangeEvent, this);
        } else {
            _asset.once('load', (asset) => {
                this._stateGraph = asset.resource;
                this.loadStateGraph(this._stateGraph);
            });
            _asset.on('change', this._onStateGraphAssetChangeEvent, this);
            this.system.app.assets.load(_asset);
        }
        this._stateGraphAsset = _id;
    }

    get stateGraphAsset() {
        return this._stateGraphAsset;
    }


    /**
     * Sets whether the animation component will normalize the weights of its layers by their sum total.
     *
     * @type {boolean}
     */
    set normalizeWeights(value) {
        this._normalizeWeights = value;
        this.unbind();
    }

    /**
     * Gets whether the animation component will normalize the weights of its layers by their sum total.
     *
     * @type {boolean}
     */
    get normalizeWeights() {
        return this._normalizeWeights;
    }

    set animationAssets(value) {
        this._animationAssets = value;
        this.loadAnimationAssets();
    }

    get animationAssets() {
        return this._animationAssets;
    }

    /**
     * Sets the speed multiplier for animation play back speed. 1.0 is playback at normal speed, 0.0 pauses
     * the animation.
     *
     * @type {number}
     */
    set speed(value) {
        this._speed = value;
    }

    /**
     * Gets the speed multiplier for animation play back speed.
     *
     * @type {number}
     */
    get speed() {
        return this._speed;
    }

    /**
     * Sets whether the first animation will begin playing when the scene is loaded.
     *
     * @type {boolean}
     */
    set activate(value) {
        this._activate = value;
    }

    /**
     * Gets whether the first animation will begin playing when the scene is loaded.
     *
     * @type {boolean}
     */
    get activate() {
        return this._activate;
    }


    /**
     * Sets whether to play or pause all animations in the component.
     *
     * @type {boolean}
     */
    set playing(value) {
        this._playing = value;
    }

    /**
     * Gets whether to play or pause all animations in the component.
     *
     * @type {boolean}
     */
    get playing() {
        return this._playing;
    }

    /**
     * Sets the entity that this anim component should use as the root of the animation hierarchy.
     *
     * @type {Entity}
     */
    set rootBone(value) {
        if (typeof value === 'string') {
            const entity = this.entity.root.findByGuid(value);
            Debug.assert(entity, `rootBone entity for supplied guid:${value} cannot be found in the scene`);
            this._rootBone = entity;
        } else if (value instanceof Entity) {
            this._rootBone = value;
        } else {
            this._rootBone = null;
        }
        this.rebind();
    }

    /**
     * Gets the entity that this anim component should use as the root of the animation hierarchy.
     *
     * @type {Entity}
     */
    get rootBone() {
        return this._rootBone;
    }

    set stateGraph(value) {
        this._stateGraph = value;
    }

    get stateGraph() {
        return this._stateGraph;
    }

    /**
     * Returns the animation layers available in this anim component.
     *
     * @type {AnimComponentLayer[]}
     */
    get layers() {
        return this._layers;
    }

    set layerIndices(value) {
        this._layerIndices = value;
    }

    get layerIndices() {
        return this._layerIndices;
    }

    set parameters(value) {
        this._parameters = value;
    }

    get parameters() {
        return this._parameters;
    }

    set targets(value) {
        this._targets = value;
    }

    get targets() {
        return this._targets;
    }

    /**
     * Returns whether all component layers are currently playable.
     *
     * @type {boolean}
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
     * Returns the base layer of the state graph.
     *
     * @type {AnimComponentLayer|null}
     */
    get baseLayer() {
        if (this._layers.length > 0) {
            return this._layers[0];
        }
        return null;
    }

    _onStateGraphAssetChangeEvent(asset) {
        // both animationAssets and layer masks should be maintained when switching AnimStateGraph assets
        const prevAnimationAssets = this.animationAssets;
        const prevMasks = this.layers.map(layer => layer.mask);
        // clear the previous state graph
        this.removeStateGraph();
        // load the new state graph
        this._stateGraph = new AnimStateGraph(asset._data);
        this.loadStateGraph(this._stateGraph);
        // assign the previous animation assets
        this.animationAssets = prevAnimationAssets;
        this.loadAnimationAssets();
        // assign the previous layer masks then rebind all anim targets
        this.layers.forEach((layer, i) => {
            layer.mask = prevMasks[i];
        });
        this.rebind();
    }

    dirtifyTargets() {
        const targets = Object.values(this._targets);
        for (let i = 0; i < targets.length; i++) {
            targets[i].dirty = true;
        }
    }

    _addLayer({ name, states, transitions, weight, mask, blendType }) {
        let graph;
        if (this.rootBone) {
            graph = this.rootBone;
        } else {
            graph = this.entity;
        }
        const layerIndex = this._layers.length;
        const animBinder = new AnimComponentBinder(this, graph, name, mask, layerIndex);
        const animEvaluator = new AnimEvaluator(animBinder);
        const controller = new AnimController(
            animEvaluator,
            states,
            transitions,
            this._activate,
            this,
            this.findParameter,
            this.consumeTrigger
        );
        this._layers.push(new AnimComponentLayer(name, controller, this, weight, blendType));
        this._layerIndices[name] = layerIndex;
        return this._layers[layerIndex];
    }

    /**
     * Adds a new anim component layer to the anim component.
     *
     * @param {string} name - The name of the layer to create.
     * @param {number} [weight] - The blending weight of the layer. Defaults to 1.
     * @param {object[]} [mask] - A list of paths to bones in the model which should be animated in
     * this layer. If omitted the full model is used. Defaults to null.
     * @param {string} [blendType] - Defines how properties animated by this layer blend with
     * animations of those properties in previous layers. Defaults to pc.ANIM_LAYER_OVERWRITE.
     * @returns {AnimComponentLayer} The created anim component layer.
     */
    addLayer(name, weight, mask, blendType) {
        const layer = this.findAnimationLayer(name);
        if (layer) return layer;
        const states = [
            {
                'name': 'START',
                'speed': 1
            }
        ];
        const transitions = [];
        return this._addLayer({ name, states, transitions, weight, mask, blendType });
    }

    _assignParameters(stateGraph) {
        this._parameters = {};
        const paramKeys = Object.keys(stateGraph.parameters);
        for (let i = 0; i < paramKeys.length; i++) {
            const paramKey = paramKeys[i];
            this._parameters[paramKey] = {
                type: stateGraph.parameters[paramKey].type,
                value: stateGraph.parameters[paramKey].value
            };
        }
    }

    /**
     * Initializes component animation controllers using the provided state graph.
     *
     * @param {object} stateGraph - The state graph asset to load into the component. Contains the
     * states, transitions and parameters used to define a complete animation controller.
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
        this._assignParameters(stateGraph);
        this._layers = [];

        let containsBlendTree = false;
        for (let i = 0; i < stateGraph.layers.length; i++) {
            const layer = stateGraph.layers[i];
            this._addLayer({ ...layer });
            if (layer.states.some(state => state.blendTree)) {
                containsBlendTree = true;
            }
        }
        // blend trees do not support the automatic assignment of animation assets
        if (!containsBlendTree) {
            this.setupAnimationAssets();
        }
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
                    this.findAnimationLayer(layer.name).assignAnimation(stateName, AnimTrack.EMPTY);
                    continue;
                }
                const assetId = animationAsset.asset;
                const asset = this.system.app.assets.get(assetId);
                // check whether assigned animation asset still exists
                if (asset) {
                    if (asset.resource) {
                        this.onAnimationAssetLoaded(layer.name, stateName, asset);
                    } else {
                        asset.once('load', function (layerName, stateName) {
                            return function (asset) {
                                this.onAnimationAssetLoaded(layerName, stateName, asset);
                            }.bind(this);
                        }.bind(this)(layer.name, stateName));
                        this.system.app.assets.load(asset);
                    }
                }
            }
        }
    }

    onAnimationAssetLoaded(layerName, stateName, asset) {
        this.findAnimationLayer(layerName).assignAnimation(stateName, asset.resource);
    }

    /**
     * Removes all layers from the anim component.
     */
    removeStateGraph() {
        this._stateGraph = null;
        this._stateGraphAsset = null;
        this._animationAssets = {};
        this._layers = [];
        this._layerIndices = {};
        this._parameters = {};
        this._playing = false;
        this.unbind();
        // clear all targets from previous binding
        this._targets = {};
    }

    /**
     * Reset all of the components layers and parameters to their initial states. If a layer was
     * playing before it will continue playing.
     */
    reset() {
        this._assignParameters(this._stateGraph);
        for (let i = 0; i < this._layers.length; i++) {
            const layerPlaying = this._layers[i].playing;
            this._layers[i].reset();
            this._layers[i].playing = layerPlaying;
        }
    }

    unbind() {
        if (!this._normalizeWeights) {
            Object.keys(this._targets).forEach((targetKey) => {
                this._targets[targetKey].unbind();
            });
        }
    }

    /**
     * Rebind all of the components layers.
     */
    rebind() {
        // clear all targets from previous binding
        this._targets = {};
        // rebind all layers
        for (let i = 0; i < this._layers.length; i++) {
            this._layers[i].rebind();
        }
    }

    /**
     * Finds a {@link AnimComponentLayer} in this component.
     *
     * @param {string} name - The name of the anim component layer to find.
     * @returns {AnimComponentLayer} Layer.
     */
    findAnimationLayer(name) {
        const layerIndex = this._layerIndices[name];
        return this._layers[layerIndex] || null;
    }

    addAnimationState(nodeName, animTrack, speed = 1, loop = true, layerName = 'Base') {
        if (!this._stateGraph) {
            this.loadStateGraph(new AnimStateGraph({
                'layers': [
                    {
                        'name': layerName,
                        'states': [
                            {
                                'name': 'START',
                                'speed': 1
                            },
                            {
                                'name': nodeName,
                                'speed': speed,
                                'loop': loop,
                                'defaultState': true
                            }
                        ],
                        'transitions': [
                            {
                                'from': 'START',
                                'to': nodeName
                            }
                        ]
                    }
                ],
                'parameters': {}
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
     * Associates an animation with a state or blend tree node in the loaded state graph. If all
     * states are linked and the {@link AnimComponent#activate} value was set to true then the
     * component will begin playing. If no state graph is loaded, a default state graph will be
     * created with a single state based on the provided nodePath parameter.
     *
     * @param {string} nodePath - Either the state name or the path to a blend tree node that this
     * animation should be associated with. Each section of a blend tree path is split using a
     * period (`.`) therefore state names should not include this character (e.g "MyStateName" or
     * "MyStateName.BlendTreeNode").
     * @param {AnimTrack} animTrack - The animation track that will be assigned to this state and
     * played whenever this state is active.
     * @param {string} [layerName] - The name of the anim component layer to update. If omitted the
     * default layer is used. If no state graph has been previously loaded this parameter is
     * ignored.
     * @param {number} [speed] - Update the speed of the state you are assigning an animation to.
     * Defaults to 1.
     * @param {boolean} [loop] - Update the loop property of the state you are assigning an
     * animation to. Defaults to true.
     */
    assignAnimation(nodePath, animTrack, layerName, speed = 1, loop = true) {
        if (!this._stateGraph && nodePath.indexOf('.') === -1) {
            this.loadStateGraph(new AnimStateGraph({
                'layers': [
                    {
                        'name': 'Base',
                        'states': [
                            {
                                'name': 'START',
                                'speed': 1
                            },
                            {
                                'name': nodePath,
                                'speed': speed,
                                'loop': loop,
                                'defaultState': true
                            }
                        ],
                        'transitions': [
                            {
                                'from': 'START',
                                'to': nodePath
                            }
                        ]
                    }
                ],
                'parameters': {}
            }));
            this.baseLayer.assignAnimation(nodePath, animTrack);
            return;
        }
        const layer = layerName ? this.findAnimationLayer(layerName) : this.baseLayer;
        if (!layer) {
            Debug.error('assignAnimation: Trying to assign an anim track to a layer that doesn\'t exist');
            return;
        }
        layer.assignAnimation(nodePath, animTrack, speed, loop);
    }

    /**
     * Removes animations from a node in the loaded state graph.
     *
     * @param {string} nodeName - The name of the node that should have its animation tracks removed.
     * @param {string} [layerName] - The name of the anim component layer to update. If omitted the
     * default layer is used.
     */
    removeNodeAnimations(nodeName, layerName) {
        const layer = layerName ? this.findAnimationLayer(layerName) : this.baseLayer;
        if (!layer) {
            Debug.error('removeStateAnimations: Trying to remove animation tracks from a state before the state graph has been loaded. Have you called loadStateGraph?');
            return;
        }
        layer.removeNodeAnimations(nodeName);
    }

    getParameterValue(name, type) {
        const param = this._parameters[name];
        if (param && param.type === type) {
            return param.value;
        }
        Debug.log(`Cannot get parameter value. No parameter found in anim controller named "${name}" of type "${type}"`);
        return undefined;
    }

    setParameterValue(name, type, value) {
        const param = this._parameters[name];
        if (param && param.type === type) {
            param.value = value;
            return;
        }
        Debug.log(`Cannot set parameter value. No parameter found in anim controller named "${name}" of type "${type}"`);
    }

    /**
     * Returns the parameter object for the specified parameter name. This function is anonymous so that it can be passed to the AnimController
     * while still being called in the scope of the AnimComponent.
     *
     * @param {string} name - The name of the parameter to return the value of.
     * @returns {object} The parameter object.
     * @private
     */
    findParameter = (name) => {
        return this._parameters[name];
    };

    /**
     * Sets a trigger parameter as having been used by a transition. This function is anonymous so that it can be passed to the AnimController
     * while still being called in the scope of the AnimComponent.
     *
     * @param {string} name - The name of the trigger to set as consumed.
     * @private
     */
    consumeTrigger = (name) => {
        this._consumedTriggers.add(name);
    };

    /**
     * Returns a float parameter value by name.
     *
     * @param {string} name - The name of the float to return the value of.
     * @returns {number} A float.
     */
    getFloat(name) {
        return this.getParameterValue(name, ANIM_PARAMETER_FLOAT);
    }

    /**
     * Sets the value of a float parameter that was defined in the animation components state graph.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {number} value - The new float value to set this parameter to.
     */
    setFloat(name, value) {
        this.setParameterValue(name, ANIM_PARAMETER_FLOAT, value);
    }

    /**
     * Returns an integer parameter value by name.
     *
     * @param {string} name - The name of the integer to return the value of.
     * @returns {number} An integer.
     */
    getInteger(name) {
        return this.getParameterValue(name, ANIM_PARAMETER_INTEGER);
    }

    /**
     * Sets the value of an integer parameter that was defined in the animation components state
     * graph.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {number} value - The new integer value to set this parameter to.
     */
    setInteger(name, value) {
        if (typeof value === 'number' && value % 1 === 0) {
            this.setParameterValue(name, ANIM_PARAMETER_INTEGER, value);
        } else {
            Debug.error('Attempting to assign non integer value to integer parameter', name, value);
        }
    }

    /**
     * Returns a boolean parameter value by name.
     *
     * @param {string} name - The name of the boolean to return the value of.
     * @returns {boolean} A boolean.
     */
    getBoolean(name) {
        return this.getParameterValue(name, ANIM_PARAMETER_BOOLEAN);
    }

    /**
     * Sets the value of a boolean parameter that was defined in the animation components state
     * graph.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {boolean} value - The new boolean value to set this parameter to.
     */
    setBoolean(name, value) {
        this.setParameterValue(name, ANIM_PARAMETER_BOOLEAN, !!value);
    }

    /**
     * Returns a trigger parameter value by name.
     *
     * @param {string} name - The name of the trigger to return the value of.
     * @returns {boolean} A boolean.
     */
    getTrigger(name) {
        return this.getParameterValue(name, ANIM_PARAMETER_TRIGGER);
    }

    /**
     * Sets the value of a trigger parameter that was defined in the animation components state
     * graph to true.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {boolean} [singleFrame] - If true, this trigger will be set back to false at the end
     * of the animation update. Defaults to false.
     */
    setTrigger(name, singleFrame = false) {
        this.setParameterValue(name, ANIM_PARAMETER_TRIGGER, true);
        if (singleFrame) {
            this._consumedTriggers.add(name);
        }
    }

    /**
     * Resets the value of a trigger parameter that was defined in the animation components state
     * graph to false.
     *
     * @param {string} name - The name of the parameter to set.
     */
    resetTrigger(name) {
        this.setParameterValue(name, ANIM_PARAMETER_TRIGGER, false);
    }

    onBeforeRemove() {
        if (Number.isFinite(this._stateGraphAsset)) {
            const stateGraphAsset = this.system.app.assets.get(this._stateGraphAsset);
            stateGraphAsset.off('change', this._onStateGraphAssetChangeEvent, this);
        }
    }

    update(dt) {
        for (let i = 0; i < this.layers.length; i++) {
            this.layers[i].update(dt * this.speed);
        }
        this._consumedTriggers.forEach((trigger) => {
            this.parameters[trigger].value = false;
        });
        this._consumedTriggers.clear();
    }

    resolveDuplicatedEntityReferenceProperties(oldAnim, duplicatedIdsMap) {
        if (oldAnim.rootBone && duplicatedIdsMap[oldAnim.rootBone.getGuid()]) {
            this.rootBone = duplicatedIdsMap[oldAnim.rootBone.getGuid()];
        } else {
            this.rebind();
        }
    }
}

export { AnimComponent };
