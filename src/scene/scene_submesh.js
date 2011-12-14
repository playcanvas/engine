pc.extend(pc.scene, function () {
    /**
     * @name pc.scene.SubMesh
     * @class A submesh.
     */
    var SubMesh = function SubMesh() {
        this._material = null;
        this._primType = pc.gfx.PrimType.TRIANGLES;
        this._base     = 0;
        this._count    = 0;
    }

    /**
     * @function
     * @name pc.scene.SubMesh#getMaterial
     * @description Returns the material assigned to the submesh. A submesh has exactly one
     * material since each submesh of a geometry is the collection of primitives sharing the
     * same material.
     * @returns {pc.scene.Material} The material assigned to the submesh.
     * @author Will Eastcott
     */
    SubMesh.prototype.getMaterial = function () {
        return this._material;
    };

    /**
     * @function
     * @name pc.scene.SubMesh#setMaterial
     * @description Assigns a material to the specified submesh. A submesh has exactly one
     * material since each submesh of a geometry is the collection of primitives sharing the
     * same material.
     * @param {pc.scene.Material} material The material to assign to the submesh.
     * @author Will Eastcott
     */
    SubMesh.prototype.setMaterial = function (material) {
        this._material = material;
    };

    /**
     * @function
     * @name pc.scene.SubMesh#getPrimitiveType
     * @description Returns the primitive type represented by the submesh's index buffer. 
     * @returns {pc.gfx.PrimType} The material assigned to the submesh.
     * @author Will Eastcott
     */
    SubMesh.prototype.getPrimitiveType = function () {
        return this._primType;
    };

    /**
     * @function
     * @name pc.scene.SubMesh#setPrimitiveType
     * @description Sets the primitive type used to interpret the submesh's index buffer. 
     * @param {pc.gfx.PrimType} type The material assigned to the submesh.
     * @author Will Eastcott
     */
    SubMesh.prototype.setPrimitiveType = function (type) {
        this._primType = type;
    };

    /**
     * @function
     * @name pc.scene.SubMesh#getIndexBase
     * @description 
     * @returns {Number} The offset into the geometry's index buffer if indexed, the vertex buffer otherwise.
     * @author Will Eastcott
     */
    SubMesh.prototype.getIndexBase = function () {
        return this._base;
    };

    /**
     * @function
     * @name pc.scene.SubMesh#setIndexBase
     * @description
     * @param {Number} base The offset into the geometry's index buffer if indexed, the vertex buffer otherwise.
     * @author Will Eastcott
     */
    SubMesh.prototype.setIndexBase = function (base) {
        this._base = base;
    };

    /**
     * @function
     * @name pc.scene.SubMesh#getIndexBase
     * @description 
     * @returns {Number} .
     * @author Will Eastcott
     */
    SubMesh.prototype.getIndexCount = function () {
        return this._count;
    };

    /**
     * @function
     * @name pc.scene.SubMesh#setIndexCount
     * @description
     * @param {Number} count.
     * @author Will Eastcott
     */
    SubMesh.prototype.setIndexCount = function (count) {
        this._count = count;
    };

    return {
        SubMesh: SubMesh
    }; 
}());