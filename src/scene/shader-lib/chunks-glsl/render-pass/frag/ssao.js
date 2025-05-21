export default /* glsl */`
    #include "screenDepthPS"
    
    varying vec2 uv0;

    uniform vec2 uInvResolution;
    uniform float uAspect;

    #define saturate(x) clamp(x,0.0,1.0)

    // Largely based on 'Dominant Light Shadowing'
    // 'Lighting Technology of The Last of Us Part II' by Hawar Doghramachi, Naughty Dog, LLC

    highp float getWFromProjectionMatrix(const mat4 p, const vec3 v) {
        // this essentially returns (p * vec4(v, 1.0)).w, but we make some assumptions
        // this assumes a perspective projection
        return -v.z;
        // this assumes a perspective or ortho projection
        // return p[2][3] * v.z + p[3][3];
    }

    highp float getViewSpaceZFromW(const mat4 p, const float w) {
        // this assumes a perspective projection
        return -w;
        // this assumes a perspective or ortho projection
        // return (w - p[3][3]) / p[2][3];
    }

    const float kLog2LodRate = 3.0;

    // random number between 0 and 1, using interleaved gradient noise
    float random(const highp vec2 w) {
        const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);
        return fract(m.z * fract(dot(w, m.xy)));
    }

    // returns the frag coord in the GL convention with (0, 0) at the bottom-left
    highp vec2 getFragCoord() {
        return gl_FragCoord.xy;
    }

    highp vec3 computeViewSpacePositionFromDepth(highp vec2 uv, highp float linearDepth) {
        return vec3((0.5 - uv) * vec2(uAspect, 1.0) * linearDepth, linearDepth);
    }

    highp vec3 faceNormal(highp vec3 dpdx, highp vec3 dpdy) {
        return normalize(cross(dpdx, dpdy));
    }

    // Compute normals using derivatives, which essentially results in half-resolution normals
    // this creates artifacts around geometry edges.
    // Note: when using the spirv optimizer, this results in much slower execution time because
    //       this whole expression is inlined in the AO loop below.
    highp vec3 computeViewSpaceNormal(const highp vec3 position) {
        return faceNormal(dFdx(position), dFdy(position));
    }

    // Compute normals directly from the depth texture, resulting in full resolution normals
    // Note: This is actually as cheap as using derivatives because the texture fetches
    //       are essentially equivalent to textureGather (which we don't have on ES3.0),
    //       and this is executed just once.
    highp vec3 computeViewSpaceNormal(const highp vec3 position, const highp vec2 uv) {
        highp vec2 uvdx = uv + vec2(uInvResolution.x, 0.0);
        highp vec2 uvdy = uv + vec2(0.0, uInvResolution.y);
        highp vec3 px = computeViewSpacePositionFromDepth(uvdx, -getLinearScreenDepth(uvdx));
        highp vec3 py = computeViewSpacePositionFromDepth(uvdy, -getLinearScreenDepth(uvdy));
        highp vec3 dpdx = px - position;
        highp vec3 dpdy = py - position;
        return faceNormal(dpdx, dpdy);
    }

    // Ambient Occlusion, largely inspired from:
    // 'The Alchemy Screen-Space Ambient Obscurance Algorithm' by Morgan McGuire
    // 'Scalable Ambient Obscurance' by Morgan McGuire, Michael Mara and David Luebke

    uniform vec2 uSampleCount;
    uniform float uSpiralTurns;

    #define PI (3.14159)

    mediump vec3 tapLocation(mediump float i, const mediump float noise) {
        mediump float offset = ((2.0 * PI) * 2.4) * noise;
        mediump float angle = ((i * uSampleCount.y) * uSpiralTurns) * (2.0 * PI) + offset;
        mediump float radius = (i + noise + 0.5) * uSampleCount.y;
        return vec3(cos(angle), sin(angle), radius * radius);
    }

    highp vec2 startPosition(const float noise) {
        float angle = ((2.0 * PI) * 2.4) * noise;
        return vec2(cos(angle), sin(angle));
    }

    uniform vec2 uAngleIncCosSin;

    highp mat2 tapAngleStep() {
        highp vec2 t = uAngleIncCosSin;
        return mat2(t.x, t.y, -t.y, t.x);
    }

    mediump vec3 tapLocationFast(mediump float i, mediump vec2 p, const mediump float noise) {
        mediump float radius = (i + noise + 0.5) * uSampleCount.y;
        return vec3(p, radius * radius);
    }

    uniform float uMaxLevel;
    uniform float uInvRadiusSquared;
    uniform float uMinHorizonAngleSineSquared;
    uniform float uBias;
    uniform float uPeak2;

    void computeAmbientOcclusionSAO(inout mediump float occlusion, mediump float i, mediump float ssDiskRadius,
            const highp vec2 uv, const highp vec3 origin, const mediump vec3 normal,
            const mediump vec2 tapPosition, const float noise) {

        mediump vec3 tap = tapLocationFast(i, tapPosition, noise);

        mediump float ssRadius = max(1.0, tap.z * ssDiskRadius); // at least 1 pixel screen-space radius

        mediump vec2 uvSamplePos = uv + vec2(ssRadius * tap.xy) * uInvResolution;

        // TODO: level is not used, but could be used with mip-mapped depth texture
        mediump float level = clamp(floor(log2(ssRadius)) - kLog2LodRate, 0.0, float(uMaxLevel));
        highp float occlusionDepth = -getLinearScreenDepth(uvSamplePos);
        highp vec3 p = computeViewSpacePositionFromDepth(uvSamplePos, occlusionDepth);

        // now we have the sample, compute AO
        vec3 v = p - origin;        // sample vector
        float vv = dot(v, v);       // squared distance
        float vn = dot(v, normal);  // distance * cos(v, normal)

        // discard samples that are outside of the radius, preventing distant geometry to cast
        // shadows -- there are many functions that work and choosing one is an artistic decision.
        mediump float w = max(0.0, 1.0 - vv * uInvRadiusSquared);
        w = w * w;

        // discard samples that are too close to the horizon to reduce shadows cast by geometry
        // not sufficiently tessellated. The goal is to discard samples that form an angle 'beta'
        // smaller than 'epsilon' with the horizon. We already have dot(v,n) which is equal to the
        // sin(beta) * |v|. So the test simplifies to vn^2 < vv * sin(epsilon)^2.
        w *= step(vv * uMinHorizonAngleSineSquared, vn * vn);

        occlusion += w * max(0.0, vn + origin.z * uBias) / (vv + uPeak2);
    }

    uniform float uProjectionScaleRadius;
    uniform float uIntensity;
    uniform float uRandomize;

    float scalableAmbientObscurance(highp vec2 uv, highp vec3 origin, vec3 normal) {
        float noise = random(getFragCoord()) + uRandomize;
        highp vec2 tapPosition = startPosition(noise);
        highp mat2 angleStep = tapAngleStep();

        // Choose the screen-space sample radius
        // proportional to the projected area of the sphere
        float ssDiskRadius = -(uProjectionScaleRadius / origin.z);

        float occlusion = 0.0;
        for (float i = 0.0; i < uSampleCount.x; i += 1.0) {
            computeAmbientOcclusionSAO(occlusion, i, ssDiskRadius, uv, origin, normal, tapPosition, noise);
            tapPosition = angleStep * tapPosition;
        }
        return occlusion;
    }

    uniform float uPower;

    void main() {
        highp vec2 uv = uv0; // interpolated to pixel center

        highp float depth = -getLinearScreenDepth(uv0);
        highp vec3 origin = computeViewSpacePositionFromDepth(uv, depth);
        vec3 normal = computeViewSpaceNormal(origin, uv);

        float occlusion = 0.0;
        if (uIntensity > 0.0) {
            occlusion = scalableAmbientObscurance(uv, origin, normal);
        }

        // occlusion to visibility
        float ao = max(0.0, 1.0 - occlusion * uIntensity);
        ao = pow(ao, uPower);

        gl_FragColor = vec4(ao, ao, ao, 1.0);
    }
`;
