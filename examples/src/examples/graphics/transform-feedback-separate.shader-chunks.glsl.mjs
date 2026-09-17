/**
 * GLSL shader chunks for the separate transform feedback example. They take the per-instance colour
 * written by the instancing chunk and use it as the albedo, so the cones are still lit normally.
 */

// Declare the varying written by the instancing chunk in the vertex shader
export const litUserDeclarationPS = /* glsl */ `
    varying vec3 vInstColor;
`;

// Use the per-instance colour as the albedo
export const diffusePS = /* glsl */ `
    void getAlbedo() {
        dAlbedo = vInstColor;
    }
`;
