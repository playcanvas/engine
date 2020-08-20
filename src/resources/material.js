import { http } from '../net/http.js';

import { StandardMaterialBinder } from './standard-material.js';
import { JsonStandardMaterialParser } from './parser/material/json-standard-material.js';

import { NodeMaterialBinder } from './node-material.js';
import { JsonNodeMaterialParser } from './parser/material/json-node-material.js';

import { StandardMaterial } from '../scene/materials/standard-material.js';
import { NodeMaterial } from '../scene/materials/node-material.js';

/**
 * @class
 * @name pc.MaterialHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler used for loading {@link pc.Material} resources.
 * @param {pc.Application} app - The running {@link pc.Application}.
 */
function MaterialHandler(app) {
    this._app = app;
    this._assets = app.assets;
    this._device = app.graphicsDevice;

    this._parsers = {};
    this._binders = {};

    this.retryRequests = false;
}

Object.assign(MaterialHandler.prototype, {
    load: function (url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // Loading from URL (engine-only)
        http.get(url.load, {
            retry: this.retryRequests
        }, function (err, response) {
            if (!err) {
                if (callback) {
                    response._engine = true;
                    callback(null, response);
                }
            } else {
                if (callback) {
                    callback("Error loading material: " + url.original + " [" + err + "]");
                }
            }
        });
    },

    _getSubClass: function (data) {
        // maybe there is a better way to tell if node material path should be taken?
        var subclass = 'Standard';
        if (data.graphData) {
            subclass = 'Node';

            if (!this._parsers[subclass]) this._parsers[subclass] = new JsonNodeMaterialParser(this._device);
            if (!this._binders[subclass]) this._binders[subclass] = new NodeMaterialBinder(this._assets, this._device, this._parsers[subclass]);
        } else {
            if (!this._parsers[subclass]) this._parsers[subclass] = new JsonStandardMaterialParser();
            if (!this._binders[subclass]) this._binders[subclass] = new StandardMaterialBinder(this._assets, this._device, this._parsers[subclass]);

        }

        return subclass;
    },

    open: function (url, data) {

        var subclass = this._getSubClass(data);

        var material = this._parsers[subclass].parse(data);

        // temp storage for engine-only as we need this during patching
        if (data._engine) {
            material._data = data;
            delete data._engine;
        }

        return material;
    },

    patch: function (asset, assets) {

        // in an engine-only environment we manually copy the source data into the asset
        if (asset.resource._data) {
            asset._data = asset.resource._data; // use _data to avoid firing events
            delete asset.resource._data; // remove from temp storage
        }

        // patch the name of the asset over the material name property
        asset.data.name = asset.name;
        asset.resource.name = asset.name;

        var subclass = this._getSubClass(asset.data);

        // adjust name if node material
        if (subclass == 'Node') {
            asset.resource.name = asset.name.replace(/[^A-Z0-9]+/ig, "_");
        }

        // this should only happen in the editor?
        if (subclass == 'Node' && !(asset.resource instanceof NodeMaterial)) {
            if (asset.resource instanceof StandardMaterial) {
                // migrate from StandardMaterial
                asset.resource = this._parsers[subclass].parse(asset.data, true);
            } else {
                asset.resource = this._parsers[subclass].parse(asset.data);
            }
        } else if (subclass == 'Standard' && !(asset.resource instanceof StandardMaterial)) {
            asset.resource = this._parsers[subclass].parse(asset.data);
        }

        this._binders[subclass].bindAndAssignAssets(asset, assets);

        asset.off('unload', this._binders[subclass].onAssetUnload, this);
        asset.on('unload', this._binders[subclass].onAssetUnload, this);
    }

});

export { MaterialHandler };
