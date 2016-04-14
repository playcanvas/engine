#define PI2 6.283185307179586

uniform vec3 prevBoundsSize;
uniform vec3 prevBoundsCenter;

uniform vec3 boundsSize;
uniform vec3 boundsCenter;

uniform float maxVel;


float decodeFloatRG(vec2 rg) {
    return rg.y*(1.0/255.0) + rg.x;
}

float decodeFloatRGBA( vec4 rgba ) {
  return dot( rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/160581375.0) );
}

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

void readInput() {
    vec4 tex0 = texture2D(particleTexIN, vec2(vUv0.x, 0.125));
    vec4 tex1 = texture2D(particleTexIN, vec2(vUv0.x, 0.375));
    vec4 tex2 = texture2D(particleTexIN, vec2(vUv0.x, 0.625));
    vec4 tex3 = texture2D(particleTexIN, vec2(vUv0.x, 0.875));

    inPos = vec3(decodeFloatRG(tex0.rg), decodeFloatRG(tex0.ba), decodeFloatRG(tex1.rg));
    inPos = (inPos - vec3(0.5)) * prevBoundsSize + prevBoundsCenter;
    inAngle = decodeFloatRG(tex1.ba) * PI2;
    inShow = tex2.a > 0.5;

    inLife = decodeFloatRGBA(tex3);
    float maxNegLife = max(lifetime, (numParticles - 1.0) * (rate+rateDiv));
    float maxPosLife = lifetime+1.0;
    inLife = inLife * (maxNegLife + maxPosLife) - maxNegLife;
}

void writeOutput() {
    float outMask0 = gl_FragCoord.y < 1.0? 1.0 : 0.0;
    float outMask1 = (gl_FragCoord.y < 2.0 && gl_FragCoord.y >= 1.0)? 1.0 : 0.0;
    float outMask2 = (gl_FragCoord.y < 3.0 && gl_FragCoord.y >= 2.0)? 1.0 : 0.0;
    float outMask3 = (gl_FragCoord.y < 4.0 && gl_FragCoord.y >= 3.0)? 1.0 : 0.0;

    outPos = (outPos - boundsCenter) / boundsSize + vec3(0.5); // TODO: mad
    outAngle = fract(outAngle / PI2);

    outVel = (outVel / maxVel) + vec3(0.5); // TODO: mul

    float maxNegLife = max(lifetime, (numParticles - 1.0) * (rate+rateDiv));
    float maxPosLife = lifetime+1.0;
    outLife = (outLife + maxNegLife) / (maxNegLife + maxPosLife);

    gl_FragColor = vec4(encodeFloatRG(outPos.x), encodeFloatRG(outPos.y)) * outMask0 +
                   vec4(encodeFloatRG(outPos.z), encodeFloatRG(outAngle)) * outMask1 +
                   vec4(outVel, visMode*0.5+0.5) * outMask2 +
                   encodeFloatRGBA(outLife) * outMask3;
}

