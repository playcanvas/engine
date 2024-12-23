// The implementation is based on the code in Filament Engine: https://github.com/google/filament
// specifically, shaders here: https://github.com/google/filament/tree/24b88219fa6148b8004f230b377f163e6f184d65/filament/src/materials/ssao

// --------------- POST EFFECT DEFINITION --------------- //
/**
 * @class
 * @name SSAOEffect
 * @classdesc Implements the SSAOEffect post processing effect.
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {GraphicsDevice} graphicsDevice - The graphics device of the application.
 * @param {any} ssaoScript - The script using the effect.
 */
function SSAOEffect(graphicsDevice, ssaoScript) {
    pc.PostEffect.call(this, graphicsDevice);

    this.ssaoScript = ssaoScript;
    this.needsDepthBuffer = true;

    var fSsao = [
        pc.shaderChunks.screenDepthPS,
        '',
        'varying vec2 vUv0;',
        '',
        '//uniform sampler2D uColorBuffer;',
        'uniform vec4 uResolution;',
        '',
        'uniform float uAspect;',
        '',
        '#define saturate(x) clamp(x,0.0,1.0)',
        '',
        '// Largely based on \'Dominant Light Shadowing\'',
        '// \'Lighting Technology of The Last of Us Part II\' by Hawar Doghramachi, Naughty Dog, LLC',
        '',
        'const float kSSCTLog2LodRate = 3.0;',
        '',
        'highp float getWFromProjectionMatrix(const mat4 p, const vec3 v) {',
        '    // this essentially returns (p * vec4(v, 1.0)).w, but we make some assumptions',
        '    // this assumes a perspective projection',
        '    return -v.z;',
        '    // this assumes a perspective or ortho projection',
        '    // return p[2][3] * v.z + p[3][3];',
        '}',
        '',
        'highp float getViewSpaceZFromW(const mat4 p, const float w) {',
        '    // this assumes a perspective projection',
        '    return -w;',
        '    // this assumes a perspective or ortho projection',
        '   // return (w - p[3][3]) / p[2][3];',
        '}',
        '',
        '',
        'const float kLog2LodRate = 3.0;',
        '',
        'vec2 sq(const vec2 a) {',
        '    return a * a;',
        '}',
        '',
        'uniform float uInvFarPlane;',
        '',
        'vec2 pack(highp float depth) {',
        '// we need 16-bits of precision',
        '    highp float z = clamp(depth * uInvFarPlane, 0.0, 1.0);',
        '    highp float t = floor(256.0 * z);',
        '    mediump float hi = t * (1.0 / 256.0);   // we only need 8-bits of precision',
        '    mediump float lo = (256.0 * z) - t;     // we only need 8-bits of precision',
        '    return vec2(hi, lo);',
        '}',
        '',
        '// random number between 0 and 1, using interleaved gradient noise',
        'float random(const highp vec2 w) {',
        '    const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);',
        '    return fract(m.z * fract(dot(w, m.xy)));',
        '}',
        '',
        '// returns the frag coord in the GL convention with (0, 0) at the bottom-left',
        'highp vec2 getFragCoord() {',
        '    return gl_FragCoord.xy;',
        '}',
        '',
        'highp vec3 computeViewSpacePositionFromDepth(highp vec2 uv, highp float linearDepth) {',
        '    return vec3((0.5 - uv) * vec2(uAspect, 1.0) * linearDepth, linearDepth);',
        '}',
        '',
        'highp vec3 faceNormal(highp vec3 dpdx, highp vec3 dpdy) {',
        '    return normalize(cross(dpdx, dpdy));',
        '}',
        '',
        '// Compute normals using derivatives, which essentially results in half-resolution normals',
        '// this creates arifacts around geometry edges.',
        '// Note: when using the spirv optimizer, this results in much slower execution time because',
        '//       this whole expression is inlined in the AO loop below.',
        'highp vec3 computeViewSpaceNormal(const highp vec3 position) {',
        '    return faceNormal(dFdx(position), dFdy(position));',
        '}',
        '',
        '// Compute normals directly from the depth texture, resulting in full resolution normals',
        '// Note: This is actually as cheap as using derivatives because the texture fetches',
        '//       are essentially equivalent to textureGather (which we don\'t have on ES3.0),',
        '//       and this is executed just once.',
        'highp vec3 computeViewSpaceNormal(const highp vec3 position, const highp vec2 uv) {',
        '    highp vec2 uvdx = uv + vec2(uResolution.z, 0.0);',
        '    highp vec2 uvdy = uv + vec2(0.0, uResolution.w);',
        '    highp vec3 px = computeViewSpacePositionFromDepth(uvdx, -getLinearScreenDepth(uvdx));',
        '    highp vec3 py = computeViewSpacePositionFromDepth(uvdy, -getLinearScreenDepth(uvdy));',
        '    highp vec3 dpdx = px - position;',
        '    highp vec3 dpdy = py - position;',
        '    return faceNormal(dpdx, dpdy);',
        '}',
        '',
        '// Ambient Occlusion, largely inspired from:',
        '// \'The Alchemy Screen-Space Ambient Obscurance Algorithm\' by Morgan McGuire',
        '// \'Scalable Ambient Obscurance\' by Morgan McGuire, Michael Mara and David Luebke',
        '',
        'uniform vec2 uSampleCount;',
        'uniform float uSpiralTurns;',
        '',
        '#define PI (3.14159)',
        '',
        'vec3 tapLocation(float i, const float noise) {',
        '    float offset = ((2.0 * PI) * 2.4) * noise;',
        '    float angle = ((i * uSampleCount.y) * uSpiralTurns) * (2.0 * PI) + offset;',
        '    float radius = (i + noise + 0.5) * uSampleCount.y;',
        '    return vec3(cos(angle), sin(angle), radius * radius);',
        '}',
        '',
        'highp vec2 startPosition(const float noise) {',
        '    float angle = ((2.0 * PI) * 2.4) * noise;',
        '    return vec2(cos(angle), sin(angle));',
        '}',
        '',
        'uniform vec2 uAngleIncCosSin;',
        '',
        'highp mat2 tapAngleStep() {',
        '    highp vec2 t = uAngleIncCosSin;',
        '    return mat2(t.x, t.y, -t.y, t.x);',
        '}',
        '',
        'vec3 tapLocationFast(float i, vec2 p, const float noise) {',
        '    float radius = (i + noise + 0.5) * uSampleCount.y;',
        '    return vec3(p, radius * radius);',
        '}',
        '',
        'uniform float uMaxLevel;',
        'uniform float uInvRadiusSquared;',
        'uniform float uMinHorizonAngleSineSquared;',
        'uniform float uBias;',
        'uniform float uPeak2;',
        '',
        'void computeAmbientOcclusionSAO(inout float occlusion, float i, float ssDiskRadius,',
        '        const highp vec2 uv,  const highp vec3 origin, const vec3 normal,',
        '        const vec2 tapPosition, const float noise) {',
        '',
        '    vec3 tap = tapLocationFast(i, tapPosition, noise);',
        '',
        '    float ssRadius = max(1.0, tap.z * ssDiskRadius);', // at least 1 pixel screen-space radius
        '',
        '    vec2 uvSamplePos = uv + vec2(ssRadius * tap.xy) * uResolution.zw;',
        '',
        '    float level = clamp(floor(log2(ssRadius)) - kLog2LodRate, 0.0, float(uMaxLevel));',
        '    highp float occlusionDepth = -getLinearScreenDepth(uvSamplePos);',
        '    highp vec3 p = computeViewSpacePositionFromDepth(uvSamplePos, occlusionDepth);',
        '',
        '    // now we have the sample, compute AO',
        '    vec3 v = p - origin;        // sample vector',
        '    float vv = dot(v, v);       // squared distance',
        '    float vn = dot(v, normal);  // distance * cos(v, normal)',
        '',
        '    // discard samples that are outside of the radius, preventing distant geometry to',
        '    // cast shadows -- there are many functions that work and choosing one is an artistic',
        '    // decision.',
        '    float w = max(0.0, 1.0 - vv * uInvRadiusSquared);',
        '    w = w*w;',
        '',
        '    // discard samples that are too close to the horizon to reduce shadows cast by geometry',
        '    // not sufficiently tessellated. The goal is to discard samples that form an angle \'beta\'',
        '    // smaller than \'epsilon\' with the horizon. We already have dot(v,n) which is equal to the',
        '    // sin(beta) * |v|. So the test simplifies to vn^2 < vv * sin(epsilon)^2.',
        '    w *= step(vv * uMinHorizonAngleSineSquared, vn * vn);',
        '',
        '    occlusion += w * max(0.0, vn + origin.z * uBias) / (vv + uPeak2);',
        '}',
        '',
        'uniform float uProjectionScaleRadius;',
        'uniform float uIntensity;',
        '',
        'float scalableAmbientObscurance(highp vec2 uv, highp vec3 origin, vec3 normal) {',
        '    float noise = random(getFragCoord());',
        '    highp vec2 tapPosition = startPosition(noise);',
        '    highp mat2 angleStep = tapAngleStep();',
        '',
        '    // Choose the screen-space sample radius',
        '    // proportional to the projected area of the sphere',
        '    float ssDiskRadius = -(uProjectionScaleRadius / origin.z);',
        '',
        '    float occlusion = 0.0;',
        '    for (float i = 0.0; i < uSampleCount.x; i += 1.0) {',
        '        computeAmbientOcclusionSAO(occlusion, i, ssDiskRadius, uv, origin, normal, tapPosition, noise);',
        '        tapPosition = angleStep * tapPosition;',
        '    }',
        '    return sqrt(occlusion * uIntensity);',
        '}',
        '',
        'uniform float uPower;',
        '',
        'void main() {',
        '    highp vec2 uv = vUv0; //variable_vertex.xy; // interpolated to pixel center',
        '',
        '    highp float depth = -getLinearScreenDepth(vUv0);',
        '    highp vec3 origin = computeViewSpacePositionFromDepth(uv, depth);',
        '    vec3 normal = computeViewSpaceNormal(origin, uv);',
        '',
        '    float occlusion = 0.0;',
        '',
        '    if (uIntensity > 0.0) {',
        '        occlusion = scalableAmbientObscurance(uv, origin, normal);',
        '    }',
        '',
        '    // occlusion to visibility',
        '    float aoVisibility = pow(saturate(1.0 - occlusion), uPower);',
        '',
        '    vec4 inCol = vec4(1.0, 1.0, 1.0, 1.0); //texture2D( uColorBuffer,  uv );',
        '',
        '    gl_FragColor.r = aoVisibility; //postProcess.color.rgb = vec3(aoVisibility, pack(origin.z));',
        '}',
        '',
        'void main_old()',
        '{',
        '    vec2 aspectCorrect = vec2( 1.0, uAspect );',
        '',
        '    float depth = getLinearScreenDepth(vUv0);',
        '    gl_FragColor.r = fract(floor(depth*256.0*256.0)),fract(floor(depth*256.0)),fract(depth);',
        '}'
    ].join('\n');

    var fblur = [
        pc.shaderChunks.screenDepthPS,
        '',
        'varying vec2 vUv0;',
        '',
        'uniform sampler2D uSSAOBuffer;',
        'uniform vec4 uResolution;',
        '',
        'uniform float uAspect;',
        '',
        'uniform int uBilatSampleCount;',
        'uniform float uFarPlaneOverEdgeDistance;',
        'uniform float uBrightness;',
        '',
        'float random(const highp vec2 w) {',
        '    const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);',
        '    return fract(m.z * fract(dot(w, m.xy)));',
        '}',
        '',
        'float bilateralWeight(in float depth, in float sampleDepth) {',
        '    float diff = (sampleDepth - depth) * uFarPlaneOverEdgeDistance;',
        '    return max(0.0, 1.0 - diff * diff);',
        '}',
        '',
        'void tap(inout float sum, inout float totalWeight, float weight, float depth, vec2 position) {',
        '    // ambient occlusion sample',
        '    float ssao = texture2D( uSSAOBuffer, position ).r;',
        '    float tdepth = -getLinearScreenDepth( position );',
        '',
        '    // bilateral sample',
        '    float bilateral = bilateralWeight(depth, tdepth);',

        '    bilateral *= weight;',
        '    sum += ssao * bilateral;',
        '    totalWeight += bilateral;',
        '}',
        '',
        'void main() {',
        '    highp vec2 uv = vUv0; // variable_vertex.xy; // interpolated at pixel\'s center',
        '',
        '    // we handle the center pixel separately because it doesn\'t participate in bilateral filtering',
        '    float depth = -getLinearScreenDepth(vUv0); // unpack(data.gb);',
        '    float totalWeight = 0.0; // float(uBilatSampleCount*2+1)*float(uBilatSampleCount*2+1);',
        '    float ssao = texture2D( uSSAOBuffer, vUv0 ).r;',
        '    float sum = ssao * totalWeight;',
        '',
        '    for (int x = -uBilatSampleCount; x <= uBilatSampleCount; x++) {',
        '       for (int y = -uBilatSampleCount; y < uBilatSampleCount; y++) {',
        '           float weight = 1.0;',
        '           vec2 offset = vec2(x,y)*uResolution.zw;',
        '           tap(sum, totalWeight, weight, depth, uv + offset);',
        '       }',
        '    }',
        '',
        '    float ao = sum / totalWeight;',
        '',
        '    // simple dithering helps a lot (assumes 8 bits target)',
        '    // this is most useful with high quality/large blurs',
        '    // ao += ((random(gl_FragCoord.xy) - 0.5) / 255.0);',
        '',
        '    ao = mix(ao, 1.0, uBrightness);',
        '    gl_FragColor.a = ao;',
        '}'
    ].join('\n');

    var foutput = [
        'varying vec2 vUv0;',
        'uniform sampler2D uColorBuffer;',
        'uniform sampler2D uSSAOBuffer;',
        '',
        'void main(void)',
        '{',
        '    vec4 inCol = texture2D( uColorBuffer, vUv0 );',
        '    float ssao = texture2D( uSSAOBuffer, vUv0 ).a;',
        '    gl_FragColor.rgb = inCol.rgb * ssao;',
        '    gl_FragColor.a = inCol.a;',
        '}'
    ].join('\n');

    var attributes = {
        aPosition: pc.SEMANTIC_POSITION
    };

    this.ssaoShader = pc.createShaderFromCode(graphicsDevice, pc.PostEffect.quadVertexShader, fSsao, 'SsaoShader', attributes);
    this.blurShader = pc.createShaderFromCode(graphicsDevice, pc.PostEffect.quadVertexShader, fblur, 'SsaoBlurShader', attributes);
    this.outputShader = pc.createShaderFromCode(graphicsDevice, pc.PostEffect.quadVertexShader, foutput, 'SsaoOutputShader', attributes);

    // Uniforms
    this.radius = 4;
    this.brightness = 0;
    this.samples = 20;
    this.downscale = 1.0;
}

SSAOEffect.prototype = Object.create(pc.PostEffect.prototype);
SSAOEffect.prototype.constructor = SSAOEffect;

SSAOEffect.prototype._destroy = function () {
    if (this.target) {
        this.target.destroyTextureBuffers();
        this.target.destroy();
        this.target = null;

    }

    if (this.blurTarget) {
        this.blurTarget.destroyTextureBuffers();
        this.blurTarget.destroy();
        this.blurTarget = null;
    }
};

SSAOEffect.prototype._resize = function (target) {

    var width = Math.ceil(target.colorBuffer.width / this.downscale);
    var height = Math.ceil(target.colorBuffer.height / this.downscale);

    // If no change, skip resize
    if (width === this.width && height === this.height) {
        return;
    }

    // Render targets
    this.width = width;
    this.height = height;

    this._destroy();

    var ssaoResultBuffer = new pc.Texture(this.device, {
        format: pc.PIXELFORMAT_RGBA8,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
        width: this.width,
        height: this.height,
        mipmaps: false
    });
    ssaoResultBuffer.name = 'SSAO Result';
    this.target = new pc.RenderTarget({
        name: 'SSAO Result Render Target',
        colorBuffer: ssaoResultBuffer,
        depth: false
    });

    var ssaoBlurBuffer = new pc.Texture(this.device, {
        format: pc.PIXELFORMAT_RGBA8,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
        width: this.width,
        height: this.height,
        mipmaps: false
    });
    ssaoBlurBuffer.name = 'SSAO Blur';
    this.blurTarget = new pc.RenderTarget({
        name: 'SSAO Blur Render Target',
        colorBuffer: ssaoBlurBuffer,
        depth: false
    });
};

Object.assign(SSAOEffect.prototype, {
    render: function (inputTarget, outputTarget, rect) {

        this._resize(inputTarget);

        var device = this.device;
        var scope = device.scope;

        var sampleCount = this.samples;
        var spiralTurns = 10.0;
        var step = (1.0 / (sampleCount - 0.5)) * spiralTurns * 2.0 * 3.141;

        var radius = this.radius;
        var bias = 0.001;
        var peak = 0.1 * radius;
        var intensity = (peak * 2.0 * 3.141) * 0.125;
        var projectionScale = 0.5 * device.height;
        var cameraFarClip = this.ssaoScript.entity.camera.farClip;

        scope.resolve('uAspect').setValue(this.width / this.height);
        scope.resolve('uResolution').setValue([this.width, this.height, 1.0 / this.width, 1.0 / this.height]);
        scope.resolve('uBrightness').setValue(this.brightness);

        scope.resolve('uInvFarPlane').setValue(1.0 / cameraFarClip);
        scope.resolve('uSampleCount').setValue([sampleCount, 1.0 / sampleCount]);
        scope.resolve('uSpiralTurns').setValue(spiralTurns);
        scope.resolve('uAngleIncCosSin').setValue([Math.cos(step), Math.sin(step)]);
        scope.resolve('uMaxLevel').setValue(0.0);
        scope.resolve('uInvRadiusSquared').setValue(1.0 / (radius * radius));
        scope.resolve('uMinHorizonAngleSineSquared').setValue(0.0);
        scope.resolve('uBias').setValue(bias);
        scope.resolve('uPeak2').setValue(peak * peak);
        scope.resolve('uIntensity').setValue(intensity);
        scope.resolve('uPower').setValue(1.0);
        scope.resolve('uProjectionScaleRadius').setValue(projectionScale * radius);

        // Render SSAO
        this.drawQuad(this.target, this.ssaoShader, rect);

        scope.resolve('uSSAOBuffer').setValue(this.target.colorBuffer);
        scope.resolve('uFarPlaneOverEdgeDistance').setValue(1);
        scope.resolve('uBilatSampleCount').setValue(4);

        // Perform the blur
        this.drawQuad(this.blurTarget, this.blurShader, rect);

        // Finally output to screen
        scope.resolve('uSSAOBuffer').setValue(this.blurTarget.colorBuffer);
        scope.resolve('uColorBuffer').setValue(inputTarget.colorBuffer);
        this.drawQuad(outputTarget, this.outputShader, rect);
    }
});

// ----------------- SCRIPT DEFINITION ------------------ //
var SSAO = pc.createScript('ssao');

SSAO.attributes.add('radius', {
    type: 'number',
    default: 4,
    min: 0,
    max: 20,
    title: 'Radius'
});

SSAO.attributes.add('brightness', {
    type: 'number',
    default: 0,
    min: 0,
    max: 1,
    title: 'Brightness'
});

SSAO.attributes.add('samples', {
    type: 'number',
    default: 16,
    min: 1,
    max: 256,
    title: 'Samples'
});

SSAO.attributes.add('downscale', {
    type: 'number',
    default: 1,
    min: 1,
    max: 4,
    title: 'Downscale'
});

SSAO.prototype.initialize = function () {
    this.effect = new SSAOEffect(this.app.graphicsDevice, this);
    this.effect.radius = this.radius;
    this.effect.brightness = this.brightness;
    this.effect.samples = this.samples;
    this.effect.downscale = this.downscale;

    this.on('attr', function (name, value) {
        this.effect[name] = value;
    }, this);

    var queue = this.entity.camera.postEffects;
    queue.addEffect(this.effect);

    this.on('state', function (enabled) {
        if (enabled) {
            queue.addEffect(this.effect);
        } else {
            queue.removeEffect(this.effect);
        }
    });

    this.on('destroy', function () {
        queue.removeEffect(this.effect);
        this.effect._destroy();
    });
};
