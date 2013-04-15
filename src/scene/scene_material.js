pc.extend(pc.scene, function () {
    var id = 0;

    /**
     * @name pc.scene.Material
     * @class A material.
     */
    var Material = function Material() {
        this.name = null;
        this.id = id++;

        this._parameters       = {};
        this._state            = {};
        this._program          = null; // Set if the material has a vanilla program attached
        this._programs         = {};   // Set from a program generator
        
        this.blendType = pc.scene.BLEND_NONE;
    };

    Object.defineProperty(Material.prototype, 'blendType', {
        get: function () {
            if (this._state.blendModes) {
                if ((this._state.blendModes.srcBlend === pc.gfx.BLENDMODE_ONE) && 
                    (this._state.blendModes.dstBlend === pc.gfx.BLENDMODE_ZERO)) {
                    return pc.scene.BLEND_NONE;
                } else if ((this._state.blendModes.srcBlend === pc.gfx.BLENDMODE_SRC_ALPHA) && 
                           (this._state.blendModes.dstBlend === pc.gfx.BLENDMODE_ONE_MINUS_SRC_ALPHA)) {
                    return pc.scene.BLEND_NORMAL;
                } else if ((this._state.blendModes.srcBlend === pc.gfx.BLENDMODE_ONE) && 
                           (this._state.blendModes.dstBlend === pc.gfx.BLENDMODE_ONE)) {
                    return pc.scene.BLEND_ADDITIVE;
                } else {
                    return pc.scene.BLEND_NORMAL;
                }
            } else {
                return pc.scene.BLEND_NONE;
            }
        },
        set: function (type) {
            switch (type) {
                case pc.scene.BLEND_NONE:
                    this._state.blend = false;
                    this._state.blendModes = {
                        srcBlend: pc.gfx.BLENDMODE_ONE, 
                        dstBlend: pc.gfx.BLENDMODE_ZERO
                    };
                    break;
                case pc.scene.BLEND_NORMAL:
                    this._state.blend = true;
                    this._state.blendModes = {
                        srcBlend: pc.gfx.BLENDMODE_SRC_ALPHA,
                        dstBlend: pc.gfx.BLENDMODE_ONE_MINUS_SRC_ALPHA
                    };
                    break;
                case pc.scene.BLEND_ADDITIVE:
                    this._state.blend = true;
                    this._state.blendModes = {
                        srcBlend: pc.gfx.BLENDMODE_ONE, 
                        dstBlend: pc.gfx.BLENDMODE_ONE 
                    };
                    break;
            }
        }
    });

    /**
     * @function
     * @name pc.scene.Material#getName
     * @description Returns the string name of the specified material. This name is not
     * necessarily unique. Material names set by an artist within the modelling application
     * should be preserved in the PlayCanvas runtime.
     * @return {string} The name of the material.
     * @author Will Eastcott
     */
    Material.prototype.getName = function () {
        return this.name;
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
        this.name = name;
    };

    // Parameter management
    Material.prototype.clearParameters = function () {
        this._parameters = {};
        
        // If programs for this material are being procedurally generated, then
        // discard whatever has already been cached
        this._programs = {};
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
     * @name {number|Array|pc.gfx.Texture} data The value for the specified parameter.
     * @author Will Eastcott
     */
    Material.prototype.setParameter = function (name, data) {
        var device = pc.gfx.Device.getCurrent();
        var param = this._parameters[name];
        if (param) {
            param._data = data;
        } else {
            this._parameters[name] = {
                _scopeId : device.scope.resolve(name),
                _data    : data
            };

            // If programs for this material are being procedurally generated, then
            // discard whatever has already been cached
            this._programs = {};
        }
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

            // If programs for this material are being procedurally generated, then
            // discard whatever has already been cached
            this._programs = {};
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
    Material.prototype.getProgram = function (mesh) {
        return this._program;
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

    /**
     * @function
     * @name pc.scene.Material#getState
     * @description Retrieves the block of render state set on the specified material. When the
     * material is used to render a pc.scene.SubMesh, the render state will be set as local state. 
     * When the submesh has been rendered, the local state will be cleared.
     * @returns {Object} The render state assigned to the material.
     * @author Will Eastcott
     */
    Material.prototype.getState = function () {
        return this._state;
    };

    /**
     * @function
     * @name pc.scene.Material#setState
     * @description Assigns a block of render state to the specified material. When the material
     * is used to render a pc.scene.SubMesh, the render state will be set as local state. When
     * the submesh has been rendered, the local state will be cleared.
     * @param {Object} state The render state to assign to the material.
     * @author Will Eastcott
     */
    Material.prototype.setState = function (state) {
        this._state = state;
    };

    return {
        Material: Material
    }; 
}());