import {
    ShaderMaterial,
    Texture,
    SEMANTIC_POSITION,
    SEMANTIC_NORMAL,
    SEMANTIC_TEXCOORD0,
    PIXELFORMAT_SRGBA8,
    ADDRESS_REPEAT,
    FILTER_LINEAR,
    FILTER_NEAREST_MIPMAP_LINEAR
} from 'playcanvas';

const createHatchMaterial = (device, textures) => {

    // create texture array from the provided textures
    const sources = textures.map(texture => texture.getSource());
    const hatchTexture = new Texture(device, {
        name: 'HatchTextureArray',
        format: PIXELFORMAT_SRGBA8,
        width: textures[0].width,
        height: textures[0].height,
        arrayLength: textures.length,
        magFilter: FILTER_LINEAR,
        minFilter: FILTER_NEAREST_MIPMAP_LINEAR,
        mipmaps: true,
        anisotropy: 16,
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,
        levels: [sources]
    });
    hatchTexture.upload();

    // create a new material with a custom shader
    const material = new ShaderMaterial({
        uniqueName: 'HatchShader',
        vertexCode: /* glsl */ `

            // include code transform shader functionality provided by the engine. It automatically
            // declares vertex_position attribute, and handles skinning and morphing if necessary.
            // It also adds uniforms: matrix_viewProjection, matrix_model, matrix_normal.
            // Functions added: getModelMatrix, getLocalPosition
            #include "transformCore"

            // include code for normal shader functionality provided by the engine. It automatically
            // declares vertex_normal attribute, and handles skinning and morphing if necessary.
            // Functions added: getNormalMatrix, getLocalNormal
            #include "normalCore"

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

            void main(void)
            {
                // use functionality from transformCore to get a world position, which includes skinning and morphing as needed
                mat4 modelMatrix = getModelMatrix();
                vec3 localPos = getLocalPosition(vertex_position.xyz);
                vec4 worldPos = modelMatrix * vec4(localPos, 1.0);

                // use functionality from normalCore to get the world normal, which includes skinning and morphing as needed
                mat3 normalMatrix = getNormalMatrix(modelMatrix);
                vec3 localNormal = getLocalNormal(vertex_normal);
                vec3 worldNormal = normalize(normalMatrix * localNormal);

                // simple wrap-around diffuse lighting using normal and light direction
                float diffuse = brightness = dot(worldNormal, uLightDir) * 0.5 + 0.5;

                // a simple specular lighting
                vec3 viewDir = normalize(view_position - worldPos.xyz);
                vec3 reflectDir = reflect(-uLightDir, worldNormal);
                float specular = pow(max(dot(viewDir, reflectDir), 0.0), 9.0);

                // combine the lighting
                brightness = diffuse * (1.0 - uMetalness) + specular * uMetalness;

                // Pass the texture coordinates
                uv0 = aUv0;

                // Transform the geometry
                gl_Position = matrix_viewProjection * worldPos;
            }
        `,
        fragmentCode: /* glsl */ `
            varying float brightness;
            varying vec2 uv0;

            uniform sampler2DArray uDiffuseMap;
            uniform float uDensity;
            uniform float uNumTextures;
            uniform vec3 uColor;

            void main(void)
            {
                #ifdef TOON

                    // just a simple toon shader - no texture sampling
                    float level = float(int(brightness * uNumTextures)) / uNumTextures;
                    vec3 colorLinear = level * uColor;

                #else
                    // brightness dictates the hatch texture level
                    float level = (1.0 - brightness) * uNumTextures;

                    // sample the two nearest levels and interpolate between them
                    vec3 hatchUnder = texture(uDiffuseMap, vec3(uv0 * uDensity, floor(level))).xyz;
                    vec3 hatchAbove = texture(uDiffuseMap, vec3(uv0 * uDensity, min(ceil(level), uNumTextures - 1.0))).xyz;
                    vec3 colorLinear = mix(hatchUnder, hatchAbove, fract(level)) * uColor;
                #endif

                // handle standard color processing - the called functions are automatically attached to the
                // shader based on the current fog / tone-mapping / gamma settings
                vec3 fogged = addFog(colorLinear);
                vec3 toneMapped = toneMap(fogged);
                gl_FragColor.rgb = gammaCorrectOutput(toneMapped);
                gl_FragColor.a = 1.0;
            }
        `,
        attributes: {
            vertex_position: SEMANTIC_POSITION,
            vertex_normal: SEMANTIC_NORMAL,
            aUv0: SEMANTIC_TEXCOORD0
        }
    });

    // default parameters
    material.setParameter('uDiffuseMap', hatchTexture);
    material.setParameter('uDensity', 1);
    material.setParameter('uColor', [1, 1, 1]);
    material.setParameter('uMetalness', 0.5);
    material.setParameter('uNumTextures', textures.length);
    return material;
};

export { createHatchMaterial };
