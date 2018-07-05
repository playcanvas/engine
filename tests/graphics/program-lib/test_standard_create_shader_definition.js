module("createShaderDefinition", {
    setup: function () {
        this.app = new pc.Application(document.createElement("canvas"));

        // force device settings for consistent test results
        this.app.graphicsDevice.webgl2 = true;
        this.app.graphicsDevice.extBlendMinmax = true;
        this.app.graphicsDevice.extDrawBuffers = true;
        this.app.graphicsDevice.extInstancing = true;
        this.app.graphicsDevice.extStandardDerivatives = true;
        this.app.graphicsDevice.extTextureFloat = true;
        this.app.graphicsDevice.extTextureHalfFloat = true;
        this.app.graphicsDevice.extTextureHalfFloatLinear = true;
        this.app.graphicsDevice.extTextureLod = true;
        this.app.graphicsDevice.extUintElement = true;
    },

    teardown: function () {

    },

    loadJson: function (url) {
        return fetch(url).then(function (response) {
            return response.json();
        });
    },

    load: function (url) {
        return fetch(url).then(function (response) {
            return response.text();
        });
    },

});

function compare(result, expected) {
    var resultLines = result.trim().split('\n');
    var expectedLines = expected.trim().split('\n');

    for (var i = 0; i < expectedLines.length; i++) {
        if (resultLines[i].trim() === expectedLines[i].trim()) {
            continue;
        } else {
            console.table({
                result: result,
                expected: expected
            });
            equal(resultLines[i].trim(), expectedLines[i].trim(), "Compare line: " + (i+1));
            return;
        }
    }

    ok(true);
};

test("createShaderDefinition", function () {
    var options = {
        lights: []
    };

    var result = pc.programlib.standard.createShaderDefinition(this.app.graphicsDevice, options);

    stop();
    var self = this;
    this.load('./results/no-options.fs').then(function (expected) {
        start();
        compare(result.fshader, expected);
    });
});

test('Lit Model', function () {
    stop();

    var self = this;
    this.loadJson('./inputs/lit-model.json').then(function (options) {
        var result = pc.programlib.standard.createShaderDefinition(self.app.graphicsDevice, options);

        Promise.all([
            self.load('./results/lit-model.fs'),
            self.load('./results/lit-model.vs')
        ]).then(function (expected) {
            start();
            compare(result.fshader, expected[0]);
            compare(result.vshader, expected[1]);
        });
    });
});

test('Nine Sliced Sprite', function () {
    stop();

    var self = this;
    this.loadJson('./inputs/nine-sliced.json').then(function (options) {
        var result = pc.programlib.standard.createShaderDefinition(self.app.graphicsDevice, options);

        Promise.all([
            self.load('./results/nine-sliced.fs'),
            self.load('./results/nine-sliced.vs')
        ]).then(function (expected) {
            start();
            compare(result.fshader, expected[0]);
            compare(result.vshader, expected[1]);
        });
    });
});


test('Nine Sliced Tiled Sprite', function () {
    stop();

    var self = this;
    this.loadJson('./inputs/nine-sliced-tiled.json').then(function (options) {
        var result = pc.programlib.standard.createShaderDefinition(self.app.graphicsDevice, options);

        Promise.all([
            self.load('./results/nine-sliced-tiled.fs'),
            self.load('./results/nine-sliced-tiled.vs')
        ]).then(function (expected) {
            start();
            compare(result.fshader, expected[0]);
            compare(result.vshader, expected[1]);
        });
    });
});

test('Nine Sliced Sprite in Pick Pass', function () {
    var options = {
      "opacityTint": true,
      "alphaTest": true,
      "forceFragmentPrecision": null,
      "chunks": {},
      "blendType": 4,
      "forceUv1": false,
      "pass": pc.SHADER_PICK,
      "screenSpace": false,
      "skin": false,
      "useInstancing": false,
      "opacityMap": true,
      "opacityMapTransform": 0,
      "opacityMapChannel": "a",
      "opacityMapUv": 0,
      "lights": [],
      "glossMap": null,
      "specularMap": null
    };

    var result = pc.programlib.standard.createShaderDefinition(this.app.graphicsDevice, options);
    stop();
    this.load('./results/nine-sliced-pick-pass.fs').then(function (expected) {
        start();
        compare(result.fshader, expected);
    })
});
