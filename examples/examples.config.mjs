/**
 * @typedef {object} ExampleConfig
 * @property {string} [DESCRIPTION] - The example description.
 * @property {'DEVELOPMENT' | 'PERFORMANCE' | 'DEBUG'} [ENGINE] - The engine type.
 * @property {object} [FILES] - The object of extra files to include (e.g shaders).
 * @property {boolean} [INCLUDE_AR_LINK] - Include AR link png.
 * @property {boolean} [NO_DEVICE_SELECTOR] - No device selector.
 * @property {boolean} [NO_CANVAS] - No canvas element.
 * @property {boolean} [NO_MINISTATS] - No ministats.
 * @property {boolean} [WEBGPU_ENABLED] - If webGPU is enabled.
 */

/**
 * N.B. Format is <CATEGORY>_<EXAMPLE_NAME> where both placeholders are in Pascal case.
 */

/**
 * @type {ExampleConfig}
 */
export const Animation_BlendTrees1D = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Animation_ComponentProperties = {
    WEBGPU_ENABLED: true,
    DESCRIPTION: "This example demonstrates how to use the Anim Component to animate the properties of other Components."
};

/**
 * @type {ExampleConfig}
 */
export const Animation_BlendTrees2DDirectional = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Animation_BlendTrees2DCartesian = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Animation_Events = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Animation_LayerMasks = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Animation_Locomotion = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Animation_Tween = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Camera_Fly = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Camera_Orbit = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Camera_FirstPerson = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_AreaLights = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_AssetViewer = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_AreaPicker = {
    WEBGPU_ENABLED: false
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_BatchingDynamic = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ClusteredAreaLights = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ClusteredLighting = {
    ENGINE: "PERFORMANCE",
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ContactHardeningShadows = {
    WEBGPU_ENABLED: false
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ClusteredSpotShadows = {
    ENGINE: "DEBUG",
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_GrabPass = {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\n            attribute vec3 vertex_position;\n            attribute vec2 vertex_texCoord0;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n\n            varying vec2 texCoord;\n\n            void main(void)\n            {\n                // project the position\n                vec4 pos = matrix_model * vec4(vertex_position, 1.0);\n                gl_Position = matrix_viewProjection * pos;\n\n                texCoord = vertex_texCoord0;\n            }\n        ",
        "shader.frag": "\n            // use the special uSceneColorMap texture, which is a built-in texture containing\n            // a copy of the color buffer at the point of capture, inside the Depth layer.\n            uniform sampler2D uSceneColorMap;\n\n            // normal map providing offsets\n            uniform sampler2D uOffsetMap;\n\n            // roughness map\n            uniform sampler2D uRoughnessMap;\n\n            // tint colors\n            uniform vec3 tints[4];\n\n            // engine built-in constant storing render target size in .xy and inverse size in .zw\n            uniform vec4 uScreenSize;\n\n            varying vec2 texCoord;\n\n            void main(void)\n            {\n                float roughness = 1.0 - texture2D(uRoughnessMap, texCoord).r;\n\n                // sample offset texture - used to add distortion to the sampled background\n                vec2 offset = texture2D(uOffsetMap, texCoord).rg;\n                offset = 2.0 * offset - 1.0;\n\n                // offset strength\n                offset *= (0.2 + roughness) * 0.015;\n\n                // get normalized uv coordinates for canvas\n                vec2 grabUv = gl_FragCoord.xy * uScreenSize.zw;\n\n                // roughness dictates which mipmap level gets used, in 0..4 range\n                float mipmap = roughness * 5.0;\n\n                // get background pixel color with distorted offset\n                vec3 grabColor = texture2DLodEXT(uSceneColorMap, grabUv + offset, mipmap).rgb;\n\n                // tint the material based on mipmap, on WebGL2 only, as WebGL1 does not support non-constant array indexing\n                // (note - this could be worked around by using a series of if statements in this case)\n                #ifdef GL2\n                    float tintIndex = clamp(mipmap, 0.0, 3.0);\n                    grabColor *= tints[int(tintIndex)];\n                #endif\n\n                // brighten the refracted texture a little bit\n                // brighten even more the rough parts of the glass\n                gl_FragColor = vec4(grabColor * 1.1, 1.0) + roughness * 0.09;\n            }\n        "
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_Hierarchy = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_DitheredTransparency = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_HardwareInstancing = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_GroundFog = {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\n            attribute vec3 vertex_position;\n            attribute vec2 vertex_texCoord0;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n            uniform float uTime;\n            uniform sampler2D uTexture;\n\n            varying vec2 texCoord0;\n            varying vec2 texCoord1;\n            varying vec2 texCoord2;\n            varying vec4 screenPos;\n            varying float depth;\n\n            void main(void)\n            {\n                // 3 scrolling texture coordinates with different direction and speed\n                texCoord0 = vertex_texCoord0 * 2.0 + vec2(uTime * 0.003, uTime * 0.01);\n                texCoord1 = vertex_texCoord0 * 1.5 + vec2(uTime * -0.02, uTime * 0.02);\n                texCoord2 = vertex_texCoord0 * 1.0 + vec2(uTime * 0.01, uTime * -0.003);\n\n                // sample the fog texture to have elevation for this vertex\n                vec2 offsetTexCoord = vertex_texCoord0 + vec2(uTime * 0.001, uTime * -0.0003);\n                float offset = texture2D(uTexture, offsetTexCoord).r;\n\n                // vertex in the world space\n                vec4 pos = matrix_model * vec4(vertex_position, 1.0);\n\n                // move it up based on the offset\n                pos.y += offset * 25.0;\n\n                // position in projected (screen) space\n                vec4 projPos = matrix_viewProjection * pos;\n                gl_Position = projPos;\n\n                // the linear depth of the vertex (in camera space)\n                depth = getLinearDepth(pos.xyz);\n\n                // screen fragment position, used to sample the depth texture\n                screenPos = projPos;\n            }\n        ",
        "shader.frag": "\n            uniform sampler2D uTexture;\n            uniform float uSoftening;\n\n            varying vec2 texCoord0;\n            varying vec2 texCoord1;\n            varying vec2 texCoord2;\n            varying vec4 screenPos;\n            varying float depth;\n            \n            void main(void)\n            {\n                // sample the texture 3 times and compute average intensity of the fog\n                vec4 diffusTexture0 = texture2D (uTexture, texCoord0);\n                vec4 diffusTexture1 = texture2D (uTexture, texCoord1);\n                vec4 diffusTexture2 = texture2D (uTexture, texCoord2);\n                float alpha = 0.5 * (diffusTexture0.r + diffusTexture1.r + diffusTexture2.r);\n\n                // use built-in getGrabScreenPos function to convert screen position to grab texture uv coords\n                vec2 screenCoord = getGrabScreenPos(screenPos);\n\n                // read the depth from the depth buffer\n                float sceneDepth = getLinearScreenDepth(screenCoord) * camera_params.x;\n\n                // depth of the current fragment (on the fog plane)\n                float fragmentDepth = depth * camera_params.x;\n\n                // difference between these two depths is used to adjust the alpha, to fade out\n                // the fog near the geometry\n                float depthDiff = clamp(abs(fragmentDepth - sceneDepth) * uSoftening, 0.0, 1.0);\n                alpha *= smoothstep(0.0, 1.0, depthDiff);\n\n                // final color\n                vec3 fogColor = vec3(1.0, 1.0, 1.0);\n                gl_FragColor = vec4(fogColor, alpha);\n            }\n        "
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_IntegerTextures = {
    WEBGPU_ENABLED: true,
    DESCRIPTION: "<ul><li>Click to add sand<li>Shift-click to remove sand<li>Press space to reset.</ul>",
    FILES: {
        "sandSimulation.frag": "\n            precision highp usampler2D;\n\n            uniform usampler2D sourceTexture;\n            uniform vec2 mousePosition;\n            uniform uint mouseButton;\n            uniform uint passNum;\n            uniform uint brush;\n            uniform float randomVal;\n            uniform float brushRadius;\n\n            varying vec2 uv0;\n\n            const uint AIR = 0u;\n            const uint SAND = 1u;\n            const uint ORANGESAND = 2u;\n            const uint GRAYSAND = 3u;\n            const uint WALL = 4u;\n                                    \n            bool isInBounds(ivec2 c, ivec2 size) {\n                return c.x > 0 && c.x < size.x - 1 && c.y > 0 && c.y < size.y - 1;\n            }\n            \n            struct Particle {\n                uint element;        // 3 bits\n                bool movedThisFrame; // 1 bit\n                uint shade;          // 4 bits\n                uint waterMass;      // 8 bits\n            };\n\n            float rand(vec2 pos, float val) {\n                return fract(pos.x * pos.y * val * 1000.0);\n            }\n            \n            uint pack(Particle particle) {\n                uint packed = 0u;\n                packed |= (particle.element & 0x7u);      // Store element in the lowest 3 bits\n                packed |= ((particle.movedThisFrame ? 1u : 0u) << 3); // Store movedThisFrame in the next bit\n                packed |= (particle.shade << 4);          // Store shade in the next 4 bits\n            \n                return packed; // Second component is reserved/unused\n            }\n            \n            Particle unpack(uint packed) {\n                Particle particle;\n                particle.element = packed & 0x7u;                         // Extract lowest 3 bits\n                particle.movedThisFrame = ((packed >> 3) & 0x1u) != 0u;   // Extract the next bit\n                particle.shade = (packed >> 4) & 0xFu;                    // Extract the next 4 bits            \n                return particle;\n            }\n\n            Particle getParticle(ivec2 c) {\n                uint val = texelFetch(sourceTexture, c, 0).r;\n                return unpack(val);\n            }\n                        \n            void main() {\n\n                ivec2 size = textureSize(sourceTexture, 0);\n                ivec2 coord = ivec2(uv0 * vec2(size));\n\n                if (!isInBounds(coord, size)) {\n                    gl_FragColor = WALL;\n                    return;\n                }\n            \n                float mouseDist = distance(mousePosition, uv0);\n                int dir = int(passNum % 3u) - 1;\n\n                Particle currentParticle = getParticle(coord);\n                Particle nextState = currentParticle;\n\n                if (mouseButton == 1u && mouseDist < brushRadius) {\n                    nextState.element = brush;\n                    nextState.movedThisFrame = true;\n                    nextState.shade = uint(rand(uv0, randomVal * float(passNum)) * 15.0);\n                } else if (mouseButton == 2u && mouseDist < brushRadius) {\n                    nextState.element = AIR;\n                    nextState.movedThisFrame = false;\n                    nextState.shade = uint(rand(uv0, randomVal * float(passNum)) * 15.0);\n                }\n                \n                currentParticle.movedThisFrame = false;\n                if (currentParticle.element == AIR) {\n                    Particle above = getParticle(coord + ivec2(dir, -1));\n                    if (above.element != AIR && above.element != WALL) {\n                        nextState = above;\n                        nextState.movedThisFrame = true;\n                    }\n                } else if (currentParticle.element != WALL) {\n                    Particle below = getParticle(coord + ivec2(-dir, 1));\n                    if (below.element == AIR && !below.movedThisFrame) {\n                        nextState = below;\n                        nextState.movedThisFrame = false;\n                    }\n                }\n\n                gl_FragColor = pack(nextState);\n            }\n        ",
        "renderOutput.frag": "\n            precision highp usampler2D;\n            uniform usampler2D sourceTexture;\n            uniform vec2 mousePosition;\n            uniform float brushRadius;\n            varying vec2 uv0;\n\n            vec3 whiteColor = vec3(1.0);\n            vec3 skyBlueColor = vec3(0.2, 0.2, 0.2);\n            vec3 yellowSandColor = vec3(0.73, 0.58, 0.26);\n            vec3 orangeSandColor = vec3(0.87, 0.43, 0.22);\n            vec3 graySandColor = vec3(0.13, 0.16, 0.17);\n            vec3 grayWallColor = vec3(0.5, 0.5, 0.5);\n            vec3 waterBlueColor = vec3(0.2, 0.3, 0.8);\n\n            float circle( vec2 p, float r ) {\n                return length(p) - r;\n            }\n\n            const float circleOutline = 0.0025;\n\n            const uint AIR = 0u;\n            const uint SAND = 1u;\n            const uint ORANGESAND = 2u;\n            const uint GRAYSAND = 3u;\n            const uint WALL = 4u;\n                                    \n            bool isInBounds(ivec2 c, ivec2 size) {\n                return c.x > 0 && c.x < size.x - 1 && c.y > 0 && c.y < size.y - 1;\n            }\n            \n            struct Particle {\n                uint element;        // 3 bits\n                bool movedThisFrame; // 1 bit\n                uint shade;          // 4 bits\n                uint waterMass;      // 8 bits\n            };\n\n            float rand(vec2 pos, float val) {\n                return fract(pos.x * pos.y * val * 1000.0);\n            }\n            \n            uint pack(Particle particle) {\n                uint packed = 0u;\n                packed |= (particle.element & 0x7u);      // Store element in the lowest 3 bits\n                packed |= ((particle.movedThisFrame ? 1u : 0u) << 3); // Store movedThisFrame in the next bit\n                packed |= (particle.shade << 4);          // Store shade in the next 4 bits\n            \n                return packed; // Second component is reserved/unused\n            }\n            \n            Particle unpack(uint packed) {\n                Particle particle;\n                particle.element = packed & 0x7u;                         // Extract lowest 3 bits\n                particle.movedThisFrame = ((packed >> 3) & 0x1u) != 0u;   // Extract the next bit\n                particle.shade = (packed >> 4) & 0xFu;                    // Extract the next 4 bits            \n                return particle;\n            }\n\n            Particle getParticle(ivec2 c) {\n                uint val = texelFetch(sourceTexture, c, 0).r;\n                return unpack(val);\n            }\n\n            void main() {\n                ivec2 size = textureSize(sourceTexture, 0);\n                ivec2 coord = ivec2(uv0 * vec2(size));\n                Particle particle = getParticle(coord);\n                \n                vec3 gameColor = skyBlueColor;\n                if (particle.element == SAND) {\n                    gameColor = mix(yellowSandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);\n                } else if (particle.element == WALL) {\n                    gameColor = grayWallColor;\n                } else if (particle.element == ORANGESAND) {\n                    gameColor = mix(orangeSandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);\n                } else if (particle.element == GRAYSAND) {\n                    gameColor = mix(graySandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);\n                }\n\n                // Render a brush circle\n                float d = length(uv0 - mousePosition);\n                float wd = fwidth(d);\n                float circle = smoothstep(brushRadius + wd, brushRadius, d);\n                float circleInner = smoothstep(brushRadius - circleOutline + wd, brushRadius - circleOutline, d);\n                float brush = max(circle - circleInner, 0.0) * 0.5;\n\n                vec3 outColor = mix(gameColor, vec3(1.0), brush);\n\n                gl_FragColor = vec4(outColor, 1.0);\n            }\n        "
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_Layers = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_LightPhysicalUnits = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_Lights = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_LitMaterial = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_Lines = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_MaterialAnisotropic = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_MaterialClearCoat = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_MaterialPhysical = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_MaterialBasic = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_MaterialTranslucentSpecular = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_MeshGeneration = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_MeshDeformation = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_MeshMorph = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ModelAsset = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ModelTexturedBox = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ModelOutline = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_MeshDecals = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_MultiView = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_MeshMorphMany = {
    WEBGPU_ENABLED: false
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_MultiRenderTargets = {
    WEBGPU_ENABLED: true,
    FILES: {
        "output.frag": "\n            #ifdef MYMRT_PASS\n                // output world normal to target 1\n                pcFragColor1 = vec4(litArgs_worldNormal * 0.5 + 0.5, 1.0);\n\n                // output gloss to target 2\n                pcFragColor2 = vec4(vec3(litArgs_gloss) , 1.0);\n            #endif\n        "
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_Painter = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_PaintMesh = {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\n            // Attributes per vertex: position and uv\n            attribute vec4 aPosition;\n            attribute vec2 aUv0;\n        \n            // model matrix of the mesh\n            uniform mat4 matrix_model;\n\n            // decal view-projection matrix (orthographic)\n            uniform mat4 matrix_decal_viewProj;\n\n            // decal projected position to fragment program\n            varying vec4 decalPos;\n\n            void main(void)\n            {\n                // handle upside-down uv coordinates on WebGPU\n                vec2 uv = getImageEffectUV(aUv0);\n\n                // We render in texture space, so a position of this fragment is its uv-coordinates.\n                // Change the range of uv coordinates from 0..1 to projection space -1 to 1.\n                gl_Position = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0, 1.0);\n\n                // transform the vertex position to world space and then to decal space, and pass it\n                // to the fragment shader to sample the decal texture\n                vec4 worldPos = matrix_model * aPosition;\n                decalPos = matrix_decal_viewProj * worldPos;\n            }",
        "shader.frag": "\n            precision lowp float;\n            varying vec4 decalPos;\n            uniform sampler2D uDecalMap;\n\n            void main(void)\n            {\n                // decal space position from -1..1 range, to texture space range 0..1\n                vec4 p = decalPos * 0.5 + 0.5;\n \n                // if the position is outside out 0..1 projection box, ignore the pixel\n                if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z < 0.0 || p.z > 1.0)\n                    discard;\n\n                gl_FragColor = texture2D(uDecalMap, p.xy);\n            }"
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ParticlesSnow = {
    WEBGPU_ENABLED: false
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_PointCloudSimulation = {
    FILES: {
        "shader.vert": "\n// Attributes per vertex: position\nattribute vec4 aPosition;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\n\n// position of the camera\nuniform vec3 view_position;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // Transform the geometry\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n    gl_Position = modelViewProj * aPosition;\n\n    // vertex in world space\n    vec4 vertexWorld = matrix_model * aPosition;\n\n    // point sprite size depends on its distance to camera\n    // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0\n    #ifndef WEBGPU\n        float dist = 25.0 - length(vertexWorld.xyz - view_position);\n        gl_PointSize = clamp(dist * 2.0 - 1.0, 1.0, 15.0);\n    #endif\n\n    // color depends on position of particle\n    outColor = vec4(vertexWorld.y * 0.1, 0.1, vertexWorld.z * 0.1, 1.0);\n}",
        "shader.frag": "\nprecision mediump float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // color supplied by vertex shader\n    gl_FragColor = outColor;\n\n    // Using gl_PointCoord in WebGPU fails to compile with: \"unknown SPIR-V builtin: 16\"\n    #ifndef WEBGPU\n        // make point round instead of square - make pixels outside of the circle black, using provided gl_PointCoord\n        vec2 dist = gl_PointCoord.xy - vec2(0.5, 0.5);\n        gl_FragColor.a = 1.0 - smoothstep(0.4, 0.5, sqrt(dot(dist, dist)));\n    #endif\n}"
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ParticlesSpark = {
    WEBGPU_ENABLED: false
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_PostEffects = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_PointCloud = {
    FILES: {
        "shader.vert": "\n// Attributes per vertex: position\nattribute vec4 aPosition;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\n\n// time\nuniform float uTime;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // Transform the geometry\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n    gl_Position = modelViewProj * aPosition;\n\n    // vertex in world space\n    vec4 vertexWorld = matrix_model * aPosition;\n\n    // use sine way to generate intensity value based on time and also y-coordinate of model\n    float intensity = abs(sin(0.6 * vertexWorld.y + uTime * 1.0));\n\n    // intensity smoothly drops to zero for smaller values than 0.9\n    intensity = smoothstep(0.9, 1.0, intensity);\n\n    // point size depends on intensity\n    // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0\n    #ifndef WEBGPU\n        gl_PointSize = clamp(12.0 * intensity, 1.0, 64.0);\n    #endif\n\n    // color mixes red and yellow based on intensity\n    outColor = mix(vec4(1.0, 1.0, 0.0, 1.0), vec4(0.9, 0.0, 0.0, 1.0), intensity);\n}",
        "shader.frag": "\nprecision lowp float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // just output color supplied by vertex shader\n    gl_FragColor = outColor;\n}"
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_Portal = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_PostProcessing = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_RenderAsset = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ReflectionBox = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ReflectionCubemap = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ReflectionPlanar = {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\n            attribute vec3 aPosition;\n            attribute vec2 aUv0;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n\n            void main(void)\n            {\n                gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);;\n            }",
        "shader.frag": "\n\n            // engine built-in constant storing render target size in .xy and inverse size in .zw\n            uniform vec4 uScreenSize;\n\n            // reflection texture\n            uniform sampler2D uDiffuseMap;\n\n            void main(void)\n            {\n                // sample reflection texture\n                vec2 coord = gl_FragCoord.xy * uScreenSize.zw;\n                coord.y = 1.0 - coord.y;\n                vec4 reflection = texture2D(uDiffuseMap, coord);\n\n                gl_FragColor = vec4(reflection.xyz * 0.7, 1);\n            }"
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_RenderPass = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ShaderBurn = {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\nattribute vec3 aPosition;\nattribute vec2 aUv0;\n\nuniform mat4 matrix_model;\nuniform mat4 matrix_viewProjection;\n\nvarying vec2 vUv0;\n\nvoid main(void)\n{\n    vUv0 = aUv0;\n    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);\n}",
        "shader.frag": "\nprecision mediump float;\n\nvarying vec2 vUv0;\n\nuniform sampler2D uDiffuseMap;\nuniform sampler2D uHeightMap;\nuniform float uTime;\n\nvoid main(void)\n{\n    float height = texture2D(uHeightMap, vUv0).r;\n    vec4 color = texture2D(uDiffuseMap, vUv0);\n    if (height < uTime) {\n    discard;\n    }\n    if (height < (uTime + uTime * 0.1)) {\n    color = vec4(1.0, 0.2, 0.0, 1.0);\n    }\n    gl_FragColor = color;\n}"
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ShaderCompile = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_RenderToTexture = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ShadowCascades = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ShaderWobble = {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\nattribute vec3 aPosition;\nattribute vec2 aUv0;\n\nuniform mat4 matrix_model;\nuniform mat4 matrix_viewProjection;\nuniform float uTime;\n\nvarying vec2 vUv0;\n\nvoid main(void)\n{\n    vec4 pos = matrix_model * vec4(aPosition, 1.0);\n    pos.x += sin(uTime + pos.y * 4.0) * 0.1;\n    pos.y += cos(uTime + pos.x * 4.0) * 0.1;\n    vUv0 = aUv0;\n    gl_Position = matrix_viewProjection * pos;\n}",
        "shader.frag": "\nprecision mediump float;\n\nuniform sampler2D uDiffuseMap;\n\nvarying vec2 vUv0;\n\nvoid main(void)\n{\n    gl_FragColor = texture2D(uDiffuseMap, vUv0);\n}"
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_Shapes = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_ShaderToon = {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\n// Attributes per vertex: position, normal and texture coordinates\nattribute vec4 aPosition;\nattribute vec3 aNormal;\nattribute vec2 aUv;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\nuniform mat4   matrix_view;\nuniform mat3   matrix_normal;\nuniform vec3   uLightPos;\n\n// Color to fragment program\nvarying float vertOutTexCoord;\nvarying vec2 texCoord;\n\nvoid main(void)\n{\n    mat4 modelView = matrix_view * matrix_model;\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n\n    // Get surface normal in eye coordinates\n    vec3 eyeNormal = normalize(matrix_normal * aNormal);\n\n    // Get vertex position in eye coordinates\n    vec4 vertexPos = modelView * aPosition;\n    vec3 vertexEyePos = vertexPos.xyz / vertexPos.w;\n\n    // Get vector to light source\n    vec3 lightDir = normalize(uLightPos - vertexEyePos);\n\n    // Dot product gives us diffuse intensity. The diffuse intensity will be\n    // used as the 1D color texture coordinate to look for the color of the\n    // resulting fragment (see fragment shader).\n    vertOutTexCoord = max(0.0, dot(eyeNormal, lightDir));\n    texCoord = aUv;\n\n    // Transform the geometry\n    gl_Position = modelViewProj * aPosition;\n}",
        "shader.frag": "\nprecision mediump float;\nuniform sampler2D uTexture;\nvarying float vertOutTexCoord;\nvarying vec2 texCoord;\nvoid main(void)\n{\n    float v = vertOutTexCoord;\n    v = float(int(v * 6.0)) / 6.0;\n    // vec4 color = texture2D (uTexture, texCoord); // try this to use the diffuse color.\n    vec4 color = vec4(0.5, 0.47, 0.43, 1.0);\n    gl_FragColor = color * vec4(v, v, v, 1.0);\n}\n"
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_Sky = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_TextureBasis = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_TextureArray = {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\n            attribute vec3 aPosition;\n            attribute vec2 aUv0;\n            attribute vec3 aNormal;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n            uniform mat3 matrix_normal;\n\n            varying vec2 vUv0;\n            varying vec3 worldNormal;\n\n            void main(void)\n            {\n                vUv0 = aUv0;\n                worldNormal = normalize(matrix_normal * aNormal);\n                gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);\n            }",
        "shader.frag": "\n            varying vec2 vUv0;\n            varying vec3 worldNormal;\n            uniform float uTime;\n\n            uniform mediump sampler2DArray uDiffuseMap;\n\n            void main(void)\n            {\n                // sample different texture based on time along its texture v-coordinate\n                float index = (sin(uTime + vUv0.y + vUv0.x * 0.5) * 0.5 + 0.5) * 4.0;\n                vec4 data = texture(uDiffuseMap, vec3(vUv0, floor(index)));\n\n                data.rgb *= 0.8 * max(dot(worldNormal, vec3(0.1, 1.0, 0.5)), 0.0) + 0.5; // simple lighting\n                gl_FragColor = vec4(data.rgb, 1.0);\n            }",
        "ground.frag": "\n            varying vec2 vUv0;\n            varying vec3 worldNormal;\n\n            uniform mediump sampler2DArray uDiffuseMap;\n\n            void main(void)\n            {\n                vec4 data = texture(uDiffuseMap, vec3(vUv0, step(vUv0.x, 0.5) + 2.0 * step(vUv0.y, 0.5)));\n                data.rgb *= 0.8 * max(dot(worldNormal, vec3(0.1, 1.0, 0.5)), 0.0) + 0.5; // simple lighting\n                gl_FragColor = vec4(data.rgb, 1.0);\n            }"
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_TransformFeedback = {
    WEBGPU_ENABLED: false,
    FILES: {
        "shaderFeedback.vert": "\n// vertex shader used to move particles during transform-feedback simulation step\n\n// input and output is vec4, containing position in .xyz and lifetime in .w\nattribute vec4 vertex_position;\nvarying vec4 out_vertex_position;\n\n// parameters controlling simulation\nuniform float deltaTime;\nuniform float areaSize;\n\n// texture storing random direction vectors\nuniform sampler2D directionSampler;\n\n// function returning random number based on vec2 seed parameter\nfloat rand(vec2 co) {\n    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);\n}\n\nvoid main(void) {\n\n    // texture contains direction of particle movement - read it based on particle's position\n    vec2 texCoord = vertex_position.xz / areaSize + 0.5;\n    vec3 dir = texture2D(directionSampler, texCoord).xyz;\n    dir = dir * 2.0 - 1.0;\n\n    // move particle along direction with some speed\n    float speed = 20.0 * deltaTime;\n    vec3 pos = vertex_position.xyz + dir * speed;\n\n    // age the particle\n    float liveTime = vertex_position.w;\n    liveTime -= deltaTime;\n\n    // if particle is too old, regenerate it\n    if (liveTime <= 0.0) {\n\n        // random life time\n        liveTime = rand(pos.xy) * 2.0;\n\n        // random position\n        pos.x = rand(pos.xz) * areaSize - 0.5 * areaSize;\n        pos.y = rand(pos.xy) * 4.0;\n        pos.z = rand(pos.yz) * areaSize - 0.5 * areaSize;\n    }\n\n    // write out updated particle\n    out_vertex_position = vec4(pos, liveTime);\n}",
        "shaderCloud.vert": "\n// vertex shader used to render point sprite particles\n\n// Attributes per vertex: position\nattribute vec4 aPosition;\n\nuniform mat4   matrix_viewProjection;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // Transform the geometry (ignore life time which is stored in .w of position)\n    vec4 worldPosition = vec4(aPosition.xyz, 1);\n    gl_Position = matrix_viewProjection * worldPosition;\n\n    // point sprite size\n    gl_PointSize = 2.0;\n\n    // color depends on position of particle\n    outColor = vec4(worldPosition.y * 0.25, 0.1, worldPosition.z * 0.2, 1);\n}",
        "shaderCloud.frag": "\n// fragment shader used to render point sprite particles\nprecision mediump float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // color supplied by vertex shader\n    gl_FragColor = outColor;\n}"
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_VideoTexture = {
    WEBGPU_ENABLED: false
};

/**
 * @type {ExampleConfig}
 */
export const Input_Mouse = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Input_Gamepad = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Input_Keyboard = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Loaders_DracoGlb = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Loaders_GsplatMany = {
    FILES: {
        "shader.vert": "\n            uniform float uTime;\n            varying float height;\n\n            void main(void)\n            {\n                // evaluate center of the splat in object space\n                vec3 centerLocal = evalCenter();\n\n                // modify it\n                float heightIntensity = centerLocal.y * 0.2;\n                centerLocal.x += sin(uTime * 5.0 + centerLocal.y) * 0.3 * heightIntensity;\n\n                // output y-coordinate\n                height = centerLocal.y;\n\n                // evaluate the rest of the splat using world space center\n                vec4 centerWorld = matrix_model * vec4(centerLocal, 1.0);\n                gl_Position = evalSplat(centerWorld);\n            }\n        ",
        "shader.frag": "\n            uniform float uTime;\n            varying float height;\n\n            void main(void)\n            {\n                // get splat color and alpha\n                gl_FragColor = evalSplat();\n\n                // modify it\n                vec3 gold = vec3(1.0, 0.85, 0.0);\n                float sineValue = abs(sin(uTime * 5.0 + height));\n                float blend = smoothstep(0.9, 1.0, sineValue);\n                gl_FragColor.xyz = mix(gl_FragColor.xyz, gold, blend);\n            }\n        "
    }
};

/**
 * @type {ExampleConfig}
 */
export const Loaders_GltfExport = {
    WEBGPU_ENABLED: true,
    INCLUDE_AR_LINK: true
};

/**
 * @type {ExampleConfig}
 */
export const Loaders_UsdzExport = {
    WEBGPU_ENABLED: true,
    INCLUDE_AR_LINK: true
};

/**
 * @type {ExampleConfig}
 */
export const Loaders_LoadersGl = {
    FILES: {
        "shader.vert": "\n            // Attributes per vertex: position\n            attribute vec4 aPosition;\n            attribute vec4 aColor;\n            \n            uniform mat4   matrix_viewProjection;\n            uniform mat4   matrix_model;\n            \n            // Color to fragment program\n            varying vec4 outColor;\n            \n            void main(void)\n            {\n                mat4 modelViewProj = matrix_viewProjection * matrix_model;\n                gl_Position = modelViewProj * aPosition;\n            \n                // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0\n                #ifndef WEBGPU\n                    gl_PointSize = 1.5;\n                #endif\n            \n                outColor = aColor;\n            }",
        "shader.frag": "\n            precision lowp float;\n            varying vec4 outColor;\n            \n            void main(void)\n            {\n                // just output color supplied by vertex shader\n                gl_FragColor = outColor;\n            }"
    }
};

/**
 * @type {ExampleConfig}
 */
export const Misc_HelloWorld = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Loaders_Glb = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Loaders_Obj = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Misc_MiniStats = {
    ENGINE: "PERFORMANCE",
    NO_MINISTATS: true
};

/**
 * @type {ExampleConfig}
 */
export const Misc_Gizmos = {
    WEBGPU_ENABLED: false
};

/**
 * @type {ExampleConfig}
 */
export const Misc_Spineboy = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Misc_MultiApp = {
    NO_CANVAS: true,
    NO_MINISTATS: true,
    NO_DEVICE_SELECTOR: true
};

/**
 * @type {ExampleConfig}
 */
export const Physics_CompoundCollision = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Physics_OffsetCollision = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Physics_FallingShapes = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Physics_Raycast = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const UserInterface_ButtonBasic = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Physics_Vehicle = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const UserInterface_LayoutGroup = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const UserInterface_CustomShader = {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\n/**\n * Simple Screen-Space Vertex Shader with one UV coordinate.\n * This shader is useful for simple UI shaders.\n * \n * Usage: the following attributes must be configured when creating a new pc.Shader:\n *   vertex_position: pc.SEMANTIC_POSITION\n *   vertex_texCoord0: pc.SEMANTIC_TEXCOORD0\n */\n\n// Default PlayCanvas uniforms\nuniform mat4 matrix_viewProjection;\nuniform mat4 matrix_model;\n\n// Additional inputs\nattribute vec3 vertex_position;\nattribute vec2 vertex_texCoord0;\n\n// Additional shader outputs\nvarying vec2 vUv0;\n\nvoid main(void) {\n    // UV is simply passed along as varying\n    vUv0 = vertex_texCoord0;\n\n    // Position for screen-space\n    gl_Position = matrix_model * vec4(vertex_position, 1.0);\n    gl_Position.zw = vec2(0.0, 1.0);\n}",
        "shader.frag": "\n/**\n * Simple Color-Inverse Fragment Shader with intensity control.\n * \n * Usage: the following parameters must be set:\n *   uDiffuseMap: image texture.\n *   amount: float that controls the amount of the inverse-color effect. 0 means none (normal color), while 1 means full inverse.\n *\n * Additionally, the Vertex shader that is paired with this Fragment shader must specify:\n *   varying vec2 vUv0: for the UV.\n */\n\n// The following line is for setting the shader precision for floats. It is commented out because, ideally, it must be configured\n// on a per-device basis before loading the Shader. Please check the accompanying TypeScript code and look for 'app.graphicsDevice.precision'.\n\n// precision mediump float;\n\n// Additional varying from vertex shader\nvarying vec2 vUv0;\n\n// Custom Parameters (must be set from code via material.setParameter())\nuniform sampler2D uDiffuseMap;\nuniform float amount;\n\nvoid main(void)\n{\n    vec4 color = texture2D(uDiffuseMap, vUv0);\n    vec3 roloc = 1.0 - color.rgb;\n    gl_FragColor = vec4(mix(color.rgb, roloc, amount), color.a);\n}"
    }
};

/**
 * @type {ExampleConfig}
 */
export const UserInterface_ButtonSprite = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const Sound_Positional = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const UserInterface_ScrollView = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const UserInterface_TextEmojis = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const UserInterface_TextAutoFontSize = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const UserInterface_TextLocalization = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const UserInterface_TextTypewriter = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const UserInterface_Text = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const UserInterface_WorldToScreen = {
    WEBGPU_ENABLED: true
};

/**
 * @type {ExampleConfig}
 */
export const UserInterface_WorldUi = {
    WEBGPU_ENABLED: true
};
