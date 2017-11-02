pc.extend(pc, function () {

    // Sorting
    var cmp, temp, pp, minEnd, maxEnd, keyA, keyB, sortCallback, sortPos, sortDir;

    function sortManual(drawCallA, drawCallB) {
        return drawCallB.drawOrder - drawCallA.drawOrder;
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

    function swap(array, i, j) {
        temp = array[i];
        array[i] = array[j];
        array[j] = temp;
        return array;
    }

    function partition(array, left, right) {
        cmp = array[right - 1];
        minEnd = left;
        for (maxEnd = left; maxEnd < right - 1; maxEnd += 1) {
            //if (array[maxEnd] <= cmp) {
            //if (array[maxEnd].time <= cmp.time) {
            if (sortCallback(array[maxEnd], cmp) < 0) {
                swap(array, maxEnd, minEnd);
                minEnd += 1;
            }
        }
        swap(array, minEnd, right - 1);
        return minEnd;
    }

    function quickSort(array, left, right) {
        if (left < right) {
            pp = partition(array, left, right);
            quickSort(array, left, pp);
            quickSort(array, pp + 1, right);
        }
        return array;
    }

    // Layers
    var layerCounter = 0;
    var layerList = [];

    function getLayerById(id) {
        return layerList[id];
    }

    function getLayerByName(name) {
        for(var i=0; i<layerList.length; i++) {
            if (layerList[i].name === name) return layerList[i];
        }
        return null;
    }

    var Layer = function (options) {
        if (options.id !== undefined && !layerList[options.id]) {
            this.id = options.id;
            layerList[this.id] = this;
        } else {
            this.id = layerCounter;
            layerList[this.id] = this;

            layerCounter++;
            while(layerList[layerCounter]) {
                layerCounter++;
            }
        }
        this.enabled = options.enabled === undefined ? true : options.enabled;
        this.name = options.name;
        this.opaqueSortMode = options.opaqueSortMode === undefined ? pc.SORTMODE_MATERIALMESH : options.opaqueSortMode;
        this.transparentSortMode = options.transparentSortMode === undefined ? pc.SORTMODE_BACK2FRONT : options.transparentSortMode;
        this.renderTarget = options.renderTarget;
        this.preRenderCallback = options.preRenderCallback;
        this.overrideCullMode = options.overrideCullMode;
        this.shaderPass = options.shaderPass === undefined ? pc.SHADER_FORWARD : options.shaderPass;

        this.opaqueMeshInstances = [];
        this.transparentMeshInstances = [];

        this._opaqueMeshInstancesCulled = [];
        this._opaqueMeshInstancesCulledLength = 0;
        this._transparentMeshInstancesCulled = [];
        this._transparentMeshInstancesCulledLength = 0;

        this._lights = [];
        this._globalLights = [];
        this._localLights = [[], []];
        this.cameras = [];
        this._dirty = false;
        this._dirtyLights = false;
    };

    Layer.prototype.addMeshInstances = function (meshInstances) {
        var m;
        for(var i=0; i<meshInstances.length; i++) {
            m = meshInstances[i];
            if (m.material.blendType === pc.BLEND_NONE) { // TODO: what happens, if blend changes at runtime? Should force resort
                this.opaqueMeshInstances.push(m);
            } else {
                this.transparentMeshInstances.push(m);
            }
        }
        this._dirty = true;
    };

    Layer.prototype.removeMeshInstances = function (meshInstances) {
        var m, arr, id;
        for(var i=0; i<meshInstances.length; i++) {
            m = meshInstances[i];
            arr = m.material.blendType === pc.BLEND_NONE ? this.opaqueMeshInstances : this.transparentMeshInstances;
            id = arr.indexOf(m);
            if (id >= 0) arr.splice(id, 1);
        }
        this._dirty = true;
    };

    Layer.prototype.addLight = function (light) {
        this._lights.push(light);
        this._dirtyLights = true;
    };

    Layer.prototype.removeLight = function (light) {
        var id = this._lights.indexOf(light);
        if (id < 0) return;
        this._lights.splice(id, 1);
        this._dirtyLights = true;
    };

    Layer.prototype.addCamera = function (camera) {
        this.cameras.push(camera);
    };

    Layer.prototype.removeCamera = function (camera) {
        var id = this.cameras.indexOf(camera);
        if (id < 0) return;
        this.cameras.splice(id, 1);
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

    Layer.prototype._sortCulled = function (transparent, cameraNode) {
        var sortMode = transparent ? this.transparentSortMode : this.opaqueSortMode;
        if (sortMode === pc.SORTMODE_NONE) return;
        var arr = transparent ? this._transparentMeshInstancesCulled : this._opaqueMeshInstancesCulled;
        var len = transparent ? this._transparentMeshInstancesCulledLength : this._opaqueMeshInstancesCulledLength;
        if (sortMode === pc.SORTMODE_BACK2FRONT || sortMode === pc.SORTMODE_FRONT2BACK) {
            sortPos = cameraNode.getPosition().data;
            sortDir = cameraNode.forward.data;
            this._calculateSortDistances(arr, len, sortPos, sortDir);
        }
        // this is partial sort to avoid allocating new arrays every frame, so we can't rely on JS sort()
        sortCallback = sortCallbacks[sortMode];
        quickSort(arr, 0, len);
    };

    // Composition can hold only 2 sublayers of each layer
    var LayerComposition = function () {
        this.layerList = [];
        this.subLayerList = [];
        this.subLayerEnabled = []; // more granular control on top of layer.enabled (ANDed)

        this._dirty = false;
        this._dirtyLights = false;
        this._meshInstances = [];
        this._lights = [];
        this._globalLights = [];
        this._localLights = [[], []];
        this._renderedRt = [];
        this._renderedByCam = [];
    };

    LayerComposition.prototype._update = function () {
        var i;
        var len = this.layerList.length;
        
        if (!this._dirty || !this._dirtyLights) {
            for(i=0; i<len; i++) {
                if (this.layerList[i]._dirty) {
                    this._dirty = true;
                }
                if (this.layerList[i]._dirtyLights) {
                    this._dirtyLights = true;
                }
            }
        }

        var arr, j;

        if (this._dirty) {
            this._meshInstances.length = 0;
            for(i=0; i<len; i++) {
                // TODO: must redo if blend mode changed
                arr = this.layerList[i].opaqueMeshInstances;
                for(j=0; j<arr.length; j++) {
                    if (this._meshInstances.indexOf(arr[j]) < 0) this._meshInstances.push(arr[j]);
                }
                arr = this.layerList[i].transparentMeshInstances;
                for(j=0; j<arr.length; j++) {
                    if (this._meshInstances.indexOf(arr[j]) < 0) this._meshInstances.push(arr[j]);
                }
            }
            this._dirty = false;
            for(i=0; i<len; i++) {
                this.layerList[i]._dirty = false;
            }
        }

        if (this._dirtyLights) {
            this._lights.length = 0;
            for(i=0; i<len; i++) {
                // TODO: must redo if blend mode changed
                arr = this.layerList[i]._lights;
                for(j=0; j<arr.length; j++) {
                    if (this._lights.indexOf(arr[j]) < 0) this._lights.push(arr[j]);
                }
            }
            this._dirtyLights = false;
            for(i=0; i<len; i++) {
                this.layerList[i]._dirtyLights = false;
            }
        }

    };

    LayerComposition.prototype._isLayerAdded = function (layer) {
        if (this.layerList.indexOf(layer) >= 0) {
            // #ifdef DEBUG
            console.error("Layer is already added.");
            // #endif
            return true;
        }
        return false;
    };

    // Whole layer API

    LayerComposition.prototype.pushLayer = function (layer) {
        // add both opaque and transparent to the end of the array
        if (this._isLayerAdded(layer)) return;
        this.layerList.push(layer);
        this.layerList.push(layer);
        this.subLayerList.push(false);
        this.subLayerList.push(true);
        this.subLayerEnabled.push(true);
        this.subLayerEnabled.push(true);
        this._dirty = true;
        this._dirtyLights = true;
    };

    LayerComposition.prototype.insertLayerBefore = function (layer, beforeLayer) {
        // insert both opaque and transparent before the first occurence of another layer
        if (this._isLayerAdded(layer)) return;
        var id = this.layerList.indexOf(beforeLayer);
        if (id < 0) {
            // #ifdef DEBUG
            console.error("Can't insert layer, beforeLayer isn't found");
            // #endif
            return;
        }
        this.layerList.splice(id, 0,    layer,  layer);
        this.subLayerList.splice(id, 0, false,  true);
        this.subLayerEnabled.splice(id, 0, true,  true);
        this._dirty = true;
        this._dirtyLights = true;
    };

    LayerComposition.prototype.insertLayerAfter = function (layer, afterLayer) {
        // insert both opaque and transparent after the last occurence of another layer
        if (this._isLayerAdded(layer)) return;
        var id = this.layerList.lastIndexOf(afterLayer);
        if (id < 0) {
            // #ifdef DEBUG
            console.error("Can't insert layer, afterLayer isn't found");
            // #endif
            return;
        }
        id++;
        this.layerList.splice(id, 0,    layer,  layer);
        this.subLayerList.splice(id, 0, false,  true);
        this.subLayerEnabled.splice(id, 0, true,  true);
        this._dirty = true;
        this._dirtyLights = true;
    };

    LayerComposition.prototype.removeLayer = function (layer) {
        // remove all occurences of a layer
        var id = this.layerList.indexOf(layer);
        while(id >= 0) {
            this.layerList.splice(id, 1);
            this.subLayerList.splice(id, 1);
            this.subLayerEnabled.splice(id, 1);
            id = this.layerList.indexOf(layer);
            this._dirty = true;
            this._dirtyLights = true;
        }
    };

    // Sublayer API

    LayerComposition.prototype.getSublayerIndex = function (layer, transparent) {
        // find sublayer index in the composition array
        var id = this.layerList.indexOf(layer);
        if (id < 0) return -1;

        if (this.subLayerList[id] !== transparent) {
            id = this.layerList.indexOf(layer, id + 1);
            if (id < 0) return -1;
            if (this.subLayerList[id] !== transparent) {
                return -1;
            }
        }
        return id;
    };

    LayerComposition.prototype.insertSublayerAt = function (index, layer, transparent) {
        // insert sublayer at the composition array index
        this.layerList.splice(index, 0,    layer);
        this.subLayerList.splice(index, 0, transparent);
        this.subLayerEnabled.splice(index, 0, true);
        this._dirty = true;
        this._dirtyLights = true;
    };

    LayerComposition.prototype.removeSublayerAt = function (index) {
        // remove sublayer in the composition array
        this.layerList.splice(index, 1);
        this.subLayerList.splice(index, 1);
        this.subLayerEnabled.splice(index, true);
        this._dirty = true;
        this._dirtyLights = true;
    };

    return {
        Layer: Layer,
        LayerComposition: LayerComposition,
        getLayerById: getLayerById,
        getLayerByName: getLayerByName,
    };
}());
