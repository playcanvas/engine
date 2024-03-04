/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": /* glsl */`
            attribute vec3 vertex_position;
            attribute vec2 vertex_texCoord0;

            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;
            uniform float uTime;
            uniform sampler2D uTexture;

            varying vec2 texCoord0;
            varying vec2 texCoord1;
            varying vec2 texCoord2;
            varying vec4 screenPos;
            varying float depth;

            void main(void)
            {
                // 3 scrolling texture coordinates with different direction and speed
                texCoord0 = vertex_texCoord0 * 2.0 + vec2(uTime * 0.003, uTime * 0.01);
                texCoord1 = vertex_texCoord0 * 1.5 + vec2(uTime * -0.02, uTime * 0.02);
                texCoord2 = vertex_texCoord0 * 1.0 + vec2(uTime * 0.01, uTime * -0.003);

                // sample the fog texture to have elevation for this vertex
                vec2 offsetTexCoord = vertex_texCoord0 + vec2(uTime * 0.001, uTime * -0.0003);
                float offset = texture2D(uTexture, offsetTexCoord).r;

                // vertex in the world space
                vec4 pos = matrix_model * vec4(vertex_position, 1.0);

                // move it up based on the offset
                pos.y += offset * 25.0;

                // position in projected (screen) space
                vec4 projPos = matrix_viewProjection * pos;
                gl_Position = projPos;

                // the linear depth of the vertex (in camera space)
                depth = getLinearDepth(pos.xyz);

                // screen fragment position, used to sample the depth texture
                screenPos = projPos;
            }
        `,
        "shader.frag": /* glsl */`
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
        `
    }
};
