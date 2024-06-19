import { Debug } from '../../core/debug.js';
import { hashCode } from '../../core/hash.js';
import { version, revision } from '../../core/core.js';

import { Shader } from '../../platform/graphics/shader.js';

import { SHADER_FORWARD, SHADER_DEPTH, SHADER_PICK, SHADER_SHADOW, SHADER_PREPASS_VELOCITY } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { StandardMaterialOptions } from '../materials/standard-material-options.js';
import { RenderingParams } from '../renderer/rendering-params.js';

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
     * @type {Map<string, import('./programs/shader-generator.js').ShaderGenerator>}
     */
    _generators = new Map();

    constructor(device, standardMaterial) {
        this._device = device;
        this._isClearingCache = false;
        this._precached = false;

        // Unique non-cached programs collection to dump and update game shaders cache
        this._programsCollection = [];
        this._defaultStdMatOption = new StandardMaterialOptions();
        this._defaultStdMatOptionMin = new StandardMaterialOptions();

        const defaultRenderParams = new RenderingParams();
        standardMaterial.shaderOptBuilder.updateRef(
            this._defaultStdMatOption, {}, defaultRenderParams, standardMaterial, null, [], SHADER_FORWARD, null);
        standardMaterial.shaderOptBuilder.updateMinRef(
            this._defaultStdMatOptionMin, {}, standardMaterial, null, SHADER_SHADOW, null);

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
     * @param {import('./programs/shader-generator.js').ShaderGenerator} generator - The generator
     * to use.
     * @param {string} name - The unique name of the shader generator.
     * @param {number} key - A unique key representing the shader options.
     * @param {object} options - The shader options.
     * @returns {object} - The shader definition.
     */
    generateShaderDefinition(generator, name, key, options) {
        let def = this.definitionsCache.get(key);
        if (!def) {
            let lights;
            if (options.litOptions?.lights) {
                lights = options.litOptions.lights;
                options.litOptions.lights = lights.map(function (l) {
                    // TODO: refactor this to avoid creating a clone of the light.
                    const lcopy = l.clone ? l.clone() : l;
                    lcopy.key = l.key;
                    return lcopy;
                });
            }

            this.storeNewProgram(name, options);

            if (options.litOptions?.lights)
                options.litOptions.lights = lights;

            if (this._precached)
                Debug.log(`ProgramLibrary#getProgram: Cache miss for shader ${name} key ${key} after shaders precaching`);

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
                shaderLanguage: generatedShaderDef.shaderLanguage
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

    storeNewProgram(name, options) {
        let opt = {};
        if (name === "standard") {
            // For standard material saving all default values is overkill, so we store only diff
            const defaultMat = this._getDefaultStdMatOptions(options.pass);

            for (const p in options) {
                if ((options.hasOwnProperty(p) && defaultMat[p] !== options[p]) || p === "pass")
                    opt[p] = options[p];
            }

            // Note: this was added in #4792 and it does not filter out the default values, like the loop above
            for (const p in options.litOptions) {
                opt[p] = options.litOptions[p];
            }
        } else {
            // Other shaders have only dozen params
            opt = options;
        }

        this._programsCollection.push(JSON.stringify({ name: name, options: opt }));
    }

    // run pc.getProgramLibrary(device).dumpPrograms(); from browser console to build shader options script
    dumpPrograms() {
        let text = 'let device = pc.app ? pc.app.graphicsDevice : pc.Application.getApplication().graphicsDevice;\n';
        text += 'let shaders = [';
        if (this._programsCollection[0])
            text += '\n\t' + this._programsCollection[0];
        for (let i = 1; i < this._programsCollection.length; ++i) {
            text += ',\n\t' + this._programsCollection[i];
        }
        text += '\n];\n';
        text += 'pc.getProgramLibrary(device).precompile(shaders);\n';
        text += 'if (pc.version != \"' + version + '\" || pc.revision != \"' + revision + '\")\n';
        text += '\tconsole.warn(\"precompile-shaders.js: engine version mismatch, rebuild shaders lib with current engine\");';

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', 'precompile-shaders.js');
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
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
        if (this._isClearingCache)
            return;

        this.processedCache.forEach((cachedShader, key) => {
            if (shader === cachedShader) {
                this.processedCache.delete(key);
            }
        });
    }

    _getDefaultStdMatOptions(pass) {
        const shaderPassInfo = ShaderPass.get(this._device).getByIndex(pass);
        return (pass === SHADER_DEPTH || pass === SHADER_PICK || pass === SHADER_PREPASS_VELOCITY || shaderPassInfo.isShadow) ?
            this._defaultStdMatOptionMin : this._defaultStdMatOption;
    }

    precompile(cache) {
        if (cache) {
            const shaders = new Array(cache.length);
            for (let i = 0; i < cache.length; i++) {

                // default options for the standard materials are not stored, and so they are inserted
                // back into the loaded options
                if (cache[i].name === "standard") {
                    const opt = cache[i].options;
                    const defaultMat = this._getDefaultStdMatOptions(opt.pass);
                    for (const p in defaultMat) {
                        if (defaultMat.hasOwnProperty(p) && opt[p] === undefined)
                            opt[p] = defaultMat[p];
                    }
                }

                shaders[i] = this.getProgram(cache[i].name, cache[i].options);
            }
        }
        this._precached = true;
    }
}

export { ProgramLibrary };
