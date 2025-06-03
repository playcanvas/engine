import { hashCode } from '../../../core/hash.js';
import { MapUtils } from '../../../core/map-utils.js';
import { SEMANTIC_ATTR15, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../platform/graphics/constants.js';
import { ShaderDefinitionUtils } from '../../../platform/graphics/shader-definition-utils.js';
import { ShaderGenerator } from './shader-generator.js';
import { ShaderChunks } from '../shader-chunks.js';

class ShaderGeneratorShader extends ShaderGenerator {
    generateKey(options) {

        // Note: options.shaderChunks are not included in the key as currently shader variants are removed
        // from the material when its chunks are modified.

        const desc = options.shaderDesc;
        const vsHashGLSL = desc.vertexGLSL ? hashCode(desc.vertexGLSL) : 0;
        const fsHashGLSL = desc.fragmentGLSL ? hashCode(desc.fragmentGLSL) : 0;
        const vsHashWGSL = desc.vertexWGSL ? hashCode(desc.vertexWGSL) : 0;
        const fsHashWGSL = desc.fragmentWGSL ? hashCode(desc.fragmentWGSL) : 0;
        const definesHash = ShaderGenerator.definesHash(options.defines);

        let key = `${desc.uniqueName}_${definesHash}_${vsHashGLSL}_${fsHashGLSL}_${vsHashWGSL}_${fsHashWGSL}`;

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

    createVertexDefinition(definitionOptions, options, sharedIncludes, wgsl) {

        const desc = options.shaderDesc;

        const includes = new Map(sharedIncludes);
        includes.set('transformInstancingVS', ''); // no default instancing, needs to be implemented in the user shader

        const defines = new Map(options.defines);
        if (options.skin) defines.set('SKIN', true);
        if (options.useInstancing) defines.set('INSTANCING', true);
        if (options.useMorphPosition || options.useMorphNormal) {
            defines.set('MORPHING', true);
            if (options.useMorphTextureBasedInt) defines.set('MORPHING_INT', true);
            if (options.useMorphPosition) defines.set('MORPHING_POSITION', true);
            if (options.useMorphNormal) defines.set('MORPHING_NORMAL', true);
        }

        definitionOptions.vertexCode = wgsl ? desc.vertexWGSL : desc.vertexGLSL;
        definitionOptions.vertexIncludes = includes;
        definitionOptions.vertexDefines = defines;
    }

    createFragmentDefinition(definitionOptions, options, sharedIncludes, wgsl) {

        const desc = options.shaderDesc;

        const includes = new Map(sharedIncludes);
        const defines = new Map(options.defines);

        definitionOptions.fragmentCode = wgsl ? desc.fragmentWGSL : desc.fragmentGLSL;
        definitionOptions.fragmentIncludes = includes;
        definitionOptions.fragmentDefines = defines;
    }

    createShaderDefinition(device, options) {

        const desc = options.shaderDesc;
        const wgsl = device.isWebGPU && !!desc.vertexWGSL && !!desc.fragmentWGSL;
        const definitionOptions = {
            name: `ShaderMaterial-${desc.uniqueName}`,
            shaderLanguage: wgsl ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL,
            fragmentOutputTypes: desc.fragmentOutputTypes,
            meshUniformBufferFormat: desc.meshUniformBufferFormat,
            meshBindGroupFormat: desc.meshBindGroupFormat
        };

        // includes - default chunks
        const shaderLanguage = wgsl ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL;
        const sharedIncludes = MapUtils.merge(
            ShaderChunks.get(device, shaderLanguage),
            options.shaderChunks[shaderLanguage]
        );

        this.createAttributesDefinition(definitionOptions, options);
        this.createVertexDefinition(definitionOptions, options, sharedIncludes, wgsl);
        this.createFragmentDefinition(definitionOptions, options, sharedIncludes, wgsl);

        return ShaderDefinitionUtils.createDefinition(device, definitionOptions);
    }
}

const shaderGeneratorShader = new ShaderGeneratorShader();

export { shaderGeneratorShader };
