Object.assign(pc, function () {
    'use strict';

    // Public interface
    var ProgramLibrary = function (device) {
        this._device = device;
        this._cache = {};
        this._generators = {};
        this._isClearingCache = false;

        // Shared Sandard Material option structures
        this.optionsContext = {};
        this.optionsContextMin = {};
    };

    ProgramLibrary.prototype.register = function (name, generator) {
        if (!this.isRegistered(name)) {
            this._generators[name] = generator;
        }
    };

    ProgramLibrary.prototype.unregister = function (name) {
        if (this.isRegistered(name)) {
            delete this._generators[name];
        }
    };

    ProgramLibrary.prototype.isRegistered = function (name) {
        var generator = this._generators[name];
        return (generator !== undefined);
    };

    ProgramLibrary.prototype.getProgram = function (name, options) {
        var generator = this._generators[name];
        if (generator === undefined) {
            // #ifdef DEBUG
            console.warn("ProgramLibrary#getProgram: No program library functions registered for: " + name);
            // #endif
            return null;
        }
        var gd = this._device;
        var key = generator.generateKey(options);
        var shader = this._cache[key];
        if (!shader) {
            var shaderDefinition = generator.createShaderDefinition(gd, options);
            shader = this._cache[key] = new pc.Shader(gd, shaderDefinition);
        }
        return shader;
    };

    ProgramLibrary.prototype.clearCache = function () {
        var cache = this._cache;
        this._isClearingCache = true;
        for (var key in cache) {
            if (cache.hasOwnProperty(key)) {
                cache[key].destroy();
            }
        }
        this._cache = {};
        this._isClearingCache = false;
    };

    ProgramLibrary.prototype.removeFromCache = function (shader) {
        if (this._isClearingCache) return; // don't delete by one when clearing whole cache
        var cache = this._cache;
        for (var key in cache) {
            if (cache.hasOwnProperty(key)) {
                if (cache[key] === shader) {
                    delete cache[key];
                    break;
                }
            }
        }
    };

    ProgramLibrary.prototype.precompile = function () {
        var options = pc.precompileShaders.options;
        for (var i = 0; i < options.lenght; i++) {
            console.log(options[i]);
        }
    };

    return {
        ProgramLibrary: ProgramLibrary
    };
}());
