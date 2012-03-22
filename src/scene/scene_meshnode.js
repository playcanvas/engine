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
        this._style = RenderStyle.NORMAL;
        this._castShadows = false;
        this._receiveShadows = true;

        this._localLights = [[], []]; // All currently enabled point and spots

        this._aabb = new pc.shape.Aabb();

        this._bones = null; // For skinned meshes, the bones array that influences the skin
    }
    MeshNode = MeshNode.extendsFrom(pc.scene.GraphNode);

    MeshNode._current = null;

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
        MeshNode._current = this;

        var geom = this._geometry;
        if (geom !== null) {
            if (geom.isSkinned()) {
                var i, numBones;
                var matrixPalette = geom.getMatrixPalette();
                var invBindPose = geom.getInverseBindPose();
                for (i = 0, numBones = this._bones.length; i < numBones; i++) {
                    pc.math.mat4.multiply(this._bones[i]._wtm, invBindPose[i], matrixPalette[i]);
                }
            } 

            geom.dispatch(this._wtm, this._style);
        }
        
        MeshNode._current = null;
    };

    /**
     * @function
     * @name pc.scene.MeshNode#castShadows
     * @description Queries whether the specified mesh occludes light from dynamic 
     * lights that cast shadows.
     * @returns {Boolean} True if the specified mesh casts shadows, false otherwise.
     * @author Will Eastcott
     */
    MeshNode.prototype.castShadows = function () {
        return this._castShadows;
    };

    /**
     * @function
     * @name pc.scene.MeshNode#receiveShadows
     * @description Queries whether the specified mesh cast shadows onto other meshes.
     * @returns {Boolean} True if the specified mesh cast shadows, false otherwise.
     * @author Will Eastcott
     */
    MeshNode.prototype.receiveShadows = function () {
        return this._receiveShadows;
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
     * @name pc.scene.MeshNode#setOccludeLight
     * @description Toggles the casting of shadows from this mesh. In other words, if true
     * is passed to this function, the mesh will be treated as an occluder.
     * @param {Boolean} castShadows True to cast shadows from this mesh, false otherwise.
     * @author Will Eastcott
     */
    MeshNode.prototype.setCastShadows = function (castShadows) {
        this._castShadows = castShadows;
    };

    /**
     * @function
     * @name pc.scene.MeshNode#setReceiveShadows
     * @description Toggles the receiving of shadows for the specified mesh. In other words, 
     * if true is passed to this function, the mesh will be mapped with the shadows cast from
     * occluding meshes via shadow casting light sources.
     * @param {Boolean} receiveShadows True to receive shadows on this mesh, false otherwise.
     * @author Will Eastcott
     */
    MeshNode.prototype.setReceiveShadows = function (receiveShadows) {
        this._receiveShadows = receiveShadows;
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

    MeshNode.prototype.getAabb = function () {
        this._aabb.setFromTransformedAabb(this._geometry._aabb, this._wtm);
        return this._aabb;
    }

    return {
        RenderStyle: RenderStyle,
        MeshNode: MeshNode
    }; 
}());