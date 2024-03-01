/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": /* glsl */`
            uniform float uTime;
            varying float height;

            void main(void)
            {
                // evaluate center of the splat in object space
                vec3 centerLocal = evalCenter();

                // modify it
                float heightIntensity = centerLocal.y * 0.2;
                centerLocal.x += sin(uTime * 5.0 + centerLocal.y) * 0.3 * heightIntensity;

                // output y-coordinate
                height = centerLocal.y;

                // evaluate the rest of the splat using world space center
                vec4 centerWorld = matrix_model * vec4(centerLocal, 1.0);
                gl_Position = evalSplat(centerWorld);
            }
        `,
        "shader.frag": /* glsl */`
            uniform float uTime;
            varying float height;

            void main(void)
            {
                // get splat color and alpha
                gl_FragColor = evalSplat();

                // modify it
                vec3 gold = vec3(1.0, 0.85, 0.0);
                float sineValue = abs(sin(uTime * 5.0 + height));
                float blend = smoothstep(0.9, 1.0, sineValue);
                gl_FragColor.xyz = mix(gl_FragColor.xyz, gold, blend);
            }
        `
    }
};
