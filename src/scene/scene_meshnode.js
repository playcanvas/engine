pc.extend(pc.scene, function () {
    var RenderStyle = {
        NORMAL: 0,
        WIREFRAME: 1
    };

    /**
     * @name pc.scene.MeshNode
     * @class A mesh.
     */
    var MeshNode = function MeshNode() {
        this._geometry = null;
        this._style    = RenderStyle.NORMAL;
        this._localLights = [];

        this._bones    = null; // For skinned meshes, the bones array that influences the skin
    }
    MeshNode = MeshNode.extendsFrom(pc.scene.GraphNode);

    /**
     * @function
     * @name pc.scene.MeshNode#clone
     * @description Duplicates a mesh node but does not 'deep copy' the geometry. Instead,
     * any attached geometry is referenced in the returned cloned MeshNode.
     * @returns {pc.scene.MeshNode} A cloned MeshNode.
     * @author Will Eastcott
     */
    MeshNode.prototype.clone = function () {
        var clone = new pc.scene.MeshNode();

        // GraphNode
        clone.setName(this.getName());
        clone.setLocalTransform(pc.math.mat4.clone(this.getLocalTransform()));
        clone._graphId = this._graphId;

        // MeshNode
        clone.setGeometry(this.getGeometry());

        return clone;
    };

    /**
     * @function
     * @name pc.scene.MeshNode#dispatch
     * @description Dispatches the mesh's assigned geometry with the mesh's world transformation
     * matrix.
     * @author Will Eastcott
     */
    MeshNode.prototype.dispatch = function () {
        var geom = this._geometry;
        if (geom !== null) {
            if (geom.isSkinned()) {
                var i, numBones;
                for (i = 0, numBones = this._bones.length; i < numBones; i++) {
                    var matrixPalette = geom.getMatrixPalette();
                    var invBindPose = geom.getInverseBindPose();
                    pc.math.mat4.multiply(this._bones[i]._wtm, invBindPose[i], matrixPalette[i]);
                }
            } 

            geom.dispatch(this._wtm, this._style);
        }
    };

    /**
     * @function
     * @name pc.scene.MeshNode#getGeometry
     * @description Returns the geometry assigned to this mesh node. If no geometry is assigned, then
     * null is returned.
     * @returns {pc.scene.Geometry} The attached geometry or null if no geometry is assigned.
     * @author Will Eastcott
     */
    MeshNode.prototype.getGeometry = function () {
        return this._geometry;
    };

    /**
     * @function
     * @name pc.scene.MeshNode#setGeometry
     * @description Assigns a geometry to the specified mesh node. Note that multiple mesh nodes can
     * reference the same geometry which effectively implements instancing. This can reduce the memory
     * footprint and load time for any given model.
     * @param {pc.scene.Geometry} geometry
     * @author Will Eastcott
     */
    MeshNode.prototype.setGeometry = function (geometry) {
        this._geometry = geometry;
    };

    /**
     * @function
     * @name pc.scene.MeshNode#getVolume
     * @description
     * @returns {pc.shape.Sphere}
     * @author Will Eastcott
     */
    MeshNode.prototype.getVolume = function () {
        var volumeLocal = this._geometry.getVolume();
        if (volumeLocal && volumeLocal instanceof pc.shape.Sphere) {
            var volumeWorld = new pc.shape.Sphere();
            pc.math.mat4.multiplyVec3(volumeLocal.center, 1.0, this._wtm, volumeWorld.center);
            var scale = pc.math.mat4.getScale(this._wtm);
            volumeWorld.radius = volumeLocal.radius * scale[0];
            return volumeWorld;
        }
        return null;
    };

    /**
     * @function
     * @name pc.scene.MeshNode#getRenderStyle
     * @description Return the render style for the specified mesh node. The style signifies
     * either a 'normal' style or a 'wireframe' style.
     * @returns {pc.scene.RenderStyle} The current render style for the mesh node.
     * @author Will Eastcott
     */
    MeshNode.prototype.getRenderStyle = function () {
        return this._style;
    }

    /**
     * @function
     * @name pc.scene.MeshNode#setRenderStyle
     * @description Sets the render style for the specified mesh node. The style can be
     * either a 'normal' style or a 'wireframe' style. For a wireframe style to be set,
     * the mesh node's geometry have previously had pc.scene.Geometry#generateWireframe
     * called on it.
     * @param {pc.scene.RenderStyle} style The current render style for the mesh node.
     * @author Will Eastcott
     */
    MeshNode.prototype.setRenderStyle = function (style) {
        this._style = style;
    }

    return {
        RenderStyle: RenderStyle,
        MeshNode: MeshNode
    }; 
}());