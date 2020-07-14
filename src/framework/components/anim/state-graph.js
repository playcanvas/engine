function AnimStateGraph(data) {
    this._layers = [];
    this._parameters = {};
    var i;
    if (!Array.isArray(data.layers)) {
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
        this._layers = data.layers;
    }
    for (var paramId in data.parameters) {
        var param = data.parameters[paramId];
        this._parameters[param.name] = { type: param.type, value: param.value };
    }
}

Object.defineProperties(AnimStateGraph.prototype, {
    parameters: {
        get: function () {
            return Object.assign({}, this._parameters);
        }
    },
    layers: {
        get: function () {
            return this._layers;
        }
    }
});

export { AnimStateGraph };
