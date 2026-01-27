/**
 * Selection processor shader options for GSplatProcessor.
 * Marks splats inside AABB as selected (1), outside as not selected (0).
 */
export const selectionProcessor = {
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
                writeSplatSelection(vec4(1.0, 0.0, 0.0, 0.0));  // Mark as selected
            } else {
                writeSplatSelection(vec4(0.0));  // Mark as not selected
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
                writeSplatSelection(vec4f(1.0, 0.0, 0.0, 0.0));
            } else {
                writeSplatSelection(vec4f(0.0));
            }
        }
    `
};
