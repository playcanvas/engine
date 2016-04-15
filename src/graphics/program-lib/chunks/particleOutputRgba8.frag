uniform vec3 outBoundsMul;
uniform vec3 outBoundsAdd;

vec2 encodeFloatRG( float v ) {
  vec2 enc = vec2(1.0, 255.0) * v;
  enc = fract(enc);
  enc -= enc.yy * vec2(1.0/255.0, 1.0/255.0);
  return enc;
}

vec4 encodeFloatRGBA( float v ) {
  vec4 enc = vec4(1.0, 255.0, 65025.0, 160581375.0) * v;
  enc = fract(enc);
  enc -= enc.yzww * vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
  return enc;
}

void writeOutput() {
    //outPos = (outPos - outBoundsCenter) / outBoundsSize + vec3(0.5);

    outPos = outPos * outBoundsMul + outBoundsAdd;
    outAngle = fract(outAngle / PI2);

    outVel = (outVel / maxVel) + vec3(0.5); // TODO: mul

    float maxNegLife = max(lifetime, (numParticles - 1.0) * (rate+rateDiv));
    float maxPosLife = lifetime+1.0;
    outLife = (outLife + maxNegLife) / (maxNegLife + maxPosLife);

    if (gl_FragCoord.y < 1.0) {
        gl_FragColor = vec4(encodeFloatRG(outPos.x), encodeFloatRG(outPos.y));
    } else if (gl_FragCoord.y < 2.0) {
        gl_FragColor = vec4(encodeFloatRG(outPos.z), encodeFloatRG(outAngle));
    } else if (gl_FragCoord.y < 3.0) {
        gl_FragColor = vec4(outVel, visMode*0.5+0.5);
    } else {
        gl_FragColor = encodeFloatRGBA(outLife);
    }
}

