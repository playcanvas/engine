pc.extend(pc, function () {

    var layerCounter = 0;
    var layerList = [];

    function getLayerById(id) {
        return layerList[id];
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
        this.cameras = options.cameras ? options.cameras : [];
        this.renderTarget = options.renderTarget;
        this.preRenderCallback = options.preRenderCallback;
        this.overrideCullMode = options.overrideCullMode;
        this.shaderPass = options.shaderPass === undefined ? pc.SHADER_FORWARD : options.shaderPass;

        this._opaqueMeshInstances = [];
        this._transparentMeshInstances = [];
    };

    Layer.prototype.addMeshInstances = function (meshInstances) {
        var m;
        for(var i=0; i<meshInstances.length; i++) {
            m = meshInstances[i];
            if (m.material.blendType === pc.BLEND_NONE) { // TODO: what happens, if blend changes at runtime? Should force resort
                this._opaqueMeshInstances.push(m);
            } else {
                this._transparentMeshInstances.push(m);
            }
        }
    };

    Layer.prototype.removeMeshInstances = function (meshInstances) {
        var m, arr, id;
        for(var i=0; i<meshInstances.length; i++) {
            m = meshInstances[i];
            arr = m.material.blendType === pc.BLEND_NONE ? this._opaqueMeshInstances : this._transparentMeshInstances;
            id = arr.indexOf(m);
            if (id >= 0) arr.splice(id, 1);
        }
    };

    // Composition can hold only 2 sublayers of each layer
    var LayerComposition = function () {
        this.layerList = [];
        this.subLayerList = [];
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
    };

    LayerComposition.prototype.removeLayer = function (layer) {
        // remove all occurences of a layer
        var id = this.layerList.indexOf(layer);
        while(id >= 0) {
            this.layerList.splice(id, 1);
            this.subLayerList.splice(id, 1);
            id = this.layerList.indexOf(layer);
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
    };

    LayerComposition.prototype.removeSublayerAt = function (index) {
        // remove sublayer in the composition array
        this.layerList.splice(index, 1);
        this.subLayerList.splice(index, 1);
    };

    return {
        Layer: Layer,
        LayerComposition: LayerComposition,
        getLayerById: getLayerById
    };
}());
