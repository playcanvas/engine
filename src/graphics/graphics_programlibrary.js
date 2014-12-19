pc.extend(pc, function () {
    'use strict';

    // Public interface
    var ProgramLibrary = function (device) {
        this._device = device;
        this._cache = {};
        this._generators = {};
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
            logERROR("No program library functions registered for: " + name);
            return null;
        }
        var key = generator.generateKey(gd, options);
        var shader = this._cache[key];
        if (!shader) {
            var gd = this._device;
            var shaderDefinition = generator.createShaderDefinition(gd, options);
            shader = this._cache[key] = new pc.Shader(gd, shaderDefinition);
        }
        return shader;
    };

    return {
        ProgramLibrary: ProgramLibrary
    }; 
}());