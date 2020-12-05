import { http } from '../net/http.js';

import { PIXELFORMAT_R8_G8_B8_A8 } from '../graphics/graphics.js';
import { Texture } from '../graphics/texture.js';

import { AssetReference } from '../asset/asset-reference.js';
import { ShaderGraphNode } from '../scene/materials/shader-graph-node.js';

/**
 * @class
 * @name pc.ShaderGraphHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler used for loading {@link pc.Material} resources.
 * @param {pc.Application} app - The running {@link pc.Application}.
 */
function ShaderGraphHandler(app) {
    this._assets = app.assets;
    this._device = app.graphicsDevice;

    // if no core nodes specified at this point we load defaults
    if (app.shaderNodes._list.length === 0) {
        // NB location of default core nodes as yet to be finalized
        app.assets.loadFromUrl("../examples/assets/core_nodes.json", "text", function (err, asset) {
            var coreNodeList = asset.resource;
            // register loaded core nodes
            app.shaderNodes.register(coreNodeList);
        });
    }

    this._coreNodes = app.shaderNodes._nodes;

    this._placeholderTextures = null;

    this.retryRequests = false;
}

Object.assign(ShaderGraphHandler.prototype, {
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
                    callback("Error loading shadergraph: " + url.original + " [" + err + "]");
                }
            }
        });
    },

    open: function (url, data) {

        var shadergraph = new ShaderGraphNode();
        this._initialize(shadergraph, data);

        // temp storage for engine-only as we need this during patching
        if (data._engine) {
            shadergraph._data = data;
            delete data._engine;
        }

        return shadergraph;
    },

    // creates placeholders for textures
    // that are used while texture is loading
    _createPlaceholders: function () {
        this._placeholderTextures = {};

        var textures = {
            white: [255, 255, 255, 255],
            gray: [128, 128, 128, 255],
            black: [0, 0, 0, 255],
            normal: [128, 128, 255, 255]
        };

        for (var key in textures) {
            if (!textures.hasOwnProperty(key))
                continue;

            // create texture
            this._placeholderTextures[key] = new Texture(this._device, {
                width: 2,
                height: 2,
                format: PIXELFORMAT_R8_G8_B8_A8
            });
            this._placeholderTextures[key].name = 'placeholder';

            // fill pixels with color
            var pixels = this._placeholderTextures[key].lock();
            for (var i = 0; i < 4; i++) {
                for (var c = 0; c < 4; c++) {
                    pixels[i * 4 + c] = textures[key][c];
                }
            }
            this._placeholderTextures[key].unlock();
        }
    },

    patch: function (asset, assets) {
        // in an engine-only environment we manually copy the source data into the asset
        if (asset.resource._data) {
            asset._data = asset.resource._data; // use _data to avoid firing events
            delete asset.resource._data; // remove from temp storage
        }

        // patch the name of the asset over the shadergraph name property
        asset.data.name = asset.name;
        asset.resource.name = asset.name;

        this._bindAndAssignAssets(asset, assets);

        asset.off('unload', this._onAssetUnload, this);
        asset.on('unload', this._onAssetUnload, this);
    },

    _onAssetUnload: function (asset) {
        // remove the parameter block we created which includes texture references
        delete asset.data.parameters;
        delete asset.data.chunks;
        delete asset.data.name;
    },

    _assignTexture: function (ioPortIndex, shadergraphAsset, resource) {
        shadergraphAsset.data.graphData.ioPorts[ioPortIndex].valueTex = resource;
        shadergraphAsset.resource.graphData.ioPorts[ioPortIndex].valueTex = resource;
    },

    _assignSubGraph: function (subGraphIndex, shadergraphAsset, resource) {
        shadergraphAsset.data.graphData.subGraphs[subGraphIndex].graph = resource;
        shadergraphAsset.resource.graphData.subGraphs[subGraphIndex].graph = resource;
    },

    // assign a placeholder texture while waiting for one to load
    // placeholder textures do not replace the data[parameterName] value
    // in the asset.data thus preserving the final asset id until it is loaded
    _assignPlaceholderTexture: function (i, shadergraphAsset) {
        // create placeholder textures on-demand
        if (!this._placeholderTextures) {
            this._createPlaceholders();
        }

        shadergraphAsset.resource.graphData.ioPorts[i].valueTex = this._placeholderTextures.gray;
    },

    _onIoPortTexLoad: function (i, shadergraphAsset, textureAsset) {
        this._assignTexture(i, shadergraphAsset, textureAsset.resource);
        this._initialize(shadergraphAsset.resource, shadergraphAsset.data);
    },

    _onIoPortTexAdd: function (i, shadergraphAsset, textureAsset) {
        this._assets.load(textureAsset);
    },

    _onIoPortTexRemove: function (i, shadergraphAsset, textureAsset) {
        var material = shadergraphAsset.resource;

        if (material.graphData.ioPorts[i].valueTex === textureAsset.resource) {
            this._assignTexture(i, shadergraphAsset, null);
            this._initialize(shadergraphAsset.resource, shadergraphAsset.data);
        }
    },

    _onSubGraphLoad: function (i, shadergraphAsset, subGraphAsset) {
        this._assignSubGraph(i, shadergraphAsset, subGraphAsset.resource);
        this._initialize(shadergraphAsset.resource, shadergraphAsset.data);
    },

    _onSubGraphAdd: function (i, shadergraphAsset, subGraphAsset) {
        this._assets.load(subGraphAsset);
    },

    _onSubGraphRemove: function (i, shadergraphAsset, subGraphAsset) {
        var material = shadergraphAsset.resource;

        if (material.graphData.subGraphs[i] === subGraphAsset.resource) {
            this._assignSubGraph(i, shadergraphAsset, null);
            this._parser.initialize(shadergraphAsset.resource, shadergraphAsset.data);
        }
    },

    _initialize: function (shadergraph, data) {
        var i = 0;
        var varType;
        // input or output or constant variables - all node shadergraph types have this block
        if (data.graphData.ioPorts) {
            for (i = 0; i < Object.keys(data.graphData.ioPorts).length; i++) {
                if (data.graphData.ioPorts[i].type === 'sampler2D' && data.graphData.ioPorts[i].valueTex) {
                    if (typeof(data.graphData.ioPorts[i].valueTex) === 'number' && data.graphData.ioPorts[i].valueTex > 0) {
                        // texture asset not loaded yet - deal with in shadergraph patcher
                    } else {
                        // texture asset loaded - assign
                        shadergraph.graphData.ioPorts[i] = {};
                        Object.assign(shadergraph.graphData.ioPorts[i], data.graphData.ioPorts[i]);
                    }
                } else {
                    // assign directly - we (probably) don't need to convert to Vec2/3/4 objects?
                    shadergraph.graphData.ioPorts[i] = {};
                    Object.assign(shadergraph.graphData.ioPorts[i], data.graphData.ioPorts[i]);

                    // deal with 0 being undefined if default or optional
                    varType = shadergraph.graphData.ioPorts[i].type;
                    if (shadergraph.graphData.ioPorts[i].valueW === undefined && varType === 'vec4') shadergraph.graphData.ioPorts[i].valueW = 0;
                    if (shadergraph.graphData.ioPorts[i].valueZ === undefined && (varType === 'vec4' || varType === 'vec3' )) shadergraph.graphData.ioPorts[i].valueZ = 0;
                    if (shadergraph.graphData.ioPorts[i].valueY === undefined && (varType === 'vec4' || varType === 'vec3' || varType === 'vec2' )) shadergraph.graphData.ioPorts[i].valueY = 0;
                    if (shadergraph.graphData.ioPorts[i].valueX === undefined && (varType === 'vec4' || varType === 'vec3' || varType === 'vec2' || varType === 'float' )) shadergraph.graphData.ioPorts[i].valueX = 0;
                }
            }
        }

        if (data.graphData.subGraphs) {
            // graph node shadergraph
            if (data.graphData.connections) {
                // sub graph connections - only graph node materials have this
                shadergraph.graphData.connections = [];

                for (i = 0; i < Object.keys(data.graphData.connections).length; i++) {
                    // connections are indices and names - no asset refs - so just assign
                    shadergraph.graphData.connections[i] = {};
                    Object.assign(shadergraph.graphData.connections[i], data.graphData.connections[i]);
                }
            }

            if (data.graphData.subGraphs) {
                if (shadergraph.graphData.subGraphs.length != Object.keys(data.graphData.subGraphs).length) {
                    shadergraph.graphData.subGraphs.length = Object.keys(data.graphData.subGraphs).length;
                }
                // if there is a name, then it is a core node
                for (i = 0; i < Object.keys(data.graphData.subGraphs).length; i++) {
                    if (data.graphData.subGraphs[i].name && this._coreNodes[data.graphData.subGraphs[i].name]) {
                        // name matches core node - so use core code
                        shadergraph.graphData.subGraphs[i].name = data.graphData.subGraphs[i].name;
                        shadergraph.graphData.subGraphs[i].graph = this._coreNodes[shadergraph.graphData.subGraphs[i].name];
                    } else {
                        // NB. NOT SUPPORTED IN MVP
                        // name does not match core node - so use sub graph asset
                        shadergraph.graphData.subGraphs[i].name = data.graphData.subGraphs[i].name;
                        if (typeof(data.graphData.subGraphs[i].graph) === 'number' && data.graphData.subGraphs[i].graph > 0) {
                            // this means sub graph asset is not loaded yet - handle in shadergraph patching
                        } else {
                            shadergraph.graphData.subGraphs[i].graph = data.graphData.subGraphs[i].graph;
                        }
                    }
                }
            }
        }
    },

    _bindAndAssignAssets: function (shadergraphAsset, assets) {
        var i;
        // always migrate before updating shadergraph from asset data
        var data = this._parser.migrate(shadergraphAsset.data);

        var shadergraph = shadergraphAsset.resource;

        var pathMapping = (data.mappingFormat === "path");

        var assetReference;

        // deal with textures (which are only in the ioPorts block)
        if (data.graphData.ioPorts) {
            for (i = 0; i < Object.keys(data.graphData.ioPorts).length; i++) {
                if (data.graphData.ioPorts[i].type === 'sampler2D' && data.graphData.ioPorts[i].valueTex) {
                    assetReference = shadergraph._ioPortAssetReferences[i];

                    if (!(data.graphData.ioPorts[i].valueTex instanceof Texture)) {
                        if (!assetReference) {
                            assetReference = new AssetReference(i, shadergraphAsset, assets, {
                                load: this._onIoPortTexLoad,
                                add: this._onIoPortTexAdd,
                                remove: this._onIoPortTexRemove
                            }, this);

                            shadergraph._ioPortAssetReferences[i] = assetReference;
                        }

                        if (pathMapping) {
                            // texture paths are measured from the shadergraph directory
                            assetReference.url = shadergraphAsset.getAbsoluteUrl(data.ioPorts[i].valueTex);
                        } else {
                            assetReference.id = data.graphData.ioPorts[i].valueTex;
                        }

                        if (assetReference.asset) {
                            if (assetReference.asset.resource) {
                                // asset is already loaded
                                shadergraph.graphData.ioPorts[i] = {};
                                Object.assign(shadergraph.graphData.ioPorts[i], data.graphData.ioPorts[i]);
                                this._assignTexture(i, shadergraphAsset, assetReference.asset.resource);
                            } else {
                                // assign placeholder texture
                                shadergraph.graphData.ioPorts[i] = {};
                                Object.assign(shadergraph.graphData.ioPorts[i], data.graphData.ioPorts[i]);
                                this._assignPlaceholderTexture(i, shadergraphAsset);
                            }

                            assets.load(assetReference.asset);
                        }
                    }
                }
            }
        }

        // deal with sub graphs
        if (data.graphData.subGraphs) {
            for (i = 0; i < Object.keys(data.graphData.subGraphs).length; i++) {
                if (data.graphData.subGraphs[i].graph) {
                    assetReference = shadergraph._subGraphAssetReferences[i];

                    if (!(data.graphData.subGraphs[i].graph instanceof ShaderGraphNode)) {
                        if (!assetReference) {
                            assetReference = new AssetReference(i, shadergraphAsset, assets, {
                                load: this._onSubGraphLoad,
                                add: this._onSubGraphAdd,
                                remove: this._onSubGraphRemove
                            }, this);

                            shadergraph._subGraphAssetReferences[i] = assetReference;
                        }

                        if (pathMapping) {
                            // texture paths are measured from the shadergraph directory
                            assetReference.url = shadergraphAsset.getAbsoluteUrl(data.graphData.subGraphs[i].graph);
                        } else {
                            assetReference.id = data.graphData.subGraphs[i].graph;
                        }

                        if (assetReference.asset) {
                            if (assetReference.asset.resource) {
                                // asset is already loaded
                                this._assignSubGraph(i, shadergraphAsset, assetReference.asset.resource);
                            } else {
                                // assign placeholder texture
                                // this._assignPlaceholderSubGraph(i, shadergraphAsset);
                            }

                            assets.load(assetReference.asset);
                        }
                    }
                }
            }
        }

        // call to re-initialize shadergraph after more asset resources assigned
        this._parser.initialize(shadergraph, data);
    }
});

export { ShaderGraphHandler };
