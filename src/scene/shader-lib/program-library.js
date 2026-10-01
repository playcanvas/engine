import { Debug } from '../../core/debug.js';
import { hashCode } from '../../core/hash.js';
import { Shader } from '../../platform/graphics/shader.js';
import { ShaderPass } from '../shader-pass.js';

/**
 * @import { ShaderGenerator } from './programs/shader-generator.js'
 */

/**
 * A class responsible for creation and caching of required shaders.
 * There is a two level cache. The first level generates the shader based on the provided options.
 * The second level processes this generated shader using processing options - in most cases
 * modifies it to support uniform buffers.
 *
 * @ignore
 */
class ProgramLibrary {
    /**
     * A cache of shaders processed using processing options.
     *
     * @type {Map<string, Shader>}
     */
    processedCache = new Map();

    /**
     * A cache of shader definitions before processing.
     *
     * @type {Map<number, object>}
     */
    definitionsCache = new Map();

    /**
     * Named shader generators.
     *
     * @type {Map<string, ShaderGenerator>}
     */
    _generators = new Map();

    constructor(device) {
        this._device = device;
        this._isClearingCache = false;

        device.on('destroy:shader', (shader) => {
            this.removeFromCache(shader);
        });
    }

    destroy() {
        this.clearCache();
    }

    register(name, generator) {
        if (!this._generators.has(name)) {
            this._generators.set(name, generator);
        }
    }

    unregister(name) {
        if (this._generators.has(name)) {
            this._generators.delete(name);
        }
    }

    isRegistered(name) {
        return this._generators.has(name);
    }

    /**
     * Returns a generated shader definition for the specified options. They key is used to cache the
     * shader definition.
     *
     * @param {ShaderGenerator} generator - The generator to use.
     * @param {string} name - The unique name of the shader generator.
     * @param {number} key - A unique key representing the shader options.
     * @param {object} options - The shader options.
     * @returns {object} - The shader definition.
     */
    generateShaderDefinition(generator, name, key, options) {
        let def = this.definitionsCache.get(key);
        if (!def) {
            const device = this._device;
            def = generator.createShaderDefinition(device, options);
            def.name = def.name ?? (options.pass ? `${name}-pass:${options.pass}` : name);
            this.definitionsCache.set(key, def);
        }
        return def;
    }

    getCachedShader(key) {
        return this.processedCache.get(key);
    }

    setCachedShader(key, shader) {
        this.processedCache.set(key, shader);
    }

    getProgram(name, options, processingOptions, userMaterialId) {
        const generator = this._generators.get(name);
        if (!generator) {
            Debug.warn(`ProgramLibrary#getProgram: No program library functions registered for: ${name}`);
            return null;
        }

        // we have a key for shader source code generation, a key for its further processing to work with
        // uniform buffers, and a final key to get the processed shader from the cache
        const generationKeyString = generator.generateKey(options);
        const generationKey = hashCode(generationKeyString);

        const processingKeyString = processingOptions.generateKey(this._device);
        const processingKey = hashCode(processingKeyString);

        const totalKey = `${generationKey}#${processingKey}`;

        // do we have final processed shader
        let processedShader = this.getCachedShader(totalKey);
        if (!processedShader) {

            // get generated shader
            const generatedShaderDef = this.generateShaderDefinition(generator, name, generationKey, options);
            Debug.assert(generatedShaderDef);

            // use shader pass name if known
            let passName = '';
            let shaderPassInfo;
            if (options.pass !== undefined) {
                shaderPassInfo = ShaderPass.get(this._device).getByIndex(options.pass);
                passName = `-${shaderPassInfo.name}`;
            }

            // fire an event to allow the shader to be modified by the user. Note that any modifications are applied
            // to all materials using the same generated shader, as the cache key is not modified.
            this._device.fire('shader:generate', {
                userMaterialId,
                shaderPassInfo,
                definition: generatedShaderDef
            });

            // create a shader definition for the shader that will include the processingOptions
            const shaderDefinition = {
                name: `${generatedShaderDef.name}${passName}-proc`,
                attributes: generatedShaderDef.attributes,
                vshader: generatedShaderDef.vshader,
                vincludes: generatedShaderDef.vincludes,
                fincludes: generatedShaderDef.fincludes,
                fshader: generatedShaderDef.fshader,
                processingOptions: processingOptions,
                shaderLanguage: generatedShaderDef.shaderLanguage,
                useDualSourceBlending: generatedShaderDef.useDualSourceBlending,
                meshUniformBufferFormat: generatedShaderDef.meshUniformBufferFormat,
                meshBindGroupFormat: generatedShaderDef.meshBindGroupFormat
            };

            // add new shader to the processed cache
            processedShader = new Shader(this._device, shaderDefinition);

            // keep the keys in the debug mode
            Debug.call(() => {
                processedShader._generationKey = generationKeyString;
                processedShader._processingKey = processingKeyString;
            });

            this.setCachedShader(totalKey, processedShader);
        }

        return processedShader;
    }

    clearCache() {
        this._isClearingCache = true;

        this.processedCache.forEach((shader) => {
            shader.destroy();
        });
        this.processedCache.clear();

        this._isClearingCache = false;
    }

    /**
     * Remove shader from the cache. This function does not destroy it, that is the responsibility
     * of the caller.
     *
     * @param {Shader} shader - The shader to be removed.
     */
    removeFromCache(shader) {
        // don't delete by one when clearing whole cache
        if (this._isClearingCache) {
            return;
        }

        this.processedCache.forEach((cachedShader, key) => {
            if (shader === cachedShader) {
                this.processedCache.delete(key);
            }
        });
    }
}

export { ProgramLibrary };
