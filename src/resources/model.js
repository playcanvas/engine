import { path } from '../core/path.js';

import { http, Http } from '../net/http.js';

import { GlbModelParser } from './parser/glb-model.js';
import { JsonModelParser } from './parser/json-model.js';

/**
 * @class
 * @name pc.ModelHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler used for loading {@link pc.Model} resources.
 * @param {pc.GraphicsDevice} device - The graphics device that will be rendering.
 * @param {pc.StandardMaterial} defaultMaterial - The shared default material that is used in any place that a material is not specified.
 */
class ModelHandler {
    constructor(device, defaultMaterial) {
        this._device = device;
        this._parsers = [];
        this._defaultMaterial = defaultMaterial;
        this.maxRetries = 0;

        this.addParser(new JsonModelParser(this._device), function (url, data) {
            return (path.getExtension(url) === '.json');
        });
        this.addParser(new GlbModelParser(this._device), function (url, data) {
            return (path.getExtension(url) === '.glb');
        });
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // we need to specify JSON for blob URLs
        var options = {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };

        if (url.load.startsWith('blob:') || url.load.startsWith('data:')) {
            if (path.getExtension(url.original).toLowerCase() === '.glb') {
                options.responseType = Http.ResponseType.ARRAY_BUFFER;
            } else {
                options.responseType = Http.ResponseType.JSON;
            }
        }

        http.get(url.load, options, function (err, response) {
            if (!callback)
                return;

            if (!err) {
                callback(null, response);
            } else {
                callback("Error loading model: " + url.original + " [" + err + "]");
            }
        });
    }

    open(url, data) {
        for (var i = 0; i < this._parsers.length; i++) {
            var p = this._parsers[i];

            if (p.decider(url, data)) {
                return p.parser.parse(data);
            }
        }
        // #ifdef DEBUG
        console.warn("pc.ModelHandler#open: No model parser found for: " + url);
        // #endif
        return null;
    }

    patch(asset, assets) {
        if (!asset.resource)
            return;

        var data = asset.data;

        var self = this;
        asset.resource.meshInstances.forEach(function (meshInstance, i) {
            if (data.mapping) {
                var handleMaterial = function (asset) {
                    if (asset.resource) {
                        meshInstance.material = asset.resource;
                    } else {
                        asset.once('load', handleMaterial);
                        assets.load(asset);
                    }

                    asset.once('remove', function (asset) {
                        if (meshInstance.material === asset.resource) {
                            meshInstance.material = self._defaultMaterial;
                        }
                    });
                };

                if (!data.mapping[i]) {
                    meshInstance.material = self._defaultMaterial;
                    return;
                }

                var id = data.mapping[i].material;
                var url = data.mapping[i].path;
                var material;

                if (id !== undefined) { // id mapping
                    if (!id) {
                        meshInstance.material = self._defaultMaterial;
                    } else {
                        material = assets.get(id);
                        if (material) {
                            handleMaterial(material);
                        } else {
                            assets.once('add:' + id, handleMaterial);
                        }
                    }
                } else if (url) {
                    // url mapping
                    var path = asset.getAbsoluteUrl(data.mapping[i].path);
                    material = assets.getByUrl(path);

                    if (material) {
                        handleMaterial(material);
                    } else {
                        assets.once('add:url:' + path, handleMaterial);
                    }
                }
            }
        });
    }

    /**
     * @function
     * @name pc.ModelHandler#addParser
     * @description Add a parser that converts raw data into a {@link pc.Model}
     * Default parser is for JSON models.
     * @param {object} parser - See JsonModelParser for example.
     * @param {pc.callbacks.AddParser} decider - Function that decides on which parser to use.
     * Function should take (url, data) arguments and return true if this parser should be used to parse the data into a {@link pc.Model}.
     * The first parser to return true is used.
     */
    addParser(parser, decider) {
        this._parsers.push({
            parser: parser,
            decider: decider
        });
    }
}

export { ModelHandler };
