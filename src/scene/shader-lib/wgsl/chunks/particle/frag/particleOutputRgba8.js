export default /* wgsl */`
uniform outBoundsMul: vec3f;
uniform outBoundsAdd: vec3f;

fn encodeFloatRG( v: f32 ) -> vec2f {
    var enc: vec2f = vec2f(1.0, 255.0) * v;
    enc = fract(enc);
    enc = enc - enc.yy * (1.0 / 255.0);
    return enc;
}

fn encodeFloatRGBA( v: f32 ) -> vec4f {
    let factors = vec4f(1.0, 255.0, 65025.0, 160581375.0);
    var enc: vec4f = factors * v;
    enc = fract(enc);
    enc = enc - enc.yzww * vec4f(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
    return enc;
}

fn getOutput() -> vec4f {
    outPos = outPos * uniform.outBoundsMul + uniform.outBoundsAdd;
    outAngle = fract(outAngle / PI2);

    outVel = (outVel / uniform.maxVel) + vec3f(0.5); // TODO: mul

    let maxNegLife = max(uniform.lifetime, uniform.numParticles * (uniform.rate + uniform.rateDiv));
    let maxPosLife = uniform.lifetime + 1.0;
    outLife = (outLife + maxNegLife) / (maxNegLife + maxPosLife);

    if (pcPosition.y < 1.0) {
        return vec4f(encodeFloatRG(outPos.x), encodeFloatRG(outPos.y));
    } else if (pcPosition.y < 2.0) {
        return vec4f(encodeFloatRG(outPos.z), encodeFloatRG(outAngle));
    } else if (pcPosition.y < 3.0) {
        return vec4f(outVel, visMode * 0.5 + 0.5);
    } else {
        return encodeFloatRGBA(outLife);
    }
}
`;
