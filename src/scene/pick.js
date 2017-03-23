pc.extend(pc, function () {

    function sortDrawCalls(drawCallA, drawCallB) {
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

        this.scene = null;
        this.drawCalls = [ ];

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
            y = this._pickBufferTarget.height - (y + (height || 1));
        }

        width = width || 1;
        height = height || 1;

        // Cache active render target
        var prevRenderTarget = device.renderTarget;

        // Ready the device for rendering to the pick buffer
        device.setRenderTarget(this._pickBufferTarget);
        device.updateBegin();

        var pixels = new Uint8Array(4 * width * height);
        device.readPixels(x, y, width, height, pixels);

        device.updateEnd();

        // Restore render target
        device.setRenderTarget(prevRenderTarget);

        var selection = [];

        for (var i = 0; i < width * height; i++) {
            var r = pixels[4 * i + 0];
            var g = pixels[4 * i + 1];
            var b = pixels[4 * i + 2];
            var index = r << 16 | g << 8 | b;
            // White is 'no selection'
            if (index !== 0xffffff) {
                var selectedMeshInstance = this.drawCalls[index];
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

        // Cache active render target
        var prevRenderTarget = device.renderTarget;

        // Ready the device for rendering to the pick buffer
        device.setRenderTarget(this._pickBufferTarget);
        device.updateBegin();
        device.setViewport(0, 0, this._pickBufferTarget.width, this._pickBufferTarget.height);
        device.setScissor(0, 0, this._pickBufferTarget.width, this._pickBufferTarget.height);
        device.clear(this.clearOptions);

        // Build mesh instance list (ideally done by visibility query)
        var i;
        var mesh, meshInstance, material;
        var type;
        var shader, isLastSelected;
        var scope = device.scope;
        var modelMatrixId = scope.resolve('matrix_model');
        var boneTextureId = scope.resolve('texture_poseMap');
        var boneTextureSizeId = scope.resolve('texture_poseMapSize');
        var skinPosOffsetId = scope.resolve('skinPosOffset');
        var poseMatrixId = scope.resolve('matrix_pose[0]');
        var pickColorId = scope.resolve('uColor');
        var projId = scope.resolve('matrix_projection');
        var viewProjId = scope.resolve('matrix_viewProjection');
        var opacityMapId = scope.resolve('texture_opacityMap');
        var alphaTestId = scope.resolve('alpha_ref');

        var wtm = camera._node.getWorldTransform();
        var projMat = camera.getProjectionMatrix();
        var viewMat = wtm.clone().invert();
        var viewProjMat = new pc.Mat4();
        viewProjMat.mul2(projMat, viewMat);

        projId.setValue(projMat.data);
        viewProjId.setValue(viewProjMat.data);

        // copy scene drawCalls
        this.drawCalls = scene.drawCalls.slice(0);
        // sort same as forward renderer
        this.drawCalls.sort(sortDrawCalls);

        for (i = 0; i < this.drawCalls.length; i++) {
            if (this.drawCalls[i].command) {
                this.drawCalls[i].command();
            } else {
                if (!this.drawCalls[i].pick) continue;
                meshInstance = this.drawCalls[i];
                mesh = meshInstance.mesh;
                material = meshInstance.material;

                type = mesh.primitive[pc.RENDERSTYLE_SOLID].type;
                var isSolid = (type === pc.PRIMITIVE_TRIANGLES) || (type === pc.PRIMITIVE_TRISTRIP) || (type === pc.PRIMITIVE_TRIFAN);
                var isPickable = (material instanceof pc.StandardMaterial) || (material instanceof pc.BasicMaterial);
                if (isSolid && isPickable) {

                    device.setBlending(false);
                    device.setCullMode(material.cull);
                    device.setDepthWrite(material.depthWrite);
                    device.setDepthTest(material.depthTest);

                    modelMatrixId.setValue(meshInstance.node.worldTransform.data);
                    if (meshInstance.skinInstance) {
                        skinPosOffsetId.setValue(meshInstance.node.getPosition().data);
                        if (device.supportsBoneTextures) {
                            boneTextureId.setValue(meshInstance.skinInstance.boneTexture);
                            var w = meshInstance.skinInstance.boneTexture.width;
                            var h = meshInstance.skinInstance.boneTexture.height;
                            boneTextureSizeId.setValue([w, h]);
                        } else {
                            poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette);
                        }
                    }

                    if (material.opacityMap) {
                        opacityMapId.setValue(material.opacityMap);
                        alphaTestId.setValue(meshInstance===this._ignoreOpacityFor? 0 : material.alphaTest);
                    }

                    this.pickColor[0] = ((i >> 16) & 0xff) / 255;
                    this.pickColor[1] = ((i >> 8) & 0xff) / 255;
                    this.pickColor[2] = (i & 0xff) / 255;
                    this.pickColor[3] = 1;
                    pickColorId.setValue(this.pickColor);

                    shader = meshInstance._shader[pc.SHADER_PICK];
                    if (!shader) {
                        shader = this.library.getProgram('pick', {
                                skin: !!meshInstance.skinInstance,
                                screenSpace: meshInstance.screenSpace,
                                opacityMap: !!material.opacityMap,
                                opacityChannel: material.opacityMap? (material.opacityMapChannel || 'r') : null
                            });
                        meshInstance._shader[pc.SHADER_PICK] = shader;
                    }
                    device.setShader(shader);

                    device.setVertexBuffer(mesh.vertexBuffer, 0);
                    device.setIndexBuffer(mesh.indexBuffer[pc.RENDERSTYLE_SOLID]);
                    device.draw(mesh.primitive[pc.RENDERSTYLE_SOLID]);
                }
            }
        }

        device.setViewport(0, 0, device.width, device.height);
        device.setScissor(0, 0, device.width, device.height);
        device.updateEnd();

        // Restore render target
        device.setRenderTarget(prevRenderTarget);
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
        var colorBuffer = new pc.Texture(this.device, {
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            width: width,
            height: height,
            mipmaps: false,
            minFilter: pc.FILTER_NEAREST,
            magFilter: pc.FILTER_NEAREST
        });
        this._pickBufferTarget = new pc.RenderTarget(this.device, colorBuffer, { depth: true });
    };

    Object.defineProperty(Picker.prototype, 'renderTarget', {
        get: function() { return this._pickBufferTarget; }
    });

    Object.defineProperty(Picker.prototype, 'width', {
        get: function() { return this._pickBufferTarget.width; }
    });

    Object.defineProperty(Picker.prototype, 'height', {
        get: function() { return this._pickBufferTarget.height; }
    });

    return {
        Picker: Picker
    };
}());
