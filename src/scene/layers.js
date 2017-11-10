pc.extend(pc, function () {

    // TODO: OK, maybe we should put hashing into one global place
    function hashCode(str){
        var hash = 0;
        if (str.length === 0) return hash;
        for (var i = 0; i < str.length; i++) {
            var char = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash;
        }
        return hash;
    }

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

    function sortCameras(camA, camB) {
        //return camA.entity._guid.localeCompare(camB.entity._guid);
        return camA.priority - camB.priority;
    }

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
        this.shadowCasters = [];

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
        this._dirtyCameras = false;
        this._cameraHash = 0;
    };

    // SUBLAYER GROUPS
    // If there are multiple sublayer with identical _cameraHash without anything in between, these are called a SUBLAYER GROUP
    // instead of
        // for each sublayer
            // for each camera
    // we go
        // for each sublayerGroup

    Layer.prototype.addMeshInstances = function (meshInstances, skipShadowCasters) {
        var m, arr;
        var casters = this.shadowCasters;
        for(var i=0; i<meshInstances.length; i++) {
            m = meshInstances[i];
            if (m.material.blendType === pc.BLEND_NONE) { // TODO: what happens, if blend changes at runtime? Should force resort
                arr = this.opaqueMeshInstances;
            } else {
                arr = this.transparentMeshInstances;
            }
            if (arr.indexOf(m) < 0) arr.push(m);
            if (!skipShadowCasters && m.castShadow && casters.indexOf(m) < 0) casters.push(m);
        }
        this._dirty = true;
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

    Layer.prototype.clearMeshInstances = function (meshInstances, skipShadowCasters) {
        this.opaqueMeshInstances.length = 0;
        this.transparentMeshInstances.length = 0;
        if (!skipShadowCasters) this.shadowCasters.length = 0;
        this._dirty = true;
    };

    Layer.prototype.addLight = function (light) {
        if (this._lights.indexOf(light) >= 0) return;
        this._lights.push(light);
        this._dirtyLights = true;
    };

    Layer.prototype.removeLight = function (light) {
        var id = this._lights.indexOf(light);
        if (id < 0) return;
        this._lights.splice(id, 1);
        this._dirtyLights = true;
    };

    Layer.prototype.clearLights = function () {
        this._lights.length = 0;
        this._dirtyLights = true;
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

    Layer.prototype._generateCameraHash = function () {
        // generate hash to check if cameras in layers are identical
        // order of cameras shouldn't matter
        if (this.cameras.length > 1) {
            sortCallback = sortCameras;
            quickSort(this.cameras, 0, this.cameras.length);
            var str = "";
            for(var i=0; i<this.cameras.length; i++) {
                str += this.cameras[i].entity._guid;
            }
            this._cameraHash = hashCode(str);
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

    function partialSort(arr, start, end, callback) {
        sortCallback = callback;
        quickSort(arr, start, end);
    }

    // Composition can hold only 2 sublayers of each layer
    var LayerComposition = function () {
        this.layerList = [];
        this.subLayerList = [];
        this.subLayerEnabled = []; // more granular control on top of layer.enabled (ANDed)

        this._dirty = false;
        this._dirtyBlend = false;
        this._dirtyLights = false;
        this._dirtyCameras = false;
        this._meshInstances = [];
        this._lights = [];
        this._globalLights = [];
        this._localLights = [[], []];
        this._lightShadowCasters = []; // array of arrays for every light; identical arrays must not be duplicated, just referenced
        this._globalLightCameras = []; // array mapping _globalLights to cameras
        this._renderedRt = [];
        this._renderedByCam = [];
        this._renderedLayer = [];

        // generated automatically - actual rendering sequence
        // can differ from layerList/subLayer list in case of multiple cameras on one layer
        // identical otherwise
        this.renderListSubLayerId = []; // index to layerList/subLayerList
        this.renderListSubLayerCameraId = []; // index to layer.cameras
    };

    LayerComposition.prototype._sortLights = function (target) {
        var light;
        var lights = target._lights;
        target._globalLights.length = 0;
        target._localLights[0].length = 0;
        target._localLights[1].length = 0;
        for (var i = 0; i < lights.length; i++) {
            light = lights[i];
            if (light._enabled) {
                if (light._type === pc.LIGHTTYPE_DIRECTIONAL) {
                    target._globalLights.push(light);
                } else {
                    target._localLights[light._type === pc.LIGHTTYPE_POINT ? 0 : 1].push(light);
                }
            }
        }
    };

    LayerComposition.prototype._update = function () {
        var i, j, k;
        var layer;
        var len = this.layerList.length;
        var result = 0;

        if (this._dirtyBlend) {
            // TODO: make it fast
            var opaqueOld, transparentOld, opaqueNew, transparentNew;
            for(i=0; i<len; i++) {
                layer = this.layerList[i];
                opaqueOld = layer.opaqueMeshInstances;
                transparentOld = layer.transparentMeshInstances;
                opaqueNew = [];
                transparentNew = [];
                for(j=0; j<opaqueOld.length; j++) {
                    if (!opaqueOld[j].material.blend) {
                        opaqueNew.push(opaqueOld[j]);
                    } else {
                        transparentNew.push(opaqueOld[j]);
                    }
                }
                for(j=0; j<transparentOld.length; j++) {
                    if (!transparentOld[j].material.blend) {
                        opaqueNew.push(transparentOld[j]);
                    } else {
                        transparentNew.push(transparentOld[j]);
                    }
                }
                layer.opaqueMeshInstances = opaqueNew;
                layer.transparentMeshInstances = transparentNew;
            }
            this._dirtyBlend = false;
        }

        if (!this._dirty || !this._dirtyLights || !this._dirtyCameras) {
            for(i=0; i<len; i++) {
                layer = this.layerList[i];
                if (layer._dirty) {
                    this._dirty = true;
                }
                if (layer._dirtyLights) {
                    this._dirtyLights = true;
                }
                if (layer._dirtyCameras) {
                    this._dirtyCameras = true;
                }
            }
        }

        var arr;

        if (this._dirty) {
            result |= 1;
            this._meshInstances.length = 0;
            for(i=0; i<len; i++) {
                layer = this.layerList[i];
                arr = layer.opaqueMeshInstances;
                for(j=0; j<arr.length; j++) {
                    if (this._meshInstances.indexOf(arr[j]) < 0) this._meshInstances.push(arr[j]);
                }
                arr = layer.transparentMeshInstances;
                for(j=0; j<arr.length; j++) {
                    if (this._meshInstances.indexOf(arr[j]) < 0) this._meshInstances.push(arr[j]);
                }
            }
            this._dirty = false;
            for(i=0; i<len; i++) {
                this.layerList[i]._dirty = false;
            }
        }

        if (this._dirtyLights || result) {
            result |= 2;
            this._lights.length = 0;
            this._lightShadowCasters.length = 0;
            // TODO: don't create new arrays, reference
            // updates when _dirty as well to fix shadow casters
            var transparent, light, casters, meshInstances, lid;

            for(i=0; i<len; i++) {
                layer = this.layerList[i];
                arr = layer._lights;
                for(j=0; j<arr.length; j++) {
                    light = arr[j];
                    lid = this._lights.indexOf(light);
                    if (lid < 0) {
                        this._lights.push(light);
                        lid = this._lights.length - 1;
                    }

                    casters = this._lightShadowCasters[lid];
                    if (!casters) {
                        this._lightShadowCasters[lid] = casters = [];
                    }
                    meshInstances = layer.shadowCasters;
                    for(k=0; k<meshInstances.length; k++) {
                        if (casters.indexOf(meshInstances[k]) < 0) casters.push(meshInstances[k]);
                    }
                }
            }

            this._sortLights(this);
            this._dirtyLights = false;
            
            for(i=0; i<len; i++) {
                layer = this.layerList[i];
                this._sortLights(layer);
                layer._dirtyLights = false;
            }

            // TODO: make dirty when changing layer.enabled on/off
            this._globalLightCameras.length = 0;
            for(var l=0; l<this._globalLights.length; l++) {
                light = this._globalLights[l];
                this._globalLightCameras[l] = [];
                for(i=0; i<len; i++) {
                    layer = this.layerList[i];
                    if (layer._globalLights.indexOf(light) < 0) continue;
                    for(k=0; k<layer.cameras.length; k++) {
                        if (this._globalLightCameras[l].indexOf(layer.cameras[k]) >= 0) continue;
                        this._globalLightCameras[l].push(layer.cameras[k]);
                    }
                }
            }
        }

        if (this._dirtyCameras) {
            result |= 4;
            this.renderListSubLayerId.length = 0;
            this.renderListSubLayerCameraId.length = 0;
            var hash, hash2, groupLength, cam;
            var skipCount = 0;

            for(i=0; i<len; i++) {
                if (skipCount) {
                    skipCount--;
                    continue;
                }

                layer = this.layerList[i];
                if (layer.cameras.length === 0) continue;
                hash = layer._cameraHash;
                if (hash === 0) { // single camera in layer
                    this.renderListSubLayerId.push(i);
                    this.renderListSubLayerCameraId.push(0);

                } else { // multiple cameras in a layer
                    groupLength = 1; // check if there is a sequence of sublayers with same cameras
                    for(j=i+1; j<len; j++) {
                        hash2 = this.layerList[j]._cameraHash;
                        if (hash !== hash2 || j === len - 1) {
                            groupLength = j - i;
                            break;
                        }
                    }
                    if (groupLength === 1) { // not a sequence, but multiple cameras
                        for(cam=0; cam<layer.cameras.length; cam++) {
                            this.renderListSubLayerId.push(i);
                            this.renderListSubLayerCameraId.push(cam);
                        }

                    } else { // sequence of groupLength
                        // add a whole sequence for each camera
                        cam = 0;
                        for(cam=0; cam<layer.cameras.length; cam++) {
                            for(j=0; j<=groupLength; j++) {
                                this.renderListSubLayerId.push(j);
                                this.renderListSubLayerCameraId.push(cam);
                            }
                        }
                        // skip the sequence sublayers (can't just modify i in JS)
                        skipCount = groupLength;
                    }
                }
            }

            this._dirtyCameras = false;
            for(i=0; i<len; i++) {
                this.layerList[i]._dirtyCameras = false;
            }
        }

        return result;
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
        partialSort: partialSort
    };
}());
