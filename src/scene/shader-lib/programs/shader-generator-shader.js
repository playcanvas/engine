import { hashCode } from '../../../core/hash.js';
import { SHADERLANGUAGE_WGSL } from '../../../platform/graphics/constants.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { ShaderPass } from '../../shader-pass.js';
import { ShaderGenerator } from './shader-generator.js';

const vShader = `
    #include "shaderPassDefines"
    #include "userCode"
`;

const fShader = `
    #include "shaderPassDefines"
    #include "userCode"
`;

class ShaderGeneratorShader extends ShaderGenerator {
    generateKey(options) {
        const descr = options.shaderDescr;
        const vsHash = descr.vertexCode ? hashCode(descr.vertexCode) : 0;
        const fsHash = descr.fragmentCode ? hashCode(descr.fragmentCode) : 0;

        let key = `${descr.uniqueName}_${vsHash}_${fsHash}`;
        key += '_' + options.pass;
        key += '_' + options.gamma;
        key += '_' + options.toneMapping;

        return key;
    }

    createVertexDefinition(definitionOptions, options, shaderPassInfo) {

        const descr = options.shaderDescr;

        if (definitionOptions.shaderLanguage === SHADERLANGUAGE_WGSL) {

            // TODO: WGSL doesn't have preprocessor connected at the moment, so we just directly use
            // the provided code. This will be fixed in the future.
            definitionOptions.vertexCode = descr.vertexCode;

        } else {
            const includes = new Map();
            const defines = new Map();

            includes.set('shaderPassDefines', shaderPassInfo.shaderDefines);
            includes.set('userCode', descr.vertexCode);

            definitionOptions.vertexCode = vShader;
            definitionOptions.vertexIncludes = includes;
            definitionOptions.vertexDefines = defines;
        }
    }

    createFragmentDefinition(definitionOptions, options, shaderPassInfo) {

        const descr = options.shaderDescr;

        if (definitionOptions.shaderLanguage === SHADERLANGUAGE_WGSL) {

            // TODO: WGSL doesn't have preprocessor connected at the moment, so we just directly use
            // the provided code. This will be fixed in the future.
            definitionOptions.fragmentCode = descr.fragmentCode;

        } else {
            const includes = new Map();
            const defines = new Map();

            includes.set('shaderPassDefines', shaderPassInfo.shaderDefines);
            includes.set('userCode', descr.fragmentCode);

            definitionOptions.fragmentCode = fShader;
            definitionOptions.fragmentIncludes = includes;
            definitionOptions.fragmentDefines = defines;
        }
    }

    createShaderDefinition(device, options) {

        const shaderPassInfo = ShaderPass.get(device).getByIndex(options.pass);
        const descr = options.shaderDescr;

        const definitionOptions = {
            name: `ShaderMaterial-${descr.uniqueName}`,
            attributes: descr.attributes,
            shaderLanguage: descr.shaderLanguage,
            fragmentOutputTypes: descr.fragmentOutputTypes,
            meshUniformBufferFormat: descr.meshUniformBufferFormat,
            meshBindGroupFormat: descr.meshBindGroupFormat
        };

        this.createVertexDefinition(definitionOptions, options, shaderPassInfo);
        this.createFragmentDefinition(definitionOptions, options, shaderPassInfo);

        return ShaderUtils.createDefinition(device, definitionOptions);
    }
}

const shaderGeneratorShader = new ShaderGeneratorShader();

export { shaderGeneratorShader };
