import { Debug } from '../core/debug.js';
import { version, revision } from '../core/core.js';

import { Shader } from './shader.js';

import { SHADER_FORWARD, SHADER_DEPTH, SHADER_PICK, SHADER_SHADOW } from '../scene/constants.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';
import { ShaderPass } from '../scene/shader-pass.js';

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

    constructor(device) {
        this._device = device;
        this._cache = {};
        this._generators = {};
        this._isClearingCache = false;
        this._precached = false;

        // Unique non-cached programs collection to dump and update game shaders cache
        this._programsCollection = [];
        this._defaultStdMatOption = {};
        this._defaultStdMatOptionMin = {};

        const m = new StandardMaterial();
        m.shaderOptBuilder.updateRef(
            this._defaultStdMatOption, {}, m, null, [], SHADER_FORWARD, null);
        m.shaderOptBuilder.updateMinRef(
            this._defaultStdMatOptionMin, {}, m, null, [], SHADER_SHADOW, null);
    }

    register(name, generator) {
        if (!this.isRegistered(name)) {
            this._generators[name] = generator;
        }
    }

    unregister(name) {
        if (this.isRegistered(name)) {
            delete this._generators[name];
        }
    }

    isRegistered(name) {
        const generator = this._generators[name];
        return (generator !== undefined);
    }

    generateShader(generator, name, key, options) {
        let shader = this._cache[key];
        if (!shader) {
            let lights;
            if (options.lights) {
                lights = options.lights;
                options.lights = lights.map(function (l) {
                    // TODO: refactor this to avoid creating a clone of the light.
                    const lcopy = l.clone ? l.clone() : l;
                    lcopy.key = l.key;
                    return lcopy;
                });
            }

            this.storeNewProgram(name, options);

            if (options.lights)
                options.lights = lights;

            if (this._precached)
                Debug.log(`ProgramLibrary#getProgram: Cache miss for shader ${name} key ${key} after shaders precaching`);

            const device = this._device;
            const shaderDefinition = generator.createShaderDefinition(device, options);
            shaderDefinition.name = `${name}-pass:${options.pass}`;
            shader = this._cache[key] = new Shader(device, shaderDefinition);
        }
        return shader;
    }

    getProgram(name, options, processingOptions) {
        const generator = this._generators[name];
        if (!generator) {
            Debug.warn(`ProgramLibrary#getProgram: No program library functions registered for: ${name}`);
            return null;
        }

        // we have a key for shader source code generation, a key for its further processing to work with
        // uniform buffers, and a final key to get the processed shader from the cache
        const generationKey = generator.generateKey(options);
        const processingKey = JSON.stringify(processingOptions);
        const totalKey = `${generationKey}#${processingKey}`;

        // do we have final processed shader
        let processedShader = this.processedCache.get(totalKey);
        if (!processedShader) {

            // get generated shader
            const generatedShader = this.generateShader(generator, name, generationKey, options);
            Debug.assert(generatedShader);

            // create a shader definition for the shader that will include the processingOptions
            const generatedShaderDef = generatedShader.definition;
            const shaderDefinition = {
                attributes: generatedShaderDef.attributes,
                vshader: generatedShaderDef.vshader,
                fshader: generatedShaderDef.fshader,
                processingOptions: processingOptions
            };

            // add new shader to the processed cache
            processedShader = new Shader(this._device, shaderDefinition);
            this.processedCache.set(totalKey, processedShader);
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
        } else {
            // Other shaders have only dozen params
            opt = options;
        }

        this._programsCollection.push(JSON.stringify({ name: name, options: opt }));
    }

    // run pc.app.graphicsDevice.programLib.dumpPrograms(); from browser console to build shader options script
    dumpPrograms() {
        let text = 'let device = pc.app ? pc.app.graphicsDevice : pc.Application.getApplication().graphicsDevice;\n';
        text += 'let shaders = [';
        if (this._programsCollection[0])
            text += '\n\t' + this._programsCollection[0];
        for (let i = 1; i < this._programsCollection.length; ++i) {
            text += ',\n\t' + this._programsCollection[i];
        }
        text += '\n];\n';
        text += 'device.programLib.precompile(shaders);\n';
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
        const cache = this._cache;
        this._isClearingCache = true;
        for (const key in cache) {
            if (cache.hasOwnProperty(key)) {
                cache[key].destroy();
            }
        }
        this._cache = {};
        this._isClearingCache = false;
    }

    removeFromCache(shader) {
        if (this._isClearingCache) return; // don't delete by one when clearing whole cache
        const cache = this._cache;
        for (const key in cache) {
            if (cache.hasOwnProperty(key)) {
                if (cache[key] === shader) {
                    delete cache[key];
                    break;
                }
            }
        }
    }

    _getDefaultStdMatOptions(pass) {
        return (pass === SHADER_DEPTH || pass === SHADER_PICK || ShaderPass.isShadow(pass)) ?
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
