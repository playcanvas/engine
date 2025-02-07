import { hashCode } from '../../../core/hash.js';
import { SEMANTIC_ATTR15, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SHADERLANGUAGE_WGSL } from '../../../platform/graphics/constants.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ShaderGenerator } from './shader-generator.js';

class ShaderGeneratorShader extends ShaderGenerator {
    generateKey(options) {

        // Note: options.chunks are not included in the key as currently shader variants are removed
        // from the material when its chunks are modified.

        const desc = options.shaderDesc;
        const vsHash = desc.vertexCode ? hashCode(desc.vertexCode) : 0;
        const fsHash = desc.fragmentCode ? hashCode(desc.fragmentCode) : 0;
        const definesHash = ShaderGenerator.definesHash(options.defines);

        let key = `${desc.uniqueName}_${vsHash}_${fsHash}_${definesHash}`;

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

    createVertexDefinition(definitionOptions, options, sharedIncludes) {

        const desc = options.shaderDesc;

        if (definitionOptions.shaderLanguage === SHADERLANGUAGE_WGSL) {

            // TODO: WGSL doesn't have preprocessor connected at the moment, so we just directly use
            // the provided code. This will be fixed in the future.
            definitionOptions.vertexCode = desc.vertexCode;

        } else {
            const includes = new Map(sharedIncludes);
            const defines = new Map(options.defines);

            includes.set('transformInstancingVS', ''); // no default instancing, needs to be implemented in the user shader

            if (options.skin) defines.set('SKIN', true);
            if (options.useInstancing) defines.set('INSTANCING', true);
            if (options.useMorphPosition || options.useMorphNormal) {
                defines.set('MORPHING', true);
                if (options.useMorphTextureBasedInt) defines.set('MORPHING_INT', true);
                if (options.useMorphPosition) defines.set('MORPHING_POSITION', true);
                if (options.useMorphNormal) defines.set('MORPHING_NORMAL', true);
            }

            definitionOptions.vertexCode = desc.vertexCode;
            definitionOptions.vertexIncludes = includes;
            definitionOptions.vertexDefines = defines;
        }
    }

    createFragmentDefinition(definitionOptions, options, sharedIncludes) {

        const desc = options.shaderDesc;

        if (definitionOptions.shaderLanguage === SHADERLANGUAGE_WGSL) {

            // TODO: WGSL doesn't have preprocessor connected at the moment, so we just directly use
            // the provided code. This will be fixed in the future.
            definitionOptions.fragmentCode = desc.fragmentCode;

        } else {
            const includes = new Map(sharedIncludes);
            const defines = new Map(options.defines);

            definitionOptions.fragmentCode = desc.fragmentCode;
            definitionOptions.fragmentIncludes = includes;
            definitionOptions.fragmentDefines = defines;
        }
    }

    createShaderDefinition(device, options) {

        const desc = options.shaderDesc;

        const definitionOptions = {
            name: `ShaderMaterial-${desc.uniqueName}`,
            shaderLanguage: desc.shaderLanguage,
            fragmentOutputTypes: desc.fragmentOutputTypes,
            meshUniformBufferFormat: desc.meshUniformBufferFormat,
            meshBindGroupFormat: desc.meshBindGroupFormat
        };

        const sharedIncludes = new Map(Object.entries({
            ...shaderChunks,  // default chunks
            ...options.chunks // material override chunks
        }));

        this.createAttributesDefinition(definitionOptions, options);
        this.createVertexDefinition(definitionOptions, options, sharedIncludes);
        this.createFragmentDefinition(definitionOptions, options, sharedIncludes);

        return ShaderUtils.createDefinition(device, definitionOptions);
    }
}

const shaderGeneratorShader = new ShaderGeneratorShader();

export { shaderGeneratorShader };
