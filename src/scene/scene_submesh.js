pc.extend(pc.scene, function () {
    /**
     * @name pc.graph.SubMesh
     * @class A submesh.
     */
    var SubMesh = function SubMesh() {
        this._indexBuffer = null;
        this._material    = null;
        this._primType    = pc.gfx.PrimType.TRIANGLES;
    }

    /**
     * @function
     * @name pc.graph.SubMesh#getIndexBuffer
     * @description Returns the index buffer assigned to the submesh. The index buffer indexes
     * into the parent geometry's vertex buffer(s).
     * @returns {pc.gfx.IndexBuffer} The index buffer assigned to the submesh.
     * @author Will Eastcott
     */
    SubMesh.prototype.getIndexBuffer = function () {
        return this._indexBuffer;
    };

    /**
     * @function
     * @name pc.graph.SubMesh#setIndexBuffer
     * @description Assigns an index buffer to the specified submesh. The index buffer indexes
     * into the parent geometry's vertex buffer(s).
     * @param {pc.gfx.IndexBuffer} indexBuffer The index buffer to assign to the submesh.
     * @author Will Eastcott
     */
    SubMesh.prototype.setIndexBuffer = function (indexBuffer) {
        this._indexBuffer = indexBuffer;
    };

    /**
     * @function
     * @name pc.graph.SubMesh#getMaterial
     * @description Returns the material assigned to the submesh. A submesh has exactly one
     * material since each submesh of a geometry is the collection of primitives sharing the
     * same material.
     * @returns {pc.graph.Material} The material assigned to the submesh.
     * @author Will Eastcott
     */
    SubMesh.prototype.getMaterial = function () {
        return this._material;
    };

    /**
     * @function
     * @name pc.graph.SubMesh#setMaterial
     * @description Assigns a material to the specified submesh. A submesh has exactly one
     * material since each submesh of a geometry is the collection of primitives sharing the
     * same material.
     * @param {pc.graph.Material} material The material to assign to the submesh.
     * @author Will Eastcott
     */
    SubMesh.prototype.setMaterial = function (material) {
        this._material = material;
    };

    /**
     * @function
     * @name pc.graph.SubMesh#getPrimitiveType
     * @description Returns the primitive type represented by the submesh's index buffer. 
     * @returns {pc.gfx.PrimType} The material assigned to the submesh.
     * @author Will Eastcott
     */
    SubMesh.prototype.getPrimitiveType = function () {
        return this._primType;
    };

    /**
     * @function
     * @name pc.graph.SubMesh#setPrimitiveType
     * @description Sets the primitive type used to interpret the submesh's index buffer. 
     * @param {pc.gfx.PrimType} type The material assigned to the submesh.
     * @author Will Eastcott
     */
    SubMesh.prototype.setPrimitiveType = function (type) {
        this._primType = type;
    };

    return {
        SubMesh: SubMesh
    }; 
}());