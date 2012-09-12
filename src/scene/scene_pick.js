pc.extend(pc.scene, function () {

    var _setPickMaterial = function (models, material) {
        // Iterate all models and add pick material for rendering to pick buffer.
        for (var i = 0; i < models.length; i++) {
            var model = models[i];
            var geometries = model.getGeometries();
            for (var j = 0; j < geometries.length; j++) {
                var geometry = geometries[j];
                var submeshes = geometry.getSubMeshes();
                for (var k = 0; k < submeshes.length; k++) {
                    var submesh = submeshes[k];
                    if (typeof submesh._cachedMaterial === 'undefined') {
                        submesh._cachedMaterial = submesh.material;
                        submesh.material = material;
                    }
                }
            }
        }
    };
    
    var _restoreCachedMaterials = function (models) {
        // Remove picking material and restore original
        for (var i = 0; i < models.length; i++) {
            var model = models[i];
            var geometries = model.getGeometries();
            for (var j = 0; j < geometries.length; j++) {
                var geometry = geometries[j];
                var submeshes = geometry.getSubMeshes();
                for (var k = 0; k < submeshes.length; k++) {
                    var submesh = submeshes[k];
                    if (typeof submesh._cachedMaterial !== 'undefined') {
                        submesh.material = submesh._cachedMaterial;
                        delete submesh._cachedMaterial;
                    }
                }
            }
        }
    };

    /**
     * @name pc.scene.Picker
     * @class Picker object used to identify Entities from the pixel co-ordinate on screen
     * The Picker can be used to identify Entities that are drawn using a RenderComponent
     * or Entities that have a PickComponent. For RenderComponents the Entity is selected if the
     * pixel picked was drawn by the RenderComponent, PickComponents contains a shape which is used
     * to perform the picking.
     * @constructor Create a new instance of a Picker object
     * @param {Number} width The width of the pick buffer in pixels.
     * @param {Number} height The height of the pick buffer in pixels.
     */
    var Picker = function(width, height) {
        this._pickMaterial = new pc.scene.Material();
        this._pickMaterial.setProgramName('pick');

        this._models = null;

        this._clearOptions = {
            color: [1.0, 1.0, 1.0, 1.0],
            depth: 1.0,
            flags: pc.gfx.ClearFlag.COLOR | pc.gfx.ClearFlag.DEPTH
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
     * @description Return the list of models selected by the specified rectangle in the previously prepared
     * pick buffer. 
     * @returns {pc.gfx.FrameBuffer} The rectangular selection region.
     */
    Picker.prototype.getSelection = function (rect) {
        rect.width = rect.width || 1;
        rect.height = rect.height || 1;

        this._pickBufferTarget.bind();

        var pixels = new ArrayBuffer(4 * rect.width * rect.height);
        var pixelsBytes = new Uint8Array(pixels);
        var gl = pc.gfx.Device.getCurrent().gl;
        gl.readPixels(rect.x, rect.y, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelsBytes);

        var selection = [];

        for (var i = 0; i < rect.width * rect.height; i++) {
            var pixel = new Uint8Array(pixels, i * 4, 4);
            var index = pixel[0] << 16 | pixel[1] << 8 | pixel[2];
            // White is 'no selection'
            if (index !== 0xffffff) {
                var selectedModel = this._models[index];
                if (selection.indexOf(selectedModel) === -1) {
                    selection.push(selectedModel);
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
     * @param {pc.scene.CameraNode} camera The viewpoint for the pick buffer.
     * @param {Array} models Array of models that are to be pickable.
     */
    Picker.prototype.prepare = function (camera, models) {
        this._models = models;

        // Set the pick material on all models in the scene
        _setPickMaterial(models, this._pickMaterial);

        // Cache camera properties
        var prevRenderTarget = camera.getRenderTarget();
        var prevClearOptions = camera.getClearOptions();

        // Ready the camera for rendering to the pick buffer
        camera.setRenderTarget(this._pickBufferTarget);
        camera.setClearOptions(this._clearOptions);
        camera.frameBegin();

        // Render all render components in a different color and store a lookup
        var count = 0;
        for (var i = 0; i < models.length; i++) {
            var model = models[i];
            var pickColor = [
                ((count >> 16) & 0xff) / 255.0, 
                ((count >> 8) & 0xff) / 255.0, 
                (count & 0xff) / 255.0, 
                1.0
            ];
            this._pickMaterial.setParameter("uColor", pickColor);
            model.dispatch();
            count++;
        }

        camera.frameEnd();

        // Restore camera
        camera.setRenderTarget(prevRenderTarget);
        camera.setClearOptions(prevClearOptions);

        // Restore materials
        _restoreCachedMaterials(models);
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
        var pickBuffer = new pc.gfx.FrameBuffer(this._width, this._height, true);
        this._pickBufferTarget = new pc.gfx.RenderTarget(pickBuffer);
    };

    return {
        Picker: Picker
    };
}());