/**
 * @typedef {AnimStateGraph_DataFromObject | AnimStateGraph_DataFromArray} AnimStateGraph_Data Two formats to pass data in, choose one
 */

// FROM OBJECT:

/**
 * @typedef {object} AnimStateGraph_DataFromObjectLayer
 * @property {string} name Name of this layer
 * @property {number[] | AnimStateGraph_DataState[]} states States of this layer
 * @property {number[] | AnimStateGraph_DataTransition} transitions Transitions of this layer
 */

/**
 * @typedef {object} AnimStateGraph_DataFromObject
 * @property {AnimStateGraph_DataFromObjectLayer[]} layers Layers of this data object
 * @property {AnimStateGraph_DataState[]} states States of this data object
 * @property {AnimStateGraph_DataTransition[]} transitions Transitions of this data object
 * @property {AnimStateGraph_DataParameters} parameters Parameters of this data object
 */

// FROM ARRAY:

/**
 * @typedef {object} AnimStateGraph_DataFromArrayLayer
 * @property {string} name Name of this layer
 * @property {AnimStateGraph_DataState[]} states States of this layer
 * @property {AnimStateGraph_DataTransition[]} transitions Transitions of this layer
 */

/**
 * @typedef {object} AnimStateGraph_DataFromArray
 * @property {AnimStateGraph_DataFromArrayLayer[]} layers Layers of this data object
 * @property {AnimStateGraph_DataParameters} parameters Parameters of this data object
 */

// GENERIC:

/**
 * @typedef {object} AnimStateGraph_DataState
 * @property {string} name Name of state, e.g. "START"
 * @property {number} [speed] Optional speed, e.g. 1
 * @property {boolean} [loop] Optional, should the state loop?
 * @property {boolean} [defaultState] Set to true for e.g. one state
 * @property {AnimStateGraph_BlendTree} [blendTree] Optional blendTree
 */

/**
 * @typedef {object} AnimStateGraph_BlendTree
 * @property {string} type One of pc.ANIM_BLEND_*
 * @property {string[]} parameters E.g. posX or posY
 * @property {AnimStateGraph_BlendTreeChild[]} children Children
 */

/**
 * @typedef {object} AnimStateGraph_BlendTreeChild
 * @property {string} name E.g. Idle/Walk/Dance
 * @property {number[]} point E.g. [0.0, 0.5]
 */

/**
 * @typedef {object} AnimStateGraph_DataTransition
 * @property {string} from E.g. "START"
 * @property {string} to E.g. "Emote"
 * @property {number} [time] Optional time, e.g. 0.0
 * @property {number} [exitTime] Optional exitTime
 * @property {number} [priority] Optional priority
 * @property {AnimStateGraph_DataTransitionCondition[]} [conditions] Optional conditions for the transition
 * @property {number} [transitionOffset] Optional transitionOffset
 * @property {string} [interruptionSource] Optional interruptionSource
 */

/**
 * @typedef {object} AnimStateGraph_DataTransitionCondition
 * @property {string} parameterName Name of parameter, e.g. "loop" or "posX"
 * @property {string} predicate E.g. pc.ANIM_EQUAL_TO
 * @property {any} value E.g. false or 0
 */

/**
 * @typedef {object} AnimStateGraph_DataParameter
 * @property {string} name Name of parameter, e.g. "loop"
 * @property {string} type E.g. pc.ANIM_PARAMETER_BOOLEAN
 * @property {any} value Value of parameter, e.g. false
 */

/**
 * @typedef {object<string, AnimStateGraph_DataParameter>} AnimStateGraph_DataParameters
 */

/**
 * @class
 * @name AnimStateGraph
 * @classdesc Creates an AnimStateGraph asset resource from a blob of JSON data that represents an anim state graph.
 * @param {AnimStateGraph_Data} data
 * @property {any} parameters parameters
 * @property {any} layers layers
 */
class AnimStateGraph {
    constructor(data) {
        this._layers = [];
        this._parameters = {};
        var i;
        if (!Array.isArray(data.layers)) {
            // Layers as an object
            // var data = {
            //     "layers": {
            //         "0": {
            //             "name": "Base",
            //             "states": [0, 1],
            //             "transitions": [0]
            //         }
            //     },
            //     "states": {
            //         "0": {
            //             "name": "START",
            //             "speed": 1
            //         },
            //         "1": {
            //             "name": "New State",
            //             "speed": 1,
            //             "loop": true,
            //             "defaultState": true
            //         }
            //     },
            //     "transitions": {
            //         "0": {
            //             "from": 0,
            //             "to": 1,
            //             "conditions": {}
            //         }
            //     },
            //     "parameters": {}
            // };
            for (var layerId in data.layers) {
                var dataLayer = data.layers[layerId];
                var layer = {
                    name: dataLayer.name,
                    states: [],
                    transitions: []
                };
                for (i = 0; i < dataLayer.states.length; i++) {
                    layer.states.push(data.states[dataLayer.states[i]]);
                }
                for (i = 0; i < dataLayer.transitions.length; i++) {
                    var dataLayerTransition = data.transitions[dataLayer.transitions[i]];
                    if (dataLayerTransition.conditions && !Array.isArray(dataLayerTransition.conditions)) {
                        var conditionKeys = Object.keys(dataLayerTransition.conditions);
                        var conditions = [];
                        for (var j = 0; j < conditionKeys.length; j++) {
                            var condition = dataLayerTransition.conditions[conditionKeys[j]];
                            if (condition.parameterName) {
                                conditions.push(condition);
                            }
                        }
                        dataLayerTransition.conditions = conditions;
                    }
                    if (Number.isInteger(dataLayerTransition.from)) {
                        dataLayerTransition.from = data.states[dataLayerTransition.from].name;
                    }
                    if (Number.isInteger(dataLayerTransition.to)) {
                        dataLayerTransition.to = data.states[dataLayerTransition.to].name;
                    }
                    layer.transitions.push(dataLayerTransition);
                }
                this._layers.push(layer);
            }
        } else {
            // Layers as an array:
            // var data = {
            //     "layers": [
            //         {
            //             "name": "Base",
            //             "states": [
            //                 {
            //                     "name": "START",
            //                     "speed": 1
            //                 },
            //                 {
            //                     "name": "New State",
            //                     "speed": 1,
            //                     "loop": true,
            //                     "defaultState": true,
            //                 }
            //             ],
            //             "transitions": [
            //                 {
            //                     "from": 0,
            //                     "to": 1,
            //                     "conditions": {}
            //                 }
            //             ]
            //         }
            //     ],
            //     "parameters": {}
            // };
            this._layers = data.layers;
        }
        for (var paramId in data.parameters) {
            var param = data.parameters[paramId];
            this._parameters[param.name] = { type: param.type, value: param.value };
        }
    }

    get parameters() {
        return Object.assign({}, this._parameters);
    }

    get layers() {
        return this._layers;
    }
}

export { AnimStateGraph };
