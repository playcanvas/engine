/**
 * Delete processor shader options for GSplatProcessor.
 * Checks AABB bounds and writes 0 to splatVisible for splats inside the box.
 */
export const deleteProcessor = {
    processGLSL: /* glsl */ `
        uniform vec3 uBoxMin;
        uniform vec3 uBoxMax;
        uniform mat4 matrix_model;

        void process() {
            vec3 center = getCenter();
            // Transform to world space
            vec3 worldCenter = (matrix_model * vec4(center, 1.0)).xyz;
            // Check if inside box
            if (all(greaterThanEqual(worldCenter, uBoxMin)) && all(lessThanEqual(worldCenter, uBoxMax))) {
                writeSplatVisible(vec4(0.0));  // Mark as not visible
            } else {
                discard; // do not change visibility
            }
        }
    `,
    processWGSL: /* wgsl */ `
        uniform uBoxMin: vec3f;
        uniform uBoxMax: vec3f;
        uniform matrix_model: mat4x4f;

        fn process() {
            let center = getCenter();
            // Transform to world space
            let worldCenter = (uniform.matrix_model * vec4f(center, 1.0)).xyz;
            // Check if inside box
            if (all(worldCenter >= uniform.uBoxMin) && all(worldCenter <= uniform.uBoxMax)) {
                writeSplatVisible(vec4f(0.0));  // Mark as not visible
            } else {
                discard; // do not change visibility
            }
        }
    `
};
