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
        "shader.vert": /* glsl */`
            attribute vec3 vertex_position;
            attribute vec2 vertex_texCoord0;

            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;

            varying vec2 texCoord;

            void main(void)
            {
                // project the position
                vec4 pos = matrix_model * vec4(vertex_position, 1.0);
                gl_Position = matrix_viewProjection * pos;

                texCoord = vertex_texCoord0;
            }
        `,
        "shader.frag": /* glsl */`
            // use the special uSceneColorMap texture, which is a built-in texture containing
            // a copy of the color buffer at the point of capture, inside the Depth layer.
            uniform sampler2D uSceneColorMap;

            // normal map providing offsets
            uniform sampler2D uOffsetMap;

            // roughness map
            uniform sampler2D uRoughnessMap;

            // tint colors
            uniform vec3 tints[4];

            // engine built-in constant storing render target size in .xy and inverse size in .zw
            uniform vec4 uScreenSize;

            varying vec2 texCoord;

            void main(void)
            {
                float roughness = 1.0 - texture2D(uRoughnessMap, texCoord).r;

                // sample offset texture - used to add distortion to the sampled background
                vec2 offset = texture2D(uOffsetMap, texCoord).rg;
                offset = 2.0 * offset - 1.0;

                // offset strength
                offset *= (0.2 + roughness) * 0.015;

                // get normalized uv coordinates for canvas
                vec2 grabUv = gl_FragCoord.xy * uScreenSize.zw;

                // roughness dictates which mipmap level gets used, in 0..4 range
                float mipmap = roughness * 5.0;

                // get background pixel color with distorted offset
                vec3 grabColor = texture2DLodEXT(uSceneColorMap, grabUv + offset, mipmap).rgb;

                // tint the material based on mipmap, on WebGL2 only, as WebGL1 does not support non-constant array indexing
                // (note - this could be worked around by using a series of if statements in this case)
                #ifdef GL2
                    float tintIndex = clamp(mipmap, 0.0, 3.0);
                    grabColor *= tints[int(tintIndex)];
                #endif

                // brighten the refracted texture a little bit
                // brighten even more the rough parts of the glass
                gl_FragColor = vec4(grabColor * 1.1, 1.0) + roughness * 0.09;
            }
        `
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
        "shader.vert": /* glsl */`
            attribute vec3 vertex_position;
            attribute vec2 vertex_texCoord0;

            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;
            uniform float uTime;
            uniform sampler2D uTexture;

            varying vec2 texCoord0;
            varying vec2 texCoord1;
            varying vec2 texCoord2;
            varying vec4 screenPos;
            varying float depth;

            void main(void)
            {
                // 3 scrolling texture coordinates with different direction and speed
                texCoord0 = vertex_texCoord0 * 2.0 + vec2(uTime * 0.003, uTime * 0.01);
                texCoord1 = vertex_texCoord0 * 1.5 + vec2(uTime * -0.02, uTime * 0.02);
                texCoord2 = vertex_texCoord0 * 1.0 + vec2(uTime * 0.01, uTime * -0.003);

                // sample the fog texture to have elevation for this vertex
                vec2 offsetTexCoord = vertex_texCoord0 + vec2(uTime * 0.001, uTime * -0.0003);
                float offset = texture2D(uTexture, offsetTexCoord).r;

                // vertex in the world space
                vec4 pos = matrix_model * vec4(vertex_position, 1.0);

                // move it up based on the offset
                pos.y += offset * 25.0;

                // position in projected (screen) space
                vec4 projPos = matrix_viewProjection * pos;
                gl_Position = projPos;

                // the linear depth of the vertex (in camera space)
                depth = getLinearDepth(pos.xyz);

                // screen fragment position, used to sample the depth texture
                screenPos = projPos;
            }
        `,
        "shader.frag": /* glsl */`
            uniform sampler2D uTexture;
            uniform float uSoftening;

            varying vec2 texCoord0;
            varying vec2 texCoord1;
            varying vec2 texCoord2;
            varying vec4 screenPos;
            varying float depth;
            
            void main(void)
            {
                // sample the texture 3 times and compute average intensity of the fog
                vec4 diffusTexture0 = texture2D (uTexture, texCoord0);
                vec4 diffusTexture1 = texture2D (uTexture, texCoord1);
                vec4 diffusTexture2 = texture2D (uTexture, texCoord2);
                float alpha = 0.5 * (diffusTexture0.r + diffusTexture1.r + diffusTexture2.r);

                // use built-in getGrabScreenPos function to convert screen position to grab texture uv coords
                vec2 screenCoord = getGrabScreenPos(screenPos);

                // read the depth from the depth buffer
                float sceneDepth = getLinearScreenDepth(screenCoord) * camera_params.x;

                // depth of the current fragment (on the fog plane)
                float fragmentDepth = depth * camera_params.x;

                // difference between these two depths is used to adjust the alpha, to fade out
                // the fog near the geometry
                float depthDiff = clamp(abs(fragmentDepth - sceneDepth) * uSoftening, 0.0, 1.0);
                alpha *= smoothstep(0.0, 1.0, depthDiff);

                // final color
                vec3 fogColor = vec3(1.0, 1.0, 1.0);
                gl_FragColor = vec4(fogColor, alpha);
            }
        `
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_IntegerTextures = {
    WEBGPU_ENABLED: true,
    DESCRIPTION: "<ul><li>Click to add sand<li>Shift-click to remove sand<li>Press space to reset.</ul>",
    FILES: {
        "sandSimulation.frag": /* glsl */`
            precision highp usampler2D;

            uniform usampler2D sourceTexture;
            uniform vec2 mousePosition;
            uniform uint mouseButton;
            uniform uint passNum;
            uniform uint brush;
            uniform float randomVal;
            uniform float brushRadius;

            varying vec2 uv0;

            const uint AIR = 0u;
            const uint SAND = 1u;
            const uint ORANGESAND = 2u;
            const uint GRAYSAND = 3u;
            const uint WALL = 4u;
                                    
            bool isInBounds(ivec2 c, ivec2 size) {
                return c.x > 0 && c.x < size.x - 1 && c.y > 0 && c.y < size.y - 1;
            }
            
            struct Particle {
                uint element;        // 3 bits
                bool movedThisFrame; // 1 bit
                uint shade;          // 4 bits
                uint waterMass;      // 8 bits
            };

            float rand(vec2 pos, float val) {
                return fract(pos.x * pos.y * val * 1000.0);
            }
            
            uint pack(Particle particle) {
                uint packed = 0u;
                packed |= (particle.element & 0x7u);      // Store element in the lowest 3 bits
                packed |= ((particle.movedThisFrame ? 1u : 0u) << 3); // Store movedThisFrame in the next bit
                packed |= (particle.shade << 4);          // Store shade in the next 4 bits
            
                return packed; // Second component is reserved/unused
            }
            
            Particle unpack(uint packed) {
                Particle particle;
                particle.element = packed & 0x7u;                         // Extract lowest 3 bits
                particle.movedThisFrame = ((packed >> 3) & 0x1u) != 0u;   // Extract the next bit
                particle.shade = (packed >> 4) & 0xFu;                    // Extract the next 4 bits            
                return particle;
            }

            Particle getParticle(ivec2 c) {
                uint val = texelFetch(sourceTexture, c, 0).r;
                return unpack(val);
            }
                        
            void main() {

                ivec2 size = textureSize(sourceTexture, 0);
                ivec2 coord = ivec2(uv0 * vec2(size));

                if (!isInBounds(coord, size)) {
                    gl_FragColor = WALL;
                    return;
                }
            
                float mouseDist = distance(mousePosition, uv0);
                int dir = int(passNum % 3u) - 1;

                Particle currentParticle = getParticle(coord);
                Particle nextState = currentParticle;

                if (mouseButton == 1u && mouseDist < brushRadius) {
                    nextState.element = brush;
                    nextState.movedThisFrame = true;
                    nextState.shade = uint(rand(uv0, randomVal * float(passNum)) * 15.0);
                } else if (mouseButton == 2u && mouseDist < brushRadius) {
                    nextState.element = AIR;
                    nextState.movedThisFrame = false;
                    nextState.shade = uint(rand(uv0, randomVal * float(passNum)) * 15.0);
                }
                
                currentParticle.movedThisFrame = false;
                if (currentParticle.element == AIR) {
                    Particle above = getParticle(coord + ivec2(dir, -1));
                    if (above.element != AIR && above.element != WALL) {
                        nextState = above;
                        nextState.movedThisFrame = true;
                    }
                } else if (currentParticle.element != WALL) {
                    Particle below = getParticle(coord + ivec2(-dir, 1));
                    if (below.element == AIR && !below.movedThisFrame) {
                        nextState = below;
                        nextState.movedThisFrame = false;
                    }
                }

                gl_FragColor = pack(nextState);
            }
        `,
        "renderOutput.frag": /* glsl */`
            precision highp usampler2D;
            uniform usampler2D sourceTexture;
            uniform vec2 mousePosition;
            uniform float brushRadius;
            varying vec2 uv0;

            vec3 whiteColor = vec3(1.0);
            vec3 skyBlueColor = vec3(0.2, 0.2, 0.2);
            vec3 yellowSandColor = vec3(0.73, 0.58, 0.26);
            vec3 orangeSandColor = vec3(0.87, 0.43, 0.22);
            vec3 graySandColor = vec3(0.13, 0.16, 0.17);
            vec3 grayWallColor = vec3(0.5, 0.5, 0.5);
            vec3 waterBlueColor = vec3(0.2, 0.3, 0.8);

            float circle( vec2 p, float r ) {
                return length(p) - r;
            }

            const float circleOutline = 0.0025;

            const uint AIR = 0u;
            const uint SAND = 1u;
            const uint ORANGESAND = 2u;
            const uint GRAYSAND = 3u;
            const uint WALL = 4u;
                                    
            bool isInBounds(ivec2 c, ivec2 size) {
                return c.x > 0 && c.x < size.x - 1 && c.y > 0 && c.y < size.y - 1;
            }
            
            struct Particle {
                uint element;        // 3 bits
                bool movedThisFrame; // 1 bit
                uint shade;          // 4 bits
                uint waterMass;      // 8 bits
            };

            float rand(vec2 pos, float val) {
                return fract(pos.x * pos.y * val * 1000.0);
            }
            
            uint pack(Particle particle) {
                uint packed = 0u;
                packed |= (particle.element & 0x7u);      // Store element in the lowest 3 bits
                packed |= ((particle.movedThisFrame ? 1u : 0u) << 3); // Store movedThisFrame in the next bit
                packed |= (particle.shade << 4);          // Store shade in the next 4 bits
            
                return packed; // Second component is reserved/unused
            }
            
            Particle unpack(uint packed) {
                Particle particle;
                particle.element = packed & 0x7u;                         // Extract lowest 3 bits
                particle.movedThisFrame = ((packed >> 3) & 0x1u) != 0u;   // Extract the next bit
                particle.shade = (packed >> 4) & 0xFu;                    // Extract the next 4 bits            
                return particle;
            }

            Particle getParticle(ivec2 c) {
                uint val = texelFetch(sourceTexture, c, 0).r;
                return unpack(val);
            }

            void main() {
                ivec2 size = textureSize(sourceTexture, 0);
                ivec2 coord = ivec2(uv0 * vec2(size));
                Particle particle = getParticle(coord);
                
                vec3 gameColor = skyBlueColor;
                if (particle.element == SAND) {
                    gameColor = mix(yellowSandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);
                } else if (particle.element == WALL) {
                    gameColor = grayWallColor;
                } else if (particle.element == ORANGESAND) {
                    gameColor = mix(orangeSandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);
                } else if (particle.element == GRAYSAND) {
                    gameColor = mix(graySandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);
                }

                // Render a brush circle
                float d = length(uv0 - mousePosition);
                float wd = fwidth(d);
                float circle = smoothstep(brushRadius + wd, brushRadius, d);
                float circleInner = smoothstep(brushRadius - circleOutline + wd, brushRadius - circleOutline, d);
                float brush = max(circle - circleInner, 0.0) * 0.5;

                vec3 outColor = mix(gameColor, vec3(1.0), brush);

                gl_FragColor = vec4(outColor, 1.0);
            }
        `
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
        "output.frag": /* glsl */`
            #ifdef MYMRT_PASS
                // output world normal to target 1
                pcFragColor1 = vec4(litArgs_worldNormal * 0.5 + 0.5, 1.0);

                // output gloss to target 2
                pcFragColor2 = vec4(vec3(litArgs_gloss) , 1.0);
            #endif
        `
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
        "shader.vert": /* glsl */`
            // Attributes per vertex: position and uv
            attribute vec4 aPosition;
            attribute vec2 aUv0;
        
            // model matrix of the mesh
            uniform mat4 matrix_model;

            // decal view-projection matrix (orthographic)
            uniform mat4 matrix_decal_viewProj;

            // decal projected position to fragment program
            varying vec4 decalPos;

            void main(void)
            {
                // handle upside-down uv coordinates on WebGPU
                vec2 uv = getImageEffectUV(aUv0);

                // We render in texture space, so a position of this fragment is its uv-coordinates.
                // Change the range of uv coordinates from 0..1 to projection space -1 to 1.
                gl_Position = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0, 1.0);

                // transform the vertex position to world space and then to decal space, and pass it
                // to the fragment shader to sample the decal texture
                vec4 worldPos = matrix_model * aPosition;
                decalPos = matrix_decal_viewProj * worldPos;
            }`,
        "shader.frag": /* glsl */`
            precision lowp float;
            varying vec4 decalPos;
            uniform sampler2D uDecalMap;

            void main(void)
            {
                // decal space position from -1..1 range, to texture space range 0..1
                vec4 p = decalPos * 0.5 + 0.5;
 
                // if the position is outside out 0..1 projection box, ignore the pixel
                if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z < 0.0 || p.z > 1.0)
                    discard;

                gl_FragColor = texture2D(uDecalMap, p.xy);
            }`
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
        "shader.vert": /* glsl */`
// Attributes per vertex: position
attribute vec4 aPosition;

uniform mat4   matrix_viewProjection;
uniform mat4   matrix_model;

// position of the camera
uniform vec3 view_position;

// Color to fragment program
varying vec4 outColor;

void main(void)
{
    // Transform the geometry
    mat4 modelViewProj = matrix_viewProjection * matrix_model;
    gl_Position = modelViewProj * aPosition;

    // vertex in world space
    vec4 vertexWorld = matrix_model * aPosition;

    // point sprite size depends on its distance to camera
    // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0
    #ifndef WEBGPU
        float dist = 25.0 - length(vertexWorld.xyz - view_position);
        gl_PointSize = clamp(dist * 2.0 - 1.0, 1.0, 15.0);
    #endif

    // color depends on position of particle
    outColor = vec4(vertexWorld.y * 0.1, 0.1, vertexWorld.z * 0.1, 1.0);
}`,
        "shader.frag": /* glsl */`
precision mediump float;
varying vec4 outColor;

void main(void)
{
    // color supplied by vertex shader
    gl_FragColor = outColor;

    // Using gl_PointCoord in WebGPU fails to compile with: \"unknown SPIR-V builtin: 16\"
    #ifndef WEBGPU
        // make point round instead of square - make pixels outside of the circle black, using provided gl_PointCoord
        vec2 dist = gl_PointCoord.xy - vec2(0.5, 0.5);
        gl_FragColor.a = 1.0 - smoothstep(0.4, 0.5, sqrt(dot(dist, dist)));
    #endif
}`
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
        "shader.vert": /* glsl */`
// Attributes per vertex: position
attribute vec4 aPosition;

uniform mat4   matrix_viewProjection;
uniform mat4   matrix_model;

// time
uniform float uTime;

// Color to fragment program
varying vec4 outColor;

void main(void)
{
    // Transform the geometry
    mat4 modelViewProj = matrix_viewProjection * matrix_model;
    gl_Position = modelViewProj * aPosition;

    // vertex in world space
    vec4 vertexWorld = matrix_model * aPosition;

    // use sine way to generate intensity value based on time and also y-coordinate of model
    float intensity = abs(sin(0.6 * vertexWorld.y + uTime * 1.0));

    // intensity smoothly drops to zero for smaller values than 0.9
    intensity = smoothstep(0.9, 1.0, intensity);

    // point size depends on intensity
    // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0
    #ifndef WEBGPU
        gl_PointSize = clamp(12.0 * intensity, 1.0, 64.0);
    #endif

    // color mixes red and yellow based on intensity
    outColor = mix(vec4(1.0, 1.0, 0.0, 1.0), vec4(0.9, 0.0, 0.0, 1.0), intensity);
}`,
        "shader.frag": /* glsl */`
precision lowp float;
varying vec4 outColor;

void main(void)
{
    // just output color supplied by vertex shader
    gl_FragColor = outColor;
}`
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
        "shader.vert": /* glsl */`
            attribute vec3 aPosition;
            attribute vec2 aUv0;

            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;

            void main(void)
            {
                gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);;
            }`,
        "shader.frag": /* glsl */`

            // engine built-in constant storing render target size in .xy and inverse size in .zw
            uniform vec4 uScreenSize;

            // reflection texture
            uniform sampler2D uDiffuseMap;

            void main(void)
            {
                // sample reflection texture
                vec2 coord = gl_FragCoord.xy * uScreenSize.zw;
                coord.y = 1.0 - coord.y;
                vec4 reflection = texture2D(uDiffuseMap, coord);

                gl_FragColor = vec4(reflection.xyz * 0.7, 1);
            }`
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
        "shader.vert": /* glsl */`
attribute vec3 aPosition;
attribute vec2 aUv0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

varying vec2 vUv0;

void main(void)
{
    vUv0 = aUv0;
    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
}`,
        "shader.frag": /* glsl */`
precision mediump float;

varying vec2 vUv0;

uniform sampler2D uDiffuseMap;
uniform sampler2D uHeightMap;
uniform float uTime;

void main(void)
{
    float height = texture2D(uHeightMap, vUv0).r;
    vec4 color = texture2D(uDiffuseMap, vUv0);
    if (height < uTime) {
    discard;
    }
    if (height < (uTime + uTime * 0.1)) {
    color = vec4(1.0, 0.2, 0.0, 1.0);
    }
    gl_FragColor = color;
}`
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
        "shader.vert": /* glsl */`
attribute vec3 aPosition;
attribute vec2 aUv0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uTime;

varying vec2 vUv0;

void main(void)
{
    vec4 pos = matrix_model * vec4(aPosition, 1.0);
    pos.x += sin(uTime + pos.y * 4.0) * 0.1;
    pos.y += cos(uTime + pos.x * 4.0) * 0.1;
    vUv0 = aUv0;
    gl_Position = matrix_viewProjection * pos;
}`,
        "shader.frag": /* glsl */`
precision mediump float;

uniform sampler2D uDiffuseMap;

varying vec2 vUv0;

void main(void)
{
    gl_FragColor = texture2D(uDiffuseMap, vUv0);
}`
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
        "shader.vert": /* glsl */`
// Attributes per vertex: position, normal and texture coordinates
attribute vec4 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;

uniform mat4   matrix_viewProjection;
uniform mat4   matrix_model;
uniform mat4   matrix_view;
uniform mat3   matrix_normal;
uniform vec3   uLightPos;

// Color to fragment program
varying float vertOutTexCoord;
varying vec2 texCoord;

void main(void)
{
    mat4 modelView = matrix_view * matrix_model;
    mat4 modelViewProj = matrix_viewProjection * matrix_model;

    // Get surface normal in eye coordinates
    vec3 eyeNormal = normalize(matrix_normal * aNormal);

    // Get vertex position in eye coordinates
    vec4 vertexPos = modelView * aPosition;
    vec3 vertexEyePos = vertexPos.xyz / vertexPos.w;

    // Get vector to light source
    vec3 lightDir = normalize(uLightPos - vertexEyePos);

    // Dot product gives us diffuse intensity. The diffuse intensity will be
    // used as the 1D color texture coordinate to look for the color of the
    // resulting fragment (see fragment shader).
    vertOutTexCoord = max(0.0, dot(eyeNormal, lightDir));
    texCoord = aUv;

    // Transform the geometry
    gl_Position = modelViewProj * aPosition;
}`,
        "shader.frag": /* glsl */`
precision mediump float;
uniform sampler2D uTexture;
varying float vertOutTexCoord;
varying vec2 texCoord;
void main(void)
{
    float v = vertOutTexCoord;
    v = float(int(v * 6.0)) / 6.0;
    // vec4 color = texture2D (uTexture, texCoord); // try this to use the diffuse color.
    vec4 color = vec4(0.5, 0.47, 0.43, 1.0);
    gl_FragColor = color * vec4(v, v, v, 1.0);
}
`
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
        "shader.vert": /* glsl */`
            attribute vec3 aPosition;
            attribute vec2 aUv0;
            attribute vec3 aNormal;

            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;
            uniform mat3 matrix_normal;

            varying vec2 vUv0;
            varying vec3 worldNormal;

            void main(void)
            {
                vUv0 = aUv0;
                worldNormal = normalize(matrix_normal * aNormal);
                gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
            }`,
        "shader.frag": /* glsl */`
            varying vec2 vUv0;
            varying vec3 worldNormal;
            uniform float uTime;

            uniform mediump sampler2DArray uDiffuseMap;

            void main(void)
            {
                // sample different texture based on time along its texture v-coordinate
                float index = (sin(uTime + vUv0.y + vUv0.x * 0.5) * 0.5 + 0.5) * 4.0;
                vec4 data = texture(uDiffuseMap, vec3(vUv0, floor(index)));

                data.rgb *= 0.8 * max(dot(worldNormal, vec3(0.1, 1.0, 0.5)), 0.0) + 0.5; // simple lighting
                gl_FragColor = vec4(data.rgb, 1.0);
            }`,
        "ground.frag": /* glsl */`
            varying vec2 vUv0;
            varying vec3 worldNormal;

            uniform mediump sampler2DArray uDiffuseMap;

            void main(void)
            {
                vec4 data = texture(uDiffuseMap, vec3(vUv0, step(vUv0.x, 0.5) + 2.0 * step(vUv0.y, 0.5)));
                data.rgb *= 0.8 * max(dot(worldNormal, vec3(0.1, 1.0, 0.5)), 0.0) + 0.5; // simple lighting
                gl_FragColor = vec4(data.rgb, 1.0);
            }`
    }
};

/**
 * @type {ExampleConfig}
 */
export const Graphics_TransformFeedback = {
    WEBGPU_ENABLED: false,
    FILES: {
        "shaderFeedback.vert": /* glsl */`
// vertex shader used to move particles during transform-feedback simulation step

// input and output is vec4, containing position in .xyz and lifetime in .w
attribute vec4 vertex_position;
varying vec4 out_vertex_position;

// parameters controlling simulation
uniform float deltaTime;
uniform float areaSize;

// texture storing random direction vectors
uniform sampler2D directionSampler;

// function returning random number based on vec2 seed parameter
float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main(void) {

    // texture contains direction of particle movement - read it based on particle's position
    vec2 texCoord = vertex_position.xz / areaSize + 0.5;
    vec3 dir = texture2D(directionSampler, texCoord).xyz;
    dir = dir * 2.0 - 1.0;

    // move particle along direction with some speed
    float speed = 20.0 * deltaTime;
    vec3 pos = vertex_position.xyz + dir * speed;

    // age the particle
    float liveTime = vertex_position.w;
    liveTime -= deltaTime;

    // if particle is too old, regenerate it
    if (liveTime <= 0.0) {

        // random life time
        liveTime = rand(pos.xy) * 2.0;

        // random position
        pos.x = rand(pos.xz) * areaSize - 0.5 * areaSize;
        pos.y = rand(pos.xy) * 4.0;
        pos.z = rand(pos.yz) * areaSize - 0.5 * areaSize;
    }

    // write out updated particle
    out_vertex_position = vec4(pos, liveTime);
}`,
        "shaderCloud.vert": /* glsl */`
// vertex shader used to render point sprite particles

// Attributes per vertex: position
attribute vec4 aPosition;

uniform mat4   matrix_viewProjection;

// Color to fragment program
varying vec4 outColor;

void main(void)
{
    // Transform the geometry (ignore life time which is stored in .w of position)
    vec4 worldPosition = vec4(aPosition.xyz, 1);
    gl_Position = matrix_viewProjection * worldPosition;

    // point sprite size
    gl_PointSize = 2.0;

    // color depends on position of particle
    outColor = vec4(worldPosition.y * 0.25, 0.1, worldPosition.z * 0.2, 1);
}`,
        "shaderCloud.frag": /* glsl */`
// fragment shader used to render point sprite particles
precision mediump float;
varying vec4 outColor;

void main(void)
{
    // color supplied by vertex shader
    gl_FragColor = outColor;
}`
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
        "shader.vert": /* glsl */`
            uniform float uTime;
            varying float height;

            void main(void)
            {
                // evaluate center of the splat in object space
                vec3 centerLocal = evalCenter();

                // modify it
                float heightIntensity = centerLocal.y * 0.2;
                centerLocal.x += sin(uTime * 5.0 + centerLocal.y) * 0.3 * heightIntensity;

                // output y-coordinate
                height = centerLocal.y;

                // evaluate the rest of the splat using world space center
                vec4 centerWorld = matrix_model * vec4(centerLocal, 1.0);
                gl_Position = evalSplat(centerWorld);
            }
        `,
        "shader.frag": /* glsl */`
            uniform float uTime;
            varying float height;

            void main(void)
            {
                // get splat color and alpha
                gl_FragColor = evalSplat();

                // modify it
                vec3 gold = vec3(1.0, 0.85, 0.0);
                float sineValue = abs(sin(uTime * 5.0 + height));
                float blend = smoothstep(0.9, 1.0, sineValue);
                gl_FragColor.xyz = mix(gl_FragColor.xyz, gold, blend);
            }
        `
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
        "shader.vert": /* glsl */`
            // Attributes per vertex: position
            attribute vec4 aPosition;
            attribute vec4 aColor;
            
            uniform mat4   matrix_viewProjection;
            uniform mat4   matrix_model;
            
            // Color to fragment program
            varying vec4 outColor;
            
            void main(void)
            {
                mat4 modelViewProj = matrix_viewProjection * matrix_model;
                gl_Position = modelViewProj * aPosition;
            
                // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0
                #ifndef WEBGPU
                    gl_PointSize = 1.5;
                #endif
            
                outColor = aColor;
            }`,
        "shader.frag": /* glsl */`
            precision lowp float;
            varying vec4 outColor;
            
            void main(void)
            {
                // just output color supplied by vertex shader
                gl_FragColor = outColor;
            }`
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
        "shader.vert": /* glsl */`
/**
 * Simple Screen-Space Vertex Shader with one UV coordinate.
 * This shader is useful for simple UI shaders.
 * 
 * Usage: the following attributes must be configured when creating a new pc.Shader:
 *   vertex_position: pc.SEMANTIC_POSITION
 *   vertex_texCoord0: pc.SEMANTIC_TEXCOORD0
 */

// Default PlayCanvas uniforms
uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;

// Additional inputs
attribute vec3 vertex_position;
attribute vec2 vertex_texCoord0;

// Additional shader outputs
varying vec2 vUv0;

void main(void) {
    // UV is simply passed along as varying
    vUv0 = vertex_texCoord0;

    // Position for screen-space
    gl_Position = matrix_model * vec4(vertex_position, 1.0);
    gl_Position.zw = vec2(0.0, 1.0);
}`,
        "shader.frag": /* glsl */`
/**
 * Simple Color-Inverse Fragment Shader with intensity control.
 * 
 * Usage: the following parameters must be set:
 *   uDiffuseMap: image texture.
 *   amount: float that controls the amount of the inverse-color effect. 0 means none (normal color), while 1 means full inverse.
 *
 * Additionally, the Vertex shader that is paired with this Fragment shader must specify:
 *   varying vec2 vUv0: for the UV.
 */

// The following line is for setting the shader precision for floats. It is commented out because, ideally, it must be configured
// on a per-device basis before loading the Shader. Please check the accompanying TypeScript code and look for 'app.graphicsDevice.precision'.

// precision mediump float;

// Additional varying from vertex shader
varying vec2 vUv0;

// Custom Parameters (must be set from code via material.setParameter())
uniform sampler2D uDiffuseMap;
uniform float amount;

void main(void)
{
    vec4 color = texture2D(uDiffuseMap, vUv0);
    vec3 roloc = 1.0 - color.rgb;
    gl_FragColor = vec4(mix(color.rgb, roloc, amount), color.a);
}`
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
