import {
    SEMANTIC_NORMAL,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial
} from 'playcanvas';

import { VAT_FRAME_SEMANTIC, VAT_TRANSFORM_SEMANTICS } from './vat-chunks.mjs';

const vertexGLSL = /* glsl */ `

    // engine provided transform functionality, overridden by the VAT chunks to source the vertex
    // position from the VAT texture. Declares the vertex_position attribute and the
    // matrix_viewProjection and matrix_model uniforms, and adds getModelMatrix and getLocalPosition.
    #include "transformCoreVS"

    attribute vec2 aUv0;

    varying vec2 vUv0;

    // the shadow pass only needs the position
    #ifndef SHADOW_PASS

        // engine provided normal functionality, overridden by the VAT chunks to source the vertex
        // normal from the VAT texture. Adds getNormalMatrix and getLocalNormal.
        #include "normalCoreVS"

        varying vec3 vNormalW;

    #endif

    void main(void) {

        mat4 modelMatrix = getModelMatrix();
        vec4 worldPos = modelMatrix * vec4(getLocalPosition(vertex_position.xyz), 1.0);

        #ifndef SHADOW_PASS
            vNormalW = normalize(getNormalMatrix(modelMatrix) * getLocalNormal(vertex_normal));
        #endif

        vUv0 = aUv0;
        gl_Position = matrix_viewProjection * worldPos;
    }
`;

const vertexWGSL = /* wgsl */ `

    // engine provided transform functionality, overridden by the VAT chunks to source the vertex
    // position from the VAT texture. Declares the vertex_position attribute and the
    // matrix_viewProjection and matrix_model uniforms, and adds getModelMatrix and getLocalPosition.
    #include "transformCoreVS"

    attribute aUv0: vec2f;

    varying vUv0: vec2f;

    // the shadow pass only needs the position
    #ifndef SHADOW_PASS

        // engine provided normal functionality, overridden by the VAT chunks to source the vertex
        // normal from the VAT texture. Adds getNormalMatrix and getLocalNormal.
        #include "normalCoreVS"

        varying vNormalW: vec3f;

    #endif

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {

        var output: VertexOutput;

        let modelMatrix: mat4x4f = getModelMatrix();
        let worldPos: vec4f = modelMatrix * vec4f(getLocalPosition(vertex_position.xyz), 1.0);

        #ifndef SHADOW_PASS
            output.vNormalW = normalize(getNormalMatrix(modelMatrix) * getLocalNormal(vertex_normal));
        #endif

        output.vUv0 = aUv0;
        output.position = uniform.matrix_viewProjection * worldPos;

        return output;
    }
`;

const fragmentGLSL = /* glsl */ `

    // gamma correction: gammaCorrectOutput
    #include "gammaPS"

    // tone-mapping: toneMap
    #include "tonemappingPS"

    // fog: addFog
    #include "fogPS"

    #ifdef SHADOW_PASS
        // shadow pass functionality: getShadowOutput
        #include "shadowCasterPS"
    #endif

    varying vec2 vUv0;

    #ifndef SHADOW_PASS

        varying vec3 vNormalW;

        uniform sampler2D uAlbedoMap;
        uniform vec3 uLightDirection;   // direction the light travels in
        uniform vec3 uLightColor;
        uniform vec3 uAmbientSky;       // ambient arriving from above
        uniform vec3 uAmbientGround;    // ambient bounced back from below

    #endif

    void main(void) {

        #ifdef SHADOW_PASS

            gl_FragColor = getShadowOutput();

        #else

            vec3 albedo = texture2D(uAlbedoMap, vUv0).rgb;
            vec3 normal = normalize(vNormalW);

            // a single directional light over a hemispherical ambient - blending the sky and ground
            // colors by the normal costs two instructions and gives the unlit side of the character
            // some shape, which a constant ambient term cannot
            float lambert = max(dot(normal, -uLightDirection), 0.0);
            vec3 ambient = mix(uAmbientGround, uAmbientSky, normal.y * 0.5 + 0.5);
            vec3 color = albedo * (ambient + uLightColor * lambert);

            // standard color processing, based on the current fog / tone-mapping / gamma settings
            color = toneMap(addFog(color));
            gl_FragColor = vec4(gammaCorrectOutput(color), 1.0);

        #endif
    }
`;

const fragmentWGSL = /* wgsl */ `

    // gamma correction: gammaCorrectOutput
    #include "gammaPS"

    // tone-mapping: toneMap
    #include "tonemappingPS"

    // fog: addFog
    #include "fogPS"

    #ifdef SHADOW_PASS
        // shadow pass functionality: getShadowOutput
        #include "shadowCasterPS"
    #endif

    varying vUv0: vec2f;

    #ifndef SHADOW_PASS

        varying vNormalW: vec3f;

        var uAlbedoMap: texture_2d<f32>;
        var uAlbedoMapSampler: sampler;
        uniform uLightDirection: vec3f;   // direction the light travels in
        uniform uLightColor: vec3f;
        uniform uAmbientSky: vec3f;       // ambient arriving from above
        uniform uAmbientGround: vec3f;    // ambient bounced back from below

    #endif

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {

        var output: FragmentOutput;

        #ifdef SHADOW_PASS

            output.color = getShadowOutput();

        #else

            let albedo: vec3f = textureSample(uAlbedoMap, uAlbedoMapSampler, input.vUv0).rgb;
            let normal: vec3f = normalize(input.vNormalW);

            // a single directional light over a hemispherical ambient - blending the sky and ground
            // colors by the normal costs two instructions and gives the unlit side of the character
            // some shape, which a constant ambient term cannot
            let lambert: f32 = max(dot(normal, -uniform.uLightDirection), 0.0);
            let ambient: vec3f = mix(uniform.uAmbientGround, uniform.uAmbientSky, vec3f(normal.y * 0.5 + 0.5));
            var color: vec3f = albedo * (ambient + uniform.uLightColor * lambert);

            // standard color processing, based on the current fog / tone-mapping / gamma settings
            color = toneMap(addFog(color));
            output.color = vec4f(gammaCorrectOutput(color), 1.0);

        #endif

        return output;
    }
`;

/**
 * Creates a simple {@link ShaderMaterial} which renders a VAT animated character using a single
 * directional light over a hemispherical ambient. Call `setupVatMaterial` on the returned material
 * to attach the VAT texture and shader chunks.
 *
 * Note that the material declares the per instance attributes the VAT chunks expect, and so the
 * characters have to be rendered using instancing.
 *
 * @returns {ShaderMaterial} The created material.
 */
export function createVatShaderMaterial() {
    return new ShaderMaterial({
        uniqueName: 'VatCharacterShader',
        vertexGLSL: vertexGLSL,
        fragmentGLSL: fragmentGLSL,
        vertexWGSL: vertexWGSL,
        fragmentWGSL: fragmentWGSL,
        attributes: {
            vertex_position: SEMANTIC_POSITION,
            vertex_normal: SEMANTIC_NORMAL,
            aUv0: SEMANTIC_TEXCOORD0,

            // the engine does not automatically supply instancing attributes to a ShaderMaterial
            vatRow0: VAT_TRANSFORM_SEMANTICS[0],
            vatRow1: VAT_TRANSFORM_SEMANTICS[1],
            vatRow2: VAT_TRANSFORM_SEMANTICS[2],

            vatFrame: VAT_FRAME_SEMANTIC
        }
    });
}
