import { hashCode } from '../../../core/hash.js';
import { SHADERLANGUAGE_WGSL } from '../../../platform/graphics/constants.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
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
    #include "tonemapping"
    #include "userCode"
`;

class ShaderGeneratorShader extends ShaderGenerator {
    generateKey(options) {
        const desc = options.shaderDesc;
        const vsHash = desc.vertexCode ? hashCode(desc.vertexCode) : 0;
        const fsHash = desc.fragmentCode ? hashCode(desc.fragmentCode) : 0;

        let key = `${desc.uniqueName}_${vsHash}_${fsHash}`;
        key += '_' + options.pass;
        key += '_' + options.gamma;
        key += '_' + options.toneMapping;

        return key;
    }

    createVertexDefinition(definitionOptions, options, shaderPassInfo) {

        const desc = options.shaderDesc;

        if (definitionOptions.shaderLanguage === SHADERLANGUAGE_WGSL) {

            // TODO: WGSL doesn't have preprocessor connected at the moment, so we just directly use
            // the provided code. This will be fixed in the future.
            definitionOptions.vertexCode = desc.vertexCode;

        } else {
            const includes = new Map();
            const defines = new Map();

            includes.set('shaderPassDefines', shaderPassInfo.shaderDefines);
            includes.set('userCode', desc.vertexCode);

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
            const includes = new Map();
            const defines = new Map();

            includes.set('shaderPassDefines', shaderPassInfo.shaderDefines);
            includes.set('decodePS', shaderChunks.decodePS);
            includes.set('gamma', ShaderGenerator.gammaCode(options.gamma));
            includes.set('tonemapping', ShaderGenerator.tonemapCode(options.toneMapping));
            includes.set('userCode', desc.fragmentCode);

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
            attributes: desc.attributes,
            shaderLanguage: desc.shaderLanguage,
            fragmentOutputTypes: desc.fragmentOutputTypes,
            meshUniformBufferFormat: desc.meshUniformBufferFormat,
            meshBindGroupFormat: desc.meshBindGroupFormat
        };

        this.createVertexDefinition(definitionOptions, options, shaderPassInfo);
        this.createFragmentDefinition(definitionOptions, options, shaderPassInfo);

        return ShaderUtils.createDefinition(device, definitionOptions);
    }
}

const shaderGeneratorShader = new ShaderGeneratorShader();

export { shaderGeneratorShader };
