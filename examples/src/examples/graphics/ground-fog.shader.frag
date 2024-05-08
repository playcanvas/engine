uniform sampler2D uTexture;
uniform float uSoftening;

varying vec2 texCoord0;
varying vec2 texCoord1;
varying vec2 texCoord2;
varying vec4 screenPos;
varying float depth;

void main(void)
{
    // sample the texture 3 times and compute average intensity of the fog
    vec4 diffusTexture0 = texture2D (uTexture, texCoord0);
    vec4 diffusTexture1 = texture2D (uTexture, texCoord1);
    vec4 diffusTexture2 = texture2D (uTexture, texCoord2);
    float alpha = 0.5 * (diffusTexture0.r + diffusTexture1.r + diffusTexture2.r);

    // use built-in getGrabScreenPos function to convert screen position to grab texture uv coords
    vec2 screenCoord = getGrabScreenPos(screenPos);

    // read the depth from the depth buffer
    float sceneDepth = getLinearScreenDepth(screenCoord) * camera_params.x;

    // depth of the current fragment (on the fog plane)
    float fragmentDepth = depth * camera_params.x;

    // difference between these two depths is used to adjust the alpha, to fade out
    // the fog near the geometry
    float depthDiff = clamp(abs(fragmentDepth - sceneDepth) * uSoftening, 0.0, 1.0);
    alpha *= smoothstep(0.0, 1.0, depthDiff);

    // final color
    vec3 fogColor = vec3(1.0, 1.0, 1.0);
    gl_FragColor = vec4(fogColor, alpha);
}
