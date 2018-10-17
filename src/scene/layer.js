Object.assign(pc, function () {
    var keyA, keyB, sortPos, sortDir;

    function sortManual(drawCallA, drawCallB) {
        return drawCallA.drawOrder - drawCallB.drawOrder;
    }

    function sortMaterialMesh(drawCallA, drawCallB) {
        keyA = drawCallA._key[pc.SORTKEY_FORWARD];
        keyB = drawCallB._key[pc.SORTKEY_FORWARD];
        if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
            return drawCallB.mesh.id - drawCallA.mesh.id;
        }
        return keyB - keyA;
    }

    function sortBackToFront(drawCallA, drawCallB) {
        return drawCallB.zdist - drawCallA.zdist;
    }

    function sortFrontToBack(drawCallA, drawCallB) {
        return drawCallA.zdist - drawCallB.zdist;
    }

    var sortCallbacks = [null, sortManual, sortMaterialMesh, sortBackToFront, sortFrontToBack];

    function sortCameras(camA, camB) {
        return camA.priority - camB.priority;
    }

    function sortLights(lightA, lightB) {
        return lightB.key - lightA.key;
    }

    // Layers
    var layerCounter = 0;

    var VisibleInstanceList = function () {
        this.list = [];
        this.length = 0;
        this.done = false;
    };

    var InstanceList = function () {
        this.opaqueMeshInstances = [];
        this.transparentMeshInstances = [];
        this.shadowCasters = [];

        // arrays of VisibleInstanceList for each camera
        this.visibleOpaque = [];
        this.visibleTransparent = [];
    };

    InstanceList.prototype.clearVisibleLists = function (cameraPass) {
        if (this.visibleOpaque[cameraPass]) {
            this.visibleOpaque[cameraPass].length = 0;
            this.visibleOpaque[cameraPass].list.length = 0;
        }

        if (this.visibleTransparent[cameraPass]) {
            this.visibleTransparent[cameraPass].length = 0;
            this.visibleTransparent[cameraPass].list.length = 0;
        }
    };

    /**
     * @constructor
     * @name pc.Layer
     * @classdesc Layer represents a renderable subset of the scene. It can contain a list of mesh instances, lights and cameras,
     * their render settings and also defines custom callbacks before, after or during rendering.
     * Layers are organized inside {@link pc.LayerComposition} in a desired order.
     * @description Create a new layer.
     * @param {Object} options Object for passing optional arguments. These arguments are the same as properties of the Layer.
     * @property {Boolean} enabled Enable the layer. Disabled layers are skipped. Defaults to true.
     * @property {String} name Name of the layer. Can be used in {@link pc.LayerComposition#getLayerByName}.
     * @property {Number} opaqueSortMode Defines the method used for sorting opaque (that is, not semi-transparent) mesh instances before rendering.
     * Possible values are:
     * <ul>
     *     <li>{@link pc.SORTMODE_NONE}</li>
     *     <li>{@link pc.SORTMODE_MANUAL}</li>
     *     <li>{@link pc.SORTMODE_MATERIALMESH}</li>
     *     <li>{@link pc.SORTMODE_BACK2FRONT}</li>
     *     <li>{@link pc.SORTMODE_FRONT2BACK}</li>
     * </ul>
     * Defaults to pc.SORTMODE_MATERIALMESH.
     * @property {Number} transparentSortMode Defines the method used for sorting semi-transparent mesh instances before rendering.
     * Possible values are:
     * <ul>
     *     <li>{@link pc.SORTMODE_NONE}</li>
     *     <li>{@link pc.SORTMODE_MANUAL}</li>
     *     <li>{@link pc.SORTMODE_MATERIALMESH}</li>
     *     <li>{@link pc.SORTMODE_BACK2FRONT}</li>
     *     <li>{@link pc.SORTMODE_FRONT2BACK}</li>
     * </ul>
     * Defaults to pc.SORTMODE_BACK2FRONT.
     * @property {pc.RenderTarget} renderTarget Render target to which rendering is performed. If not set, will render simply to the screen.
     * @property {Number} shaderPass A type of shader to use during rendering. Possible values are:
     * <ul>
     *     <li>{@link pc.SHADER_FORWARD}</li>
     *     <li>{@link pc.SHADER_FORWARDHDR}</li>
     *     <li>{@link pc.SHADER_DEPTH}</li>
     *     <li>Your own custom value. Should be in 19 - 31 range. Use {@link pc.StandardMaterial#onUpdateShader} to apply shader modifications based on this value.</li>
     * </ul>
     * Defaults to pc.SHADER_FORWARD.
     * @property {Boolean} passThrough Tells that this layer is simple and needs to just render a bunch of mesh instances without lighting, skinning and morphing (faster).
     *
     * @property {Boolean} overrideClear Defines if layer should use camera clear parameters (true) or ignore them and use {@link pc.Layer#clearColor}, {@link pc.Layer#clearColorBuffer},
     * {@link pc.Layer#clearDepthBuffer} and {@link pc.Layer#clearStencilBuffer}.
     * @property {pc.Color} clearColor The color used to clear the canvas to before each camera starts to render.
     * @property {Boolean} clearColorBuffer If true cameras will clear the color buffer to the color set in clearColor.
     * @property {Boolean} clearDepthBuffer If true cameras will clear the depth buffer.
     * @property {Boolean} clearStencilBuffer If true cameras will clear the stencil buffer.
     *
     * @property {pc.Layer} layerReference Make this layer render the same mesh instances that another layer does instead of having its own mesh instance list.
     * Both layers must share cameras. Frustum culling is only performed for one layer.
     * @property {Function} cullingMask Visibility mask that interacts with {@link pc.MeshInstance#mask}.
     * @property {Function} onEnable Custom function that is called after the layer has been enabled.
     * This happens when:
     * <ul>
     *     <li>The layer is created with {@link pc.Layer#enabled} set to true (which is the default value).</li>
     *     <li>{@link pc.Layer#enabled} was changed from false to true</li>
     *     <li>{@link pc.Layer#incrementCounter} was called and incremented the counter above zero.</li>
     * </ul>
     * Useful for allocating resources this layer will use (e.g. creating render targets).
     * @property {Function} onDisable Custom function that is called after the layer has been disabled.
     * This happens when:
     * <ul>
     *     <li>{@link pc.Layer#enabled} was changed from true to false</li>
     *     <li>{@link pc.Layer#decrementCounter} was called and set the counter to zero.</li>
     * </ul>
     * @property {Function} onPreCull Custom function that is called before visibility culling is performed for this layer.
     * Useful, for example, if you want to modify camera projection while still using the same camera and make frustum culling work correctly with it
     * (see {@link pc.CameraComponent#calculateTransform} and {@link pc.CameraComponent#calculateProjection}).
     * This function will receive camera index as the only argument. You can get the actual camera being used by looking up {@link pc.LayerComposition#cameras} with this index.
     * @property {Function} onPostCull Custom function that is called after visibiliy culling is performed for this layer.
     * Useful for reverting changes done in {@link pc.Layer#onPreCull} and determining final mesh instance visibility (see {@link pc.MeshInstance#visibleThisFrame}).
     * This function will receive camera index as the only argument. You can get the actual camera being used by looking up {@link pc.LayerComposition#cameras} with this index.
     * @property {Function} onPreRender Custom function that is called before this layer is rendered.
     * Useful, for example, for reacting on screen size changes.
     * This function is called before the first occurrence of this layer in {@link pc.LayerComposition}.
     * It will receive camera index as the only argument. You can get the actual camera being used by looking up {@link pc.LayerComposition#cameras} with this index.
     * @property {Function} onPreRenderOpaque Custom function that is called before opaque mesh instances (not semi-transparent) in this layer are rendered.
     * This function will receive camera index as the only argument. You can get the actual camera being used by looking up {@link pc.LayerComposition#cameras} with this index.
     * @property {Function} onPreRenderTransparent Custom function that is called before semi-transparent mesh instances in this layer are rendered.
     * This function will receive camera index as the only argument. You can get the actual camera being used by looking up {@link pc.LayerComposition#cameras} with this index.
     * @property {Function} onPostRender Custom function that is called after this layer is rendered.
     * Useful to revert changes made in {@link pc.Layer#onPreRender} or performing some processing on {@link pc.Layer#renderTarget}.
     * This function is called after the last occurrence of this layer in {@link pc.LayerComposition}.
     * It will receive camera index as the only argument. You can get the actual camera being used by looking up {@link pc.LayerComposition#cameras} with this index.
     * @property {Function} onPostRenderOpaque Custom function that is called after opaque mesh instances (not semi-transparent) in this layer are rendered.
     * This function will receive camera index as the only argument. You can get the actual camera being used by looking up {@link pc.LayerComposition#cameras} with this index.
     * @property {Function} onPostRenderTransparent Custom function that is called after semi-transparent mesh instances in this layer are rendered.
     * This function will receive camera index as the only argument. You can get the actual camera being used by looking up {@link pc.LayerComposition#cameras} with this index.
     * @property {Function} onDrawCall Custom function that is called before every mesh instance in this layer is rendered.
     * It is not recommended to set this function when rendering many objects every frame due to performance reasons.
     * @property {Function} id A unique ID of the layer.
     * Layer IDs are stored inside {@link pc.ModelComponent#layers}, {@link pc.CameraComponent#layers}, {@link pc.LightComponent#layers} and {@link pc.ElementComponent#layers} instead of names.
     * Can be used in {@link pc.LayerComposition#getLayerById}.
     */
    var Layer = function (options) {
        options = options || {};

        if (options.id !== undefined) {
            this.id = options.id;
            layerCounter = Math.max(this.id + 1, layerCounter);
        } else {
            this.id = layerCounter++;
        }

        this.name = options.name;

        this._enabled = options.enabled === undefined ? true : options.enabled;
        this._refCounter = this._enabled ? 1 : 0;

        this.opaqueSortMode = options.opaqueSortMode === undefined ? pc.SORTMODE_MATERIALMESH : options.opaqueSortMode;
        this.transparentSortMode = options.transparentSortMode === undefined ? pc.SORTMODE_BACK2FRONT : options.transparentSortMode;
        this.renderTarget = options.renderTarget;
        this.shaderPass = options.shaderPass === undefined ? pc.SHADER_FORWARD : options.shaderPass;
        this.passThrough = options.passThrough === undefined ? false : options.passThrough;

        this.overrideClear = options.overrideClear === undefined ? false : options.overrideClear;
        this._clearColor = new pc.Color(0, 0, 0, 1);
        if (options.clearColor) {
            this._clearColor.copy(options.clearColor);
        }
        this._clearColorBuffer = options.clearColorBuffer === undefined ? false : options.clearColorBuffer;
        this._clearDepthBuffer = options.clearDepthBuffer === undefined ? false : options.clearDepthBuffer;
        this._clearStencilBuffer = options.clearStencilBuffer === undefined ? false : options.clearStencilBuffer;
        this._clearOptions = {
            color: [this._clearColor.r, this._clearColor.g, this._clearColor.b, this._clearColor.a],
            depth: 1,
            stencil: 0,
            flags: (this._clearColorBuffer ? pc.CLEARFLAG_COLOR : 0) | (this._clearDepthBuffer ? pc.CLEARFLAG_DEPTH : 0) | (this._clearStencilBuffer ? pc.CLEARFLAG_STENCIL : 0)
        };

        this.onPreCull = options.onPreCull;
        this.onPreRender = options.onPreRender;
        this.onPreRenderOpaque = options.onPreRenderOpaque;
        this.onPreRenderTransparent = options.onPreRenderTransparent;

        this.onPostCull = options.onPostCull;
        this.onPostRender = options.onPostRender;
        this.onPostRenderOpaque = options.onPostRenderOpaque;
        this.onPostRenderTransparent = options.onPostRenderTransparent;

        this.onDrawCall = options.onDrawCall;
        this.onEnable = options.onEnable;
        this.onDisable = options.onDisable;

        if (this._enabled && this.onEnable) {
            this.onEnable();
        }

        this.layerReference = options.layerReference; // should use the same camera
        this.instances = options.layerReference ? options.layerReference.instances : new InstanceList();
        this.cullingMask = options.cullingMask ? options.cullingMask : 0xFFFFFFFF;

        this.opaqueMeshInstances = this.instances.opaqueMeshInstances;
        this.transparentMeshInstances = this.instances.transparentMeshInstances;
        this.shadowCasters = this.instances.shadowCasters;

        this.customSortCallback = null;
        this.customCalculateSortValues = null;

        this._lightComponents = [];
        this._lights = [];
        this._sortedLights = [[], [], []];
        this.cameras = [];
        this._dirty = false;
        this._dirtyLights = false;
        this._dirtyCameras = false;
        this._cameraHash = 0;
        this._lightHash = 0;
        this._staticLightHash = 0;
        this._needsStaticPrepare = true;
        this._staticPrepareDone = false;

        // #ifdef PROFILER
        this.skipRenderAfter = Number.MAX_VALUE;
        this._skipRenderCounter = 0;

        this._renderTime = 0;
        this._forwardDrawCalls = 0;
        this._shadowDrawCalls = 0;
        // #endif

        this._shaderVersion = -1;
        this._version = 0;
        this._lightCube = null;
    };

    Object.defineProperty(Layer.prototype, "enabled", {
        get: function () {
            return this._enabled;
        },
        set: function (val) {
            if (val !== this._enabled) {
                this._enabled = val;
                if (val) {
                    this.incrementCounter();
                    if (this.onEnable) this.onEnable();
                } else {
                    this.decrementCounter();
                    if (this.onDisable) this.onDisable();
                }
            }
        }
    });

    Object.defineProperty(Layer.prototype, "clearColor", {
        get: function () {
            return this._clearColor;
        },
        set: function (val) {
            this._clearColor.copy(val);
        }
    });

    Layer.prototype._updateClearFlags = function () {
        var flags = 0;

        if (this._clearColorBuffer)
            flags |= pc.CLEARFLAG_COLOR;

        if (this._clearDepthBuffer)
            flags |= pc.CLEARFLAG_DEPTH;

        if (this._clearStencilBuffer)
            flags |= pc.CLEARFLAG_STENCIL;

        this._clearOptions.flags = flags;
    };

    Object.defineProperty(Layer.prototype, "clearColorBuffer", {
        get: function () {
            return this._clearColorBuffer;
        },
        set: function (val) {
            this._clearColorBuffer = val;
            this._updateClearFlags();
        }
    });

    Object.defineProperty(Layer.prototype, "clearDepthBuffer", {
        get: function () {
            return this._clearDepthBuffer;
        },
        set: function (val) {
            this._clearDepthBuffer = val;
            this._updateClearFlags();
        }
    });

    Object.defineProperty(Layer.prototype, "clearStencilBuffer", {
        get: function () {
            return this._clearStencilBuffer;
        },
        set: function (val) {
            this._clearStencilBuffer = val;
            this._updateClearFlags();
        }
    });

    /**
     * @private
     * @function
     * @name pc.Layer#incrementCounter
     * @description Increments the usage counter of this layer.
     * By default, layers are created with counter set to 1 (if {@link pc.Layer.enabled} is true) or 0 (if it was false).
     * Incrementing the counter from 0 to 1 will enable the layer and call {@link pc.Layer.onEnable}.
     * Use this function to "subscribe" multiple effects to the same layer. For example, if the layer is used to render a reflection texture which is used by 2 mirrors,
     * then each mirror can call this function when visible and {@link pc.Layer.decrementCounter} if invisible.
     * In such case the reflection texture won't be updated, when there is nothing to use it, saving performance.
     */
    Layer.prototype.incrementCounter = function () {
        if (this._refCounter === 0) {
            this._enabled = true;
            if (this.onEnable) this.onEnable();
        }
        this._refCounter++;
    };

    /**
     * @private
     * @function
     * @name pc.Layer#decrementCounter
     * @description Decrements the usage counter of this layer.
     * Decrementing the counter from 1 to 0 will disable the layer and call {@link pc.Layer.onDisable}.
     * See {@link pc.Layer#incrementCounter} for more details.
     */
    Layer.prototype.decrementCounter = function () {
        if (this._refCounter === 1) {
            this._enabled = false;
            if (this.onDisable) this.onDisable();

        } else if (this._refCounter === 0) {
            // #ifdef DEBUG
            console.warn("Trying to decrement layer counter below 0");
            // #endif
            return;
        }
        this._refCounter--;
    };

    // SUBLAYER GROUPS
    // If there are multiple sublayer with identical _cameraHash without anything in between, these
    // are called a SUBLAYER GROUP instead of:
    //     for each sublayer
    //         for each camera
    // we go:
    //     for each sublayerGroup

    /**
     * @function
     * @name pc.Layer#addMeshInstances
     * @description Adds an array of mesh instances to this layer.
     * @param {Array} meshInstances Array of {@link pc.MeshInstance}.
     * @param {Boolean} [skipShadowCasters] Set it to true if you don't want these mesh instances to cast shadows in this layer.
     */
    Layer.prototype.addMeshInstances = function (meshInstances, skipShadowCasters) {
        var sceneShaderVer = this._shaderVersion;

        var m, arr, mat;
        var casters = this.shadowCasters;
        for (var i = 0; i < meshInstances.length; i++) {
            m = meshInstances[i];
            mat = m.material;
            if (mat.blendType === pc.BLEND_NONE) {
                arr = this.opaqueMeshInstances;
            } else {
                arr = this.transparentMeshInstances;
            }
            if (arr.indexOf(m) < 0) arr.push(m);
            if (!skipShadowCasters && m.castShadow && casters.indexOf(m) < 0) casters.push(m);
            if (!this.passThrough && sceneShaderVer >= 0 && mat._shaderVersion !== sceneShaderVer) { // clear old shader if needed
                if (mat.updateShader !== pc.Material.prototype.updateShader) {
                    mat.clearVariants();
                    mat.shader = null;
                }
                mat._shaderVersion = sceneShaderVer;
            }
        }
        if (!this.passThrough) this._dirty = true;
    };

    /**
     * @function
     * @name pc.Layer#removeMeshInstances
     * @description Removes multiple mesh instances from this layer.
     * @param {Array} meshInstances Array of {@link pc.MeshInstance}. If they were added to this layer, they will be removed.
     * @param {Boolean} [skipShadowCasters] Set it to true if you want to still cast shadows from removed mesh instances or if they never did cast shadows before.
     */
    Layer.prototype.removeMeshInstances = function (meshInstances, skipShadowCasters) {

        var i, j, m, spliceOffset, spliceCount, len, drawCall;
        var opaque = this.opaqueMeshInstances;
        var transparent = this.transparentMeshInstances;
        var casters = this.shadowCasters;

        for (i = 0; i < meshInstances.length; i++) {
            m = meshInstances[i];

            // remove from opaque
            spliceOffset = -1;
            spliceCount = 0;
            len = opaque.length;
            for (j = 0; j < len; j++) {
                drawCall = opaque[j];
                if (drawCall === m) {
                    spliceOffset = j;
                    spliceCount = 1;
                    break;
                }
                if (drawCall._staticSource === m) {
                    if (spliceOffset < 0) spliceOffset = j;
                    spliceCount++;
                } else if (spliceOffset >= 0) {
                    break;
                }
            }
            if (spliceOffset >= 0) opaque.splice(spliceOffset, spliceCount);

            // remove from transparent
            spliceOffset = -1;
            spliceCount = 0;
            len = transparent.length;
            for (j = 0; j < len; j++) {
                drawCall = transparent[j];
                if (drawCall === m) {
                    spliceOffset = j;
                    spliceCount = 1;
                    break;
                }
                if (drawCall._staticSource === m) {
                    if (spliceOffset < 0) spliceOffset = j;
                    spliceCount++;
                } else if (spliceOffset >= 0) {
                    break;
                }
            }
            if (spliceOffset >= 0) transparent.splice(spliceOffset, spliceCount);

            // remove from shadows
            if (skipShadowCasters) continue;
            j = casters.indexOf(m);
            if (j >= 0) casters.splice(j, 1);
        }
        this._dirty = true;
    };

    /**
     * @function
     * @name pc.Layer#clearMeshInstances
     * @description Removes all mesh instances from this layer.
     * @param {Boolean} [skipShadowCasters] Set it to true if you want to still cast shadows from removed mesh instances or if they never did cast shadows before.
     */
    Layer.prototype.clearMeshInstances = function (skipShadowCasters) {
        if (this.opaqueMeshInstances.length === 0 && this.transparentMeshInstances.length === 0) {
            if (skipShadowCasters || this.shadowCasters.length === 0) return;
        }
        this.opaqueMeshInstances.length = 0;
        this.transparentMeshInstances.length = 0;
        if (!skipShadowCasters) this.shadowCasters.length = 0;
        if (!this.passThrough) this._dirty = true;
    };

    /**
     * @function
     * @name pc.Layer#addLight
     * @description Adds a light to this layer.
     * @param {pc.LightComponent} light A {@link pc.LightComponent}.
     */
    Layer.prototype.addLight = function (light) {
        if (this._lightComponents.indexOf(light) >= 0) return;
        this._lightComponents.push(light);
        this._lights.push(light.light);
        this._dirtyLights = true;
        this._generateLightHash();
    };

    /**
     * @function
     * @name pc.Layer#removeLight
     * @description Removes a light from this layer.
     * @param {pc.LightComponent} light A {@link pc.LightComponent}.
     */
    Layer.prototype.removeLight = function (light) {
        var id = this._lightComponents.indexOf(light);
        if (id < 0) return;
        this._lightComponents.splice(id, 1);

        id = this._lights.indexOf(light.light);
        this._lights.splice(id, 1);

        this._dirtyLights = true;
        this._generateLightHash();
    };

    /**
     * @function
     * @name pc.Layer#clearLights
     * @description Removes all lights from this layer.
     */
    Layer.prototype.clearLights = function () {
        this._lightComponents.length = 0;
        this._lights.length = 0;
        this._dirtyLights = true;
    };

    /**
     * @function
     * @name pc.Layer#addShadowCasters
     * @description Adds an array of mesh instances to this layer, but only as shadow casters (they will not be rendered anywhere, but only cast shadows on other objects).
     * @param {Array} meshInstances Array of {@link pc.MeshInstance}.
     */
    Layer.prototype.addShadowCasters = function (meshInstances) {
        var m;
        var arr = this.shadowCasters;
        for (var i = 0; i < meshInstances.length; i++) {
            m = meshInstances[i];
            if (!m.castShadow) continue;
            if (arr.indexOf(m) < 0) arr.push(m);
        }
        this._dirtyLights = true;
    };

    /**
     * @function
     * @name pc.Layer#removeShadowCasters
     * @description Removes multiple mesh instances from the shadow casters list of this layer, meaning they will stop casting shadows.
     * @param {Array} meshInstances Array of {@link pc.MeshInstance}. If they were added to this layer, they will be removed.
     */
    Layer.prototype.removeShadowCasters = function (meshInstances) {
        var id;
        var arr = this.shadowCasters;
        for (var i = 0; i < meshInstances.length; i++) {
            id = arr.indexOf(meshInstances[i]);
            if (id >= 0) arr.splice(id, 1);
        }
        this._dirtyLights = true;
    };

    Layer.prototype._generateLightHash = function () {
        // generate hash to check if layers have the same set of static lights
        // order of lights shouldn't matter
        if (this._lights.length > 0) {
            this._lights.sort(sortLights);
            var str = "";
            var strStatic = "";

            for (var i = 0; i < this._lights.length; i++) {
                if (this._lights[i].isStatic) {
                    strStatic += this._lights[i].key;
                } else {
                    str += this._lights[i].key;
                }
            }

            if (str.length === 0) {
                this._lightHash = 0;
            } else {
                this._lightHash = pc.hashCode(str);
            }

            if (strStatic.length === 0) {
                this._staticLightHash = 0;
            } else {
                this._staticLightHash = pc.hashCode(strStatic);
            }

        } else {
            this._lightHash = 0;
            this._staticLightHash = 0;
        }
    };

    Layer.prototype._generateCameraHash = function () {
        // generate hash to check if cameras in layers are identical
        // order of cameras shouldn't matter
        if (this.cameras.length > 1) {
            this.cameras.sort(sortCameras);
            var str = "";
            for (var i = 0; i < this.cameras.length; i++) {
                str += this.cameras[i].entity.getGuid();
            }
            this._cameraHash = pc.hashCode(str);
        } else {
            this._cameraHash = 0;
        }
        this._dirtyCameras = true;
    };

    /**
     * @function
     * @name pc.Layer#addCamera
     * @description Adds a camera to this layer.
     * @param {pc.CameraComponent} camera A {@link pc.CameraComponent}.
     */
    Layer.prototype.addCamera = function (camera) {
        if (this.cameras.indexOf(camera) >= 0) return;
        this.cameras.push(camera);
        this._generateCameraHash();
    };

    /**
     * @function
     * @name pc.Layer#removeCamera
     * @description Removes a camera from this layer.
     * @param {pc.CameraComponent} camera A {@link pc.CameraComponent}.
     */
    Layer.prototype.removeCamera = function (camera) {
        var id = this.cameras.indexOf(camera);
        if (id < 0) return;
        this.cameras.splice(id, 1);
        this._generateCameraHash();

        // visible lists in layer are not updated after camera is removed
        // so clear out any remaining mesh instances
        this.instances.clearVisibleLists(id);
    };

    /**
     * @function
     * @name pc.Layer#clearCameras
     * @description Removes all cameras from this layer.
     */
    Layer.prototype.clearCameras = function () {
        this.cameras.length = 0;
        this._cameraHash = 0;
        this._dirtyCameras = true;
    };

    Layer.prototype._sortCameras = function () {
        this._generateCameraHash();
    };

    Layer.prototype._calculateSortDistances = function (drawCalls, drawCallsCount, camPos, camFwd) {
        var i, drawCall, meshPos;
        var tempx, tempy, tempz;
        for (i = 0; i < drawCallsCount; i++) {
            drawCall = drawCalls[i];
            if (drawCall.command) continue;
            if (drawCall.layer <= pc.LAYER_FX) continue; // Only alpha sort mesh instances in the main world (backwards comp)
            meshPos = drawCall.aabb.center;
            tempx = meshPos.x - camPos.x;
            tempy = meshPos.y - camPos.y;
            tempz = meshPos.z - camPos.z;
            drawCall.zdist = tempx * camFwd.x + tempy * camFwd.y + tempz * camFwd.z;
        }
    };

    Layer.prototype._sortVisible = function (transparent, cameraNode, cameraPass) {
        var objects = this.instances;
        var sortMode = transparent ? this.transparentSortMode : this.opaqueSortMode;
        if (sortMode === pc.SORTMODE_NONE) return;

        var visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];

        if (sortMode === pc.SORTMODE_CUSTOM) {
            sortPos = cameraNode.getPosition();
            sortDir = cameraNode.forward;
            if (this.customCalculateSortValues) {
                this.customCalculateSortValues(visible.list, visible.length, sortPos, sortDir);
            }

            if (visible.list.length !== visible.length) {
                visible.list.length = visible.length;
            }

            if (this.customSortCallback) {
                visible.list.sort(this.customSortCallback);
            }
        } else {
            if (sortMode === pc.SORTMODE_BACK2FRONT || sortMode === pc.SORTMODE_FRONT2BACK) {
                sortPos = cameraNode.getPosition();
                sortDir = cameraNode.forward;
                this._calculateSortDistances(visible.list, visible.length, sortPos, sortDir);
            }

            if (visible.list.length !== visible.length) {
                visible.list.length = visible.length;
            }

            visible.list.sort(sortCallbacks[sortMode]);
        }
    };

    return {
        Layer: Layer,
        InstanceList: InstanceList,
        VisibleInstanceList: VisibleInstanceList
    };
}());
