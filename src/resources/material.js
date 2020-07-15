import { http } from '../net/http.js';

import { StandardMaterialBinder } from './standard-material.js';
import { JsonStandardMaterialParser } from './parser/material/json-standard-material.js';

import { NodeMaterialBinder } from './node-material.js';
import { JsonNodeMaterialParser } from './parser/material/json-node-material.js';


/**
 * @class
 * @name pc.MaterialHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler used for loading {@link pc.Material} resources.
 * @param {pc.Application} app - The running {@link pc.Application}.
 */
function MaterialHandler(app) {
    this._assets = app.assets;
    this._device = app.graphicsDevice;

    this._placeholderTextures = null;
   
    this._binder = null;
    this._parser = null;
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

    _assignParserAndBinderBasedOnSubClass: function (data) {
        if (data.shaderGraph) //maybe there is a better way to tell if node material path should be taken?
        {
            this._parser = new JsonNodeMaterialParser();
            this._binder = new NodeMaterialBinder(this._assets, this._device, this._parser);
        }
        else
        {
            this._parser = new JsonStandardMaterialParser();
            this._binder = new StandardMaterialBinder(this._assets, this._device, this._parser);
        }
    },

    open: function (url, data) {
        if (!this._parser || !this._binder) 
        {
            this._assignParserAndBinderBasedOnSubClass(data);
        }

        var material = this._parser.parse(data);

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

        if (!this._parser || !this._binder) 
        {
            this._assignParserAndBinderBasedOnSubClass(asset.data);
        }        

        this._binder.bindAndAssignAssets(asset, assets);

        asset.off('unload', this._binder.onAssetUnload, this);
        asset.on('unload', this._binder.onAssetUnload, this);
    },

});

export { MaterialHandler };
