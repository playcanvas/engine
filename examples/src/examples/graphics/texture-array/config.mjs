/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": /* glsl */`
            attribute vec3 aPosition;
            attribute vec2 aUv0;
            attribute vec3 aNormal;

            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;
            uniform mat3 matrix_normal;

            varying vec2 vUv0;
            varying vec3 worldNormal;

            void main(void)
            {
                vUv0 = aUv0;
                worldNormal = normalize(matrix_normal * aNormal);
                gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
            }`,
        "shader.frag": /* glsl */`
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
            }`,
        "ground.frag": /* glsl */`
            varying vec2 vUv0;
            varying vec3 worldNormal;

            uniform mediump sampler2DArray uDiffuseMap;

            void main(void)
            {
                vec4 data = texture(uDiffuseMap, vec3(vUv0, step(vUv0.x, 0.5) + 2.0 * step(vUv0.y, 0.5)));
                data.rgb *= 0.8 * max(dot(worldNormal, vec3(0.1, 1.0, 0.5)), 0.0) + 0.5; // simple lighting
                gl_FragColor = vec4(data.rgb, 1.0);
            }`
    }
};
