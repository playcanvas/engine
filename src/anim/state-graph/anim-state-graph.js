/**
 * @typedef {object} AnimStateGraph_DataState
 * @property {string} name
 * @property {number} [speed]
 * @property {boolean} [loop]
 * @property {boolean} [defaultState]
 */

/**
 * @typedef {object} AnimStateGraph_DataTransitionCondition
 * @property {string} parameterName
 * @property {string} predicate
 */

/**
 * @typedef {object} AnimStateGraph_DataTransition
 * @property {string} from
 * @property {string} to
 * @property {number} [time]
 * @property {number} [priority]
 * @property {AnimStateGraph_DataTransitionCondition[]} [conditions]
 * @property {number} [exitTime]
 * @property {number} [transitionOffset]
 * @property {string} [interruptionSource]
 */

/**
 * @typedef {object} AnimStateGraph_DataParameter
 * @property {string} name
 * @property {string} type One of pc.ANIM_*
 * @property {any} value
 */

/**
 * @typedef {Object<string, AnimStateGraph_DataParameter>} AnimStateGraph_DataParameters
 */

// FROM OBJECT

/**
 * @typedef {object} AnimStateGraph_DataFromObjectLayer
 * @property {string} name
 * @property {number[] | AnimStateGraph_DataState[]} states
 * @property {number[] | AnimStateGraph_DataTransition} transitions
 */

/**
 * @typedef {object} AnimStateGraph_DataFromObject
 * @property {AnimStateGraph_DataFromObjectLayer[]} layers
 * @property {AnimStateGraph_DataState[]} states
 * @property {AnimStateGraph_DataTransition[]} transitions
 * @property {AnimStateGraph_DataParameters} parameters
 */

// FROM ARRAY:

/**
 * @typedef {object} AnimStateGraph_DataFromArrayLayer
 * @property {string} name
 * @property {AnimStateGraph_DataState[]} states
 * @property {AnimStateGraph_DataTransition[]} transitions
 */

/**
 * @typedef {object} AnimStateGraph_DataFromArray
 * @property {AnimStateGraph_DataFromArrayLayer[]} layers
 * @property {AnimStateGraph_DataParameters} parameters
 */

// GENERIC

/**
 * @typedef {AnimStateGraph_DataFromObject | AnimStateGraph_DataFromArray} AnimStateGraph_Data
 */

/**
 * @class
 * @name AnimStateGraph
 * @classdesc Creates an AnimStateGraph asset resource from a blob of JSON data that represents an anim state graph.
 * @param {AnimStateGraph_Data} data
 * @property {any} parameters
 * @property {any} layers
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
