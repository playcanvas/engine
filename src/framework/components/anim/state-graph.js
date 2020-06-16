function AnimStateGraph(data) {
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
        this._parameters = Object.assign({}, data.parameters);
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
