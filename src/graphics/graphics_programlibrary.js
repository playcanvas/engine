pc.extend(pc.gfx, function () {
    // Public interface
    var ProgramLibrary = function () {
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
        var key = generator.generateKey(options);
        var program = this._cache[key];
        if (!program) {
            var vsCode = generator.generateVertexShader(options);
            var fsCode = generator.generateFragmentShader(options);
            logDEBUG("\n" + key + ": vertex shader\n" + vsCode);
            logDEBUG("\n" + key + ": fragment shader\n" + fsCode);
            var vs = new pc.gfx.Shader(pc.gfx.SHADERTYPE_VERTEX, vsCode);
            var fs = new pc.gfx.Shader(pc.gfx.SHADERTYPE_FRAGMENT, fsCode);
            program = this._cache[key] = new pc.gfx.Program(vs, fs);
        }
        return program;
    };

    return {
        ProgramLibrary: ProgramLibrary
    }; 
}());