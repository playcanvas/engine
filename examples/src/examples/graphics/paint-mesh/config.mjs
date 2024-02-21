/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": /* glsl */`
            // Attributes per vertex: position and uv
            attribute vec4 aPosition;
            attribute vec2 aUv0;
        
            // model matrix of the mesh
            uniform mat4 matrix_model;

            // decal view-projection matrix (orthographic)
            uniform mat4 matrix_decal_viewProj;

            // decal projected position to fragment program
            varying vec4 decalPos;

            void main(void)
            {
                // handle upside-down uv coordinates on WebGPU
                vec2 uv = getImageEffectUV(aUv0);

                // We render in texture space, so a position of this fragment is its uv-coordinates.
                // Change the range of uv coordinates from 0..1 to projection space -1 to 1.
                gl_Position = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0, 1.0);

                // transform the vertex position to world space and then to decal space, and pass it
                // to the fragment shader to sample the decal texture
                vec4 worldPos = matrix_model * aPosition;
                decalPos = matrix_decal_viewProj * worldPos;
            }`,
        "shader.frag": /* glsl */`
            precision lowp float;
            varying vec4 decalPos;
            uniform sampler2D uDecalMap;

            void main(void)
            {
                // decal space position from -1..1 range, to texture space range 0..1
                vec4 p = decalPos * 0.5 + 0.5;
 
                // if the position is outside out 0..1 projection box, ignore the pixel
                if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z < 0.0 || p.z > 1.0)
                    discard;

                gl_FragColor = texture2D(uDecalMap, p.xy);
            }`
    }
};
