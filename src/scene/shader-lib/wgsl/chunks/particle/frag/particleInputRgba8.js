export default /* wgsl */`
//RG=X, BA=Y
//RG=Z, BA=A
//RGB=V, A=visMode
//RGBA=life

const PI2: f32 = 6.283185307179586;

uniform inBoundsSize: vec3f;
uniform inBoundsCenter: vec3f;

uniform maxVel: f32;

fn decodeFloatRG(rg: vec2f) -> f32 {
    return rg.y * (1.0 / 255.0) + rg.x;
}

fn decodeFloatRGBA( rgba: vec4f ) -> f32 {
    return dot(rgba, vec4f(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 160581375.0));
}

fn readInput(uv: f32) {
    let tex0 = textureSampleLevel(particleTexIN, particleTexINSampler, vec2f(uv, 0.125), 0.0);
    let tex1 = textureSampleLevel(particleTexIN, particleTexINSampler, vec2f(uv, 0.375), 0.0);
    let tex2 = textureSampleLevel(particleTexIN, particleTexINSampler, vec2f(uv, 0.625), 0.0);
    let tex3 = textureSampleLevel(particleTexIN, particleTexINSampler, vec2f(uv, 0.875), 0.0);

    inPos = vec3f(decodeFloatRG(tex0.rg), decodeFloatRG(tex0.ba), decodeFloatRG(tex1.rg));
    inPos = (inPos - vec3f(0.5)) * uniform.inBoundsSize + uniform.inBoundsCenter;

    inVel = tex2.xyz;
    inVel = (inVel - vec3f(0.5)) * uniform.maxVel;

    inAngle = decodeFloatRG(tex1.ba) * PI2;
    inShow = tex2.a > 0.5;

    let life_decoded = decodeFloatRGBA(tex3);
    let maxNegLife = max(uniform.lifetime, (uniform.numParticles - 1.0) * (uniform.rate + uniform.rateDiv));
    let maxPosLife = uniform.lifetime + 1.0;
    inLife = life_decoded * (maxNegLife + maxPosLife) - maxNegLife;
}`;
