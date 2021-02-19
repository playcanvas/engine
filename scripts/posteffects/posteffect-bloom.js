// --------------- POST EFFECT DEFINITION --------------- //
var SAMPLE_COUNT = 15;

function computeGaussian(n, theta) {
    return ((1.0 / Math.sqrt(2 * Math.PI * theta)) * Math.exp(-(n * n) / (2 * theta * theta)));
}

function calculateBlurValues(sampleWeights, sampleOffsets, dx, dy, blurAmount) {
    // Look up how many samples our gaussian blur effect supports.

    // Create temporary arrays for computing our filter settings.
    // The first sample always has a zero offset.
    sampleWeights[0] = computeGaussian(0, blurAmount);
    sampleOffsets[0] = 0;
    sampleOffsets[1] = 0;

    // Maintain a sum of all the weighting values.
    var totalWeights = sampleWeights[0];

    // Add pairs of additional sample taps, positioned
    // along a line in both directions from the center.
    var i, len;
    for (i = 0, len = Math.floor(SAMPLE_COUNT / 2); i < len; i++) {
        // Store weights for the positive and negative taps.
        var weight = computeGaussian(i + 1, blurAmount);
        sampleWeights[i * 2] = weight;
        sampleWeights[i * 2 + 1] = weight;
        totalWeights += weight * 2;

        // To get the maximum amount of blurring from a limited number of
        // pixel shader samples, we take advantage of the bilinear filtering
        // hardware inside the texture fetch unit. If we position our texture
        // coordinates exactly halfway between two texels, the filtering unit
        // will average them for us, giving two samples for the price of one.
        // This allows us to step in units of two texels per sample, rather
        // than just one at a time. The 1.5 offset kicks things off by
        // positioning us nicely in between two texels.
        var sampleOffset = i * 2 + 1.5;

        // Store texture coordinate offsets for the positive and negative taps.
        sampleOffsets[i * 4] = dx * sampleOffset;
        sampleOffsets[i * 4 + 1] = dy * sampleOffset;
        sampleOffsets[i * 4 + 2] = -dx * sampleOffset;
        sampleOffsets[i * 4 + 3] = -dy * sampleOffset;
    }

    // Normalize the list of sample weightings, so they will always sum to one.
    for (i = 0, len = sampleWeights.length; i < len; i++) {
        sampleWeights[i] /= totalWeights;
    }
}

/**
 * @class
 * @name BloomEffect
 * @classdesc Implements the BloomEffect post processing effect.
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {GraphicsDevice} graphicsDevice - The graphics device of the application.
 * @property {number} bloomThreshold Only pixels brighter then this threshold will be processed. Ranges from 0 to 1.
 * @property {number} blurAmount Controls the amount of blurring.
 * @property {number} bloomIntensity The intensity of the effect.
 */
function BloomEffect(graphicsDevice) {
    pc.PostEffect.call(this, graphicsDevice);

    // Shaders
    var attributes = {
        aPosition: pc.SEMANTIC_POSITION
    };

    var passThroughVert = [
        "attribute vec2 aPosition;",
        "",
        "varying vec2 vUv0;",
        "",
        "void main(void)",
        "{",
        "    gl_Position = vec4(aPosition, 0.0, 1.0);",
        "    vUv0 = (aPosition + 1.0) * 0.5;",
        "}"
    ].join("\n");

    // Pixel shader extracts the brighter areas of an image.
    // This is the first step in applying a bloom postprocess.
    var bloomExtractFrag = [
        "precision " + graphicsDevice.precision + " float;",
        "",
        "varying vec2 vUv0;",
        "",
        "uniform sampler2D uBaseTexture;",
        "uniform float uBloomThreshold;",
        "",
        "void main(void)",
        "{",
                // Look up the original image color.
        "    vec4 color = texture2D(uBaseTexture, vUv0);",
        "",
                // Adjust it to keep only values brighter than the specified threshold.
        "    gl_FragColor = clamp((color - uBloomThreshold) / (1.0 - uBloomThreshold), 0.0, 1.0);",
        "}"
    ].join("\n");

    // Pixel shader applies a one dimensional gaussian blur filter.
    // This is used twice by the bloom postprocess, first to
    // blur horizontally, and then again to blur vertically.
    var gaussianBlurFrag = [
        "precision " + graphicsDevice.precision + " float;",
        "",
        "#define SAMPLE_COUNT " + SAMPLE_COUNT,
        "",
        "varying vec2 vUv0;",
        "",
        "uniform sampler2D uBloomTexture;",
        "uniform vec2 uBlurOffsets[SAMPLE_COUNT];",
        "uniform float uBlurWeights[SAMPLE_COUNT];",
        "",
        "void main(void)",
        "{",
        "    vec4 color = vec4(0.0);",
                // Combine a number of weighted image filter taps.
        "    for (int i = 0; i < SAMPLE_COUNT; i++)",
        "    {",
        "        color += texture2D(uBloomTexture, vUv0 + uBlurOffsets[i]) * uBlurWeights[i];",
        "    }",
        "",
        "    gl_FragColor = color;",
        "}"
    ].join("\n");

    // Pixel shader combines the bloom image with the original
    // scene, using tweakable intensity levels.
    // This is the final step in applying a bloom postprocess.
    var bloomCombineFrag = [
        "precision " + graphicsDevice.precision + " float;",
        "",
        "varying vec2 vUv0;",
        "",
        "uniform float uBloomEffectIntensity;",
        "uniform sampler2D uBaseTexture;",
        "uniform sampler2D uBloomTexture;",
        "",
        "void main(void)",
        "{",
                // Look up the bloom and original base image colors.
        "    vec4 bloom = texture2D(uBloomTexture, vUv0) * uBloomEffectIntensity;",
        "    vec4 base = texture2D(uBaseTexture, vUv0);",
        "",
                // Darken down the base image in areas where there is a lot of bloom,
                // to prevent things looking excessively burned-out.
        "    base *= (1.0 - clamp(bloom, 0.0, 1.0));",
        "",
                // Combine the two images.
        "    gl_FragColor = base + bloom;",
        "}"
    ].join("\n");

    this.extractShader = new pc.Shader(graphicsDevice, {
        attributes: attributes,
        vshader: passThroughVert,
        fshader: bloomExtractFrag
    });
    this.blurShader = new pc.Shader(graphicsDevice, {
        attributes: attributes,
        vshader: passThroughVert,
        fshader: gaussianBlurFrag
    });
    this.combineShader = new pc.Shader(graphicsDevice, {
        attributes: attributes,
        vshader: passThroughVert,
        fshader: bloomCombineFrag
    });

    // Render targets
    var width = graphicsDevice.width;
    var height = graphicsDevice.height;
    this.targets = [];
    for (var i = 0; i < 2; i++) {
        var colorBuffer = new pc.Texture(graphicsDevice, {
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            width: width >> 1,
            height: height >> 1,
            mipmaps: false
        });
        colorBuffer.minFilter = pc.FILTER_LINEAR;
        colorBuffer.magFilter = pc.FILTER_LINEAR;
        colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        colorBuffer.name = 'pe-bloom';
        var target = new pc.RenderTarget(graphicsDevice, colorBuffer, { depth: false });

        this.targets.push(target);
    }

    // Effect defaults
    this.bloomThreshold = 0.25;
    this.blurAmount = 4;
    this.bloomIntensity = 1.25;

    // Uniforms
    this.sampleWeights = new Float32Array(SAMPLE_COUNT);
    this.sampleOffsets = new Float32Array(SAMPLE_COUNT * 2);
}

BloomEffect.prototype = Object.create(pc.PostEffect.prototype);
BloomEffect.prototype.constructor = BloomEffect;

Object.assign(BloomEffect.prototype, {
    render: function (inputTarget, outputTarget, rect) {
        var device = this.device;
        var scope = device.scope;

        // Pass 1: draw the scene into rendertarget 1, using a
        // shader that extracts only the brightest parts of the image.
        scope.resolve("uBloomThreshold").setValue(this.bloomThreshold);
        scope.resolve("uBaseTexture").setValue(inputTarget.colorBuffer);
        pc.drawFullscreenQuad(device, this.targets[0], this.vertexBuffer, this.extractShader);

        // Pass 2: draw from rendertarget 1 into rendertarget 2,
        // using a shader to apply a horizontal gaussian blur filter.
        calculateBlurValues(this.sampleWeights, this.sampleOffsets, 1.0 / this.targets[1].width, 0, this.blurAmount);
        scope.resolve("uBlurWeights[0]").setValue(this.sampleWeights);
        scope.resolve("uBlurOffsets[0]").setValue(this.sampleOffsets);
        scope.resolve("uBloomTexture").setValue(this.targets[0].colorBuffer);
        pc.drawFullscreenQuad(device, this.targets[1], this.vertexBuffer, this.blurShader);

        // Pass 3: draw from rendertarget 2 back into rendertarget 1,
        // using a shader to apply a vertical gaussian blur filter.
        calculateBlurValues(this.sampleWeights, this.sampleOffsets, 0, 1.0 / this.targets[0].height, this.blurAmount);
        scope.resolve("uBlurWeights[0]").setValue(this.sampleWeights);
        scope.resolve("uBlurOffsets[0]").setValue(this.sampleOffsets);
        scope.resolve("uBloomTexture").setValue(this.targets[1].colorBuffer);
        pc.drawFullscreenQuad(device, this.targets[0], this.vertexBuffer, this.blurShader);

        // Pass 4: draw both rendertarget 1 and the original scene
        // image back into the main backbuffer, using a shader that
        // combines them to produce the final bloomed result.
        scope.resolve("uBloomEffectIntensity").setValue(this.bloomIntensity);
        scope.resolve("uBloomTexture").setValue(this.targets[0].colorBuffer);
        scope.resolve("uBaseTexture").setValue(inputTarget.colorBuffer);
        pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.combineShader, rect);
    }
});

// ----------------- SCRIPT DEFINITION ------------------ //
var Bloom = pc.createScript('bloom');

Bloom.attributes.add('bloomIntensity', {
    type: 'number',
    default: 1,
    min: 0,
    title: 'Intensity'
});

Bloom.attributes.add('bloomThreshold', {
    type: 'number',
    default: 0.25,
    min: 0,
    max: 1,
    title: 'Threshold'
});

Bloom.attributes.add('blurAmount', {
    type: 'number',
    default: 4,
    min: 1,
    'title': 'Blur amount'
});

Bloom.prototype.initialize = function () {
    this.effect = new BloomEffect(this.app.graphicsDevice);

    this.effect.bloomThreshold = this.bloomThreshold;
    this.effect.blurAmount = this.blurAmount;
    this.effect.bloomIntensity = this.bloomIntensity;

    var queue = this.entity.camera.postEffects;

    queue.addEffect(this.effect);

    this.on('attr', function (name, value) {
        this.effect[name] = value;
    }, this);

    this.on('state', function (enabled) {
        if (enabled) {
            queue.addEffect(this.effect);
        } else {
            queue.removeEffect(this.effect);
        }
    });

    this.on('destroy', function () {
        queue.removeEffect(this.effect);
    });
};
