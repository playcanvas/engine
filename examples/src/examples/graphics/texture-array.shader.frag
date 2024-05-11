varying vec2 vUv0;
varying vec3 worldNormal;
uniform float uTime;

uniform mediump sampler2DArray uDiffuseMap;

void main(void)
{
    // sample different texture based on time along its texture v-coordinate
    float index = (sin(uTime + vUv0.y + vUv0.x * 0.5) * 0.5 + 0.5) * 4.0;
    vec4 data = texture(uDiffuseMap, vec3(vUv0, floor(index)));

    data.rgb *= 0.8 * max(dot(worldNormal, vec3(0.1, 1.0, 0.5)), 0.0) + 0.5; // simple lighting
    gl_FragColor = vec4(data.rgb, 1.0);
}
