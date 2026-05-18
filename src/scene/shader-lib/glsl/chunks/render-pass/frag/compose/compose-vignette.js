export default /* glsl */`
    #ifdef VIGNETTE
        uniform vec4 vignetterParams;
        uniform vec3 vignetteColor;
        
        // Global variable for debug
        float dVignette;
        
        float calcVignette(vec2 uv) {
            float inner = vignetterParams.x;
            float outer = vignetterParams.y;
            float curvature = vignetterParams.z;
            float intensity = vignetterParams.w;

            // edge curvature
            vec2 curve = pow(abs(uv * 2.0 -1.0), vec2(1.0 / curvature));

            // distance to edge
            float edge = pow(length(curve), curvature);

            // gradient and intensity
            dVignette = 1.0 - intensity * smoothstep(inner, outer, edge);
            return dVignette;
        }

        vec3 applyVignette(vec3 color, vec2 uv) {
            return mix(vignetteColor, color, calcVignette(uv));
        }
    #endif
`;
