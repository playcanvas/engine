import { hashCode } from '../../../core/hash.js';
import { SEMANTIC_ATTR15, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SHADERLANGUAGE_WGSL } from '../../../platform/graphics/constants.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { tonemapNames } from '../../constants.js';
import { ShaderPass } from '../../shader-pass.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ShaderGenerator } from './shader-generator.js';

const vShader = `
    #include "shaderPassDefines"
    #include "userCode"
`;

const fShader = `
    #include "shaderPassDefines"
    #include "decodePS"
    #include "gamma"
    #include "tonemappingPS"
    #include "fog"
    #include "userCode"
`;

class ShaderGeneratorShader extends ShaderGenerator {
    generateKey(options) {
        const desc = options.shaderDesc;
        const vsHash = desc.vertexCode ? hashCode(desc.vertexCode) : 0;
        const fsHash = desc.fragmentCode ? hashCode(desc.fragmentCode) : 0;
        const definesHash = ShaderGenerator.definesHash(options.defines);

        let key = `${desc.uniqueName}_${vsHash}_${fsHash}_${definesHash}`;
        key += `_${options.pass}`;
        key += `_${options.gamma}`;
        key += `_${options.toneMapping}`;
        key += `_${options.fog}`;

        if (options.skin)                       key += '_skin';
        if (options.useInstancing)              key += '_inst';
        if (options.useMorphPosition)           key += '_morphp';
        if (options.useMorphNormal)             key += '_morphn';
        if (options.useMorphTextureBasedInt)    key += '_morphi';

        return key;
    }

    createAttributesDefinition(definitionOptions, options) {

        // clone provided attributes if any
        const srcAttributes = options.shaderDesc.attributes;
        const attributes = srcAttributes ? { ...srcAttributes } : undefined;

        // add automatic attributes
        if (options.skin) {
            attributes.vertex_boneWeights = SEMANTIC_BLENDWEIGHT;
            attributes.vertex_boneIndices = SEMANTIC_BLENDINDICES;
        }

        if (options.useMorphPosition || options.useMorphNormal) {
            attributes.morph_vertex_id = SEMANTIC_ATTR15;
        }

        definitionOptions.attributes = attributes;
    }


    createVertexDefinition(definitionOptions, options, shaderPassInfo) {

        const desc = options.shaderDesc;

        if (definitionOptions.shaderLanguage === SHADERLANGUAGE_WGSL) {

            // TODO: WGSL doesn't have preprocessor connected at the moment, so we just directly use
            // the provided code. This will be fixed in the future.
            definitionOptions.vertexCode = desc.vertexCode;

        } else {
            const includes = new Map();
            const defines = new Map(options.defines);

            includes.set('shaderPassDefines', shaderPassInfo.shaderDefines);
            includes.set('userCode', desc.vertexCode);
            includes.set('transformCore', shaderChunks.transformCoreVS);
            includes.set('transformInstancing', ''); // no default instancing, needs to be implemented in the user shader
            includes.set('normalCore', shaderChunks.normalCoreVS);
            includes.set('skinCode', shaderChunks.skinTexVS);
            includes.set('skinTexVS', shaderChunks.skinTexVS);

            if (options.skin) defines.set('SKIN', true);
            if (options.useInstancing) defines.set('INSTANCING', true);
            if (options.useMorphPosition || options.useMorphNormal) {
                defines.set('MORPHING', true);
                if (options.useMorphTextureBasedInt) defines.set('MORPHING_INT', true);
                if (options.useMorphPosition) defines.set('MORPHING_POSITION', true);
                if (options.useMorphNormal) defines.set('MORPHING_NORMAL', true);
            }

            definitionOptions.vertexCode = vShader;
            definitionOptions.vertexIncludes = includes;
            definitionOptions.vertexDefines = defines;
        }
    }

    createFragmentDefinition(definitionOptions, options, shaderPassInfo) {

        const desc = options.shaderDesc;

        if (definitionOptions.shaderLanguage === SHADERLANGUAGE_WGSL) {

            // TODO: WGSL doesn't have preprocessor connected at the moment, so we just directly use
            // the provided code. This will be fixed in the future.
            definitionOptions.fragmentCode = desc.fragmentCode;

        } else {
            const includes = new Map(Object.entries({
                ...shaderChunks,
                ...options.chunks
            }));

            includes.set('shaderPassDefines', shaderPassInfo.shaderDefines);
            includes.set('gamma', ShaderGenerator.gammaCode(options.gamma));
            includes.set('fog', ShaderGenerator.fogCode(options.fog));
            includes.set('userCode', desc.fragmentCode);

            const defines = new Map(options.defines);
            defines.set('TONEMAP', tonemapNames[options.toneMapping]);

            definitionOptions.fragmentCode = fShader;
            definitionOptions.fragmentIncludes = includes;
            definitionOptions.fragmentDefines = defines;
        }
    }

    createShaderDefinition(device, options) {

        const shaderPassInfo = ShaderPass.get(device).getByIndex(options.pass);
        const desc = options.shaderDesc;

        const definitionOptions = {
            name: `ShaderMaterial-${desc.uniqueName}`,
            shaderLanguage: desc.shaderLanguage,
            fragmentOutputTypes: desc.fragmentOutputTypes,
            meshUniformBufferFormat: desc.meshUniformBufferFormat,
            meshBindGroupFormat: desc.meshBindGroupFormat
        };

        this.createAttributesDefinition(definitionOptions, options);
        this.createVertexDefinition(definitionOptions, options, shaderPassInfo);
        this.createFragmentDefinition(definitionOptions, options, shaderPassInfo);

        return ShaderUtils.createDefinition(device, definitionOptions);
    }
}

const shaderGeneratorShader = new ShaderGeneratorShader();

export { shaderGeneratorShader };
