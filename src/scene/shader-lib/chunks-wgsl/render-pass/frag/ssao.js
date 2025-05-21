export default /* glsl */`
    #include "screenDepthPS"

    varying uv0: vec2f;

    uniform uInvResolution: vec2f;
    uniform uAspect: f32;

    // Largely based on 'Dominant Light Shadowing'
    // 'Lighting Technology of The Last of Us Part II' by Hawar Doghramachi, Naughty Dog, LLC

    fn getWFromProjectionMatrix(p: mat4x4f, v: vec3f) -> f32 {
        // this essentially returns (p * vec4(v, 1.0)).w, but we make some assumptions
        // this assumes a perspective projection
        return -v.z;
        // this assumes a perspective or ortho projection
        // return p[2][3] * v.z + p[3][3];
    }

    fn getViewSpaceZFromW(p: mat4x4f, w: f32) -> f32 {
        // this assumes a perspective projection
        return -w;
        // this assumes a perspective or ortho projection
        // return (w - p[3][3]) / p[2][3];
    }

    const kLog2LodRate: f32 = 3.0;

    // random number between 0 and 1, using interleaved gradient noise
    fn random(w: vec2f) -> f32 {
        const m: vec3f = vec3f(0.06711056, 0.00583715, 52.9829189);
        return fract(m.z * fract(dot(w, m.xy)));
    }

    // returns the frag coord in the GL convention with (0, 0) at the bottom-left
    fn getFragCoord() -> vec2f {
        return pcPosition.xy;
    }

    fn computeViewSpacePositionFromDepth(uv: vec2f, linearDepth: f32) -> vec3f {
        return vec3f((0.5 - uv) * vec2f(uniform.uAspect, 1.0) * linearDepth, linearDepth);
    }

    fn faceNormal(dpdx: vec3f, dpdy: vec3f) -> vec3f {
        return normalize(cross(dpdx, dpdy));
    }

    // Compute normals using derivatives, which essentially results in half-resolution normals
    // this creates artifacts around geometry edges.
    // Note: when using the spirv optimizer, this results in much slower execution time because
    //       this whole expression is inlined in the AO loop below.
    fn computeViewSpaceNormalDeriv(position: vec3f) -> vec3f {
        return faceNormal(dpdx(position), dpdy(position));
    }

    // Compute normals directly from the depth texture, resulting in full resolution normals
    // Note: This is actually as cheap as using derivatives because the texture fetches
    //       are essentially equivalent to textureGather (which we don't have on ES3.0),
    //       and this is executed just once.
    fn computeViewSpaceNormalDepth(position: vec3f, uv: vec2f) -> vec3f {
        let uvdx: vec2f = uv + vec2f(uniform.uInvResolution.x, 0.0);
        let uvdy: vec2f = uv + vec2f(0.0, uniform.uInvResolution.y);
        let px: vec3f = computeViewSpacePositionFromDepth(uvdx, -getLinearScreenDepth(uvdx));
        let py: vec3f = computeViewSpacePositionFromDepth(uvdy, -getLinearScreenDepth(uvdy));
        let dpdx: vec3f = px - position;
        let dpdy: vec3f = py - position;
        return faceNormal(dpdx, dpdy);
    }

    // Ambient Occlusion, largely inspired from:
    // 'The Alchemy Screen-Space Ambient Obscurance Algorithm' by Morgan McGuire
    // 'Scalable Ambient Obscurance' by Morgan McGuire, Michael Mara and David Luebke

    uniform uSampleCount: vec2f;
    uniform uSpiralTurns: f32;

    const PI: f32 = 3.14159;

    fn tapLocation(i: f32, noise: f32) -> vec3f {
        let offset: f32 = ((2.0 * PI) * 2.4) * noise;
        let angle: f32 = ((i * uniform.uSampleCount.y) * uniform.uSpiralTurns) * (2.0 * PI) + offset;
        let radius: f32 = (i + noise + 0.5) * uniform.uSampleCount.y;
        return vec3f(cos(angle), sin(angle), radius * radius);
    }

    fn startPosition(noise: f32) -> vec2f {
        let angle: f32 = ((2.0 * PI) * 2.4) * noise;
        return vec2f(cos(angle), sin(angle));
    }

    uniform uAngleIncCosSin: vec2f;

    fn tapAngleStep() -> mat2x2f {
        let t: vec2f = uniform.uAngleIncCosSin;
        return mat2x2f(vec2f(t.x, t.y), vec2f(-t.y, t.x));
    }

    fn tapLocationFast(i: f32, p: vec2f, noise_in: f32) -> vec3f {
        let radius: f32 = (i + noise_in + 0.5) * uniform.uSampleCount.y;
        return vec3f(p.x, p.y, radius * radius);
    }

    uniform uMaxLevel: f32;
    uniform uInvRadiusSquared: f32;
    uniform uMinHorizonAngleSineSquared: f32;
    uniform uBias: f32;
    uniform uPeak2: f32;

    fn computeAmbientOcclusionSAO(occlusion_ptr: ptr<function, f32>, i: f32, ssDiskRadius: f32,
            uv: vec2f, origin: vec3f, normal: vec3f,
            tapPosition: vec2f, noise: f32) {

        let tap: vec3f = tapLocationFast(i, tapPosition, noise);

        let ssRadius: f32 = max(1.0, tap.z * ssDiskRadius); // at least 1 pixel screen-space radius

        let uvSamplePos: vec2f = uv + (ssRadius * tap.xy) * uniform.uInvResolution;

        // TODO: level is not used, but could be used with mip-mapped depth texture
        let level: f32 = clamp(floor(log2(ssRadius)) - kLog2LodRate, 0.0, uniform.uMaxLevel);
        let occlusionDepth: f32 = -getLinearScreenDepth(uvSamplePos);
        let p: vec3f = computeViewSpacePositionFromDepth(uvSamplePos, occlusionDepth);

        // now we have the sample, compute AO
        let v: vec3f = p - origin;        // sample vector
        let vv: f32 = dot(v, v);       // squared distance
        let vn: f32 = dot(v, normal);  // distance * cos(v, normal)

        // discard samples that are outside of the radius, preventing distant geometry to cast
        // shadows -- there are many functions that work and choosing one is an artistic decision.
        var w_val: f32 = max(0.0, 1.0 - vv * uniform.uInvRadiusSquared);
        w_val = w_val * w_val;

        // discard samples that are too close to the horizon to reduce shadows cast by geometry
        // not sufficiently tessellated. The goal is to discard samples that form an angle 'beta'
        // smaller than 'epsilon' with the horizon. We already have dot(v,n) which is equal to the
        // sin(beta) * |v|. So the test simplifies to vn^2 < vv * sin(epsilon)^2.
        w_val = w_val * step(vv * uniform.uMinHorizonAngleSineSquared, vn * vn);

        *occlusion_ptr = *occlusion_ptr + w_val * max(0.0, vn + origin.z * uniform.uBias) / (vv + uniform.uPeak2);
    }

    uniform uProjectionScaleRadius: f32;
    uniform uIntensity: f32;
    uniform uRandomize: f32;

    fn scalableAmbientObscurance(uv: vec2f, origin: vec3f, normal: vec3f) -> f32 {
        let noise: f32 = random(getFragCoord()) + uniform.uRandomize;
        var tapPosition: vec2f = startPosition(noise);
        let angleStep: mat2x2f = tapAngleStep();

        // Choose the screen-space sample radius
        // proportional to the projected area of the sphere
        let ssDiskRadius: f32 = -(uniform.uProjectionScaleRadius / origin.z);

        var occlusion: f32 = 0.0;
        for (var i: i32 = 0; i < i32(uniform.uSampleCount.x); i = i + 1) {
            computeAmbientOcclusionSAO(&occlusion, f32(i), ssDiskRadius, uv, origin, normal, tapPosition, noise);
            tapPosition = angleStep * tapPosition;
        }
        return occlusion;
    }

    uniform uPower: f32;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        let uv: vec2f = input.uv0; // interpolated to pixel center

        let depth: f32 = -getLinearScreenDepth(input.uv0);
        let origin: vec3f = computeViewSpacePositionFromDepth(uv, depth);
        let normal: vec3f = computeViewSpaceNormalDepth(origin, uv);

        var occlusion: f32 = 0.0;
        if (uniform.uIntensity > 0.0) {
            occlusion = scalableAmbientObscurance(uv, origin, normal);
        }

        // occlusion to visibility
        var ao: f32 = max(0.0, 1.0 - occlusion * uniform.uIntensity);
        ao = pow(ao, uniform.uPower);

        output.color = vec4f(ao, ao, ao, 1.0);
        return output;
    }
`;
