// --------------- POST EFFECT DEFINITION --------------- //
/**
 * @class
 * @name SSAOEffect
 * @classdesc Implements the SSAOEffect post processing effect.
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {GraphicsDevice} graphicsDevice - The graphics device of the application.
 */
function SSAOEffect(graphicsDevice) {
    pc.PostEffect.call(this, graphicsDevice);

    this.needsDepthBuffer = true;

    this.ssaoShader = new pc.Shader(graphicsDevice, {
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
            "uniform vec4 uResolution;",
            "",
            "uniform float uAspect;",
            "",
            "#define saturate(x) clamp(x,0.0,1.0)",
            "",
            "// Largely based on 'Dominant Light Shadowing'",
            "// 'Lighting Technology of The Last of Us Part II' by Hawar Doghramachi, Naughty Dog, LLC",
            "",
            "const float kSSCTLog2LodRate = 3.0;",
            "",
            "struct ConeTraceSetup {",
            "   // fragment info",
            "    highp vec2 ssStartPos;",
            "    highp vec3 vsStartPos;",
            "    vec3 vsNormal;",
            "",
            "   // light (cone) info",
            "    vec3 vsConeDirection;",
            "    float shadowDistance;",
            "    float coneAngleTangeant;",
            "    float contactDistanceMaxInv;",
            "    vec2 jitterOffset;          // (x = direction offset, y = step offset)",
            "",
            "   // scene infos",
            "    highp mat4 screenFromViewMatrix;",
            "    float projectionScale;",
            "    vec4 resolution;",
            "    float maxLevel;",
            "",
            "   // artistic/quality parameters",
            "    float intensity;",
            "    float depthBias;",
            "    float slopeScaledDepthBias;",
            "    int sampleCount;",
            "};",
            "",
            "highp float getWFromProjectionMatrix(const mat4 p, const vec3 v) {",
            "    // this essentially returns (p * vec4(v, 1.0)).w, but we make some assumptions",
            "    // this assumes a perspective projection",
            "    return -v.z;",
            "    // this assumes a perspective or ortho projection",
            "    // return p[2][3] * v.z + p[3][3];",
            "}",
            "",
            "highp float getViewSpaceZFromW(const mat4 p, const float w) {",
            "    // this assumes a perspective projection",
            "    return -w;",
            "    // this assumes a perspective or ortho projection",
            "   // return (w - p[3][3]) / p[2][3];",
            "}",
            "",
            "float coneTraceOcclusion(in ConeTraceSetup setup) {",
            "// skip fragments that are back-facing trace direction",
            "// (avoid overshadowing of translucent surfaces)",
            "    float NoL = dot(setup.vsNormal, setup.vsConeDirection);",
            "    if (NoL < 0.0) {",
            "        return 0.0;",
            "    }",
            "",
            "// start position of cone trace",
            "    highp vec2 ssStartPos = setup.ssStartPos;",
            "    highp vec3 vsStartPos = setup.vsStartPos;",
            "    highp float ssStartPosW = getWFromProjectionMatrix(setup.screenFromViewMatrix, vsStartPos);",
            "    highp float ssStartPosWInv = 1.0 / ssStartPosW;",
            "",
            "// end position of cone trace",
            "    highp vec3 vsEndPos = setup.vsConeDirection * setup.shadowDistance + vsStartPos;",
            "    highp float ssEndPosW = getWFromProjectionMatrix(setup.screenFromViewMatrix, vsEndPos);",
            "    highp float ssEndPosWInv = 1.0 / ssEndPosW;",
            "    highp vec2 ssEndPos = (setup.screenFromViewMatrix * vec4(vsEndPos, 1.0)).xy * ssEndPosWInv;",
            "",
            "// cone trace direction in screen-space",
            "    float ssConeLength = length(ssEndPos - ssStartPos);",     // do the math in highp
            "    vec2 ssConeVector = ssEndPos - ssStartPos;",
            "",
            "// direction perpendicular to cone trace direction",
            "    vec2 perpConeDir = normalize(vec2(ssConeVector.y, -ssConeVector.x));",
            "    float vsEndRadius = setup.coneAngleTangeant * setup.shadowDistance;",
            "",
            "// normalized step",
            "    highp float dt = 1.0 / float(setup.sampleCount);",
            "",
            "// normalized (0 to 1) screen-space postion on the ray",
            "    highp float t = dt * setup.jitterOffset.y;",
            "",
            "// calculate depth bias",
            "    float vsDepthBias = saturate(1.0 - NoL) * setup.slopeScaledDepthBias + setup.depthBias;",
            "",
            "    float occlusion = 0.0;",
            "    for (int i = 0; i < setup.sampleCount; i++, t += dt) {",
            "        float ssTracedDistance = ssConeLength * t;",
            "        float ssSliceRadius = setup.jitterOffset.x * (setup.coneAngleTangeant * ssTracedDistance);",
            "        highp vec2 ssSamplePos = perpConeDir * ssSliceRadius + ssConeVector * t + ssStartPos;",
            "",
            "        float level = clamp(floor(log2(ssSliceRadius)) - kSSCTLog2LodRate, 0.0, float(setup.maxLevel));",
            "        float vsSampleDepthLinear = -getLinearScreenDepth(ssSamplePos * setup.resolution.zw);",
            "",
            "       // calculate depth range of cone slice",
            "        float vsSliceRadius = vsEndRadius * t;",
            "",
            "       // calculate depth of cone center",
            "        float vsConeAxisDepth = -getViewSpaceZFromW(setup.screenFromViewMatrix, 1.0 / mix(ssStartPosWInv, ssEndPosWInv, t));",
            "        float vsJitteredSampleRadius = vsSliceRadius * setup.jitterOffset.x;",
            "        float vsSliceHalfRange = sqrt(vsSliceRadius * vsSliceRadius - vsJitteredSampleRadius * vsJitteredSampleRadius);",
            "        float vsSampleDepthMax = vsConeAxisDepth + vsSliceHalfRange;",
            "",
            "       // calculate overlap of depth buffer height-field with trace cone",
            "        float vsDepthDifference = vsSampleDepthMax - vsSampleDepthLinear;",
            "        float overlap = saturate((vsDepthDifference - vsDepthBias) / (vsSliceHalfRange * 2.0));",
            "",
            "        // attenuate by distance to avoid false occlusion",
            "        float attenuation = saturate(1.0 - (vsDepthDifference * setup.contactDistanceMaxInv));",
            "        occlusion = max(occlusion, overlap * attenuation);",
            "        if (occlusion >= 1.0) {  // note: this can't get > 1.0 by construction",
            "                                  // fully occluded, early exit",
            "            break;",
            "        }",
            "    }",
            "    return occlusion * setup.intensity;",
            "}",
            "",
            "const float kLog2LodRate = 3.0;",
            "",
            "vec2 sq(const vec2 a) {",
            "    return a * a;",
            "}",
            "",
            "uniform float uInvFarPlane;",
            "",
            "vec2 pack(highp float depth) {",
            "// we need 16-bits of precision",
            "    highp float z = clamp(depth * uInvFarPlane, 0.0, 1.0);",
            "    highp float t = floor(256.0 * z);",
            "    mediump float hi = t * (1.0 / 256.0);   // we only need 8-bits of precision",
            "    mediump float lo = (256.0 * z) - t;     // we only need 8-bits of precision",
            "    return vec2(hi, lo);",
            "}",
            "",
            "// random number between 0 and 1, using interleaved gradient noise",
            "float random(const highp vec2 w) {",
            "    const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);",
            "    return fract(m.z * fract(dot(w, m.xy)));",
            "}",
            "",
            "// returns the frag coord in the GL convention with (0, 0) at the bottom-left",
            "highp vec2 getFragCoord() {",
            "    return gl_FragCoord.xy;",
            "}",
            "",
            "highp vec3 computeViewSpacePositionFromDepth(highp vec2 uv, highp float linearDepth) {",
            "    return vec3((0.5 - uv) * vec2(uAspect, 1.0) * linearDepth, linearDepth);",
            "}",
            "",
            "highp vec3 faceNormal(highp vec3 dpdx, highp vec3 dpdy) {",
            "    return normalize(cross(dpdx, dpdy));",
            "}",
            "",
            "// Compute normals using derivatives, which essentially results in half-resolution normals",
            "// this creates arifacts around geometry edges.",
            "// Note: when using the spirv optimizer, this results in much slower execution time because",
            "//       this whole expression is inlined in the AO loop below.",
            "highp vec3 computeViewSpaceNormal(const highp vec3 position) {",
            "    return faceNormal(dFdx(position), dFdy(position));",
            "}",
            "",
            "// Compute normals directly from the depth texture, resulting in full resolution normals",
            "// Note: This is actually as cheap as using derivatives because the texture fetches",
            "//       are essentially equivalent to textureGather (which we don't have on ES3.0),",
            "//       and this is executed just once.",
            "highp vec3 computeViewSpaceNormal(const highp vec3 position, const highp vec2 uv) {",
            "    highp vec2 uvdx = uv + vec2(uResolution.z, 0.0);",
            "    highp vec2 uvdy = uv + vec2(0.0, uResolution.w);",
            "    highp vec3 px = computeViewSpacePositionFromDepth(uvdx, -getLinearScreenDepth(uvdx));",
            "    highp vec3 py = computeViewSpacePositionFromDepth(uvdy, -getLinearScreenDepth(uvdy));",
            "    highp vec3 dpdx = px - position;",
            "    highp vec3 dpdy = py - position;",
            "    return faceNormal(dpdx, dpdy);",
            "}",
            "",
            "// Ambient Occlusion, largely inspired from:",
            "// 'The Alchemy Screen-Space Ambient Obscurance Algorithm' by Morgan McGuire",
            "// 'Scalable Ambient Obscurance' by Morgan McGuire, Michael Mara and David Luebke",
            "",
            "uniform vec2 uSampleCount;",
            "uniform float uSpiralTurns;",
            "",
            "#define PI (3.14159)",
            "",
            "vec3 tapLocation(float i, const float noise) {",
            "    float offset = ((2.0 * PI) * 2.4) * noise;",
            "    float angle = ((i * uSampleCount.y) * uSpiralTurns) * (2.0 * PI) + offset;",
            "    float radius = (i + noise + 0.5) * uSampleCount.y;",
            "    return vec3(cos(angle), sin(angle), radius * radius);",
            "}",
            "",
            "highp vec2 startPosition(const float noise) {",
            "    float angle = ((2.0 * PI) * 2.4) * noise;",
            "    return vec2(cos(angle), sin(angle));",
            "}",
            "",
            "uniform vec2 uAngleIncCosSin;",
            "",
            "highp mat2 tapAngleStep() {",
            "    highp vec2 t = uAngleIncCosSin;",
            "    return mat2(t.x, t.y, -t.y, t.x);",
            "}",
            "",
            "vec3 tapLocationFast(float i, vec2 p, const float noise) {",
            "    float radius = (i + noise + 0.5) * uSampleCount.y;",
            "    return vec3(p, radius * radius);",
            "}",
            "",
            "uniform float uMaxLevel;",
            "uniform float uInvRadiusSquared;",
            "uniform float uMinHorizonAngleSineSquared;",
            "uniform float uBias;",
            "uniform float uPeak2;",
            "",
            "void computeAmbientOcclusionSAO(inout float occlusion, float i, float ssDiskRadius,",
            "        const highp vec2 uv,  const highp vec3 origin, const vec3 normal,",
            "        const vec2 tapPosition, const float noise) {",
            "",
            "    vec3 tap = tapLocationFast(i, tapPosition, noise);",
            "",
            "    float ssRadius = max(1.0, tap.z * ssDiskRadius);", // at least 1 pixel screen-space radius
            "",
            "    vec2 uvSamplePos = uv + vec2(ssRadius * tap.xy) * uResolution.zw;",
            "",
            "    float level = clamp(floor(log2(ssRadius)) - kLog2LodRate, 0.0, float(uMaxLevel));",
            "    highp float occlusionDepth = -getLinearScreenDepth(uvSamplePos);",
            "    highp vec3 p = computeViewSpacePositionFromDepth(uvSamplePos, occlusionDepth);",
            "",
            "    // now we have the sample, compute AO",
            "    vec3 v = p - origin;        // sample vector",
            "    float vv = dot(v, v);       // squared distance",
            "    float vn = dot(v, normal);  // distance * cos(v, normal)",
            "",
            "    // discard samples that are outside of the radius, preventing distant geometry to",
            "    // cast shadows -- there are many functions that work and choosing one is an artistic",
            "    // decision.",
            "    float w = max(0.0, 1.0 - vv * uInvRadiusSquared);",
            "    w = w*w;",
            "",
            "    // discard samples that are too close to the horizon to reduce shadows cast by geometry",
            "    // not sufficently tessellated. The goal is to discard samples that form an angle 'beta'",
            "    // smaller than 'epsilon' with the horizon. We already have dot(v,n) which is equal to the",
            "    // sin(beta) * |v|. So the test simplifies to vn^2 < vv * sin(epsilon)^2.",
            "    w *= step(vv * uMinHorizonAngleSineSquared, vn * vn);",
            "",
            "    occlusion += w * max(0.0, vn + origin.z * uBias) / (vv + uPeak2);",
            "}",
            "",
            "uniform float uProjectionScaleRadius;",
            "uniform float uIntensity;",
            "",
            "float scalableAmbientObscurance(highp vec2 uv, highp vec3 origin, vec3 normal) {",
            "    float noise = random(getFragCoord());",
            "    highp vec2 tapPosition = startPosition(noise);",
            "    highp mat2 angleStep = tapAngleStep();",
            "",
            "    // Choose the screen-space sample radius",
            "    // proportional to the projected area of the sphere",
            "    float ssDiskRadius = -(uProjectionScaleRadius / origin.z);",
            "",
            "    float occlusion = 0.0;",
            "    for (float i = 0.0; i < uSampleCount.x; i += 1.0) {",
            "        computeAmbientOcclusionSAO(occlusion, i, ssDiskRadius, uv, origin, normal, tapPosition, noise);",
            "        tapPosition = angleStep * tapPosition;",
            "    }",
            "    return sqrt(occlusion * uIntensity);",
            "}",
            "",
            "uniform float uPower;",
            "",
            "void main() {",
            "    highp vec2 uv = vUv0; //variable_vertex.xy; // interpolated to pixel center",
            "",
            "    highp float depth = -getLinearScreenDepth(vUv0);",
            "    highp vec3 origin = computeViewSpacePositionFromDepth(uv, depth);",
            "    vec3 normal = computeViewSpaceNormal(origin, uv);",
            "",
            "    float occlusion = 0.0;",
            "",
            "    if (uIntensity > 0.0) {",
            "        occlusion = scalableAmbientObscurance(uv, origin, normal);",
            "    }",
            "",
            "    // occlusion to visibility",
            "    float aoVisibility = pow(saturate(1.0 - occlusion), uPower);",
            "",
            "    vec4 inCol = vec4(1.0, 1.0, 1.0, 1.0); //texture2D( uColorBuffer,  uv );",
            "",
            "    gl_FragColor.rgb = inCol.rgb * vec3(aoVisibility); //postProcess.color.rgb = vec3(aoVisibility, pack(origin.z));",
            "    gl_FragColor.a = 1.0;",
            "}",
            "",
            "void main_old()",
            "{",
            "    vec2 aspectCorrect = vec2( 1.0, uAspect );",
            "",
            "    float depth = getLinearScreenDepth(vUv0);",
            "    gl_FragColor.rgb = vec3(fract(floor(depth*256.0*256.0)),fract(floor(depth*256.0)),fract(depth));",
            "    gl_FragColor.a = 1.0;",
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
            "uniform sampler2D uSSAOBuffer;",
            "uniform vec4 uResolution;",
            "",
            "uniform float uAspect;",
            "",
            "uniform int uBilatSampleCount;",
            "uniform float uFarPlaneOverEdgeDistance;",
            "",
            "float random(const highp vec2 w) {",
            "    const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);",
            "    return fract(m.z * fract(dot(w, m.xy)));",
            "}",
            "",
            "float bilateralWeight(in float depth, in float sampleDepth) {",
            "    float diff = (sampleDepth - depth) * uFarPlaneOverEdgeDistance;",
            "    return max(0.0, 1.0 - diff * diff);",
            "}",
            "",
            "void tap(inout float sum, inout float totalWeight, float weight, float depth, vec2 position) {",
            "    // ambient occlusion sample",
            "    float ssao = texture2D( uSSAOBuffer, position ).r;",
            "    float tdepth = -getLinearScreenDepth( position );",
            "",
            "    // bilateral sample",
            "    float bilateral = bilateralWeight(depth, tdepth);",
            "    bilateral *= weight;",
            "    sum += ssao * bilateral;",
            "    totalWeight += bilateral;",
            "}",
            "",
            "void main() {",
            "    highp vec2 uv = vUv0; // variable_vertex.xy; // interpolated at pixel's center",
            "",
            "    // we handle the center pixel separately because it doesn't participate in",
            "    // bilateral filtering",
            "    float depth = -getLinearScreenDepth(vUv0); // unpack(data.gb);",
            "    float totalWeight = 0.0; // float(uBilatSampleCount*2+1)*float(uBilatSampleCount*2+1);",
            "    float ssao = texture2D( uSSAOBuffer, vUv0 ).r;",
            "    float sum = ssao * totalWeight;",
            "",
            "    for (int x = -uBilatSampleCount; x <= uBilatSampleCount; x++) {",
            "       for (int y = -uBilatSampleCount; y < uBilatSampleCount; y++) {",
            "           float weight = 1.0;",
            "           vec2 offset = vec2(x,y)*uResolution.zw;",
            "           tap(sum, totalWeight, weight, depth, uv + offset);",
            "       }",
            "    }",
            "",
            "    float ao = sum * (1.0 / totalWeight);",
            "",
            "    // simple dithering helps a lot (assumes 8 bits target)",
            "    // this is most useful with high quality/large blurs",
            "    // ao += ((random(gl_FragCoord.xy) - 0.5) / 255.0);",
            "",
            "    vec4 inCol = texture2D( uColorBuffer,  vUv0 );",
            "",
            "    gl_FragColor.rgb = inCol.rgb * ao;",
            "    gl_FragColor.a = 1.0;",
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
        colorBuffer.name = 'ssao_' + i;
        var target = new pc.RenderTarget(graphicsDevice, colorBuffer, { depth: false });

        this.targets.push(target);
    }

    // Uniforms
    this.maxBlur = 0.02;
}

SSAOEffect.prototype = Object.create(pc.PostEffect.prototype);
SSAOEffect.prototype.constructor = SSAOEffect;

Object.assign(SSAOEffect.prototype, {
    render: function (inputTarget, outputTarget, rect) {
        var device = this.device;
        var scope = device.scope;

        var sampleCount = 16.0;
        var spiralTurns = 10.0;
        var step = (1.0 / (sampleCount - 0.5)) * spiralTurns * 2.0 * 3.141;

        var radius = 4.0;
        var bias = 0.001;
        var peak = 0.1 * radius;
        var intensity = (peak * 2.0 * 3.141) * 0.125;

        var projectionScale = 0.5 * device.height;

        var bilateralThreshold = 0.7;

        scope.resolve("uMaxBlur").setValue(this.maxBlur);
        scope.resolve("uAspect").setValue(device.width / device.height);
        scope.resolve("uResolution").setValue([device.width, device.height, 1.0 / device.width, 1.0 / device.height]);
        scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);

        scope.resolve("uInvFarPlane").setValue(1.0 / 50.0);
        scope.resolve("uSampleCount").setValue([sampleCount, 1.0 / sampleCount]);
        scope.resolve("uSpiralTurns").setValue(spiralTurns);
        scope.resolve("uAngleIncCosSin").setValue([Math.cos(step), Math.sin(step)]);
        scope.resolve("uMaxLevel").setValue(0.0);
        scope.resolve("uInvRadiusSquared").setValue(1.0 / (radius * radius));
        scope.resolve("uMinHorizonAngleSineSquared").setValue(0.0);
        scope.resolve("uBias").setValue(bias);
        scope.resolve("uPeak2").setValue(peak * peak);
        scope.resolve("uIntensity").setValue(intensity);
        scope.resolve("uPower").setValue(1.0);
        scope.resolve("uProjectionScaleRadius").setValue(projectionScale * radius);

        pc.drawFullscreenQuad(device, this.targets[0], this.vertexBuffer, this.ssaoShader, rect);

        scope.resolve("uSSAOBuffer").setValue(this.targets[0].colorBuffer);
        scope.resolve("uFarPlaneOverEdgeDistance").setValue(50.0 / bilateralThreshold);
        scope.resolve("uBilatSampleCount").setValue(4);

        pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.blurShader, rect);
    }
});

// ----------------- SCRIPT DEFINITION ------------------ //
var SSAO = pc.createScript('ssao');

SSAO.attributes.add('maxBlur', {
    type: 'number',
    default: 0.02,
    min: 0,
    max: 1,
    title: 'Max Blur'
});

SSAO.prototype.initialize = function () {
    this.effect = new SSAOEffect(this.app.graphicsDevice);
    this.effect.maxBlur = this.maxBlur;

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
    });
};
