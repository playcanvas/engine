pc.extend(pc.scene, function () {
    /**
     * @name pc.scene.Geometry
     * @class A geometry.
     */
    var Geometry = function Geometry() {
        this._vertexBuffers = []; // A geometry can have multiple vertex buffers/streams
        this._indexBuffers = []; // A geometry can have multiple index buffers (1 per style)
        this._submeshes = [
            [], // Normal render style
            []  // Wireframe render style
        ];

        // Skinning data
        this._inverseBindPose = null;
        this._matrixPalette = null; // The raw memory buffer to hold the matrix palette
        this._matrixPaletteF32 = null; // The matrix palette uploaded to the shader (typed as Float32Array)
        this._matrixPaletteEntryF32 = null; // The memory buffer represented as an array of matrices to use with the pc.math.mat4 API

        // Object space bounding volume
        this._aabb = null;
        this._volume = null;

        var device = pc.gfx.Device.getCurrent();
        var scope = device.scope;
        this.matrixModelId = scope.resolve("matrix_model");
        this.poseId = scope.resolve("matrix_pose[0]"); 
    };

    /**
     * @function
     * @name pc.scene.Geometry#dispatch
     * @description Submits a geometry for rendering.
     * @param {Array} transform A 4x4 world transformation matrix.
     * @param {pc.scene.RenderStyle} style (Optional) The render style of the geometry.
     * @author Will Eastcott
     */
    Geometry.prototype.dispatch = function (transform, style) {
        style = style || 0; // Default to normal render style

        var i, j, numVertBuffers, numSubmeshes, numBoneIndices, material;
        var device = pc.gfx.Device.getCurrent();

        // Set the vertex and index buffers
        for (i = 0, numVertBuffers = this._vertexBuffers.length; i < numVertBuffers; i++) {
            device.setVertexBuffer(this._vertexBuffers[i], i);
        }
        device.setIndexBuffer(this._indexBuffers[style]);

        // Generate the matrix palette
        var skinned = this.isSkinned();
        if (skinned) {
            if (!this._partitionedBoneIndices) {
                this.poseId.setValue(this._matrixPaletteF32);
            }
        }

        this.matrixModelId.setValue(transform);

        // Dispatch each submesh
        var submeshes = this._submeshes[style];
        for (i = 0, numSubmeshes = submeshes.length; i < numSubmeshes; i++) {
            var submesh = submeshes[i];

            // Set the skinning matrix palette
            if (skinned && this._partitionedBoneIndices) {
                var boneIndices = this._partitionedBoneIndices[i];
                var palette = this._partitionedPalettes[i];
                for (j = 0; j < boneIndices.length; j++) {
                    palette.set(this._matrixPaletteEntryF32[boneIndices[j]], j * 16);
                }
                this.poseId.setValue(palette);
            }

            // Set all state related to the material
            var material = submesh.material;
            material.setParameters();
            device.updateLocalState(material.getState());
            device.setProgram(material.getProgram(pc.scene.MeshNode._current));

            // Now draw the submesh
            device.draw(submesh.primitive);

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
     * @name pc.scene.Geometry#getIndexBuffer
     * @description Returns the index buffer assigned to the geometry. The index buffer indexes
     * into the parent geometry's vertex buffer(s).
     * @returns {pc.gfx.IndexBuffer} The index buffer assigned to the geometry.
     * @author Will Eastcott
     */
    Geometry.prototype.getIndexBuffer = function (style) {
        style = style || 0; // Default to querying normal style index buffer
        return this._indexBuffers[style];
    };

    /**
     * @function
     * @name pc.scene.Geometry#setIndexBuffer
     * @description Assigns an index buffer to the specified geometry. The index buffer indexes
     * into the parent geometry's vertex buffer(s).
     * @param {pc.gfx.IndexBuffer} indexBuffer The index buffer to assign to the geometry.
     * @author Will Eastcott
     */
    Geometry.prototype.setIndexBuffer = function (indexBuffer, style) {
        style = style || 0; // Default to setting normal style index buffer
        this._indexBuffers[style] = indexBuffer;
    };

    /**
     * @function
     * @name pc.scene.Geometry#getSubMeshes
     * @description Retrieves the geometry's array of submeshes.
     * @returns {Array} The geometry's submesh array.
     * @author Will Eastcott
     */
    Geometry.prototype.getSubMeshes = function (style) {
        style = style || 0; // Default to querying normal style index buffer
        return this._submeshes[style];
    };

    /**
     * @function
     * @name pc.scene.Geometry#setSubMeshes
     * @description Assigns an array of pc.scene.SubMesh objects to the specified geometry.
     * @param {Array} submeshes An array of pc.scene.SubMesh objects.
     * @author Will Eastcott
     */
    Geometry.prototype.setSubMeshes = function (submeshes, style) {
        style = style || 0; // Default to setting normal style submeshes
        this._submeshes[style] = submeshes;
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

    Geometry.prototype.getMatrixPalette = function () {
        return this._matrixPaletteEntryF32;
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
            this._matrixPalette = null;
            this._matrixPaletteF32 = null;
            this._matrixPaletteEntryF32 = null;
        }
    };

    /**
     * @function
     * @name pc.scene.Geometry#getAabb
     * @description Retrieves the pc.shape.Aabb object assigned to the geometry which acts as
     * the geometry's bounding volume.
     * @returns {pc.shape.Aabb} The geometry's axis-aligned bounding box volume.
     * @author Will Eastcott
     */
    Geometry.prototype.getAabb = function () {
        return this._aabb;
    };

    /**
     * @function
     * @name pc.scene.Geometry#setAabb
     * @description Assigns a pc.shape.Aabb volume object to the specified geometry.
     * @param {pc.shape.Aabb} volume The bounding volume to assign to the geometry.
     * @author Will Eastcott
     */
    Geometry.prototype.setAabb = function (aabb) {
        this._aabb = aabb;
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

    /**
     * @function
     * @name pc.scene.Geometry#hasAlpha
     * @description
     * @returns {Boolean}
     * @author Will Eastcott
     */
    Geometry.prototype.hasAlpha = function () {
        var submeshes = this.getSubMeshes();
        for (var i = 0; i < submeshes.length; i++) {
            var material = submeshes[i].material;
            if (material.isTransparent())
                return true;
        }
        return false;
    };

    Geometry.prototype.generateWireframe = function () {
        var i, i1, i2, submesh, base, count;

        var indexBuffer = this.getIndexBuffer(pc.scene.RenderStyle.NORMAL);
        var submeshes = this.getSubMeshes(pc.scene.RenderStyle.NORMAL);

        var srcIndices = new Uint16Array(indexBuffer.lock());
        var wireIndices = [];

        var offsets = [[0, 1], [1, 2], [2, 0]];
        for (i = 0; i < submeshes.length; i++) {
            submesh = submeshes[i];

            base = submesh.primitive.base;
            count = submesh.primitive.count;

            var uniqueLineIndices = {};
            var lines = [];
            for (j = base; j < base + count; j+=3) {
                for (var k = 0; k < 3; k++) {
                    i1 = srcIndices[j + offsets[k][0]];
                    i2 = srcIndices[j + offsets[k][1]];
                    var line = (i1 > i2) ? ((i2 << 16) | i1) : ((i1 << 16) | i2);
                    if (uniqueLineIndices[line] === undefined) {
                        uniqueLineIndices[line] = 0;
                        lines.push(i1, i2);
                    }
                }
            }

            wireIndices.push(lines);
        }
        indexBuffer.unlock();

        var numIndices = 0;
        for (i = 0; i < wireIndices.length; i++) {
            numIndices += wireIndices[i].length;
        }

        var wireBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT16, numIndices);
        // Copy indices into index buffer
        var dstIndices = new Uint16Array(wireBuffer.lock());
        var index = 0;
        for (i = 0; i < wireIndices.length; i++) {
            var wireSubmesh = wireIndices[i];
            for (j = 0; j < wireSubmesh.length; j++) {
                dstIndices[index++] = wireSubmesh[j];
            }
        }
        wireBuffer.unlock();

        // Generate a set of wireframe submeshes
        var wireSubmeshes = [];
        base = 0;
        for (i = 0; i < submeshes.length; i++) {
            submesh = submeshes[i];
            wireSubmeshes.push({
                material: submesh.material,
                primitive: {
                    type: pc.gfx.PrimType.LINES,
                    base: base,
                    count: wireIndices[i].length,
                    indexed: true
                }
            });
            base += wireIndices[i].length;
        }

        this.setIndexBuffer(wireBuffer, pc.scene.RenderStyle.WIREFRAME);
        this.setSubMeshes(wireSubmeshes, pc.scene.RenderStyle.WIREFRAME);
    };

    return {
        Geometry: Geometry
    }; 
}());