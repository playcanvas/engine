pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.Picker
     * @class Picker object used to select mesh instances from screen coordinates.
     * @constructor Create a new instance of a Picker object
     * @param {Number} width The width of the pick buffer in pixels.
     * @param {Number} height The height of the pick buffer in pixels.
     */
    var Picker = function(device, width, height) {
        this.device = device;

        var library = device.getProgramLibrary();
        this.pickProgStatic = library.getProgram('pick', {
            skin: false
        });
        this.pickProgSkin = library.getProgram('pick', {
            skin: true
        });

        this.pickColor = new Float32Array(4);

        this.scene = null;

        this._clearOptions = {
            color: [1.0, 1.0, 1.0, 1.0],
            depth: 1.0,
            flags: pc.gfx.CLEARFLAG_COLOR | pc.gfx.CLEARFLAG_DEPTH
        };
        this.setDimensions(width, height);
    };

    /**
     * @function
     * @name pc.scene.Picker#getHeight
     * @description Queries the height of the pick buffer.
     * @returns {Number} The height of the pick buffer in pixels.
     */
    Picker.prototype.getHeight = function () {
        return this._height;
    };

    /**
     * @function
     * @name pc.scene.Picker#getPickBuffer
     * @description Retrieves the pc.gfx.FrameBuffer object used internally as a pick buffer.
     * @returns {pc.gfx.FrameBuffer} The pick buffer.
     */
    Picker.prototype.getPickBuffer = function () {
        return this._pickBufferTarget.getFrameBuffer();
    };

    /**
     * @function
     * @name pc.scene.Picker#getSelection
     * @description Return the list of mesh instances selected by the specified rectangle in the
     * previously prepared pick buffer.
     * @param {Object} rect The selection rectangle.
     * @param {Number} rect.x The left edge of the rectangle
     * @param {Number} rect.y The bottom edge of the rectangle
     * @param {Number} [rect.width] The width of the rectangle
     * @param {Number} [rect.height] The height of the rectangle
     * @returns {Array} An array of mesh instances that are in the selection
     * @example
     * // Get the selection at the point (10,20)
     * var selection = picker.getSelection({
     *     x: 10,
     *     y: 20
     * });
     * 
     * // Get all models in rectangle with corners at (10,20) and (20,40)
     * var selection = picker.getSelection({
     *     x: 10,
     *     y: 20,
     *     width: 10,
     *     height: 20
     * });
     */
    Picker.prototype.getSelection = function (rect) {
        rect.width = rect.width || 1;
        rect.height = rect.height || 1;

        this._pickBufferTarget.bind();

        var pixels = new ArrayBuffer(4 * rect.width * rect.height);
        var pixelsBytes = new Uint8Array(pixels);
        var gl = this.device.gl;
        gl.readPixels(rect.x, rect.y, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelsBytes);

        var selection = [];

        for (var i = 0; i < rect.width * rect.height; i++) {
            var pixel = new Uint8Array(pixels, i * 4, 4);
            var index = pixel[0] << 16 | pixel[1] << 8 | pixel[2];
            // White is 'no selection'
            if (index !== 0xffffff) {
                var selectedMeshInstance = this.scene.meshInstances[index];
                if (selection.indexOf(selectedMeshInstance) === -1) {
                    selection.push(selectedMeshInstance);
                }
            }
        }

        return selection;
    };

    /**
     * @function
     * @name pc.scene.Picker#getWidth
     * @description Queries the width of the pick buffer.
     * @returns {Number} The width of the pick buffer in pixels.
     */
    Picker.prototype.getWidth = function () {
        return this._width;
    };

    /**
     * @function
     * @name pc.scene.Picker#prepare
     * @description Primes the pick buffer with a rendering of the specified models from the point of view
     * of the supplied camera. Once the pick buffer has been prepared, pc.scene.Picker#getSelection can be
     * called multiple times on the same picker object. Therefore, if the models or camera do not change 
     * in any way, pc.scene.Picker#prepare does not need to be called again.
     * @param {pc.scene.CameraNode} camera The camera used to render the scene, note this is the CameraNode, not an Entity
     * @param {pc.scene.Scene} scene The scene containing the pickable mesh instances.
     */
    Picker.prototype.prepare = function (camera, scene) {
        this.scene = scene;
        device = this.device;

        // Cache active render target
        var prevRenderTarget = device.getRenderTarget();

        // Ready the device for rendering to the pick buffer
        device.setRenderTarget(this._pickBufferTarget);
        device.updateBegin();
        device.clear(this._clearOptions);

        // Build mesh instance list (ideally done by visibility query)
        var i;
        var mesh, meshInstance;
        var type;
        var meshInstances = scene.meshInstances;
        var numMeshInstances = meshInstances.length;
        var device = this.device;
        var scope = device.scope;
        var modelMatrixId = scope.resolve('matrix_model');
        var poseMatrixId = scope.resolve('matrix_pose[0]');
        var pickColorId = scope.resolve('uColor');
        var projId = scope.resolve('matrix_projection');
        var viewProjId = scope.resolve('matrix_viewProjection');

        var wtm = camera.getWorldTransform();
        var projMat = camera.getProjectionMatrix();
        projId.setValue(projMat);
        var viewMat = pc.math.mat4.invert(wtm);
        var viewProjMat = pc.math.mat4.multiply(projMat, viewMat);
        viewProjId.setValue(viewProjMat);

        for (i = 0; i < numMeshInstances; i++) {
            meshInstance = meshInstances[i];
            mesh = meshInstance.mesh;

            type = mesh.primitive[pc.scene.RENDERSTYLE_SOLID].type; 
            if ((type === pc.gfx.PRIMITIVE_TRIANGLES) || (type === pc.gfx.PRIMITIVE_TRISTRIP)) {
                modelMatrixId.setValue(meshInstance.node.worldTransform);
                if (meshInstance.skinInstance) {
                    poseMatrixId.setValue(meshInstance.skinInstance.matrixPaletteF32);
                }

                this.pickColor[0] = ((i >> 16) & 0xff) / 255.0;
                this.pickColor[1] = ((i >> 8) & 0xff) / 255.0;
                this.pickColor[2] = (i & 0xff) / 255.0;
                this.pickColor[3] = 1.0;
                pickColorId.setValue(this.pickColor);
                device.setProgram(mesh.skin ? this.pickProgSkin : this.pickProgStatic);

                device.setVertexBuffer(mesh.vertexBuffer, 0);
                device.setIndexBuffer(mesh.indexBuffer[pc.scene.RENDERSTYLE_SOLID]);
                device.draw(mesh.primitive[pc.scene.RENDERSTYLE_SOLID]);
            }
        }

        device.updateEnd();

        // Restore render target
        device.setRenderTarget(prevRenderTarget);
    };

    /**
     * @function
     * @name pc.scene.Picker#setDimensions
     * @description Sets the resolution of the pick buffer. The pick buffer resolution does not need
     * to match the resolution of the corresponding frame buffer use for general rendering of the 
     * 3D scene. However, the lower the resolution of the pick buffer, the less accurate the selection
     * results returned by pc.scene.Picker#getSelection. On the other hand, smaller pick buffers will
     * yield greater performance, so there is a trade off.
     * @param {Number} width The width of the pick buffer in pixels.
     * @param {Number} height The height of the pick buffer in pixels.
     */
    Picker.prototype.setDimensions = function (width, height) {
        this._width = width;
        this._height = height;
        this._pickBufferTarget = new pc.gfx.RenderTarget(this.device, this._width, this._height, true);
        var pickBufferTexture = this._pickBufferTarget.getTexture();
        pickBufferTexture.minFilter = pc.gfx.FILTER_NEAREST;
        pickBufferTexture.magFilter = pc.gfx.FILTER_NEAREST;
        pickBufferTexture.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
        pickBufferTexture.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
    };

    return {
        Picker: Picker
    };
}());