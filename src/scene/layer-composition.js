import { EventHandler } from '../core/event-handler.js';

import {
    BLEND_NONE,
    COMPUPDATED_BLEND, COMPUPDATED_CAMERAS, COMPUPDATED_INSTANCES, COMPUPDATED_LIGHTS,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_POINT, LIGHTTYPE_SPOT
} from './constants.js';

/**
 * @class
 * @name pc.LayerComposition
 * @augments pc.EventHandler
 * @classdesc Layer Composition is a collection of {@link pc.Layer} that is fed to {@link pc.Scene#layers} to define rendering order.
 * @description Create a new layer composition.
 * @property {pc.Layer[]} layerList A read-only array of {@link pc.Layer} sorted in the order they will be rendered.
 * @property {boolean[]} subLayerList A read-only array of boolean values, matching {@link pc.Layer#layerList}.
 * True means only semi-transparent objects are rendered, and false means opaque.
 * @property {boolean[]} subLayerEnabled A read-only array of boolean values, matching {@link pc.Layer#layerList}.
 * True means the layer is rendered, false means it's skipped.
 * @property {pc.CameraComponent[]} cameras A read-only array of {@link pc.CameraComponent} that can be used during rendering, e.g. Inside
 * {@link pc.Layer#onPreCull}, {@link pc.Layer#onPostCull}, {@link pc.Layer#onPreRender}, {@link pc.Layer#onPostRender}.
 */
// Composition can hold only 2 sublayers of each layer
function LayerComposition() {
    EventHandler.call(this);

    // all layers added into the composition
    this.layerList = [];

    this.subLayerList = [];
    this.subLayerEnabled = []; // more granular control on top of layer.enabled (ANDed)
    this._opaqueOrder = {};
    this._transparentOrder = {};

    this._dirty = false;
    this._dirtyBlend = false;
    this._dirtyLights = false;
    this._dirtyCameras = false;

    // all unique meshInstances from all layers, stored both as an array, and also a set for fast search
    this._meshInstances = [];
    this._meshInstancesSet = new Set();

    // all unique lights from all layers, stored both as an array, and also map for fast search (key is light, values is its index in _lights array)
    this._lights = [];
    this._lightsMap = new Map();

    // each light in _lights has entry here at the same index, storing an array and also a set of shadow casters for it
    this._lightShadowCasters = [];
    this._lightShadowCastersSets = [];

    // _lights split into arrays per type of light, indexed by LIGHTTYPE_*** constants
    this._splitLights = [[], [], []];

    // for each directional light (in _splitLights[LIGHTTYPE_DIRECTIONAL]), this stores array of unique cameras that are on the same layer as the light
    this._globalLightCameras = [];

    // array of unique cameras from all layers
    this.cameras = [];


    this._globalLightCameraIds = []; // array mapping _globalLights to camera ids in composition
    this._renderedRt = [];
    this._renderedByCam = [];
    this._renderedLayer = [];

    // generated automatically - actual rendering sequence
    // can differ from layerList/subLayer list in case of multiple cameras on one layer
    // identical otherwise
    this._renderList = []; // index to layerList/subLayerList
    this._renderListCamera = []; // index to layer.cameras
}
LayerComposition.prototype = Object.create(EventHandler.prototype);
LayerComposition.prototype.constructor = LayerComposition;

// function which splits list of lights on a a target object into separate lists of lights based on light type
LayerComposition.prototype._splitLightsArray = function (target) {
    var light;
    var lights = target._lights;
    target._splitLights[LIGHTTYPE_DIRECTIONAL].length = 0;
    target._splitLights[LIGHTTYPE_POINT].length = 0;
    target._splitLights[LIGHTTYPE_SPOT].length = 0;

    for (var i = 0; i < lights.length; i++) {
        light = lights[i];
        if (light.enabled) {
            target._splitLights[light._type].push(light);
        }
    }
};

LayerComposition.prototype._update = function () {
    var i, j, k, l;
    var layer;
    var len = this.layerList.length;
    var result = 0;

    // if composition dirty flags are not set, test if layers are marked dirty
    if (!this._dirty || !this._dirtyLights || !this._dirtyCameras) {
        for (i = 0; i < len; i++) {
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

    // function adds unique meshInstances from src array into destArray. A destSet is a Set containing already
    // existing meshInstances  to accelerate the removal of duplicates
    // returns true if any of the materials on these meshInstances has _dirtyBlend set
    function addUniqueMeshInstance(destArray, destSet, srcArray) {
        var meshInst, material, dirtyBlend = false;
        var srcLen = srcArray.length;
        for (var s = 0; s < srcLen; s++) {
            meshInst = srcArray[s];

            if (!destSet.has(meshInst)) {
                destSet.add(meshInst);
                destArray.push(meshInst);

                material = meshInst.material;
                if (material && material._dirtyBlend) {
                    dirtyBlend = true;
                    material._dirtyBlend = false;
                }
            }
        }
        return dirtyBlend;
    }

    // rebuild this._meshInstances array - add all unique meshInstances from all layers to it
    // also set this._dirtyBlend to true if material of any meshInstance has _dirtyBlend set, and clear those flags on materials
    if (this._dirty) {
        result |= COMPUPDATED_INSTANCES;
        this._meshInstances.length = 0;
        this._meshInstancesSet.clear();
        var dirtyBlend1, dirtyBlend2;

        for (i = 0; i < len; i++) {
            layer = this.layerList[i];
            if (!layer.passThrough) {

                // add meshInstances from both opaque and transparent lists
                dirtyBlend1 = addUniqueMeshInstance(this._meshInstances, this._meshInstancesSet, layer.opaqueMeshInstances);
                dirtyBlend2 = addUniqueMeshInstance(this._meshInstances, this._meshInstancesSet, layer.transparentMeshInstances);
                this._dirtyBlend = dirtyBlend1 || dirtyBlend2;
            }

            layer._dirty = false;
            layer._version++;
        }

        this._dirty = false;
    }

    // funtion moves transparent or opaque meshes based on moveTransparent from src to dest array
    function moveByBlendType(dest, src, moveTransparent) {
        var material, isTransparent;
        for (var s = 0; s < src.length; ) {

            material = src[s].material;
            isTransparent = material && material.blendType !== BLEND_NONE;

            if (isTransparent === moveTransparent) {

                // add it to dest
                dest.push(src[s]);

                // remove it from src
                src[s] = src[src.length - 1];
                src.length--;

            } else {

                // just skip it
                s++;
            }
        }
    }

    // for each layer, split its meshInstances to either opaque or transparent array based on material blend type
    if (this._dirtyBlend) {
        result |= COMPUPDATED_BLEND;

        for (i = 0; i < len; i++) {
            layer = this.layerList[i];
            if (!layer.passThrough) {

                // move any opaque meshInstances from transparentMeshInstances to opaqueMeshInstances
                moveByBlendType(layer.opaqueMeshInstances, layer.transparentMeshInstances, false);

                // move any transparent meshInstances from opaqueMeshInstances to transparentMeshInstances
                moveByBlendType(layer.transparentMeshInstances, layer.opaqueMeshInstances, true);
            }
        }
        this._dirtyBlend = false;
    }

    var light, lights;
    if (this._dirtyLights) {
        result |= COMPUPDATED_LIGHTS;

        // build a list and map of all unique lights from all layers
        this._lights.length = 0;
        this._lightsMap.clear();

        // create a list of all unique lights from all layers
        for (i = 0; i < len; i++) {
            layer = this.layerList[i];
            lights = layer._lights;
            for (j = 0; j < lights.length; j++) {
                light = lights[j];

                // add new light
                if (!this._lightsMap.has(light)) {

                    this._lightsMap.set(light, this._lights.length);
                    this._lights.push(light);
                }
            }
        }

        // adjust _lightShadowCasters to the right size, matching number of lights, and clean it up (minimize allocations)
        var lightCount = this._lights.length;
        this._lightShadowCasters.length = lightCount;
        this._lightShadowCastersSets.length = lightCount;
        for (i = 0; i < lightCount; i++) {

            // clear array
            if (this._lightShadowCasters[i]) {
                this._lightShadowCasters[i].length = 0;
            } else {
                this._lightShadowCasters[i] = [];
            }

            // clear set
            if (this._lightShadowCastersSets[i]) {
                this._lightShadowCastersSets[i].clear();
            } else {
                this._lightShadowCastersSets[i] = new Set();
            }
        }

        // split global lights list by type
        this._splitLightsArray(this);
        this._dirtyLights = false;

        // split layer lights lists by type
        for (i = 0; i < len; i++) {
            layer = this.layerList[i];
            this._splitLightsArray(layer);
            layer._dirtyLights = false;
        }
    }

    // if meshes OR lights changed, rebuild shadow casters
    var casters, castersSet;
    var meshInstances, meshInstance;
    var lightIndex;
    if (result) {

        // start with empty shadow casters
        for (i = 0; i < this._lightShadowCasters.length; i++) {
            this._lightShadowCasters[i].length = 0;
            this._lightShadowCastersSets[i].clear();
        }

        // for each layer
        for (i = 0; i < len; i++) {
            layer = this.layerList[i];
            lights = layer._lights;

            // for each light of a layer
            for (j = 0; j < lights.length; j++) {

                // find its index in global light list, and get shadow casters for it
                lightIndex = this._lightsMap.get(lights[j]);
                casters = this._lightShadowCasters[lightIndex];
                castersSet = this._lightShadowCastersSets[lightIndex];

                // add unique meshes from the layer to casters
                meshInstances = layer.shadowCasters;
                for (k = 0; k < meshInstances.length; k++) {

                    meshInstance = meshInstances[k];

                    if (!castersSet.has(meshInstance)) {
                        castersSet.add(meshInstance);
                        casters.push(meshInstance);
                    }
                }
            }
        }
    }

    // rebuild _globalLightCameras - list of cameras for each directional light
    if ((result & COMPUPDATED_LIGHTS) || this._dirtyCameras) {

        // TODO: make dirty when changing layer.enabled on/off
        this._globalLightCameras.length = 0;
        var globalLights = this._splitLights[LIGHTTYPE_DIRECTIONAL];

        for (l = 0; l < globalLights.length; l++) {
            light = globalLights[l];
            this._globalLightCameras[l] = [];

            for (i = 0; i < len; i++) {
                layer = this.layerList[i];
                if (layer._splitLights[LIGHTTYPE_DIRECTIONAL].indexOf(light) >= 0) {

                    for (k = 0; k < layer.cameras.length; k++) {
                        if (this._globalLightCameras[l].indexOf(layer.cameras[k]) < 0) {
                            this._globalLightCameras[l].push(layer.cameras[k]);
                        }
                    }
                }
            }
        }
    }

    var camera, index;
    if (this._dirtyCameras) {
        result |= COMPUPDATED_CAMERAS;

        // build array of unique cameras from all layers
        this.cameras.length = 0;
        for (i = 0; i < len; i++) {
            layer = this.layerList[i];
            for (j = 0; j < layer.cameras.length; j++) {
                camera = layer.cameras[j];
                index = this.cameras.indexOf(camera);
                if (index < 0) {
                    index = this.cameras.length;
                    this.cameras.push(camera);
                }
            }
        }

        this._renderList.length = 0;
        this._renderListCamera.length = 0;
        var hash, hash2, groupLength, cam;
        var skipCount = 0;

        for (i = 0; i < len; i++) {
            if (skipCount) {
                skipCount--;
                continue;
            }

            layer = this.layerList[i];
            if (layer.cameras.length === 0 && !layer.isPostEffect) continue;
            hash = layer._cameraHash;
            if (hash === 0) { // single camera in layer
                this._renderList.push(i);
                this._renderListCamera.push(0);

            } else { // multiple cameras in a layer
                groupLength = 1; // check if there is a sequence of sublayers with same cameras
                for (j = i + 1; j < len; j++) {
                    hash2 = this.layerList[j]._cameraHash;
                    if (hash !== hash2) {
                        groupLength = (j - i) - 1;
                        break;
                    } else if (j === len - 1) {
                        groupLength = j - i;
                    }
                }
                if (groupLength === 1) { // not a sequence, but multiple cameras
                    for (cam = 0; cam < layer.cameras.length; cam++) {
                        this._renderList.push(i);
                        this._renderListCamera.push(cam);
                    }

                } else { // sequence of groupLength
                    // add a whole sequence for each camera
                    cam = 0;
                    for (cam = 0; cam < layer.cameras.length; cam++) {
                        for (j = 0; j <= groupLength; j++) {
                            this._renderList.push(i + j);
                            this._renderListCamera.push(cam);
                        }
                    }
                    // skip the sequence sublayers (can't just modify i in JS)
                    skipCount = groupLength;
                }
            }
        }

        this._dirtyCameras = false;
        for (i = 0; i < len; i++) {
            this.layerList[i]._dirtyCameras = false;
        }
    }

    var arr;
    if ((result & COMPUPDATED_LIGHTS) || (result & COMPUPDATED_CAMERAS)) {
        // cameras/lights changed
        this._globalLightCameraIds.length = 0;
        for (l = 0; l < this._globalLightCameras.length; l++) {
            arr = [];
            for (i = 0; i < this._globalLightCameras[l].length; i++) {
                index = this.cameras.indexOf( this._globalLightCameras[l][i] );
                if (index < 0) {
                    // #ifdef DEBUG
                    console.warn("Can't find _globalLightCameras[l][i] in cameras");
                    // #endif
                    continue;
                }
                arr.push(index);
            }
            this._globalLightCameraIds.push(arr);
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

LayerComposition.prototype._isSublayerAdded = function (layer, transparent) {
    for (var i = 0; i < this.layerList.length; i++) {
        if (this.layerList[i] === layer && this.subLayerList[i] === transparent) {
            // #ifdef DEBUG
            console.error("Sublayer is already added.");
            // #endif
            return true;
        }
    }
    return false;
};

// Whole layer API

/**
 * @function
 * @name pc.LayerComposition#push
 * @description Adds a layer (both opaque and semi-transparent parts) to the end of the {@link pc.Layer#layerList}.
 * @param {pc.Layer} layer - A {@link pc.Layer} to add.
 */
LayerComposition.prototype.push = function (layer) {
    // add both opaque and transparent to the end of the array
    if (this._isLayerAdded(layer)) return;
    this.layerList.push(layer);
    this.layerList.push(layer);
    this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
    this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
    this.subLayerEnabled.push(true);
    this.subLayerEnabled.push(true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire("add", layer);
};

/**
 * @function
 * @name pc.LayerComposition#insert
 * @description Inserts a layer (both opaque and semi-transparent parts) at the chosen index in the {@link pc.Layer#layerList}.
 * @param {pc.Layer} layer - A {@link pc.Layer} to add.
 * @param {number} index - Insertion position.
 */
LayerComposition.prototype.insert = function (layer, index) {
    // insert both opaque and transparent at the index
    if (this._isLayerAdded(layer)) return;
    this.layerList.splice(index, 0,    layer,  layer);
    this.subLayerList.splice(index, 0, false,  true);

    var count = this.layerList.length;
    this._updateOpaqueOrder(index, count - 1);
    this._updateTransparentOrder(index, count - 1);
    this.subLayerEnabled.splice(index, 0, true,  true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire("add", layer);
};

/**
 * @function
 * @name pc.LayerComposition#remove
 * @description Removes a layer (both opaque and semi-transparent parts) from {@link pc.Layer#layerList}.
 * @param {pc.Layer} layer - A {@link pc.Layer} to remove.
 */
LayerComposition.prototype.remove = function (layer) {
    // remove all occurrences of a layer
    var id = this.layerList.indexOf(layer);

    delete this._opaqueOrder[id];
    delete this._transparentOrder[id];

    while (id >= 0) {
        this.layerList.splice(id, 1);
        this.subLayerList.splice(id, 1);
        this.subLayerEnabled.splice(id, 1);
        id = this.layerList.indexOf(layer);
        this._dirty = true;
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire("remove", layer);
    }

    // update both orders
    var count = this.layerList.length;
    this._updateOpaqueOrder(0, count - 1);
    this._updateTransparentOrder(0, count - 1);
};

// Sublayer API

/**
 * @function
 * @name pc.LayerComposition#pushOpaque
 * @description Adds part of the layer with opaque (non semi-transparent) objects to the end of the {@link pc.Layer#layerList}.
 * @param {pc.Layer} layer - A {@link pc.Layer} to add.
 */
LayerComposition.prototype.pushOpaque = function (layer) {
    // add opaque to the end of the array
    if (this._isSublayerAdded(layer, false)) return;
    this.layerList.push(layer);
    this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
    this.subLayerEnabled.push(true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire("add", layer);
};

/**
 * @function
 * @name pc.LayerComposition#insertOpaque
 * @description Inserts an opaque part of the layer (non semi-transparent mesh instances) at the chosen index in the {@link pc.Layer#layerList}.
 * @param {pc.Layer} layer - A {@link pc.Layer} to add.
 * @param {number} index - Insertion position.
 */
LayerComposition.prototype.insertOpaque = function (layer, index) {
    // insert opaque at index
    if (this._isSublayerAdded(layer, false)) return;
    this.layerList.splice(index, 0,    layer);
    this.subLayerList.splice(index, 0, false);

    var count = this.subLayerList.length;
    this._updateOpaqueOrder(index, count - 1);

    this.subLayerEnabled.splice(index, 0, true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire("add", layer);
};

/**
 * @function
 * @name pc.LayerComposition#removeOpaque
 * @description Removes an opaque part of the layer (non semi-transparent mesh instances) from {@link pc.Layer#layerList}.
 * @param {pc.Layer} layer - A {@link pc.Layer} to remove.
 */
LayerComposition.prototype.removeOpaque = function (layer) {
    // remove opaque occurrences of a layer
    for (var i = 0, len = this.layerList.length; i < len; i++) {
        if (this.layerList[i] === layer && !this.subLayerList[i]) {
            this.layerList.splice(i, 1);
            this.subLayerList.splice(i, 1);

            len--;
            this._updateOpaqueOrder(i, len - 1);

            this.subLayerEnabled.splice(i, 1);
            this._dirty = true;
            this._dirtyLights = true;
            this._dirtyCameras = true;
            if (this.layerList.indexOf(layer) < 0) {
                this.fire("remove", layer); // no sublayers left
            }
            return;
        }
    }
};

/**
 * @function
 * @name pc.LayerComposition#pushTransparent
 * @description Adds part of the layer with semi-transparent objects to the end of the {@link pc.Layer#layerList}.
 * @param {pc.Layer} layer - A {@link pc.Layer} to add.
 */
LayerComposition.prototype.pushTransparent = function (layer) {
    // add transparent to the end of the array
    if (this._isSublayerAdded(layer, true)) return;
    this.layerList.push(layer);
    this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
    this.subLayerEnabled.push(true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire("add", layer);
};

/**
 * @function
 * @name pc.LayerComposition#insertTransparent
 * @description Inserts a semi-transparent part of the layer at the chosen index in the {@link pc.Layer#layerList}.
 * @param {pc.Layer} layer - A {@link pc.Layer} to add.
 * @param {number} index - Insertion position.
 */
LayerComposition.prototype.insertTransparent = function (layer, index) {
    // insert transparent at index
    if (this._isSublayerAdded(layer, true)) return;
    this.layerList.splice(index, 0,    layer);
    this.subLayerList.splice(index, 0, true);

    var count = this.subLayerList.length;
    this._updateTransparentOrder(index, count - 1);

    this.subLayerEnabled.splice(index, 0, true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire("add", layer);
};

/**
 * @function
 * @name pc.LayerComposition#removeTransparent
 * @description Removes a transparent part of the layer from {@link pc.Layer#layerList}.
 * @param {pc.Layer} layer - A {@link pc.Layer} to remove.
 */
LayerComposition.prototype.removeTransparent = function (layer) {
    // remove transparent occurrences of a layer
    for (var i = 0, len = this.layerList.length; i < len; i++) {
        if (this.layerList[i] === layer && this.subLayerList[i]) {
            this.layerList.splice(i, 1);
            this.subLayerList.splice(i, 1);

            len--;
            this._updateTransparentOrder(i, len - 1);

            this.subLayerEnabled.splice(i, 1);
            this._dirty = true;
            this._dirtyLights = true;
            this._dirtyCameras = true;
            if (this.layerList.indexOf(layer) < 0) {
                this.fire("remove", layer); // no sublayers left
            }
            return;
        }
    }
};

LayerComposition.prototype._getSublayerIndex = function (layer, transparent) {
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

/**
 * @function
 * @name pc.LayerComposition#getOpaqueIndex
 * @description Gets index of the opaque part of the supplied layer in the {@link pc.Layer#layerList}.
 * @param {pc.Layer} layer - A {@link pc.Layer} to find index of.
 * @returns {number} The index of the opaque part of the specified layer.
 */
LayerComposition.prototype.getOpaqueIndex = function (layer) {
    return this._getSublayerIndex(layer, false);
};

/**
 * @function
 * @name pc.LayerComposition#getTransparentIndex
 * @description Gets index of the semi-transparent part of the supplied layer in the {@link pc.Layer#layerList}.
 * @param {pc.Layer} layer - A {@link pc.Layer} to find index of.
 * @returns {number} The index of the semi-transparent part of the specified layer.
 */
LayerComposition.prototype.getTransparentIndex = function (layer) {
    return this._getSublayerIndex(layer, true);
};

/**
 * @function
 * @name pc.LayerComposition#getLayerById
 * @description Finds a layer inside this composition by its ID. Null is returned, if nothing is found.
 * @param {number} id - An ID of the layer to find.
 * @returns {pc.Layer} The layer corresponding to the specified ID. Returns null if layer is not found.
 */
LayerComposition.prototype.getLayerById = function (id) {
    for (var i = 0; i < this.layerList.length; i++) {
        if (this.layerList[i].id === id) return this.layerList[i];
    }
    return null;
};

/**
 * @function
 * @name pc.LayerComposition#getLayerByName
 * @description Finds a layer inside this composition by its name. Null is returned, if nothing is found.
 * @param {string} name - The name of the layer to find.
 * @returns {pc.Layer} The layer corresponding to the specified name. Returns null if layer is not found.
 */
LayerComposition.prototype.getLayerByName = function (name) {
    for (var i = 0; i < this.layerList.length; i++) {
        if (this.layerList[i].name === name) return this.layerList[i];
    }
    return null;
};

LayerComposition.prototype._updateOpaqueOrder = function (startIndex, endIndex) {
    for (var i = startIndex; i <= endIndex; i++) {
        if (this.subLayerList[i] === false) {
            this._opaqueOrder[this.layerList[i].id] = i;
        }
    }
};

LayerComposition.prototype._updateTransparentOrder = function (startIndex, endIndex) {
    for (var i = startIndex; i <= endIndex; i++) {
        if (this.subLayerList[i] === true) {
            this._transparentOrder[this.layerList[i].id] = i;
        }
    }
};

// Used to determine which array of layers has any sublayer that is
// on top of all the sublayers in the other array. The order is a dictionary
// of <layerId, index>.
LayerComposition.prototype._sortLayersDescending = function (layersA, layersB, order) {
    var i = 0;
    var len = 0;
    var id = 0;
    var topLayerA = -1;
    var topLayerB = -1;

    // search for which layer is on top in layersA
    for (i = 0, len = layersA.length; i < len; i++) {
        id = layersA[i];
        if (order.hasOwnProperty(id)) {
            topLayerA = Math.max(topLayerA, order[id]);
        }
    }

    // search for which layer is on top in layersB
    for (i = 0, len = layersB.length; i < len; i++) {
        id = layersB[i];
        if (order.hasOwnProperty(id)) {
            topLayerB = Math.max(topLayerB, order[id]);
        }
    }

    // if the layers of layersA or layersB do not exist at all
    // in the composition then return early with the other.
    if (topLayerA === -1 && topLayerB !== -1) {
        return 1;
    } else if (topLayerB === -1 && topLayerA !== -1) {
        return -1;
    }

    // sort in descending order since we want
    // the higher order to be first
    return topLayerB - topLayerA;
};

/**
 * @function
 * @name pc.LayerComposition#sortTransparentLayers
 * @description Used to determine which array of layers has any transparent sublayer that is on top of all the transparent sublayers in the other array.
 * @param {number[]} layersA - IDs of layers.
 * @param {number[]} layersB - IDs of layers.
 * @returns {number} Returns a negative number if any of the transparent sublayers in layersA is on top of all the transparent sublayers in layersB,
 * or a positive number if any of the transparent sublayers in layersB is on top of all the transparent sublayers in layersA, or 0 otherwise.
 */
LayerComposition.prototype.sortTransparentLayers = function (layersA, layersB) {
    return this._sortLayersDescending(layersA, layersB, this._transparentOrder);
};

/**
 * @function
 * @name pc.LayerComposition#sortOpaqueLayers
 * @description Used to determine which array of layers has any opaque sublayer that is on top of all the opaque sublayers in the other array.
 * @param {number[]} layersA - IDs of layers.
 * @param {number[]} layersB - IDs of layers.
 * @returns {number} Returns a negative number if any of the opaque sublayers in layersA is on top of all the opaque sublayers in layersB,
 * or a positive number if any of the opaque sublayers in layersB is on top of all the opaque sublayers in layersA, or 0 otherwise.
 */
LayerComposition.prototype.sortOpaqueLayers = function (layersA, layersB) {
    return this._sortLayersDescending(layersA, layersB, this._opaqueOrder);
};

export { LayerComposition };
