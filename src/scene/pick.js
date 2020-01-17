Object.assign(pc, function () {

    var _deviceDeprecationWarning = false;
    var _getSelectionDeprecationWarning = false;
    var _prepareDeprecationWarning = false;

    /**
     * @class
     * @name pc.Picker
     * @classdesc Picker object used to select mesh instances from screen coordinates.
     * @description Create a new instance of a Picker object
     * @param {pc.Application} app The application managing this picker instance.
     * @param {number} width The width of the pick buffer in pixels.
     * @param {number} height The height of the pick buffer in pixels.
     * @property {number} width Width of the pick buffer in pixels (read-only).
     * @property {number} height Height of the pick buffer in pixels (read-only).
     * @property {pc.RenderTarget} renderTarget The render target used by the picker internally (read-only).
     */
    var Picker = function (app, width, height) {
        if (app instanceof pc.GraphicsDevice) {
            app = pc.Application.getApplication();
            if (!_deviceDeprecationWarning) {
                _deviceDeprecationWarning = true;
                // #ifdef DEBUG
                console.warn("pc.Picker now takes pc.Application as first argument. Passing pc.GraphicsDevice is deprecated.");
                // #endif
            }
        }

        this.app = app;
        this.device = app.graphicsDevice;
        var device = this.device;

        this.library = device.getProgramLibrary();

        this.pickColor = new Float32Array(4);
        this.pickColor[3] = 1;

        this.scene = null;
        this.drawCalls = [];
        this.layer = null;
        this.layerComp = null;

        this.clearOptions = {
            color: [1, 1, 1, 1],
            depth: 1,
            flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH
        };

        var self = this;
        this._clearDepthOptions = {
            depth: 1.0,
            flags: pc.CLEARFLAG_DEPTH
        };
        this.clearDepthCommand = new pc.Command(0, 0, function (){
            device.clear(self._clearDepthOptions);
        });

        this.resize(width, height);

        this._ignoreOpacityFor = null; // meshInstance
    };

    /**
     * @function
     * @name pc.Picker#getSelection
     * @description Return the list of mesh instances selected by the specified rectangle in the
     * previously prepared pick buffer.The rectangle using top-left coordinate system.
     * @param {number} x The left edge of the rectangle
     * @param {number} y The top edge of the rectangle
     * @param {number} [width] The width of the rectangle
     * @param {number} [height] The height of the rectangle
     * @returns {pc.MeshInstance[]} An array of mesh instances that are in the selection
     * @example
     * // Get the selection at the point (10,20)
     * var selection = picker.getSelection(10, 20);
     * @example
     * // Get all models in rectangle with corners at (10,20) and (20,40)
     * var selection = picker.getSelection(10, 20, 10, 20);
     */
    Picker.prototype.getSelection = function (x, y, width, height) {
        var device = this.device;

        if (typeof x === 'object') {
            // #ifdef DEBUG
            if (!_prepareDeprecationWarning) {
                _prepareDeprecationWarning = true;
                console.warn("Picker.getSelection:param 'rect' is deprecated, use 'x, y, width, height' instead.");
            }
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

        var r, g, b, index;
        for (var i = 0; i < width * height; i++) {
            r = pixels[4 * i + 0];
            g = pixels[4 * i + 1];
            b = pixels[4 * i + 2];
            index = r << 16 | g << 8 | b;
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
     * @param {pc.CameraComponent} camera The camera component used to render the scene.
     * @param {pc.Scene} scene The scene containing the pickable mesh instances.
     * @param {pc.Layer|pc.RenderTarget} [arg] Layer or RenderTarget from which objects will be picked. If not supplied, all layers rendering to backbuffer before this layer will be used.
     */
    Picker.prototype.prepare = function (camera, scene, arg) {
        var device = this.device;
        var i, j;
        var self = this;

        if (camera instanceof pc.Camera) {
            // #ifdef DEBUG
            if (!_getSelectionDeprecationWarning) {
                _getSelectionDeprecationWarning = true;
                console.warn("pc.Picker#prepare now takes pc.CameraComponent as first argument. Passing pc.Camera is deprecated.");
            }

            // #endif
            camera = camera._component;
        }

        this.scene = scene;
        var sourceLayer = null;
        var sourceRt = null;

        if (arg instanceof pc.Layer) {
            sourceLayer = arg;
        } else {
            sourceRt = arg;
        }

        // Setup picker rendering once
        if (!this.layer) {
            var pickColorId = device.scope.resolve('uColor');

            this.layer = new pc.Layer({
                name: "Picker",
                shaderPass: pc.SHADER_PICK,
                opaqueSortMode: pc.SORTMODE_NONE,

                onEnable: function () {
                    if (this.renderTarget) return;
                    var colorBuffer = new pc.Texture(device, {
                        format: pc.PIXELFORMAT_R8_G8_B8_A8,
                        width: self.width,
                        height: self.height
                    });
                    colorBuffer.name = 'pick';
                    colorBuffer.minFilter = pc.FILTER_NEAREST;
                    colorBuffer.magFilter = pc.FILTER_NEAREST;
                    colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                    colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                    this.renderTarget = new pc.RenderTarget(device, colorBuffer, {
                        depth: true
                    });
                },

                onDisable: function () {
                    if (!this.renderTarget) return;
                    this.renderTarget._colorBuffer.destroy();
                    this.renderTarget.destroy();
                    this.renderTarget = null;
                },

                onDrawCall: function (meshInstance, index) {
                    self.pickColor[0] = ((index >> 16) & 0xff) / 255;
                    self.pickColor[1] = ((index >> 8) & 0xff) / 255;
                    self.pickColor[2] = (index & 0xff) / 255;
                    pickColorId.setValue(self.pickColor);
                    device.setBlending(false);
                }
            });

            this.layerComp = new pc.LayerComposition();
            this.layerComp.pushOpaque(this.layer);

            this.meshInstances = this.layer.opaqueMeshInstances;
            this._instancesVersion = -1;
        }

        // Collect pickable mesh instances
        var instanceList, instanceListLength, drawCall;
        if (!sourceLayer) {
            this.layer.clearMeshInstances();
            var layers = scene.layers.layerList;
            var subLayerEnabled = scene.layers.subLayerEnabled;
            var isTransparent = scene.layers.subLayerList;
            var layer;
            var layerCamId, transparent;
            for (i = 0; i < layers.length; i++) {
                if (layers[i].overrideClear && layers[i]._clearDepthBuffer) layers[i]._pickerCleared = false;
            }
            for (i = 0; i < layers.length; i++) {
                layer = layers[i];
                if (layer.renderTarget !== sourceRt || !layer.enabled || !subLayerEnabled[i]) continue;
                layerCamId = layer.cameras.indexOf(camera);
                if (layerCamId < 0) continue;
                if (layer.overrideClear && layer._clearDepthBuffer && !layer._pickerCleared) {
                    this.meshInstances.push(this.clearDepthCommand);
                    layer._pickerCleared = true;
                }
                transparent = isTransparent[i];
                instanceList = transparent ? layer.instances.transparentMeshInstances : layer.instances.opaqueMeshInstances;
                instanceListLength = instanceList.length;
                for (j = 0; j < instanceListLength; j++) {
                    drawCall = instanceList[j];
                    if (drawCall.pick) {
                        this.meshInstances.push(drawCall);
                    }
                }
            }
        } else {
            if (this._instancesVersion !== sourceLayer._version) {
                this.layer.clearMeshInstances();
                instanceList = sourceLayer.instances.opaqueMeshInstances;
                instanceListLength = instanceList.length;
                for (j = 0; j < instanceListLength; j++) {
                    drawCall = instanceList[j];
                    if (drawCall.pick) {
                        this.meshInstances.push(drawCall);
                    }
                }
                instanceList = sourceLayer.instances.transparentMeshInstances;
                instanceListLength = instanceList.length;
                for (j = 0; j < instanceListLength; j++) {
                    drawCall = instanceList[j];
                    if (drawCall.pick) {
                        this.meshInstances.push(drawCall);
                    }
                }
                this._instancesVersion = sourceLayer._version;
            }
        }

        // Setup picker camera if changed
        if (this.layer.cameras[0] !== camera) {
            this.layer.clearCameras();
            this.layer.addCamera(camera);
        }

        // save old camera state
        this.onLayerPreRender(this.layer, sourceLayer, sourceRt);

        // Render
        this.app.renderer.renderComposition(this.layerComp);

        // restore old camera state
        this.onLayerPostRender(this.layer);
    };

    Picker.prototype.onLayerPreRender = function (layer, sourceLayer, sourceRt) {
        if (this.width !== layer.renderTarget.width || this.height !== layer.renderTarget.height) {
            layer.onDisable();
            layer.onEnable();
        }
        layer.oldClear = layer.cameras[0].camera._clearOptions;
        layer.oldAspectMode = layer.cameras[0].aspectRatioMode;
        layer.oldAspect = layer.cameras[0].aspectRatio;
        layer.cameras[0].camera._clearOptions = this.clearOptions;
        layer.cameras[0].aspectRatioMode = pc.ASPECT_MANUAL;
        var rt = sourceRt ? sourceRt : (sourceLayer ? sourceLayer.renderTarget : null);
        layer.cameras[0].aspectRatio = layer.cameras[0].calculateAspectRatio(rt);
        this.app.renderer.updateCameraFrustum(layer.cameras[0].camera);
    };

    Picker.prototype.onLayerPostRender = function (layer) {
        layer.cameras[0].camera._clearOptions = layer.oldClear;
        layer.cameras[0].aspectRatioMode = layer.oldAspectMode;
        layer.cameras[0].aspectRatio = layer.oldAspect;
    };

    /**
     * @function
     * @name pc.Picker#resize
     * @description Sets the resolution of the pick buffer. The pick buffer resolution does not need
     * to match the resolution of the corresponding frame buffer use for general rendering of the
     * 3D scene. However, the lower the resolution of the pick buffer, the less accurate the selection
     * results returned by pc.Picker#getSelection. On the other hand, smaller pick buffers will
     * yield greater performance, so there is a trade off.
     * @param {number} width The width of the pick buffer in pixels.
     * @param {number} height The height of the pick buffer in pixels.
     */
    Picker.prototype.resize = function (width, height) {
        this.width = width;
        this.height = height;
    };

    Object.defineProperty(Picker.prototype, 'renderTarget', {
        get: function () {
            return this.layer.renderTarget;
        }
    });

    return {
        Picker: Picker
    };
}());
