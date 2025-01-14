import {
    Vec3,
    ShaderMaterial,
    SEMANTIC_POSITION,
    SEMANTIC_NORMAL,
    SEMANTIC_ATTR12,
    SEMANTIC_ATTR13,
    SEMANTIC_TEXCOORD0
} from 'playcanvas';

const createGoochMaterial = (texture, color) => {

    // create a new material with a custom shader
    const material = new ShaderMaterial({
        uniqueName: 'GoochShader',
        vertexCode: /* glsl */ `

            // include code transform shader functionality provided by the engine. It automatically
            // declares vertex_position attribute, and handles skinning and morphing if necessary.
            // It also adds uniforms: matrix_viewProjection, matrix_model, matrix_normal.
            // Functions added: getModelMatrix, getLocalPosition
            #include "transformCoreVS"

            // include code for normal shader functionality provided by the engine. It automatically
            // declares vertex_normal attribute, and handles skinning and morphing if necessary.
            // Functions added: getNormalMatrix, getLocalNormal
            #include "normalCoreVS"

            // add additional attributes we need
            attribute vec2 aUv0;

            // engine supplied uniforms
            uniform vec3 view_position;

            // out custom uniforms
            uniform vec3 uLightDir;
            uniform float uMetalness;

            // variables we pass to the fragment shader
            varying vec2 uv0;
            varying float brightness;

            // use instancing if required
            #if INSTANCING

                // add instancing attributes we need for our case - here we have position and scale
                attribute vec3 aInstPosition;
                attribute float aInstScale;

                // instancing needs to provide a model matrix, the rest is handled by the engine when using transformCore
                mat4 getModelMatrix() {
                    return mat4(
                        vec4(aInstScale, 0.0, 0.0, 0.0),
                        vec4(0.0, aInstScale, 0.0, 0.0),
                        vec4(0.0, 0.0, aInstScale, 0.0),
                        vec4(aInstPosition, 1.0)
                    );
                }

            #endif

            void main(void)
            {
                // use functionality from transformCore to get a world position, which includes skinning, morphing or instancing as needed
                mat4 modelMatrix = getModelMatrix();
                vec3 localPos = getLocalPosition(vertex_position.xyz);
                vec4 worldPos = modelMatrix * vec4(localPos, 1.0);

                // use functionality from normalCore to get the world normal, which includes skinning, morphing or instancing as needed
                mat3 normalMatrix = getNormalMatrix(modelMatrix);
                vec3 localNormal = getLocalNormal(vertex_normal);
                vec3 worldNormal = normalize(normalMatrix * localNormal);

                // wrap-around diffuse lighting
                brightness = (dot(worldNormal, uLightDir) + 1.0) * 0.5;

                // Pass the texture coordinates
                uv0 = aUv0;

                // Transform the geometry
                gl_Position = matrix_viewProjection * worldPos;
            }
        `,
        fragmentCode: /* glsl */ `
            varying float brightness;
            varying vec2 uv0;

            uniform vec3 uColor;
            #if DIFFUSE_MAP
                uniform sampler2D uDiffuseMap;
            #endif

            // Gooch shading constants - could be exposed as uniforms instead
            float diffuseCool = 0.4;
            float diffuseWarm = 0.4;
            vec3 cool = vec3(0, 0, 0.6);
            vec3 warm = vec3(0.6, 0, 0);

            void main(void)
            {
                float alpha = 1.0f;
                vec3 colorLinear = uColor;

                // shader variant using a diffuse texture
                #if DIFFUSE_MAP
                    vec4 diffuseLinear = texture2D(uDiffuseMap, uv0);
                    colorLinear *= diffuseLinear.rgb;
                    alpha = diffuseLinear.a;
                #endif

                // simple Gooch shading that highlights structural and contextual data
                vec3 kCool = min(cool + diffuseCool * colorLinear, 1.0);
                vec3 kWarm = min(warm + diffuseWarm * colorLinear, 1.0);
                colorLinear = mix(kCool, kWarm, brightness);

                // handle standard color processing - the called functions are automatically attached to the
                // shader based on the current fog / tone-mapping / gamma settings
                vec3 fogged = addFog(colorLinear);
                vec3 toneMapped = toneMap(fogged);
                gl_FragColor.rgb = gammaCorrectOutput(toneMapped);
                gl_FragColor.a = alpha;
            }
        `,
        attributes: {
            vertex_position: SEMANTIC_POSITION,
            vertex_normal: SEMANTIC_NORMAL,
            aUv0: SEMANTIC_TEXCOORD0,

            // instancing attributes
            aInstPosition: SEMANTIC_ATTR12,
            aInstScale: SEMANTIC_ATTR13
        }
    });

    // default parameters
    material.setParameter('uColor', color ?? [1, 1, 1]);

    if (texture) {
        material.setParameter('uDiffuseMap', texture);
        material.setDefine('DIFFUSE_MAP', true);
    }

    const lightDir = new Vec3(0.5, -0.5, 0.5).normalize();
    material.setParameter('uLightDir', [-lightDir.x, -lightDir.y, -lightDir.z]);

    return material;
};

export { createGoochMaterial };
