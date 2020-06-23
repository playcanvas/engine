Object.assign(pc, function () {

    /**
     * @class
     * @name pc.NodeMaterial
     * @augments pc.Material
     * @classdesc A Node material is for rendering geometry with material properties set by a material node graph
     * @property {pc.NodeInputs} nodeInputs
     * @example
     * // Create a new Node material
     * var material = new pc.NodeMaterial();
     *
     *
     * // Notify the material that it has been modified
     * material.update();
     */
    var NodeMaterial = function () {
        pc.Material.call(this);
        
        this.paramValues=[];

        //this.nodeInputs = new NodeInputs();

      //  this.nodeInputs.params = [];
        
     //   this.nodeInputs.key = null;
     //   this.nodeInputs.vertexPositionOffset = 'vec3 getVertexPositionOffset(){\n return vec3(0,0,0); \n};\n';
     //   this.nodeInputs.emissiveColor = 'vec3 getEmissiveColor(){\n return vec3(0,0,0); \n};\n';
//        this.nodeInputs.baseColor = 'vec3 getBaseColor(){\n return vec3(0,0,0); \n};\n';
//        this.nodeInputs.opacity = 'float getOpacity(){\n return float(0); \n};\n';
//        this.nodeInputs.normal = 'vec3 getNormal(){\n return vec3(0,0,0); \n};\n';
//        this.nodeInputs.metallic = 'float getMetallic(){\n return float(0); \n};\n';
//        this.nodeInputs.roughness = 'float getRoughness(){\n return float(0); \n};\n';

        //no neeed? assume node input vector param values are Float32Arrays!
//        this.tempVec2 = new Float32Array(2);
//        this.tempVec3 = new Float32Array(3);
//        this.tempVec4 = new Float32Array(4);

    };
    NodeMaterial.prototype = Object.create(pc.Material.prototype);
    NodeMaterial.prototype.constructor = NodeMaterial;

    var NodeInputs = function () { };
    NodeInputs.prototype.copy = function (from) {
        for (var p in from) {
            if (from.hasOwnProperty(p) && p !== 'copy')
                this[p] = from[p];
        }
    };

/*    var NodeParam = function (type, name, value) {
        this.type = type;
        this.name = name;
        this.value = value;    
      }
      NodeParam.prototype.constructor = NodeParam;*/

    Object.assign(NodeMaterial.prototype, {
        /**
         * @function
         * @name pc.NodeMaterial#clone
         * @description Duplicates a Node material. All properties are duplicated except textures
         * where only the references are copied.
         * @returns {pc.NodeMaterial} A cloned Node material.
         */
        clone: function () {
            var clone = new pc.NodeMaterial();

            pc.Material.prototype._cloneInternal.call(this, clone);

            //clone.nodeInputs.copy(this.nodeInputs);

            return clone;
        },

        updateUniforms: function () {
            this.clearParameters();

            for (var n=0;n<this.shaderGraphNode.params.length;n++)
            {
                if (!this.paramValues[n])
                {
                    this.paramValues[n] = (this.shaderGraphNode.params[n].value.clone) ? this.shaderGraphNode.params[n].value.clone() : this.shaderGraphNode.params[n].value;
                }

                switch(this.shaderGraphNode.params[n].type)
                {
                    case 'sampler2D':
                    case 'samplerCube':
                    case 'float':
                    case 'vec2':
                    case 'vec3':
                    case 'vec4':
                        this.setParameter(this.shaderGraphNode.params[n].name, this.paramValues[n]);
                        break;
                    default:
                        //error
                        break;    
                }           
            }
        },

        //updateShader: function (device, scene, objDefs, staticLightList, pass, sortedLights) {
        initShader: function (device) {
            if (!this.shader)
            {
                var options = {
                    skin: !!this.meshInstances[0].skinInstance,
                    shaderGraphNode: this.shaderGraphNode,
                    //pass: pass
                };
//              var library = device.getProgramLibrary();
//              this.shader = library.getProgram('node', options);

                var shaderDefinition = pc.programlib.node.createShaderDefinition(device, options);
                this.shader = new pc.Shader(device, shaderDefinition);
            }
        }
    });

    return {
        NodeMaterial: NodeMaterial
    };
}());
