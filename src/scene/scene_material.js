pc.extend(pc, function () {
    var id = 0;

    /**
     * @name pc.Material
     * @class A material.
     */
    var Material = function Material() {
        this.name = "Untitled";
        this.id = id++;
        this.shader = null;
        this.variants = {};

        this.parameters = {};

        // Render states
        this.alphaTest = 0;

        this.blend = false;
        this.blendSrc = pc.BLENDMODE_ONE;
        this.blendDst = pc.BLENDMODE_ZERO;
        this.blendEquation = pc.BLENDEQUATION_ADD;

        this.cull = pc.CULLFACE_BACK;

        this.depthTest = true;
        this.depthWrite = true;

        this.redWrite = true;
        this.greenWrite = true;
        this.blueWrite = true;
        this.alphaWrite = true;

        this.meshInstances = []; // The mesh instances referencing this material
    };

    Object.defineProperty(Material.prototype, 'blendType', {
        get: function () {
            if ((!this.blend) &&
                (this.blendSrc === pc.BLENDMODE_ONE) &&
                (this.blendDst === pc.BLENDMODE_ZERO) &&
                (this.blendEquation === pc.BLENDEQUATION_ADD)) {
                return pc.BLEND_NONE;
            } else if ((this.blend) &&
                       (this.blendSrc === pc.BLENDMODE_SRC_ALPHA) &&
                       (this.blendDst === pc.BLENDMODE_ONE_MINUS_SRC_ALPHA) &&
                       (this.blendEquation === pc.BLENDEQUATION_ADD)) {
                return pc.BLEND_NORMAL;
            } else if ((this.blend) &&
                       (this.blendSrc === pc.BLENDMODE_ONE) &&
                       (this.blendDst === pc.BLENDMODE_ONE) &&
                       (this.blendEquation === pc.BLENDEQUATION_ADD)) {
                return pc.BLEND_ADDITIVE;
            } else if ((this.blend) &&
                       (this.blendSrc === pc.BLENDMODE_SRC_ALPHA) &&
                       (this.blendDst === pc.BLENDMODE_ONE) &&
                       (this.blendEquation === pc.BLENDEQUATION_ADD)) {
                return pc.BLEND_ADDITIVEALPHA;
            } else if ((this.blend) &&
                       (this.blendSrc === pc.BLENDMODE_DST_COLOR) &&
                       (this.blendDst === pc.BLENDMODE_ZERO) &&
                       (this.blendEquation === pc.BLENDEQUATION_ADD)) {
                return pc.BLEND_MULTIPLICATIVE;
            } else if ((this.blend) &&
                       (this.blendSrc === pc.BLENDMODE_ONE) &&
                       (this.blendDst === pc.BLENDMODE_ONE_MINUS_SRC_ALPHA) &&
                       (this.blendEquation === pc.BLENDEQUATION_ADD)) {
                return pc.BLEND_PREMULTIPLIED;
            } else {
                return pc.BLEND_NORMAL;
            }
        },
        set: function (type) {
            switch (type) {
                case pc.BLEND_NONE:
                    this.blend = false;
                    this.blendSrc = pc.BLENDMODE_ONE;
                    this.blendDst = pc.BLENDMODE_ZERO;
                    this.blendEquation = pc.BLENDEQUATION_ADD;
                    break;
                case pc.BLEND_NORMAL:
                    this.blend = true;
                    this.blendSrc = pc.BLENDMODE_SRC_ALPHA;
                    this.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
                    this.blendEquation = pc.BLENDEQUATION_ADD;
                    break;
                case pc.BLEND_PREMULTIPLIED:
                    this.blend = true;
                    this.blendSrc = pc.BLENDMODE_ONE;
                    this.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
                    this.blendEquation = pc.BLENDEQUATION_ADD;
                    break;
                case pc.BLEND_ADDITIVE:
                    this.blend = true;
                    this.blendSrc = pc.BLENDMODE_ONE;
                    this.blendDst = pc.BLENDMODE_ONE;
                    this.blendEquation = pc.BLENDEQUATION_ADD;
                    break;
                case pc.BLEND_ADDITIVEALPHA:
                    this.blend = true;
                    this.blendSrc = pc.BLENDMODE_SRC_ALPHA;
                    this.blendDst = pc.BLENDMODE_ONE;
                    this.blendEquation = pc.BLENDEQUATION_ADD;
                    break;
                case pc.BLEND_MULTIPLICATIVE:
                    this.blend = true;
                    this.blendSrc = pc.BLENDMODE_DST_COLOR;
                    this.blendDst = pc.BLENDMODE_ZERO;
                    this.blendEquation = pc.BLENDEQUATION_ADD;
                    break;
            }
            this._updateMeshInstanceKeys();
        }
    });

    Material.prototype._cloneInternal = function (clone) {
        clone.name = this.name;
        clone.id = id++;
        clone.shader = null;
        clone.variants = {}; // ?

        clone.parameters = {};

        // Render states
        clone.alphaTest = this.alphaTest;

        clone.blend = this.blend;
        clone.blendSrc = this.blendSrc;
        clone.blendDst = this.blendDst;
        clone.blendEquation = this.blendEquation;

        clone.cull = this.cull;

        clone.depthTest = this.depthTest;
        clone.depthWrite = this.depthWrite;

        clone.redWrite = this.redWrite;
        clone.greenWrite = this.greenWrite;
        clone.blueWrite = this.blueWrite;
        clone.alphaWrite = this.alphaWrite;

        clone.meshInstances = [];
    },

    Material.prototype.clone = function () {
        var clone = new pc.Material();
        this._cloneInternal(clone);
        return clone;
    },

    Material.prototype._updateMeshInstanceKeys = function () {
        var i, meshInstances = this.meshInstances;
        for (var i = 0; i < meshInstances.length; i++) {
            meshInstances[i].updateKey();
        }
    };

    Material.prototype.updateShader = function (device, scene, objDefs) {
        // For vanilla materials, the shader can only be set by the user
    }

    /**
     * @function
     * @name pc.Material#getName
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
     * @name pc.Material#setName
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
        this.parameters = {};
    };

    Material.prototype.getParameters = function () {
        return this.parameters;
    };

    Material.prototype.clearVariants = function () {
        this.variants = {};
        for (i=0; i<this.meshInstances.length; i++) {
            this.meshInstances[i]._shader = null;
        }
    };

    /**
     * @function
     * @name pc.Material#getParameter
     * @description Retrieves the specified shader parameter from a material.
     * @param {string} name The name of the parameter to query.
     * @returns {Object} The named parameter.
     * @author Will Eastcott
     */
    Material.prototype.getParameter = function (name) {
        return this.parameters[name];
    };

    /**
     * @function
     * @name pc.Material#setParameter
     * @description Sets a shader parameter on a material.
     * @param {string} name The name of the parameter to set.
     * @param {number|Array|pc.Texture} data The value for the specified parameter.
     * @author Will Eastcott
     */
    Material.prototype.setParameter = function (arg, data) {

        var name;
        if (data===undefined) {
            var uniformObject = arg;
            if (uniformObject.length) {
                for(var i=0; i<uniformObject.length; i++) this.setParameter(uniformObject[i]);
                    return;
            } else {
                name = uniformObject.name;
                data = uniformObject.value;
            }
        } else {
            name = arg;
        }

        var param = this.parameters[name];
        if (param) {
            param.data = data;
        } else {
            this.parameters[name] = {
                scopeId: null,
                data: data
            };
        }
    };

    /**
     * @function
     * @name pc.Material#deleteParameter
     * @description Deletes a shader parameter on a material.
     * @param {string} name The name of the parameter to delete.
     * @author Will Eastcott
     */
    Material.prototype.deleteParameter = function (name) {
        if (this.parameters[name]) {
            delete this.parameters[name];
        }
    };

    /**
     * @function
     * @name pc.Material#setParameters
     * @description Pushes all material parameters into scope.
     * @author Will Eastcott
     */
    Material.prototype.setParameters = function () {
        // Push each shader parameter into scope
        for (var paramName in this.parameters) {
            var parameter = this.parameters[paramName];
            if (!parameter.scopeId) {
                parameter.scopeId = device.scope.resolve(paramName);
            }
            parameter.scopeId.setValue(parameter.data);
        }
    };

    /**
     * @function
     * @name pc.Material#getShader
     * @description Retrieves the shader assigned to the specified material.
     * @returns {pc.Shader} The shader assigned to the material.
     * @author Will Eastcott
     */
    Material.prototype.getShader = function () {
        return this.shader;
    };

    /**
     * @function
     * @name pc.Material#setShader
     * @description Assigns a shader to the specified material.
     * @param {pc.Shader} shader The shader to assign to the material.
     * @author Will Eastcott
     */
    Material.prototype.setShader = function (shader) {
        this.shader = shader;
    };

    /**
     * @function
     * @name pc.Material#update
     * @description Applies any changes made to the material's properties.
     */
    Material.prototype.update = function () {
        throw Error("Not Implemented in base class");
    };

    /**
     * @function
     * @description Initializes the material with the properties in the specified data.
     * @name pc.Material#init
     * @param {object} data The initial data for the material.
     */
    Material.prototype.init = function (data) {
        throw Error("Not Implemented in base class");
    };

    return {
        Material: Material
    };
}());
