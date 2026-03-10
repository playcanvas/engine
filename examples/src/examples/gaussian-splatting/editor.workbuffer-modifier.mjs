/**
 * Work buffer modifier for the GSplat editor example.
 * This shader modifies splat appearance during rendering:
 * - Deleted splats (visible=0) are hidden by setting scale to zero
 * - Selected splats (selection>0.5) are tinted yellow for visual feedback
 */
export const workBufferModifier = {
    glsl: /* glsl */ `
        void modifySplatCenter(inout vec3 center) {
        }

        void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
            float visible = texelFetch(splatVisible, splat.uv, 0).r;
            if (visible < 0.5) {
                scale = vec3(0.0);  // Deleted - make invisible
            }
        }

        void modifySplatColor(vec3 center, inout vec4 color) {
            float selected = texelFetch(splatSelection, splat.uv, 0).r;
            if (selected > 0.5) {
                color.rgb = mix(color.rgb, vec3(1.0, 1.0, 0.0), 0.7);  // Yellow tint for selected
            }
        }
    `,
    wgsl: /* wgsl */ `
        fn modifySplatCenter(center: ptr<function, vec3f>) {
        }

        fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
            let visible = textureLoad(splatVisible, splat.uv, 0).r;
            if (visible < 0.5) {
                *scale = vec3f(0.0);  // Deleted - make invisible
            }
        }

        fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
            let selected = textureLoad(splatSelection, splat.uv, 0).r;
            if (selected > 0.5) {
                (*color).r = mix((*color).r, 1.0, 0.7);  // Yellow tint for selected
                (*color).g = mix((*color).g, 1.0, 0.7);
                (*color).b = mix((*color).b, 0.0, 0.7);
            }
        }
    `
};
