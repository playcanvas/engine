export default {
  "animation": {
    "blend-trees-1d": {
      
      
      "nameSlug": "blend-trees-1d",
      "categorySlug": "animation"
    },
    "blend-trees-2d-cartesian": {
      
      
      "nameSlug": "blend-trees-2d-cartesian",
      "categorySlug": "animation"
    },
    "blend-trees-2d-directional": {
      
      
      "nameSlug": "blend-trees-2d-directional",
      "categorySlug": "animation"
    },
    "component-properties": {
      
      
      "nameSlug": "component-properties",
      "categorySlug": "animation"
    },
    "events": {
      
      
      "nameSlug": "events",
      "categorySlug": "animation"
    },
    "layer-masks": {
      
      
      "nameSlug": "layer-masks",
      "categorySlug": "animation"
    },
    "locomotion": {
      
      
      "nameSlug": "locomotion",
      "categorySlug": "animation"
    },
    "tween": {
      
      
      "nameSlug": "tween",
      "categorySlug": "animation"
    }
  },
  "camera": {
    "first-person": {
      
      
      "nameSlug": "first-person",
      "categorySlug": "camera"
    },
    "fly": {
      
      
      "nameSlug": "fly",
      "categorySlug": "camera"
    },
    "orbit": {
      
      
      "nameSlug": "orbit",
      "categorySlug": "camera"
    }
  },
  "graphics": {
    "area-lights": {
      
      
      "nameSlug": "area-lights",
      "categorySlug": "graphics"
    },
    "area-picker": {
      
      
      "nameSlug": "area-picker",
      "categorySlug": "graphics"
    },
    "asset-viewer": {
      
      
      "nameSlug": "asset-viewer",
      "categorySlug": "graphics"
    },
    "batching-dynamic": {
      
      
      "nameSlug": "batching-dynamic",
      "categorySlug": "graphics"
    },
    "clustered-area-lights": {
      
      
      "nameSlug": "clustered-area-lights",
      "categorySlug": "graphics"
    },
    "clustered-lighting": {
      
      
      "nameSlug": "clustered-lighting",
      "categorySlug": "graphics"
    },
    "clustered-omni-shadows": {
      
      
      "nameSlug": "clustered-omni-shadows",
      "categorySlug": "graphics"
    },
    "clustered-spot-shadows": {
      
      
      "nameSlug": "clustered-spot-shadows",
      "categorySlug": "graphics"
    },
    "contact-hardening-shadows": {
      
      
      "nameSlug": "contact-hardening-shadows",
      "categorySlug": "graphics"
    },
    "grab-pass": {
      
      
      "nameSlug": "grab-pass",
      "categorySlug": "graphics",
      "files": {
        "shader.vert": "\n            attribute vec3 vertex_position;\n            attribute vec2 vertex_texCoord0;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n\n            varying vec2 texCoord;\n\n            void main(void)\n            {\n                // project the position\n                vec4 pos = matrix_model * vec4(vertex_position, 1.0);\n                gl_Position = matrix_viewProjection * pos;\n\n                texCoord = vertex_texCoord0;\n            }\n        ",
        "shader.frag": "\n            // use the special uSceneColorMap texture, which is a built-in texture containing\n            // a copy of the color buffer at the point of capture, inside the Depth layer.\n            uniform sampler2D uSceneColorMap;\n\n            // normal map providing offsets\n            uniform sampler2D uOffsetMap;\n\n            // roughness map\n            uniform sampler2D uRoughnessMap;\n\n            // tint colors\n            uniform vec3 tints[4];\n\n            // engine built-in constant storing render target size in .xy and inverse size in .zw\n            uniform vec4 uScreenSize;\n\n            varying vec2 texCoord;\n\n            void main(void)\n            {\n                float roughness = 1.0 - texture2D(uRoughnessMap, texCoord).r;\n\n                // sample offset texture - used to add distortion to the sampled background\n                vec2 offset = texture2D(uOffsetMap, texCoord).rg;\n                offset = 2.0 * offset - 1.0;\n\n                // offset strength\n                offset *= (0.2 + roughness) * 0.015;\n\n                // get normalized uv coordinates for canvas\n                vec2 grabUv = gl_FragCoord.xy * uScreenSize.zw;\n\n                // roughness dictates which mipmap level gets used, in 0..4 range\n                float mipmap = roughness * 5.0;\n\n                // get background pixel color with distorted offset\n                vec3 grabColor = texture2DLodEXT(uSceneColorMap, grabUv + offset, mipmap).rgb;\n\n                // tint the material based on mipmap, on WebGL2 only, as WebGL1 does not support non-constant array indexing\n                // (note - this could be worked around by using a series of if statements in this case)\n                #ifdef GL2\n                    float tintIndex = clamp(mipmap, 0.0, 3.0);\n                    grabColor *= tints[int(tintIndex)];\n                #endif\n\n                // brighten the refracted texture a little bit\n                // brighten even more the rough parts of the glass\n                gl_FragColor = vec4(grabColor * 1.1, 1.0) + roughness * 0.09;\n            }\n        "
      }
    },
    "ground-fog": {
      
      
      "nameSlug": "ground-fog",
      "categorySlug": "graphics",
      "files": {
        "shader.vert": "\n            attribute vec3 vertex_position;\n            attribute vec2 vertex_texCoord0;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n            uniform float uTime;\n            uniform sampler2D uTexture;\n\n            varying vec2 texCoord0;\n            varying vec2 texCoord1;\n            varying vec2 texCoord2;\n            varying vec4 screenPos;\n            varying float depth;\n\n            void main(void)\n            {\n                // 3 scrolling texture coordinates with different direction and speed\n                texCoord0 = vertex_texCoord0 * 2.0 + vec2(uTime * 0.003, uTime * 0.01);\n                texCoord1 = vertex_texCoord0 * 1.5 + vec2(uTime * -0.02, uTime * 0.02);\n                texCoord2 = vertex_texCoord0 * 1.0 + vec2(uTime * 0.01, uTime * -0.003);\n\n                // sample the fog texture to have elevation for this vertex\n                vec2 offsetTexCoord = vertex_texCoord0 + vec2(uTime * 0.001, uTime * -0.0003);\n                float offset = texture2D(uTexture, offsetTexCoord).r;\n\n                // vertex in the world space\n                vec4 pos = matrix_model * vec4(vertex_position, 1.0);\n\n                // move it up based on the offset\n                pos.y += offset * 25.0;\n\n                // position in projected (screen) space\n                vec4 projPos = matrix_viewProjection * pos;\n                gl_Position = projPos;\n\n                // the linear depth of the vertex (in camera space)\n                depth = getLinearDepth(pos.xyz);\n\n                // screen fragment position, used to sample the depth texture\n                screenPos = projPos;\n            }\n        ",
        "shader.frag": "\n            uniform sampler2D uTexture;\n            uniform float uSoftening;\n\n            varying vec2 texCoord0;\n            varying vec2 texCoord1;\n            varying vec2 texCoord2;\n            varying vec4 screenPos;\n            varying float depth;\n            \n            void main(void)\n            {\n                // sample the texture 3 times and compute average intensity of the fog\n                vec4 diffusTexture0 = texture2D (uTexture, texCoord0);\n                vec4 diffusTexture1 = texture2D (uTexture, texCoord1);\n                vec4 diffusTexture2 = texture2D (uTexture, texCoord2);\n                float alpha = 0.5 * (diffusTexture0.r + diffusTexture1.r + diffusTexture2.r);\n\n                // use built-in getGrabScreenPos function to convert screen position to grab texture uv coords\n                vec2 screenCoord = getGrabScreenPos(screenPos);\n\n                // read the depth from the depth buffer\n                float sceneDepth = getLinearScreenDepth(screenCoord) * camera_params.x;\n\n                // depth of the current fragment (on the fog plane)\n                float fragmentDepth = depth * camera_params.x;\n\n                // difference between these two depths is used to adjust the alpha, to fade out\n                // the fog near the geometry\n                float depthDiff = clamp(abs(fragmentDepth - sceneDepth) * uSoftening, 0.0, 1.0);\n                alpha *= smoothstep(0.0, 1.0, depthDiff);\n\n                // final color\n                vec3 fogColor = vec3(1.0, 1.0, 1.0);\n                gl_FragColor = vec4(fogColor, alpha);\n            }\n        "
      }
    },
    "hardware-instancing": {
      
      
      "nameSlug": "hardware-instancing",
      "categorySlug": "graphics"
    },
    "hierarchy": {
      
      
      "nameSlug": "hierarchy",
      "categorySlug": "graphics"
    },
    "layers": {
      
      
      "nameSlug": "layers",
      "categorySlug": "graphics"
    },
    "light-physical-units": {
      
      
      "nameSlug": "light-physical-units",
      "categorySlug": "graphics"
    },
    "lights-baked-a-o": {
      
      
      "nameSlug": "lights-baked-a-o",
      "categorySlug": "graphics"
    },
    "lights-baked": {
      
      
      "nameSlug": "lights-baked",
      "categorySlug": "graphics"
    },
    "lights": {
      
      
      "nameSlug": "lights",
      "categorySlug": "graphics"
    },
    "lines": {
      
      
      "nameSlug": "lines",
      "categorySlug": "graphics"
    },
    "material-anisotropic": {
      
      
      "nameSlug": "material-anisotropic",
      "categorySlug": "graphics"
    },
    "material-basic": {
      
      
      "nameSlug": "material-basic",
      "categorySlug": "graphics"
    },
    "material-clear-coat": {
      
      
      "nameSlug": "material-clear-coat",
      "categorySlug": "graphics"
    },
    "material-physical": {
      
      
      "nameSlug": "material-physical",
      "categorySlug": "graphics"
    },
    "material-translucent-specular": {
      
      
      "nameSlug": "material-translucent-specular",
      "categorySlug": "graphics"
    },
    "mesh-decals": {
      
      
      "nameSlug": "mesh-decals",
      "categorySlug": "graphics"
    },
    "mesh-deformation": {
      
      
      "nameSlug": "mesh-deformation",
      "categorySlug": "graphics"
    },
    "mesh-generation": {
      
      
      "nameSlug": "mesh-generation",
      "categorySlug": "graphics"
    },
    "mesh-morph-many": {
      
      
      "nameSlug": "mesh-morph-many",
      "categorySlug": "graphics"
    },
    "mesh-morph": {
      
      
      "nameSlug": "mesh-morph",
      "categorySlug": "graphics"
    },
    "model-asset": {
      
      
      "nameSlug": "model-asset",
      "categorySlug": "graphics"
    },
    "model-outline": {
      
      
      "nameSlug": "model-outline",
      "categorySlug": "graphics"
    },
    "model-textured-box": {
      
      
      "nameSlug": "model-textured-box",
      "categorySlug": "graphics"
    },
    "mrt": {
      
      
      "nameSlug": "mrt",
      "categorySlug": "graphics",
      "files": {
        "output.frag": "\n            #ifdef MYMRT_PASS\n                // output world normal to target 1\n                pcFragColor1 = vec4(litShaderArgs.worldNormal * 0.5 + 0.5, 1.0);\n\n                // output gloss to target 2\n                pcFragColor2 = vec4(vec3(litShaderArgs.gloss) , 1.0);\n            #endif\n        "
      }
    },
    "multi-view": {
      
      
      "nameSlug": "multi-view",
      "categorySlug": "graphics"
    },
    "paint-mesh": {
      
      
      "nameSlug": "paint-mesh",
      "categorySlug": "graphics",
      "files": {
        "shader.vert": "\n            // Attributes per vertex: position and uv\n            attribute vec4 aPosition;\n            attribute vec2 aUv0;\n        \n            // model matrix of the mesh\n            uniform mat4 matrix_model;\n\n            // decal view-projection matrix (orthographic)\n            uniform mat4 matrix_decal_viewProj;\n\n            // decal projected position to fragment program\n            varying vec4 decalPos;\n\n            void main(void)\n            {\n                // We render in texture space, so a position of this fragment is its uv-coordinates.\n                // Changes the range of uv coordinates from 0..1 to projection space -1 to 1.\n                gl_Position = vec4(aUv0.x * 2.0 - 1.0, aUv0.y * 2.0 - 1.0, 0, 1.0);\n\n                // transform the vertex position to world space and then to decal space, and pass it\n                // to the fragment shader to sample the decal texture\n                vec4 worldPos = matrix_model * aPosition;\n                decalPos = matrix_decal_viewProj * worldPos;\n            }",
        "shader.frag": "\n            precision lowp float;\n            varying vec4 decalPos;\n            uniform sampler2D uDecalMap;\n\n            void main(void)\n            {\n                // decal space position from -1..1 range, to texture space range 0..1\n                vec4 p = decalPos * 0.5 + 0.5;\n \n                // if the position is outside out 0..1 projection box, ignore the pixel\n                if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z < 0.0 || p.z > 1.0)\n                    discard;\n\n                gl_FragColor = texture2D(uDecalMap, p.xy);\n            }"
      }
    },
    "painter": {
      
      
      "nameSlug": "painter",
      "categorySlug": "graphics"
    },
    "particles-anim-index": {
      
      
      "nameSlug": "particles-anim-index",
      "categorySlug": "graphics"
    },
    "particles-random-sprites": {
      
      
      "nameSlug": "particles-random-sprites",
      "categorySlug": "graphics"
    },
    "particles-snow": {
      
      
      "nameSlug": "particles-snow",
      "categorySlug": "graphics"
    },
    "particles-spark": {
      
      
      "nameSlug": "particles-spark",
      "categorySlug": "graphics"
    },
    "point-cloud-simulation": {
      
      
      "nameSlug": "point-cloud-simulation",
      "categorySlug": "graphics",
      "files": {
        "shader.vert": "\n// Attributes per vertex: position\nattribute vec4 aPosition;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\n\n// position of the camera\nuniform vec3 view_position;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // Transform the geometry\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n    gl_Position = modelViewProj * aPosition;\n\n    // vertex in world space\n    vec4 vertexWorld = matrix_model * aPosition;\n\n    // point sprite size depends on its distance to camera\n    float dist = 25.0 - length(vertexWorld.xyz - view_position);\n    gl_PointSize = clamp(dist * 2.0 - 1.0, 1.0, 15.0);\n\n    // color depends on position of particle\n    outColor = vec4(vertexWorld.y * 0.1, 0.1, vertexWorld.z * 0.1, 1);\n}",
        "shader.frag": "\nprecision mediump float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // color supplied by vertex shader\n    gl_FragColor = outColor;\n\n    // make point round instead of square - make pixels outside of the circle black, using provided gl_PointCoord\n    vec2 dist = gl_PointCoord.xy - vec2(0.5, 0.5);\n    gl_FragColor.a = 1.0 - smoothstep(0.4, 0.5, sqrt(dot(dist, dist)));\n\n}"
      }
    },
    "point-cloud": {
      
      
      "nameSlug": "point-cloud",
      "categorySlug": "graphics",
      "files": {
        "shader.vert": "\n// Attributes per vertex: position\nattribute vec4 aPosition;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\nuniform mat4   matrix_view;\n\n// time\nuniform float uTime;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // Transform the geometry\n    mat4 modelView = matrix_view * matrix_model;\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n    gl_Position = modelViewProj * aPosition;\n\n    // vertex in world space\n    vec4 vertexWorld = matrix_model * aPosition;\n\n    // use sine way to generate intensity value based on time and also y-coordinate of model\n    float intensity = abs(sin(0.6 * vertexWorld.y + uTime * 1.0));\n\n    // intensity smoothly drops to zero for smaller values than 0.9\n    intensity = smoothstep(0.9, 1.0, intensity);\n\n    // point size depends on intensity\n    gl_PointSize = clamp(12.0 * intensity, 1.0, 64.0);\n\n    // color mixes red and yellow based on intensity\n    outColor = mix(vec4(1.0, 1.0, 0.0, 1.0), vec4(0.9, 0.0, 0.0, 1.0), intensity);\n}",
        "shader.frag": "\nprecision lowp float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // just output color supplied by vertex shader\n    gl_FragColor = outColor;\n}"
      }
    },
    "portal": {
      
      
      "nameSlug": "portal",
      "categorySlug": "graphics"
    },
    "post-effects": {
      
      
      "nameSlug": "post-effects",
      "categorySlug": "graphics"
    },
    "reflection-box": {
      
      
      "nameSlug": "reflection-box",
      "categorySlug": "graphics"
    },
    "reflection-cubemap": {
      
      
      "nameSlug": "reflection-cubemap",
      "categorySlug": "graphics"
    },
    "reflection-planar": {
      
      
      "nameSlug": "reflection-planar",
      "categorySlug": "graphics",
      "files": {
        "shader.vert": "\n            attribute vec3 aPosition;\n            attribute vec2 aUv0;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n\n            void main(void)\n            {\n                gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);;\n            }",
        "shader.frag": "\n\n            // engine built-in constant storing render target size in .xy and inverse size in .zw\n            uniform vec4 uScreenSize;\n\n            // reflection texture\n            uniform sampler2D uDiffuseMap;\n\n            void main(void)\n            {\n                // sample reflection texture\n                vec2 coord = gl_FragCoord.xy * uScreenSize.zw;\n                coord.y = 1.0 - coord.y;\n                vec4 reflection = texture2D(uDiffuseMap, coord);\n\n                gl_FragColor = vec4(reflection.xyz * 0.7, 1);\n            }"
      }
    },
    "render-asset": {
      
      
      "nameSlug": "render-asset",
      "categorySlug": "graphics"
    },
    "render-to-texture": {
      
      
      "nameSlug": "render-to-texture",
      "categorySlug": "graphics"
    },
    "shader-burn": {
      
      
      "nameSlug": "shader-burn",
      "categorySlug": "graphics",
      "files": {
        "shader.vert": "\nattribute vec3 aPosition;\nattribute vec2 aUv0;\n\nuniform mat4 matrix_model;\nuniform mat4 matrix_viewProjection;\n\nvarying vec2 vUv0;\n\nvoid main(void)\n{\n    vUv0 = aUv0;\n    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);\n}",
        "shader.frag": "\nprecision mediump float;\n\nvarying vec2 vUv0;\n\nuniform sampler2D uDiffuseMap;\nuniform sampler2D uHeightMap;\nuniform float uTime;\n\nvoid main(void)\n{\n    float height = texture2D(uHeightMap, vUv0).r;\n    vec4 color = texture2D(uDiffuseMap, vUv0);\n    if (height < uTime) {\n    discard;\n    }\n    if (height < (uTime + uTime * 0.1)) {\n    color = vec4(1.0, 0.2, 0.0, 1.0);\n    }\n    gl_FragColor = color;\n}"
      }
    },
    "shader-compile": {
      
      
      "nameSlug": "shader-compile",
      "categorySlug": "graphics"
    },
    "shader-toon": {
      
      
      "nameSlug": "shader-toon",
      "categorySlug": "graphics",
      "files": {
        "shader.vert": "\n// Attributes per vertex: position, normal and texture coordinates\nattribute vec4 aPosition;\nattribute vec3 aNormal;\nattribute vec2 aUv;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\nuniform mat4   matrix_view;\nuniform mat3   matrix_normal;\nuniform vec3   uLightPos;\n\n// Color to fragment program\nvarying float vertOutTexCoord;\nvarying vec2 texCoord;\n\nvoid main(void)\n{\n    mat4 modelView = matrix_view * matrix_model;\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n\n    // Get surface normal in eye coordinates\n    vec3 eyeNormal = normalize(matrix_normal * aNormal);\n\n    // Get vertex position in eye coordinates\n    vec4 vertexPos = modelView * aPosition;\n    vec3 vertexEyePos = vertexPos.xyz / vertexPos.w;\n\n    // Get vector to light source\n    vec3 lightDir = normalize(uLightPos - vertexEyePos);\n\n    // Dot product gives us diffuse intensity. The diffuse intensity will be\n    // used as the 1D color texture coordinate to look for the color of the\n    // resulting fragment (see fragment shader).\n    vertOutTexCoord = max(0.0, dot(eyeNormal, lightDir));\n    texCoord = aUv;\n\n    // Transform the geometry\n    gl_Position = modelViewProj * aPosition;\n}",
        "shader.frag": "\nprecision mediump float;\nuniform sampler2D uTexture;\nvarying float vertOutTexCoord;\nvarying vec2 texCoord;\nvoid main(void)\n{\n    float v = vertOutTexCoord;\n    v = float(int(v * 6.0)) / 6.0;\n    // vec4 color = texture2D (uTexture, texCoord); // try this to use the diffuse color.\n    vec4 color = vec4(0.5, 0.47, 0.43, 1.0);\n    gl_FragColor = color * vec4(v, v, v, 1.0);\n}\n"
      }
    },
    "shader-wobble": {
      
      
      "nameSlug": "shader-wobble",
      "categorySlug": "graphics",
      "files": {
        "shader.vert": "\nattribute vec3 aPosition;\nattribute vec2 aUv0;\n\nuniform mat4 matrix_model;\nuniform mat4 matrix_viewProjection;\nuniform float uTime;\n\nvarying vec2 vUv0;\n\nvoid main(void)\n{\n    vec4 pos = matrix_model * vec4(aPosition, 1.0);\n    pos.x += sin(uTime + pos.y * 4.0) * 0.1;\n    pos.y += cos(uTime + pos.x * 4.0) * 0.1;\n    vUv0 = aUv0;\n    gl_Position = matrix_viewProjection * pos;\n}",
        "shader.frag": "\nprecision mediump float;\n\nuniform sampler2D uDiffuseMap;\n\nvarying vec2 vUv0;\n\nvoid main(void)\n{\n    gl_FragColor = texture2D(uDiffuseMap, vUv0);\n}"
      }
    },
    "shadow-cascades": {
      
      
      "nameSlug": "shadow-cascades",
      "categorySlug": "graphics"
    },
    "shapes": {
      
      
      "nameSlug": "shapes",
      "categorySlug": "graphics"
    },
    "texture-basis": {
      
      
      "nameSlug": "texture-basis",
      "categorySlug": "graphics"
    },
    "transform-feedback": {
      
      
      "nameSlug": "transform-feedback",
      "categorySlug": "graphics",
      "files": {
        "shaderFeedback.vert": "\n// vertex shader used to move particles during transform-feedback simulation step\n\n// input and output is vec4, containing position in .xyz and lifetime in .w\nattribute vec4 vertex_position;\nvarying vec4 out_vertex_position;\n\n// parameters controlling simulation\nuniform float deltaTime;\nuniform float areaSize;\n\n// texture storing random direction vectors\nuniform sampler2D directionSampler;\n\n// function returning random number based on vec2 seed parameter\nfloat rand(vec2 co) {\n    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);\n}\n\nvoid main(void) {\n\n    // texture contains direction of particle movement - read it based on particle's position\n    vec2 texCoord = vertex_position.xz / areaSize + 0.5;\n    vec3 dir = texture2D(directionSampler, texCoord).xyz;\n    dir = dir * 2.0 - 1.0;\n\n    // move particle along direction with some speed\n    float speed = 20.0 * deltaTime;\n    vec3 pos = vertex_position.xyz + dir * speed;\n\n    // age the particle\n    float liveTime = vertex_position.w;\n    liveTime -= deltaTime;\n\n    // if particle is too old, regenerate it\n    if (liveTime <= 0.0) {\n\n        // random life time\n        liveTime = rand(pos.xy) * 2.0;\n\n        // random position\n        pos.x = rand(pos.xz) * areaSize - 0.5 * areaSize;\n        pos.y = rand(pos.xy) * 4.0;\n        pos.z = rand(pos.yz) * areaSize - 0.5 * areaSize;\n    }\n\n    // write out updated particle\n    out_vertex_position = vec4(pos, liveTime);\n}",
        "shaderCloud.vert": "\n// vertex shader used to render point sprite particles\n\n// Attributes per vertex: position\nattribute vec4 aPosition;\n\nuniform mat4   matrix_viewProjection;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // Transform the geometry (ignore life time which is stored in .w of position)\n    vec4 worldPosition = vec4(aPosition.xyz, 1);\n    gl_Position = matrix_viewProjection * worldPosition;\n\n    // point sprite size\n    gl_PointSize = 2.0;\n\n    // color depends on position of particle\n    outColor = vec4(worldPosition.y * 0.25, 0.1, worldPosition.z * 0.2, 1);\n}",
        "shaderCloud.frag": "\n// fragment shader used to render point sprite particles\nprecision mediump float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // color supplied by vertex shader\n    gl_FragColor = outColor;\n}"
      }
    },
    "video-texture": {
      
      
      "nameSlug": "video-texture",
      "categorySlug": "graphics"
    }
  },
  "input": {
    "gamepad": {
      
      
      "nameSlug": "gamepad",
      "categorySlug": "input"
    },
    "keyboard": {
      
      
      "nameSlug": "keyboard",
      "categorySlug": "input"
    },
    "mouse": {
      
      
      "nameSlug": "mouse",
      "categorySlug": "input"
    }
  },
  "loaders": {
    "draco-glb": {
      
      
      "nameSlug": "draco-glb",
      "categorySlug": "loaders"
    },
    "glb": {
      
      
      "nameSlug": "glb",
      "categorySlug": "loaders"
    },
    "gltf-export": {
      
      
      "nameSlug": "gltf-export",
      "categorySlug": "loaders"
    },
    "loaders-gl": {
      
      
      "nameSlug": "loaders-gl",
      "categorySlug": "loaders",
      "files": {
        "shader.vert": "\n// Attributes per vertex: position\nattribute vec4 aPosition;\nattribute vec4 aColor;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n    gl_Position = modelViewProj * aPosition;\n\n    gl_PointSize = 1.5;\n    outColor = aColor;\n}",
        "shader.frag": "\nprecision lowp float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // just output color supplied by vertex shader\n    gl_FragColor = outColor;\n}"
      }
    },
    "obj": {
      
      
      "nameSlug": "obj",
      "categorySlug": "loaders"
    },
    "usdz-export": {
      
      
      "nameSlug": "usdz-export",
      "categorySlug": "loaders"
    }
  },
  "misc": {
    "hello-world": {
      
      
      "nameSlug": "hello-world",
      "categorySlug": "misc"
    },
    "mini-stats": {
      
      
      "nameSlug": "mini-stats",
      "categorySlug": "misc"
    },
    "spineboy": {
      
      
      "nameSlug": "spineboy",
      "categorySlug": "misc"
    }
  },
  "physics": {
    "compound-collision": {
      
      
      "nameSlug": "compound-collision",
      "categorySlug": "physics"
    },
    "falling-shapes": {
      
      
      "nameSlug": "falling-shapes",
      "categorySlug": "physics"
    },
    "offset-collision": {
      
      
      "nameSlug": "offset-collision",
      "categorySlug": "physics"
    },
    "raycast": {
      
      
      "nameSlug": "raycast",
      "categorySlug": "physics"
    },
    "vehicle": {
      
      
      "nameSlug": "vehicle",
      "categorySlug": "physics"
    }
  },
  "sound": {
    "positional": {
      
      
      "nameSlug": "positional",
      "categorySlug": "sound"
    }
  },
  "user-interface": {
    "button-basic": {
      
      
      "nameSlug": "button-basic",
      "categorySlug": "user-interface"
    },
    "button-sprite": {
      
      
      "nameSlug": "button-sprite",
      "categorySlug": "user-interface"
    },
    "custom-shader": {
      
      
      "nameSlug": "custom-shader",
      "categorySlug": "user-interface",
      "files": {
        "shader.vert": "\n/**\n * Simple Screen-Space Vertex Shader with one UV coordinate.\n * This shader is useful for simple UI shaders.\n * \n * Usage: the following attributes must be configured when creating a new pc.Shader:\n *   vertex_position: pc.SEMANTIC_POSITION\n *   vertex_texCoord0: pc.SEMANTIC_TEXCOORD0\n */\n\n// Default PlayCanvas uniforms\nuniform mat4 matrix_viewProjection;\nuniform mat4 matrix_model;\n\n// Additional inputs\nattribute vec3 vertex_position;\nattribute vec2 vertex_texCoord0;\n\n// Additional shader outputs\nvarying vec2 vUv0;\n\nvoid main(void) {\n    // UV is simply passed along as varying\n    vUv0 = vertex_texCoord0;\n\n    // Position for screen-space\n    gl_Position = matrix_model * vec4(vertex_position, 1.0);\n    gl_Position.zw = vec2(0.0, 1.0);\n}",
        "shader.frag": "\n/**\n * Simple Color-Inverse Fragment Shader with intensity control.\n * \n * Usage: the following parameters must be set:\n *   uDiffuseMap: image texture.\n *   amount: float that controls the amount of the inverse-color effect. 0 means none (normal color), while 1 means full inverse.\n *\n * Additionally, the Vertex shader that is paired with this Fragment shader must specify:\n *   varying vec2 vUv0: for the UV.\n */\n\n// The following line is for setting the shader precision for floats. It is commented out because, ideally, it must be configured\n// on a per-device basis before loading the Shader. Please check the accompanying TypeScript code and look for 'app.graphicsDevice.precision'.\n\n// precision mediump float;\n\n// Additional varying from vertex shader\nvarying vec2 vUv0;\n\n// Custom Parameters (must be set from code via material.setParameter())\nuniform sampler2D uDiffuseMap;\nuniform float amount;\n\nvoid main(void)\n{\n    vec4 color = texture2D(uDiffuseMap, vUv0);\n    vec3 roloc = 1.0 - color.rgb;\n    gl_FragColor = vec4(mix(color.rgb, roloc, amount), color.a);\n}"
      }
    },
    "layout-group": {
      
      
      "nameSlug": "layout-group",
      "categorySlug": "user-interface"
    },
    "particle-system": {
      
      
      "nameSlug": "particle-system",
      "categorySlug": "user-interface"
    },
    "scroll-view": {
      
      
      "nameSlug": "scroll-view",
      "categorySlug": "user-interface"
    },
    "text-auto-font-size": {
      
      
      "nameSlug": "text-auto-font-size",
      "categorySlug": "user-interface"
    },
    "text-emojis": {
      
      
      "nameSlug": "text-emojis",
      "categorySlug": "user-interface"
    },
    "text-localization": {
      
      
      "nameSlug": "text-localization",
      "categorySlug": "user-interface"
    },
    "text-typewriter": {
      
      
      "nameSlug": "text-typewriter",
      "categorySlug": "user-interface"
    },
    "text": {
      
      
      "nameSlug": "text",
      "categorySlug": "user-interface"
    },
    "world-to-screen": {
      
      
      "nameSlug": "world-to-screen",
      "categorySlug": "user-interface"
    },
    "world-ui": {
      
      
      "nameSlug": "world-ui",
      "categorySlug": "user-interface"
    }
  },
  "xr": {
    "ar-basic": {
      
      
      "nameSlug": "ar-basic",
      "categorySlug": "xr"
    },
    "ar-hit-test": {
      
      
      "nameSlug": "ar-hit-test",
      "categorySlug": "xr"
    },
    "vr-basic": {
      
      
      "nameSlug": "vr-basic",
      "categorySlug": "xr"
    },
    "vr-controllers": {
      
      
      "nameSlug": "vr-controllers",
      "categorySlug": "xr"
    },
    "vr-hands": {
      
      
      "nameSlug": "vr-hands",
      "categorySlug": "xr"
    },
    "vr-movement": {
      
      
      "nameSlug": "vr-movement",
      "categorySlug": "xr"
    },
    "xr-picking": {
      
      
      "nameSlug": "xr-picking",
      "categorySlug": "xr"
    }
  }
}