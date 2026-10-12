export default /* glsl */`
    #include "screenDepthPS"
    varying vec2 uv0;
    uniform vec3 params;

    void main()
    {
        float depth = getLinearScreenDepth(uv0);

        // near and far focus ranges
        float focusDistance = params.x;
        float focusRange = params.y;
        float invRange = params.z;
        float farRange = focusDistance + focusRange * 0.5;
        
        // near and far CoC
        float cocFar = min((depth - farRange) * invRange, 1.0);

        #ifdef NEAR_BLUR
            float nearRange = focusDistance - focusRange * 0.5;
            float cocNear = min((nearRange - depth) * invRange, 1.0);
        #else
            float cocNear = 0.0;
        #endif

        gl_FragColor = vec4(cocFar, cocNear, 0.0, 0.0);
    }
`;
