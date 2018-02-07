pc.extend(pc, function () {
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

    var _guidA, _guidB;
    function sortLights(lightA, lightB) {
        _guidA = lightA._node._guid;
        if (!_guidA) _guidA = 0; // does it make sense?
        
        _guidB = lightB._node._guid;
        if (!_guidB) _guidB = 0;

        return _guidA.localeCompare(_guidB);
    }

    // Layers
    var layerCounter = 0;
    var layerList = [];

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

    var Layer = function (options) {
        if (options.id !== undefined && !layerList[options.id]) {
            this.id = options.id;
            layerList[this.id] = this;
        } else {
            while(layerList[layerCounter]) {
                layerCounter++;
            }
            
            this.id = layerCounter;
            layerList[this.id] = this;

            layerCounter++;
            while(layerList[layerCounter]) {
                layerCounter++;
            }
        }
        
        this._enabled = options.enabled === undefined ? true : options.enabled;
        this._refCounter = this._enabled ? 1 : 0;

        this.name = options.name;
        this.opaqueSortMode = options.opaqueSortMode === undefined ? pc.SORTMODE_MATERIALMESH : options.opaqueSortMode;
        this.transparentSortMode = options.transparentSortMode === undefined ? pc.SORTMODE_BACK2FRONT : options.transparentSortMode;
        this.renderTarget = options.renderTarget;
        this.shaderPass = options.shaderPass === undefined ? pc.SHADER_FORWARD : options.shaderPass;
        this.simple = options.simple === undefined ? false : options.simple;

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

        this._lights = [];
        this._sortedLights = [[], [], []];
        this.cameras = [];
        this._dirty = false;
        this._dirtyLights = false;
        this._dirtyCameras = false;
        this._cameraHash = 0;
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

    Layer.prototype.incrementCounter = function () {
        if (this._refCounter === 0) {
            this._enabled = true;
            if (this.onEnable) this.onEnable();
        }
        this._refCounter++;
    };

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
    // If there are multiple sublayer with identical _cameraHash without anything in between, these are called a SUBLAYER GROUP
    // instead of
        // for each sublayer
            // for each camera
    // we go
        // for each sublayerGroup

    Layer.prototype.addMeshInstances = function (meshInstances, skipShadowCasters) {
        var sceneShaderVer = this._shaderVersion;

        var m, arr, mat;
        var casters = this.shadowCasters;
        for(var i=0; i<meshInstances.length; i++) {
            m = meshInstances[i];
            mat = m.material;
            if (mat.blendType === pc.BLEND_NONE) {
                arr = this.opaqueMeshInstances;
            } else {
                arr = this.transparentMeshInstances;
            }
            if (arr.indexOf(m) < 0) arr.push(m);
            if (!skipShadowCasters && m.castShadow && casters.indexOf(m) < 0) casters.push(m);
            if (!this.simple && sceneShaderVer >= 0 && mat._shaderVersion !== sceneShaderVer) { // clear old shader if needed
                mat.clearVariants();
                mat.shader = null;
                mat._shaderVersion = sceneShaderVer;
            }
        }
        if (!this.simple) this._dirty = true;
    };

    Layer.prototype.removeMeshInstances = function (meshInstances, skipShadowCasters) {
        var m, arr, id;
        var casters = this.shadowCasters;
        for(var i=0; i<meshInstances.length; i++) {
            m = meshInstances[i];
            arr = m.material.blendType === pc.BLEND_NONE ? this.opaqueMeshInstances : this.transparentMeshInstances;
            id = arr.indexOf(m);
            if (id >= 0) arr.splice(id, 1);
            if (skipShadowCasters) continue;
            id = casters.indexOf(m);
            if (id >= 0) casters.splice(id, 1);
        }
        this._dirty = true;
    };

    Layer.prototype.clearMeshInstances = function (skipShadowCasters) {
        if (this.opaqueMeshInstances.length === 0 && this.transparentMeshInstances.length === 0) {
            if (skipShadowCasters || this.shadowCasters.length === 0) return;
        }
        this.opaqueMeshInstances.length = 0;
        this.transparentMeshInstances.length = 0;
        if (!skipShadowCasters) this.shadowCasters.length = 0;
        if (!this.simple) this._dirty = true;
    };

    Layer.prototype.addLight = function (light) {
        if (this._lights.indexOf(light) >= 0) return;
        this._lights.push(light);
        this._dirtyLights = true;
        this._generateLightHash();
    };

    Layer.prototype.removeLight = function (light) {
        var id = this._lights.indexOf(light);
        if (id < 0) return;
        this._lights.splice(id, 1);
        this._dirtyLights = true;
        this._generateLightHash();
    };

    Layer.prototype.clearLights = function () {
        this._lights.length = 0;
        this._dirtyLights = true;
    };

    Layer.prototype.clearCameras = function () {
        this.cameras.length = 0;
        this._cameraHash = 0;
        this._dirtyCameras = true;
    };

    Layer.prototype.addShadowCasters = function (meshInstances) {
        var m;
        var arr = this.shadowCasters;
        for(var i=0; i<meshInstances.length; i++) {
            m = meshInstances[i];
            if (!m.castShadow) continue;
            if (arr.indexOf(m) < 0) arr.push(m);
        }
        this._dirtyLights = true;
    };

    Layer.prototype.removeShadowCasters = function (meshInstances) {
        var id;
        var arr = this.shadowCasters;
        for(var i=0; i<meshInstances.length; i++) {
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
            for(var i=0; i<this._lights.length; i++) {
                if (!this._lights[i].isStatic) continue;
                str += this._lights[i]._node._guid;
            }
            if (str.length === 0) {
                this._staticLightHash = 0;
            } else {
                this._staticLightHash = pc.hashCode(str);
            }
        } else {
            this._staticLightHash = 0;
        }
    };

    Layer.prototype._generateCameraHash = function () {
        // generate hash to check if cameras in layers are identical
        // order of cameras shouldn't matter
        if (this.cameras.length > 1) {
            this.cameras.sort(sortCameras);
            var str = "";
            for(var i=0; i<this.cameras.length; i++) {
                str += this.cameras[i].entity._guid;
            }
            this._cameraHash = pc.hashCode(str);
        } else {
            this._cameraHash = 0;
        }
        this._dirtyCameras = true;
    };

    Layer.prototype.addCamera = function (camera) {
        if (this.cameras.indexOf(camera) >= 0) return;
        this.cameras.push(camera);
        this._generateCameraHash();
    };

    Layer.prototype.removeCamera = function (camera) {
        var id = this.cameras.indexOf(camera);
        if (id < 0) return;
        this.cameras.splice(id, 1);
        this._generateCameraHash();
    };

    Layer.prototype.sortCameras = function () {
        this._generateCameraHash();
    };

    Layer.prototype._calculateSortDistances = function(drawCalls, drawCallsCount, camPos, camFwd) {
        var i, drawCall, btype, meshPos;
        var tempx, tempy, tempz;
        for (i = 0; i < drawCallsCount; i++) {
            drawCall = drawCalls[i];
            if (drawCall.command) continue;
            if (drawCall.layer <= pc.scene.LAYER_FX) continue; // Only alpha sort mesh instances in the main world (backwards comp)
            meshPos = drawCall.aabb.center.data;
            tempx = meshPos[0] - camPos[0];
            tempy = meshPos[1] - camPos[1];
            tempz = meshPos[2] - camPos[2];
            drawCall.zdist = tempx*camFwd[0] + tempy*camFwd[1] + tempz*camFwd[2];
        }
    };

    Layer.prototype._sortVisible = function (transparent, cameraNode, cameraPass) {
        var objects = this.instances;
        var sortMode = transparent ? this.transparentSortMode : this.opaqueSortMode;
        if (sortMode === pc.SORTMODE_NONE) return;
        var visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];
        if (sortMode === pc.SORTMODE_BACK2FRONT || sortMode === pc.SORTMODE_FRONT2BACK) {
            sortPos = cameraNode.getPosition().data;
            sortDir = cameraNode.forward.data;
            this._calculateSortDistances(visible.list, visible.length, sortPos, sortDir);
        }

        if (visible.list.length !== visible.length) {
            visible.list.length = visible.length;
        }
        visible.list.sort(sortCallbacks[sortMode]);
    };

    return {
        Layer: Layer,
        InstanceList: InstanceList,
        VisibleInstanceList: VisibleInstanceList
    };
}());
