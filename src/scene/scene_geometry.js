pc.extend(pc.scene, function () {
    /**
     * @name pc.scene.Geometry
     * @class A geometry.
     */
    var Geometry = function Geometry() {
        this._vertexBuffers   = [];
        this._subMeshes       = [];

        // Skinning data
        this._bones           = null;
        this._inverseBindPose = null;

        // Object space bounding volume
        this._volume          = null;
    };

    /**
     * @function
     * @name pc.scene.Geometry#dispatch
     * @description Submits a geometry for rendering.
     * @param {Array} transform A 4x4 world transformation matrix.
     * @author Will Eastcott
     */
    Geometry.prototype.dispatch = function (transform) {
        var i, j, numVertBuffers, numMeshes, numBoneIndices, material;
        var device = pc.gfx.Device.getCurrent();
        var scope = device.scope;

        // Set each vertex buffer
        for (i = 0, numVertBuffers = this._vertexBuffers.length; i < numVertBuffers; i++) {
            device.setVertexBuffer(this._vertexBuffers[i], i);
        }

        // Generate the matrix palette
        var skinned = this._inverseBindPose && this._bones;
        var poseId;
        if (skinned) {
            var numBones;
            for (i = 0, numBones = this._bones.length; i < numBones; i++) {
                pc.math.mat4.multiply(this._bones[i]._wtm, this._inverseBindPose[i], this._matrixPaletteEntryF32[i]);
            }
            poseId = scope.resolve("matrix_pose[0]"); 
            poseId.setValue(this._matrixPaletteF32);
        }

        scope.resolve("matrix_model").setValue(transform);

        // Dispatch each submesh
        for (i = 0, numMeshes = this._subMeshes.length; i < numMeshes; i++) {
            var subMesh = this._subMeshes[i];

            // Set the skinning matrix palette
            if (skinned && subMesh._boneIndices) {
                var boneIndices = subMesh._boneIndices;
                var numBones = boneIndices.length;
                for (j = 0; j < numBones; j++) {
                    subMesh._subPalette.set(this._matrixPaletteEntryF32[boneIndices[j]], j * 16);
                }
                poseId.setValue(subMesh._subPalette);
            }

            // Set all state related to the material
            var material = subMesh.getMaterial();
            material.setParameters();
            device.updateLocalState(material.getState());

            // Set the index buffer and program
            var indexBuffer = subMesh.getIndexBuffer();
            device.setIndexBuffer(indexBuffer);
            device.setProgram(material.getProgram(this));

            // Now draw the submesh
            device.draw({
                useIndexBuffer: indexBuffer !== null,
                primitiveType: subMesh.getPrimitiveType(),
                numVertices: (indexBuffer !== null) ? indexBuffer.getNumIndices() : this._vertexBuffers[0].getNumVertices()
            });

            // Pop the submesh's local state
            device.clearLocalState();
        }
    };

    /**
     * @function
     * @name pc.scene.Geometry#getVertexBuffers
     * @description Retrieves the geometry's vertex buffer array.
     * @returns {Array} The geometry's vertex buffer array.
     * @author Will Eastcott
     */
    Geometry.prototype.getVertexBuffers = function () {
        return this._vertexBuffers;
    };

    /**
     * @function
     * @name pc.scene.Geometry#setVertexBuffers
     * @description Assigns an array of pc.gfx.VertexBuffer objects to the specified geometry.
     * @param {Array} buffers An array of pc.gfx.VertexBuffer objects.
     * @author Will Eastcott
     */
    Geometry.prototype.setVertexBuffers = function (buffers) {
        this._vertexBuffers = buffers;
    };

    /**
     * @function
     * @name pc.scene.Geometry#getSubMeshes
     * @description Retrieves the geometry's array of submeshes.
     * @returns {Array} The geometry's submesh array.
     * @author Will Eastcott
     */
    Geometry.prototype.getSubMeshes = function () {
        return this._subMeshes;
    };

    /**
     * @function
     * @name pc.scene.Geometry#setSubMeshes
     * @description Assigns an array of pc.scene.SubMesh objects to the specified geometry.
     * @param {Array} subMeshes An array of pc.scene.SubMesh objects.
     * @author Will Eastcott
     */
    Geometry.prototype.setSubMeshes = function (subMeshes) {
        this._subMeshes = subMeshes;
    };

    /**
     * @function
     * @name pc.scene.Geometry#getInverseBindPose
     * @description Retrieves the geometry's array of inverse bind pose matrices.
     * @returns {Array} The geometry's inverse bind pose matrix array.
     * @author Will Eastcott
     */
    Geometry.prototype.getInverseBindPose = function () {
        return this._inverseBindPose;
    };

    /**
     * @function
     * @name pc.scene.Geometry#isSkinned
     * @description Returns true if geometry is skinned.
     * @returns {Boolean} True if geometry is skinned
     * @author Will Eastcott
     */
    Geometry.prototype.isSkinned = function () {
        return (this._inverseBindPose !== null);
    };

    /**
     * @function
     * @name pc.scene.Geometry#setInverseBindPose
     * @description Assigns an array of inverse bind pose matrices to the specified geometry.
     * @param {Array} buffers An array of objects (pc.gfx.Mat4).
     * @author Will Eastcott
     */
    Geometry.prototype.setInverseBindPose = function (ibp) {
        this._inverseBindPose = ibp;

        if (ibp) {
            // Create a matrix array that will be a concatenation of the IBMs and the WTMs at each node
            this._matrixPalette         = new ArrayBuffer(ibp.length * 16 * 4);
            this._matrixPaletteF32      = new Float32Array(this._matrixPalette);
            this._matrixPaletteEntryF32 = [];
            for (var i = 0, len = ibp.length; i < len; i++) {
                this._matrixPaletteEntryF32[i] = new Float32Array(this._matrixPalette, i * 16 * 4, 16);
            }
        } else {
            this._matrixPalette = null;
            delete this._matrixPalette;
            delete this._matrixPaletteF32;
            delete this._matrixPaletteEntryF32;
        }
    };

    /**
     * @function
     * @name pc.scene.Geometry#getVolume
     * @description Retrieves the pc.shape.Sphere object assigned to the geometry which acts as
     * the geometry's bounding volume.
     * @returns {pc.shape.Sphere} The geometry's bounding sphere volume.
     * @author Will Eastcott
     */
    Geometry.prototype.getVolume = function () {
        return this._volume;
    };

    /**
     * @function
     * @name pc.scene.Geometry#setVolume
     * @description Assigns a pc.shape.Sphere volume object to the specified geometry.
     * @param {pc.shape.Sphere} volume The bounding volume to assign to the geometry.
     * @author Will Eastcott
     */
    Geometry.prototype.setVolume = function (volume) {
        this._volume = volume;
    };

    return {
        Geometry: Geometry
    }; 
}());