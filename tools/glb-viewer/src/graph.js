var Graph = function (app, numSamples) {
    var positions = [];
    for (var i = 0; i < numSamples - 1; ++i) {
        positions[i * 2 + 0] = new pc.Vec3(0, 0, 0);
        positions[i * 2 + 1] = new pc.Vec3(0, 0, 0);
    }

    this.app = app;
    this.numSamples = numSamples;
    this.graphs = [];
    this.positions = positions;
    // this.app.on('prerender', this.render.bind(this));
};

Object.assign(Graph.prototype, {
    addGraph: function (node, color, callback) {
        this.graphs.push({
            node: node,
            color: color,
            callback: callback,
            samples: [],
            sample: 0,
            prevSample: 0,
            constantSamples: this.numSamples
        });
    },

    clear: function () {
        this.graphs = [];
    },

    update: function () {
        var graphs = this.graphs;
        var numSamples = this.numSamples;
        for (var i = 0; i < graphs.length; ++i) {
            var graph = graphs[i];
            var sample = graph.callback();

            if (graph.samples.length === 0) {
                // first sample, initialize everything
                for (var j = 0; j < this.numSamples; ++j) {
                    graph.samples.push(sample);
                }
                graph.prevSample = sample;
                graph.constantSamples = 512;
            } else {
                graph.samples[graph.sample] = sample;
                graph.sample++;
                if (graph.sample >= numSamples) {
                    graph.sample = 0;
                }

                if (sample === graph.prevSample) {
                    graph.constantSamples++;
                } else {
                    graph.constantSamples = 0;
                    graph.prevSample = sample;
                }
            }
        }
    },

    render: function () {
        var app = this.app;
        var camera = this.app.root.findByName('Camera');
        if (!camera) {
            return;
        }

        var graphs = this.graphs;
        var numSamples = this.numSamples;
        var positions = this.positions;
        var i, j;

        var right = new pc.Vec3();
        var up = new pc.Vec3();
        var sample;
        var pos;

        var options = {
            layer: app.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE),
            depthTest: false
        };

        for (i = 0; i < graphs.length; ++i) {
            var graph = graphs[i];
            if (graph.constantSamples < this.numSamples) {
                var idx = graph.sample + numSamples - 1 + numSamples;
                var base = (graph.node.parent || graph.node).getPosition();
                var dist = base.distance(camera.getPosition());
                right.copy(camera.right);
                right.scale(dist * 0.005);
                up.copy(camera.up);
                up.scale(dist * 0.05);

                for (j = 0; j < numSamples - 1; ++j) {

                    sample = graph.samples[(idx - j) % numSamples];
                    pos = positions[j * 2 + 0];
                    pos.x = base.x + right.x * j + up.x * sample;
                    pos.y = base.y + right.y * j + up.y * sample;
                    pos.z = base.z + right.z * j + up.z * sample;

                    sample = graph.samples[(idx - j - 1) % numSamples];
                    pos = positions[j * 2 + 1];
                    pos.x = base.x + right.x * (j + 1) + up.x * sample;
                    pos.y = base.y + right.y * (j + 1) + up.y * sample;
                    pos.z = base.z + right.z * (j + 1) + up.z * sample;
                }

                app.renderLines(positions, graph.color, options);
            }
        }
    }
});
