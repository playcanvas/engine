pc.extend(pc.gfx, function () {
    // Public interface
    var ProgramLibrary = function () {
        this._cache = [];
        this._generators = [];
    };

    ProgramLibrary.prototype.register = function (name, vsFunc, fsFunc, keyFunc) {
        this._generators[name] = {
            generateVert : vsFunc,
            generateFrag : fsFunc, 
            generateKey : keyFunc
        };
    };

    ProgramLibrary.prototype.unregister = function (name) {
        this._generators[name] = undefined;
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
        if (program === undefined) {
            var vsCode = generator.generateVert(options);
            var fsCode = generator.generateFrag(options);
            logDEBUG("\n" + key + ": vertex shader\n" + vsCode);
            logDEBUG("\n" + key + ": fragment shader\n" + fsCode);
            var vs = new pc.gfx.Shader(pc.gfx.ShaderType.VERTEX, vsCode);
            var fs = new pc.gfx.Shader(pc.gfx.ShaderType.FRAGMENT, fsCode);
            program = this._cache[key] = new pc.gfx.Program(vs, fs);
        }
        return program;
    };

    return {
        ProgramLibrary: ProgramLibrary
    }; 
}());