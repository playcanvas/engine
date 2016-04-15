//RG=X, BA=Y
//RG=Z, BA=A
//RGB=V, A=visMode
//RGBA=life

#define PI2 6.283185307179586

uniform vec3 inBoundsSize;
uniform vec3 inBoundsCenter;

uniform float maxVel;

float decodeFloatRG(vec2 rg) {
    return rg.y*(1.0/255.0) + rg.x;
}

float decodeFloatRGBA( vec4 rgba ) {
  return dot( rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/160581375.0) );
}

void readInput(float uv) {
    vec4 tex0 = texture2D(particleTexIN, vec2(uv, 0.125));
    vec4 tex1 = texture2D(particleTexIN, vec2(uv, 0.375));
    vec4 tex2 = texture2D(particleTexIN, vec2(uv, 0.625));
    vec4 tex3 = texture2D(particleTexIN, vec2(uv, 0.875));

    inPos = vec3(decodeFloatRG(tex0.rg), decodeFloatRG(tex0.ba), decodeFloatRG(tex1.rg));
    inPos = (inPos - vec3(0.5)) * inBoundsSize + inBoundsCenter;

    inVel = tex2.xyz;
    inVel = (inVel - vec3(0.5)) * maxVel;

    inAngle = decodeFloatRG(tex1.ba) * PI2;
    inShow = tex2.a > 0.5;

    inLife = decodeFloatRGBA(tex3);
    float maxNegLife = max(lifetime, (numParticles - 1.0) * (rate+rateDiv));
    float maxPosLife = lifetime+1.0;
    inLife = inLife * (maxNegLife + maxPosLife) - maxNegLife;
}

