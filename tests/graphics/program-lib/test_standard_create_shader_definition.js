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
      "chunks": {
        "basePS": "\nuniform vec3 view_position;\nuniform vec3 light_globalAmbient;\nfloat square(float x) {\n    return x*x;\n}\nfloat saturate(float x) {\n    return clamp(x, 0.0, 1.0);\n}\nvec3 saturate(vec3 x) {\n    return clamp(x, vec3(0.0), vec3(1.0));\n}\nvarying vec2 vMask;\nvarying vec2 vTiledUv;\nuniform vec4 innerOffset;\nuniform vec2 outerScale;\nuniform vec4 atlasRect;\nvec2 nineSlicedUv;",
        "startPS": "\nvoid main(void) {\n    dDiffuseLight = vec3(0);\n    dSpecularLight = vec3(0);\n    dReflection = vec4(0);\n    dSpecularity = vec3(0);\nnineSlicedUv = vUv0;\n",
        "emissivePS": "#ifdef MAPCOLOR\nuniform vec3 material_emissive;\n#endif\n#ifdef MAPFLOAT\nuniform float material_emissiveIntensity;\n#endif\n#ifdef MAPTEXTURE\nuniform sampler2D texture_emissiveMap;\n#endif\nvec3 getEmission() {\n    vec3 emission = vec3(1.0);\n    #ifdef MAPFLOAT\n        emission *= material_emissiveIntensity;\n    #endif\n    #ifdef MAPCOLOR\n        emission *= material_emissive;\n    #endif\n    #ifdef MAPTEXTURE\n        emission *= $texture2DSAMPLE(texture_emissiveMap, nineSlicedUv).$CH;\n    #endif\n    #ifdef MAPVERTEX\n        emission *= gammaCorrectInput(saturate(vVertexColor.$VC));\n    #endif\n    return emission;\n}\n",
        "opacityPS": "#ifdef MAPFLOAT\nuniform float material_opacity;\n#endif\n#ifdef MAPTEXTURE\nuniform sampler2D texture_opacityMap;\n#endif\nvoid getOpacity() {\n    dAlpha = 1.0;\n    #ifdef MAPFLOAT\n        dAlpha *= material_opacity;\n    #endif\n    #ifdef MAPTEXTURE\n        dAlpha *= texture2D(texture_opacityMap, nineSlicedUv).$CH;\n    #endif\n    #ifdef MAPVERTEX\n        dAlpha *= saturate(vVertexColor.$VC);\n    #endif\n}\n",
        "transformVS": "#define NINESLICED\n#ifdef PIXELSNAP\n    uniform vec4 uScreenSize;\n#endif\n#ifdef NINESLICED\n    #ifndef NINESLICE\n    #define NINESLICE\n    uniform vec4 innerOffset;\n    uniform vec2 outerScale;\n    uniform vec4 atlasRect;\n    varying vec2 vTiledUv;\n    #endif\n#endif\nmat4 getModelMatrix() {\n    #ifdef DYNAMICBATCH\n        return getBoneMatrix(vertex_boneIndices);\n    #elif defined(SKIN)\n        return matrix_model * (getBoneMatrix(vertex_boneIndices.x) * vertex_boneWeights.x +\n               getBoneMatrix(vertex_boneIndices.y) * vertex_boneWeights.y +\n               getBoneMatrix(vertex_boneIndices.z) * vertex_boneWeights.z +\n               getBoneMatrix(vertex_boneIndices.w) * vertex_boneWeights.w);\n    #elif defined(INSTANCING)\n        return mat4(instance_line1, instance_line2, instance_line3, instance_line4);\n    #else\n        return matrix_model;\n    #endif\n}\nvec4 getPosition() {\n    dModelMatrix = getModelMatrix();\n    vec3 localPos = vertex_position;\n    #ifdef NINESLICED\n        // outer and inner vertices are at the same position, scale both\n        localPos.xz *= outerScale;\n        // offset inner vertices inside\n        // (original vertices must be in [-1;1] range)\n        vec2 positiveUnitOffset = clamp(vertex_position.xz, vec2(0.0), vec2(1.0));\n        vec2 negativeUnitOffset = clamp(-vertex_position.xz, vec2(0.0), vec2(1.0));\n        localPos.xz += (-positiveUnitOffset * innerOffset.xy + negativeUnitOffset * innerOffset.zw) * vertex_texCoord0.xy;\n        vTiledUv = (localPos.xz - outerScale + innerOffset.xy) * -0.5 + 1.0; // uv = local pos - inner corner\n        localPos.xz *= -0.5; // move from -1;1 to -0.5;0.5\n        localPos = localPos.xzy;\n    #endif\n    vec4 posW = dModelMatrix * vec4(localPos, 1.0);\n    #ifdef SCREENSPACE\n        posW.zw = vec2(0.0, 1.0);\n    #endif\n    dPositionW = posW.xyz;\n    vec4 screenPos;\n    #ifdef UV1LAYOUT\n        screenPos = vec4(vertex_texCoord1.xy * 2.0 - 1.0, 0.5, 1);\n    #else\n        #ifdef SCREENSPACE\n            screenPos = posW;\n        #else\n            screenPos = matrix_viewProjection * posW;\n        #endif\n        #ifdef PIXELSNAP\n            // snap vertex to a pixel boundary\n            screenPos.xy = (screenPos.xy * 0.5) + 0.5;\n            screenPos.xy *= uScreenSize.xy;\n            screenPos.xy = floor(screenPos.xy);\n            screenPos.xy *= uScreenSize.zw;\n            screenPos.xy = (screenPos.xy * 2.0) - 1.0;\n        #endif\n    #endif\n    return screenPos;\n}\nvec3 getWorldPosition() {\n    return dPositionW;\n}\n",
        "uv0VS": "#ifndef NINESLICE\n#define NINESLICE\nuniform vec4 innerOffset;\nuniform vec2 outerScale;\nuniform vec4 atlasRect;\nvarying vec2 vTiledUv;\n#endif\nvarying vec2 vMask;\nvec2 getUv0() {\n    vec2 uv = vertex_position.xz;\n    // offset inner vertices inside\n    // (original vertices must be in [-1;1] range)\n    vec2 positiveUnitOffset = clamp(vertex_position.xz, vec2(0.0), vec2(1.0));\n    vec2 negativeUnitOffset = clamp(-vertex_position.xz, vec2(0.0), vec2(1.0));\n    uv += (-positiveUnitOffset * innerOffset.xy + negativeUnitOffset * innerOffset.zw) * vertex_texCoord0.xy;\n    uv = uv * -0.5 + 0.5;\n    uv = uv * atlasRect.zw + atlasRect.xy;\n    vMask = vertex_texCoord0.xy;\n    return uv;\n}\n"
      },
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
      "lights": []
    };

    var result = pc.programlib.standard.createShaderDefinition(this.app.graphicsDevice, options);
    stop();
    this.load('./results/nine-sliced-pick-pass.fs').then(function (expected) {
        start();
        compare(result.fshader, expected);
    })
});
