pc.extend(pc.scene, function () {
    /**
     * @name pc.scene.MeshNode
     * @class A mesh.
     */
    var MeshNode = function MeshNode() {
        this._geometry = null;
    }

    MeshNode = MeshNode.extendsFrom(pc.scene.GraphNode);

    /**
     * @function
     * @name pc.scene.MeshNode#dispatch
     * @description
     * @author Will Eastcott
     */
    MeshNode.prototype.dispatch = function () {
        if (this._geometry !== null) {
            this._geometry.dispatch(this._geometry.isSkinned() ? this._ltm : this._wtm);
        }
    };

    /**
     * @function
     * @name pc.scene.MeshNode#getGeometry
     * @description
     * @returns {pc.scene.Geometry}
     * @author Will Eastcott
     */
    MeshNode.prototype.getGeometry = function () {
        return this._geometry;
    };

    /**
     * @function
     * @name pc.scene.MeshNode#setGeometry
     * @description
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
     * @name pc.scene.MeshNode#hasAlpha
     * @description
     * @returns {Boolean}
     * @author Will Eastcott
     */
    MeshNode.prototype.hasAlpha = function () {
        var geom = this._geometry;
        var subMeshes = geom.getSubMeshes();
        for (var i = 0; i < subMeshes.length; i++) {
            var material = subMeshes[i].getMaterial();
            if (material.isTransparent())
                return true;
        }
        return false;
    };

    return {
        MeshNode: MeshNode
    }; 
}());