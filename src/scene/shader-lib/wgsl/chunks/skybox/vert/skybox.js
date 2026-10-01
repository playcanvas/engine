export default /* wgsl */`
    // Attribute
    attribute aPosition : vec4f;

    uniform matrix_view : mat4x4f;
    uniform matrix_projectionSkybox : mat4x4f;
    uniform cubeMapRotationMatrix : mat3x3f;

    varying vViewDir : vec3f;

    #ifdef SKY_FISHEYE
        varying vClipXYW : vec3f;
        uniform projectionFlipY : f32;
    #endif

    #if defined(PREPASS_PASS) || (defined(SCENE_TEXTURE_DEPTH) && defined(SKYMESH))
        // Depth-based effects can use either the prepass or the scene pass depth output.
        varying vLinearDepth: f32;
    #endif

    #ifdef SKYMESH
        uniform matrix_model : mat4x4f;
        varying vWorldPos : vec3f;
    #endif

    @vertex
    fn vertexMain(input : VertexInput) -> VertexOutput {

        var output : VertexOutput;
        var view : mat4x4f = uniform.matrix_view;

        #ifdef SKYMESH

            var worldPos : vec4f = uniform.matrix_model * input.aPosition;
            output.vWorldPos = worldPos.xyz;
            output.position = uniform.matrix_projectionSkybox * (view * worldPos);

            #if defined(PREPASS_PASS) || defined(SCENE_TEXTURE_DEPTH)
                // linear depth from the worldPosition, see getLinearDepth
                output.vLinearDepth = -(uniform.matrix_view * vec4f(worldPos.xyz, 1.0)).z;
            #endif

        #else

            view[3][0] = 0.0;
            view[3][1] = 0.0;
            view[3][2] = 0.0;
            output.vViewDir = input.aPosition.xyz * uniform.cubeMapRotationMatrix;

            #ifdef SKY_FISHEYE
                // Bypass matrix_projectionSkybox which degenerates at extreme FOVs.
                // Use a fixed ~90° perspective (p00=p11=1) so the box always covers the
                // screen. The fragment shader recomputes view direction from screen
                // coordinates, so only rasterization coverage matters here.
                var viewPos : vec4f = view * input.aPosition;
                output.vClipXYW = vec3f(viewPos.xy, -viewPos.z);

                // apply the per-pass target flip, so the rasterized position (and winding, which the
                // renderer compensates for) matches the target orientation
                output.position = vec4f(viewPos.x, viewPos.y * uniform.projectionFlipY, 0.0, -viewPos.z);
            #else
                output.position = uniform.matrix_projectionSkybox * (view * input.aPosition);
            #endif

            #ifdef PREPASS_PASS
                // for infinite skybox, use negative gl_Position.w to get positive linear depth
                output.vLinearDepth = -pcPosition.w;
            #endif
        #endif

        // Force skybox to far Z, regardless of the clip planes on the camera
        // Subtract a tiny fudge factor to ensure floating point errors don't
        // still push pixels beyond far Z. See:
        // https://community.khronos.org/t/skybox-problem/61857

        output.position.z = output.position.w - 1.0e-7;

        return output;
    }
`;
