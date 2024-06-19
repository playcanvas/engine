/**
 * An asset resource which represents an anim state graph. It can be loaded into an anim component using the {@link AnimComponent#loadStateGraph} method.
 *
 * ## Usage
 * Scripts can retrieve an AnimStateGraph instance from assets of type 'animstategraph'. An AnimStateGraph can then be loaded into an anim component as follows:
 * ```javascript
 * const animStateGraph = app.assets.get(ASSET_ID).resource;
 * const entity = new pc.Entity();
 * entity.addComponent('anim');
 * entity.anim.loadStateGraph(animStateGraph);
 * ```
 *
 * @category Animation
 */
class AnimStateGraph {
    /**
     * Create an AnimStateGraph instance from JSON data.
     *
     * @param {object} data - The JSON data to create the AnimStateGraph from.
     * @ignore
     */
    constructor(data) {
        this._layers = [];
        this._parameters = {};
        if (!Array.isArray(data.layers)) {
            // Layers as an object
            // const data = {
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
            for (const layerId in data.layers) {
                const dataLayer = data.layers[layerId];
                const layer = {
                    name: dataLayer.name,
                    blendType: dataLayer.blendType,
                    weight: dataLayer.weight,
                    states: [],
                    transitions: []
                };
                for (let i = 0; i < dataLayer.states.length; i++) {
                    layer.states.push(data.states[dataLayer.states[i]]);
                }
                for (let i = 0; i < dataLayer.transitions.length; i++) {
                    const dataLayerTransition = data.transitions[dataLayer.transitions[i]];
                    if (dataLayerTransition.conditions && !Array.isArray(dataLayerTransition.conditions)) {
                        const conditionKeys = Object.keys(dataLayerTransition.conditions);
                        const conditions = [];
                        for (let j = 0; j < conditionKeys.length; j++) {
                            const condition = dataLayerTransition.conditions[conditionKeys[j]];
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
            // const data = {
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
        for (const paramId in data.parameters) {
            const param = data.parameters[paramId];
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
