// --------------- POST EFFECT DEFINITION --------------- //
/**
 * @class
 * @name GodRaysEffect
 * @classdesc Implements the GodRaysEffect post processing effect.
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {GraphicsDevice} graphicsDevice - The graphics device of the application.
 * @param {number} samples - The number of samples accumulated for ray distribution.
 */
function GodRaysEffect(graphicsDevice, samples) {
    pc.PostEffect.call(this, graphicsDevice);

    this.needsDepthBuffer = true;

    this.lightScatterShader = new pc.Shader(graphicsDevice, {
        attributes: {
            aPosition: pc.SEMANTIC_POSITION
        },
        vshader: [
            (graphicsDevice.webgl2) ? ("#version 300 es\n\n" + pc.shaderChunks.gles3VS) : "",
            "attribute vec2 aPosition;",
            "",
            "varying vec2 vUv0;",
            "",
            "void main(void)",
            "{",
            "    gl_Position = vec4(aPosition, 0.0, 1.0);",
            "    vUv0 = (aPosition.xy + 1.0) * 0.5;",
            "}"
        ].join("\n"),
        fshader: [
            (graphicsDevice.webgl2) ? ("#version 300 es\n\n" + pc.shaderChunks.gles3PS) : "",
            "precision " + graphicsDevice.precision + " float;",
            pc.shaderChunks.screenDepthPS,
            "",
            "varying vec2 vUv0;",
            "",
            "uniform sampler2D uColorBuffer;",
            "uniform float uAspect;",
            "uniform vec4 uLightPosition;",
            "uniform float uIntensity;",
            "uniform float uWeight;",
            "",
            "float sun( vec2 uv, vec2 p ){",
            "   float di = distance(uv, p) * uLightPosition.w;",
            "   return (di <= .3333 / uWeight ? sqrt(1. - di*3./ uWeight) : 0.);",
            "}",
            "",
            "void main()",
            "{",
            "    highp vec2 uv = vUv0; // variable_vertex.xy; // interpolated at pixel's center",
            "    vec2 coords = uv;",
            "",
            "    coords.x *= uAspect;",
            "    vec2 sunPos = uLightPosition.xy;",
            "    sunPos.x *= uAspect;",
            "    float light = sun(coords, sunPos);",
            "",
            "    float occluders = 1.0 - getLinearScreenDepth(uv) / camera_params.y;",
            "",
            "    float col = step(occluders, 0.0) * (light - occluders) * uIntensity;",
            "    gl_FragColor = vec4(col * uLightPosition.z,occluders,0.0,0.0);",
            "}"
        ].join("\n")
    });

    this.blurShader = new pc.Shader(graphicsDevice, {
        attributes: {
            aPosition: pc.SEMANTIC_POSITION
        },
        vshader: [
            (graphicsDevice.webgl2) ? ("#version 300 es\n\n" + pc.shaderChunks.gles3VS) : "",
            "attribute vec2 aPosition;",
            "",
            "varying vec2 vUv0;",
            "",
            "void main(void)",
            "{",
            "    gl_Position = vec4(aPosition, 0.0, 1.0);",
            "    vUv0 = (aPosition.xy + 1.0) * 0.5;",
            "}"
        ].join("\n"),
        fshader: [
            (graphicsDevice.webgl2) ? ("#version 300 es\n\n" + pc.shaderChunks.gles3PS) : "",
            "precision " + graphicsDevice.precision + " float;",
            pc.shaderChunks.screenDepthPS,
            "",
            "varying vec2 vUv0;",
            "",
            "uniform sampler2D uColorBuffer;",
            "uniform sampler2D uLightScatterBuffer;",
            "#define DITHER",
            "#define SAMPLES " + samples.toFixed(0),
            "#define DENSITY .95",
            "#define WEIGHT .25",
            "uniform vec4 uLightPosition;",
            "uniform float uWeight;",
            "uniform float uDecay;",
            "uniform float uExposure;",
            "uniform vec3 uColor;",
            "",
            "float random(const highp vec2 uv) {",
            "   const highp float a = 12.9898, b = 78.233, c = 43758.5453;",
            "   highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, 3.14159265359 );",
            "   return fract(sin(sn) * c);",
            "}",
            "",
            "void main() {",
            "    highp vec2 uv = vUv0; // variable_vertex.xy; // interpolated at pixel's center",
            "    vec2 coord = uv;        ",
            "    vec2 lightPos = uLightPosition.xy;",
            "",
            "    vec4 lightScatterSampler = texture2D(uLightScatterBuffer, uv);",
            "    float occ = lightScatterSampler.x; //light",
            "    float obj = lightScatterSampler.y; //objects",
            "    float dither = random(uv);",
            "",
            "    vec2 dtc = (coord - lightPos) * (1. / float(SAMPLES) * DENSITY);",
            "    float illumdecay = 1.;",
            "",
            "    for(int i=0; i<SAMPLES; i++){",
            "        coord -= dtc;",
            "        float s = texture2D(uLightScatterBuffer, coord+(dtc*dither)).x;",
            "        s *= illumdecay * WEIGHT;",
            "        occ += s;",
            "        illumdecay *= uDecay;",
            "    }",
            "",
            "    float rays = occ*uExposure *uLightPosition.z;",
            "    vec4 base = texture2D( uColorBuffer, vUv0 );",
            "",
            "    gl_FragColor = vec4(uColor * rays, 1.0) + (base * (1.5 - 0.4));",
            "}"
        ].join("\n")
    });

    // Render targets
    var width = graphicsDevice.width;
    var height = graphicsDevice.height;
    this.targets = [];
    for (var i = 0; i < 1; i++) {
        var colorBuffer = new pc.Texture(graphicsDevice, {
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            width: width,
            height: height,
            mipmaps: false
        });
        colorBuffer.minFilter = pc.FILTER_LINEAR;
        colorBuffer.magFilter = pc.FILTER_LINEAR;
        colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        colorBuffer.name = 'lightScatter_' + i;
        var target = new pc.RenderTarget(graphicsDevice, colorBuffer, { depth: false });

        this.targets.push(target);
    }

    // Uniforms
    this.cameraEntity = undefined;
    this.lightEntity = undefined;
    this.vec = new pc.Vec3();
    this.lightPosition = new pc.Vec4();
    this.intensity = 2.0;
    this.weight = 0.43;
    this.decay = 0.024;
    this.exposure = 0.3;
    this.color = new pc.Color(0.835, 0.812, 0.318, 1.0);
}

GodRaysEffect.prototype = Object.create(pc.PostEffect.prototype);
GodRaysEffect.prototype.constructor = GodRaysEffect;

Object.assign(GodRaysEffect.prototype, {
    render: function (inputTarget, outputTarget, rect) {

        var device = this.device;
        var scope = device.scope;

        // --- calculate screen position of light emitter
        if (this.lightEntity && this.cameraEntity) {
            var lightPos = this.lightEntity.getPosition();
            var vec = this.vec;

            var resolutionX = device.width / window.devicePixelRatio;
            var resolutionY = device.height / window.devicePixelRatio;

            this.cameraEntity.camera.worldToScreen(lightPos, vec);
            this.lightPosition.x = vec.x / resolutionX;
            this.lightPosition.y = 1.0 - vec.y / resolutionY;
            this.lightPosition.z = vec.z > 0 ? 1.0 : 0.0;
            this.lightPosition.w = window.devicePixelRatio;
        }

        scope.resolve("uLightPosition").setValue([this.lightPosition.x, this.lightPosition.y, this.lightPosition.z, this.lightPosition.w]);
        scope.resolve("uIntensity").setValue(this.intensity);
        scope.resolve("uWeight").setValue(this.weight);
        scope.resolve("uDecay").setValue(1.0 - this.decay);
        scope.resolve("uExposure").setValue(this.exposure);
        scope.resolve("uColor").setValue([this.color.r, this.color.g, this.color.b]);

        scope.resolve("uAspect").setValue(device.width / device.height);
        scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);

        pc.drawFullscreenQuad(device, this.targets[0], this.vertexBuffer, this.lightScatterShader, rect);

        scope.resolve("uLightScatterBuffer").setValue(this.targets[0].colorBuffer);

        pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.blurShader, rect);
    }
});

// ----------------- SCRIPT DEFINITION ------------------ //
var GodRays = pc.createScript('godrays');

GodRays.attributes.add('cameraEntity', {
    type: 'entity',
    title: 'Camera Entity'
});

GodRays.attributes.add('lightEntity', {
    type: 'entity',
    title: 'Light Emitter',
    description: 'Drag and drop any entity (not necessarily a light), its world position will be used to calculate the center of the effect on screen.'
});

GodRays.attributes.add('samples', {
    type: 'number',
    default: 32,
    precision: 1,
    title: 'Samples',
    description: 'The number of iterations executed for rays distribution.'
});

GodRays.attributes.add('intensity', {
    type: 'number',
    default: 1.5,
    min: 0.01,
    max: 3,
    title: 'Intensity',
    description: 'The intensity of the light accumulated in the center of the effect.'
});

GodRays.attributes.add('weight', {
    type: 'number',
    default: 0.3,
    min: 0.0,
    max: 1.0,
    title: 'Weight',
    description: 'Determines the outer rim of the light on the center of the effect.'
});

GodRays.attributes.add('decay', {
    type: 'number',
    default: 0.01,
    precision: 3,
    min: 0.0,
    max: 1,
    title: 'Decay',
    description: 'Determines how fast the rays will decay from the light source.'
});

GodRays.attributes.add('exposure', {
    type: 'number',
    default: 0.09,
    min: 0.0,
    max: 1,
    title: 'Exposure',
    description: 'A multiplier to increase exponentially the amount of light calculated.'
});

GodRays.attributes.add('color', {
    type: 'rgb',
    default: [0.835, 0.812, 0.318],
    title: 'Color',
    description: 'The color of the light source.'
});

GodRays.prototype.initialize = function () {
    if (!this.cameraEntity) return;

    var queue = this.cameraEntity.camera.postEffects;

    this.effect = this.createEffect();

    this.on('attr', function (name, value) {
        this.effect[name] = value;

        if (name === 'samples') {
            queue.removeEffect(this.effect);

            this.effect = this.createEffect();

            if (this.lightEntity.enabled) {
                queue.addEffect(this.effect);
            }
        }
    }, this);

    if (this.lightEntity.enabled) {
        queue.addEffect(this.effect);
    }

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

GodRays.prototype.createEffect = function () {

    var effect = new GodRaysEffect(this.app.graphicsDevice, this.samples);
    effect.cameraEntity = this.cameraEntity;
    effect.lightEntity = this.lightEntity;
    effect.intensity = this.intensity;
    effect.weight = this.weight;
    effect.decay = this.decay;
    effect.exposure = this.exposure;
    effect.color = this.color;

    return effect;
};
