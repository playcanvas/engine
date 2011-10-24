pc.extend(pc.scene, function () {

    var _transparencyDefault = function (material) {
        return false;
    };

    /**
     * @name pc.scene.Material
     * @class A material.
     */
    var Material = function Material() {
        this._name             = null;
        this._programName      = null;
        this._parameters       = {};
        this._state            = {};
        this._program          = null; // Set if the material has a vanilla program attached
        this._programs         = {};   // Set from a program generator
        this._transparencyFunc = _transparencyDefault;
    };

    Material.transparencyDefault = _transparencyDefault;

    /**
     * @function
     * @name pc.scene.Material#getName
     * @description Returns the string name of the specified material. This name is not
     * necessarily unique. Material names set by artist's within the modelling application
     * should be preserved in the PlayCanvas runtime.
     * @return {string} The name of the material.
     * @author Will Eastcott
     */
    Material.prototype.getName = function () {
        return this._name;
    };

    /**
     * @function
     * @name pc.scene.Material#setName
     * @description Sets the string name of the specified material. This name does not
     * have to be unique.
     * @param {string} name The name of the material.
     * @author Will Eastcott
     */
    Material.prototype.setName = function (name) {
        this._name = name;
    };
    
    Material.prototype.setProgramName = function (name) {
        if (pc.graph.materialplugin[name]) {
            var func = pc.graph.materialplugin[name].isTransparent;
            if (func) {
                this.setTransparencyFunc(func);
            }
        }
        this._programName = name;
    };

    Material.prototype.isTransparent = function () {
        return this._transparencyFunc(this);
    };

    Material.prototype.setTransparencyFunc = function (func) {
        this._transparencyFunc = func ? func : _transparencyDefault;
    };

    Material.prototype.getTransparencyFunc = function () {
        return this._transparencyFunc;
    };

    // Parameter management
    Material.prototype.clearParameters = function () {
        this._parameters = {};
    };

    Material.prototype.getParameters = function () {
        return this._parameters;
    };

    /**
     * @function
     * @name pc.scene.Material#getParameter
     * @description Retrieves the specified shader parameter from a material.
     * @name {string} name The name of the parameter to query.
     * @returns {Object} The named parameter.
     * @author Will Eastcott
     */
    Material.prototype.getParameter = function (name) {
        return this._parameters[name];
    };

    /**
     * @function
     * @name pc.scene.Material#setParameter
     * @description Sets a shader parameter on a material.
     * @name {string} name The name of the parameter to set.
     * @name {number|Array|pc.gfx.Texture2D|pc.gfx.TextureCube} data The value for the specified parameter.
     * @author Will Eastcott
     */
    Material.prototype.setParameter = function (name, data) {
        var device = pc.gfx.Device.getCurrent();
        this._parameters[name] = {
            _scopeId : device.scope.resolve(name),
            _data    : data
        };
    };

    /**
     * @function
     * @name pc.scene.Material#deleteParameter
     * @description Deletes a shader parameter on a material.
     * @name {string} name The name of the parameter to delete.
     * @author Will Eastcott
     */
    Material.prototype.deleteParameter = function (name) {
        if (this._parameters[name]) {
            delete this._parameters[name];
        }
    };

    /**
     * @function
     * @name pc.scene.Material#setParameters
     * @description Pushes all material parameters into scope.
     * @author Will Eastcott
     */
    Material.prototype.setParameters = function () {    
        // Push each shader parameter into scope
        for (var paramName in this._parameters) {
            var parameter = this._parameters[paramName];
            parameter._scopeId.setValue(parameter._data);
        }
    };

    /**
     * @function
     * @name pc.scene.Material#getProgram
     * @description Retrieves the program assigned to the specified material.
     * @returns {pc.gfx.Program} The program assigned to the material.
     * @author Will Eastcott
     */
    Material.prototype.getProgram = function (geometry) {
        if (this._programName === null) {
            return this._program;
        } else {
            var key = pc.graph.materialplugin[this._programName].generateStateKey(geometry);
            var program = this._programs[key];
            if (!program) {
                program = pc.graph.materialplugin[this._programName].getProgram(this, geometry);
                this._programs[key] = program;
            }
            return program;
        }
    };

    /**
     * @function
     * @name pc.scene.Material#setProgram
     * @description Assigns a program to the specified material.
     * @param {pc.gfx.Program} program The program to assign to the material.
     * @author Will Eastcott
     */
    Material.prototype.setProgram = function (program) {
        this._program = program;
    };

    Material.prototype.setState = function (state) {
        this._state = state;
    }

    Material.prototype.getState = function () {
        return this._state;
    }
    
    return {
        Material: Material
    }; 
}());