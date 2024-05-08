varying vec2 vUv0;
varying vec3 worldNormal;

uniform mediump sampler2DArray uDiffuseMap;

void main(void)
{
    vec4 data = texture(uDiffuseMap, vec3(vUv0, step(vUv0.x, 0.5) + 2.0 * step(vUv0.y, 0.5)));
    data.rgb *= 0.8 * max(dot(worldNormal, vec3(0.1, 1.0, 0.5)), 0.0) + 0.5; // simple lighting
    gl_FragColor = vec4(data.rgb, 1.0);
}
