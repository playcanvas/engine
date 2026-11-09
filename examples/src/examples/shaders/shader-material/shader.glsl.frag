varying vec4 vFragPosition;
varying vec2 vUv0;

uniform sampler2D diffuseTexture;
uniform float amount;

void main(void)
{
    vec3 color = vFragPosition.rgb;
    vec3 tint = vec3(amount) + color;
    vec4 diffuseColor = texture2D(diffuseTexture, vUv0);
    gl_FragColor = vec4(diffuseColor.xyz * tint, 1.0);
}
