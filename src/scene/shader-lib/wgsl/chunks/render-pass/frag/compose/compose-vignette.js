export default /* wgsl */`
    #ifdef VIGNETTE
        uniform vignetterParams: vec4f;
        uniform vignetteColor: vec3f;
        
        // Global variable for debug
        var<private> dVignette: f32;
        
        fn calcVignette(uv: vec2f) -> f32 {
            let inner = uniform.vignetterParams.x;
            let outer = uniform.vignetterParams.y;
            let curvature = uniform.vignetterParams.z;
            let intensity = uniform.vignetterParams.w;

            // edge curvature
            let curve = pow(abs(uv * 2.0 - 1.0), vec2f(1.0 / curvature));

            // distance to edge
            let edge = pow(length(curve), curvature);

            // gradient and intensity
            dVignette = 1.0 - intensity * smoothstep(inner, outer, edge);
            return dVignette;
        }

        fn applyVignette(color: vec3f, uv: vec2f) -> vec3f {
            return mix(uniform.vignetteColor, color, calcVignette(uv));
        }
    #endif
`;
