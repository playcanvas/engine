Object.assign(pc, function () {

    var AnimStateGraph = function (data) {
        this._layers = [];
        this._parameters = {};
        if (data) {
            if (data.states) {
                this._layers = [];
                this._layers.push({
                    name: 'DEFAULT_LAYER',
                    states: data.states,
                    transitions: data.transitions
                });
            } else {
                this._layers = data.layers;
            }
            this._parameters = {};
            for (var paramId in data.parameters) {
                var param = data.parameters[paramId];
                this._parameters[param.name] = { type: param.type, value: param.value };
            }
        }
    };

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

    return {
        AnimStateGraph: AnimStateGraph
    };
}());
