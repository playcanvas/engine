pc.extend(pc, function () {

    function sortDrawCalls(drawCallA, drawCallB) {

        if (drawCallA.layer === drawCallB.layer) {
            if (drawCallA.drawOrder && drawCallB.drawOrder) {
                return drawCallA.drawOrder - drawCallB.drawOrder;
            }
        }

        return drawCallB.key - drawCallA.key;
    }

    /**
     * @name pc.Picker
     * @class Picker object used to select mesh instances from screen coordinates.
     * @description Create a new instance of a Picker object
     * @param {pc.GraphicsDevice} device Graphics device used to manage internal graphics resources.
     * @param {Number} width The width of the pick buffer in pixels.
     * @param {Number} height The height of the pick buffer in pixels.
     * @property {Number} width Width of the pick buffer in pixels (read-only).
     * @property {Number} height Height of the pick buffer in pixels (read-only).
     * @property {pc.RenderTarget} renderTarget The render target used by the picker internally (read-only).
     */
    var Picker = function(device, width, height) {
        this.device = device;
        this.library = device.getProgramLibrary();

        this.pickColor = new Float32Array(4);
        this.pickColor[3] = 1;

        this.scene = null;
        this.drawCalls = [ ];
        this.layer = null;
        this.layerComp = null;

        this.clearOptions = {
            color: [1, 1, 1, 1],
            depth: 1,
            flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH
        };
        this.resize(width, height);

        this._ignoreOpacityFor = null; // meshInstance
    };

    /**
     * @function
     * @name pc.Picker#getSelection
     * @description Return the list of mesh instances selected by the specified rectangle in the
     * previously prepared pick buffer.The rectangle using top-left coordinate system.
     * @param {Number} x The left edge of the rectangle
     * @param {Number} y The top edge of the rectangle
     * @param {Number} [width] The width of the rectangle
     * @param {Number} [height] The height of the rectangle
     * @returns {pc.MeshInstance[]} An array of mesh instances that are in the selection
     * @example
     * // Get the selection at the point (10,20)
     * var selection = picker.getSelection(10, 20);
     *
     * // Get all models in rectangle with corners at (10,20) and (20,40)
     * var selection = picker.getSelection(10, 20, 10, 20);
     */
    Picker.prototype.getSelection = function (x, y, width, height) {
        var device = this.device;

        if (typeof x === 'object') {
            // #ifdef DEBUG
            console.warn("Picker.getSelection:param 'rect' is deprecated, use 'x, y, width, height' instead.");
            // #endif

            var rect = x;
            x = rect.x;
            y = rect.y;
            width = rect.width;
            height = rect.height;
        } else {
            y = this.layer.renderTarget.height - (y + (height || 1));
        }

        width = width || 1;
        height = height || 1;

        // Cache active render target
        var prevRenderTarget = device.renderTarget;

        // Ready the device for rendering to the pick buffer
        device.setRenderTarget(this.layer.renderTarget);
        device.updateBegin();

        var pixels = new Uint8Array(4 * width * height);
        device.readPixels(x, y, width, height, pixels);

        device.updateEnd();

        // Restore render target
        device.setRenderTarget(prevRenderTarget);

        var selection = [];

        var drawCalls = this.layer.instances.visibleOpaque[0].list;

        for (var i = 0; i < width * height; i++) {
            var r = pixels[4 * i + 0];
            var g = pixels[4 * i + 1];
            var b = pixels[4 * i + 2];
            var index = r << 16 | g << 8 | b;
            // White is 'no selection'
            if (index !== 0xffffff) {
                var selectedMeshInstance = drawCalls[index];
                if (selection.indexOf(selectedMeshInstance) === -1) {
                    selection.push(selectedMeshInstance);
                }
            }
        }

        return selection;
    };

    /**
     * @function
     * @name pc.Picker#prepare
     * @description Primes the pick buffer with a rendering of the specified models from the point of view
     * of the supplied camera. Once the pick buffer has been prepared, pc.Picker#getSelection can be
     * called multiple times on the same picker object. Therefore, if the models or camera do not change
     * in any way, pc.Picker#prepare does not need to be called again.
     * @param {pc.Camera} camera The camera used to render the scene, note this is the CameraNode, not an Entity
     * @param {pc.Scene} scene The scene containing the pickable mesh instances.
     */
    Picker.prototype.prepare = function (camera, scene) {
        var device = this.device;

        this.scene = scene;

        // Setup picker rendering once
        if (!this.layer) {
            
            var self = this;
            var pickColorId = device.scope.resolve('uColor');

            this.layer = new pc.Layer({
                name: "Picker",
                shaderPass: pc.SHADER_PICK,
                layerReference: this.defaultLayerWorld,

                onEnable: function() {
                    if (this.renderTarget) return;
                    var colorBuffer = new pc.Texture(device, {
                        format: pc.PIXELFORMAT_R8_G8_B8_A8,
                        width: self.width,
                        height: self.height
                    });
                    colorBuffer.minFilter = pc.FILTER_NEAREST;
                    colorBuffer.magFilter = pc.FILTER_NEAREST;
                    colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                    colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                    this.renderTarget = new pc.RenderTarget(device, colorBuffer, {
                        depth: true
                    });
                },

                onDisable: function() {
                    if (!this.renderTarget) return;
                    this.renderTarget._colorBuffer.destroy();
                    this.renderTarget.destroy();
                    this.renderTarget = null;
                },

                onPreRender: function() {
                    this.oldClear = this.cameras[0].camera._clearOptions;
                    this.cameras[0].camera._clearOptions = self.clearOptions;
                },

                onDrawCall: function(meshInstance, i) {
                    self.pickColor[0] = ((i >> 16) & 0xff) / 255;
                    self.pickColor[1] = ((i >> 8) & 0xff) / 255;
                    self.pickColor[2] = (i & 0xff) / 255;
                    pickColorId.setValue(self.pickColor);
                },

                onPostRender: function() {
                    this.cameras[0].camera._clearOptions = this.oldClear;
                }
            });

            this.layerComp = new pc.LayerComposition();
            this.layerComp.insertSublayerAt(0, this.layer, false);
        }

        // Setup picker camera if changed
        if (this.layer.cameras[0] !== camera) {
            this.layer.clearCameras();
            this.layer.addCamera(camera);
        }

        // Setup mesh instances
        var sourceLayer = pc.getLayerByName("World"); // TODO: don't search every call; move method to scene
        this.layer.clearMeshInstances(true);
        this.layer.addMeshInstances(sourceLayer.opaqueMeshInstances, true);

        // Render
        pc.Application.getApplication().renderer.renderComposition(this.layerComp); // TODO: oh no
    };

    /**
     * @function
     * @name pc.Picker#resize
     * @description Sets the resolution of the pick buffer. The pick buffer resolution does not need
     * to match the resolution of the corresponding frame buffer use for general rendering of the
     * 3D scene. However, the lower the resolution of the pick buffer, the less accurate the selection
     * results returned by pc.Picker#getSelection. On the other hand, smaller pick buffers will
     * yield greater performance, so there is a trade off.
     * @param {Number} width The width of the pick buffer in pixels.
     * @param {Number} height The height of the pick buffer in pixels.
     */
    Picker.prototype.resize = function (width, height) {
        this.width = width;
        this.height = height;
    };

    Object.defineProperty(Picker.prototype, 'renderTarget', {
        get: function() { return this.layer.renderTarget; }
    });

    return {
        Picker: Picker
    };
}());
