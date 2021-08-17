import { version, revision } from '../core/core.js';

import { Shader } from './shader.js';

import { SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_SHADOW } from '../scene/constants.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';

// Public interface
class ProgramLibrary {
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
            this._defaultStdMatOption, device, {}, m, null, [], SHADER_FORWARD, null, null);
        m.shaderOptBuilder.updateMinRef(
            this._defaultStdMatOptionMin, device, {}, m, null, [], SHADER_SHADOW, null, null);
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

    getProgram(name, options) {
        const generator = this._generators[name];
        if (generator === undefined) {
            // #if _DEBUG
            console.warn("ProgramLibrary#getProgram: No program library functions registered for: " + name);
            // #endif
            return null;
        }
        const gd = this._device;
        const key = generator.generateKey(options);
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
                console.warn("ProgramLibrary#getProgram: Cache miss for shader", name, "key", key, "after shaders precaching");

            const shaderDefinition = generator.createShaderDefinition(gd, options);
            shader = this._cache[key] = new Shader(gd, shaderDefinition);
        }
        return shader;
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
        return (pass > SHADER_FORWARDHDR && pass <= SHADER_PICK) ?
            this._defaultStdMatOptionMin : this._defaultStdMatOption;
    }

    precompile(cache) {
        if (cache) {
            const shaders = new Array(cache.length);
            for (let i = 0; i < cache.length; i++) {
                if (cache[i].name === "standard") {
                    const opt = cache[i].options;
                    const defaultMat = this._getDefaultStdMatOptions(opt.pass);
                    for (const p in defaultMat) {
                        if (defaultMat.hasOwnProperty(p) && opt[p] === undefined)
                            opt[p] = defaultMat[p];
                    }
                    // Patch device specific properties
                    opt.useTexCubeLod = this._device.useTexCubeLod;
                }
                shaders[i] = this.getProgram(cache[i].name, cache[i].options);
            }
            // Uncomment to force finish linking after preload
            // let device = this._device;
            // let forceLink = function () {
            //     for (let i = 0; i < shaders.length; i++) {
            //         device.postLink(shaders[i]);
            //     }
            // };
            // pc.Application.getApplication().on("preload:end", forceLink);
        }
        this._precached = true;
    }
}

export { ProgramLibrary };
