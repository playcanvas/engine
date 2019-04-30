
vec3 unpack3NFloats(float src) {
    float r = fract(src);
    float g = fract(src * 256.0);
    float b = fract(src * 65536.0);
    return vec3(r, g, b);
}

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec4 tex1Dlod_lerp(sampler2D tex, vec2 tc) {
    return mix( texture2D(tex,tc), texture2D(tex,tc + graphSampleSize), fract(tc.x*graphNumSamples) );
}

vec4 tex1Dlod_lerp(sampler2D tex, vec2 tc, out vec3 w) {
    vec4 a = texture2D(tex,tc);
    vec4 b = texture2D(tex,tc + graphSampleSize);
    float c = fract(tc.x*graphNumSamples);

    vec3 unpackedA = unpack3NFloats(a.w);
    vec3 unpackedB = unpack3NFloats(b.w);
    w = mix(unpackedA, unpackedB, c);

    return mix(a, b, c);
}


vec2 rotate(vec2 quadXY, float pRotation, out mat2 rotMatrix) {
    float c = cos(pRotation);
    float s = sin(pRotation);

    mat2 m = mat2(c, -s, s, c);
    rotMatrix = m;

    return m * quadXY;
}

vec3 billboard(vec3 InstanceCoords, vec2 quadXY) {
   vec3 pos = -matrix_viewInverse[0].xyz * quadXY.x + -matrix_viewInverse[1].xyz * quadXY.y;
   return pos;
}

vec3 customFace(vec3 InstanceCoords, vec2 quadXY) {
    vec3 pos = faceTangent * quadXY.x + faceBinorm * quadXY.y;
    return pos;
}

void main(void) {
    vec3 meshLocalPos = particle_vertexData.xyz;
    float id = floor(particle_vertexData.w);

    float rndFactor = fract(sin(id + 1.0 + seed));
    vec3 rndFactor3 = vec3(rndFactor, fract(rndFactor*10.0), fract(rndFactor*100.0));

    float uv = id / numParticlesPot;
    readInput(uv);

#ifdef LOCAL_SPACE
    inVel = mat3(matrix_model) * inVel;
#endif
    vec2 velocityV = normalize((mat3(matrix_view) * inVel).xy); // should be removed by compiler if align/stretch is not used
    float particleLifetime = lifetime;

    if (inLife <= 0.0 || inLife > particleLifetime || !inShow) meshLocalPos = vec3(0.0);
    vec2 quadXY = meshLocalPos.xy;
    float nlife = clamp(inLife / particleLifetime, 0.0, 1.0);

    vec3 paramDiv;
    vec4 params = tex1Dlod_lerp(internalTex2, vec2(nlife, 0), paramDiv);
    float scale = params.y;
    float scaleDiv = paramDiv.x;
    float alphaDiv = paramDiv.z;

    scale += (scaleDiv * 2.0 - 1.0) * scaleDivMult * fract(rndFactor*10000.0);

#ifndef USE_MESH
    texCoordsAlphaLife = vec4(quadXY * -0.5 + 0.5, (alphaDiv * 2.0 - 1.0) * alphaDivMult * fract(rndFactor*1000.0), nlife);
#else
    texCoordsAlphaLife = vec4(particle_uv, (alphaDiv * 2.0 - 1.0) * alphaDivMult * fract(rndFactor*1000.0), nlife);
#endif

    vec3 particlePos = inPos;
    vec3 particlePosMoved = vec3(0.0);

    mat2 rotMatrix;
