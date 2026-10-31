/**
 * Copy processor shader options for GSplatProcessor.
 * Copies splat data from source to destination with world transform applied.
 * Uses a remap texture to map destination indices to source indices.
 */
export const copyProcessor = {
    processGLSL: /* glsl */ `
        uniform highp usampler2D uRemapTexture;
        uniform mat4 matrix_model;
        uniform vec3 model_scale;
        uniform vec4 model_rotation;
        uniform vec3 aabb_center;

        // Quaternion multiplication: result = a * b (both in xyzw format)
        vec4 quatMul(vec4 a, vec4 b) {
            return vec4(
                a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
                a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
                a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
                a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
            );
        }

        void process() {
            // Read remap index for this destination splat (use gl_FragCoord for destination pixel coords)
            uint srcIndex = texelFetch(uRemapTexture, ivec2(gl_FragCoord.xy), 0).r;
            if (srcIndex == 0xFFFFFFFFu) discard;  // not from this source

            // Set global splat for reading to point to remapped source splat
            setSplat(srcIndex);

            // Read model-space data from source
            vec3 modelCenter = getCenter();
            vec4 color = getColor();
            vec3 srcScale = getScale();
            vec4 srcRot = getRotation();  // returns wxyz order

            // Transform to world space
            vec3 worldCenter = (matrix_model * vec4(modelCenter, 1.0)).xyz;

            // Make position local (relative to AABB center)
            vec3 localCenter = worldCenter - aabb_center;

            // Combine rotations: world = model * source (convert to xyzw for quatMul)
            vec4 srcRotXYZW = srcRot.yzwx;
            vec4 worldRotation = quatMul(model_rotation, srcRotXYZW);
            if (worldRotation.w < 0.0) worldRotation = -worldRotation;

            // Combine scales
            vec3 worldScale = model_scale * srcScale;

            // Write data in float format
            writeDataColor(color);
            writeDataCenter(vec4(localCenter, 0.0));
            writeDataScale(vec4(worldScale, 0.0));
            writeDataRotation(worldRotation.wxyz);  // convert xyzw back to wxyz for storage
        }
    `,
    processWGSL: /* wgsl */ `
        var uRemapTexture: texture_2d<u32>;
        uniform matrix_model: mat4x4f;
        uniform model_scale: vec3f;
        uniform model_rotation: vec4f;
        uniform aabb_center: vec3f;

        // Quaternion multiplication: result = a * b (both in xyzw format)
        fn quatMul(a: vec4f, b: vec4f) -> vec4f {
            return vec4f(
                a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
                a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
                a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
                a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
            );
        }

        fn process() {
            // Read remap index for this destination splat (use pcPosition for destination pixel coords)
            let srcIndex = textureLoad(uRemapTexture, vec2i(pcPosition.xy), 0).r;
            if (srcIndex == 0xFFFFFFFFu) {
                discard;
            }

            // Set global splat for reading to point to remapped source splat
            setSplat(srcIndex);

            // Read model-space data from source
            let modelCenter = getCenter();
            let color = getColor();
            let srcScale = getScale();
            let srcRot = getRotation();  // returns wxyz order

            // Transform to world space
            let worldCenter = (uniform.matrix_model * vec4f(modelCenter, 1.0)).xyz;

            // Make position local (relative to AABB center)
            let localCenter = worldCenter - uniform.aabb_center;

            // Combine rotations: world = model * source (convert to xyzw for quatMul)
            let srcRotXYZW = srcRot.yzwx;
            var worldRotation = quatMul(uniform.model_rotation, srcRotXYZW);
            if (worldRotation.w < 0.0) { worldRotation = -worldRotation; }

            // Combine scales
            let worldScale = uniform.model_scale * srcScale;

            // Write data in float format
            writeDataColor(color);
            writeDataCenter(vec4f(localCenter, 0.0));
            writeDataScale(vec4f(worldScale, 0.0));
            writeDataRotation(worldRotation.wxyz);  // convert xyzw back to wxyz for storage
        }
    `
};
