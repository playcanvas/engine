import { PIXELFORMAT_R8_G8_B8_A8 } from '../graphics/graphics.js';
import { Texture } from '../graphics/texture.js';

import { AssetReference } from '../asset/asset-reference.js';
import { NodeMaterial } from '../scene/materials/node-material.js';

/**
 * @class
 * @name pc.NodeMaterialBinder
 * @classdesc Resource binder used for binding {@link pc.NodeMaterial} resources.
 * @param {pc.Application} app - The running {@link pc.Application}.
 * @param {pc.JsonNodeMaterialParser} parser - JSON parser for {@link pc.NodeMaterial} owned by global {@link pc.MaterialHandler}
 */
function NodeMaterialBinder(app, parser) {
    this._assets = app.assets;
    this._device = app.graphicsDevice;
    this._parser = parser;

    this._placeholderGraph = null;
    this._placeholderGlsl = null;

    this._placeholderTextures = null;
}

Object.assign(NodeMaterialBinder.prototype, {

    // creates placeholders for textures and shader graph
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

        this._placeholderGraph = new NodeMaterial('vec4 v4_zero() { return vec4(0); }');

        this._placeholderGlsl = 'vec4 v4_zero() { return vec4(0); }';
    },

    onAssetUnload: function (asset) {
        // remove the parameter block we created which includes texture references
        // delete asset.data.parameters;
        // delete asset.data.chunks;
        // delete asset.data.name;
    },

    _assignTexture: function (iocVarIndex, materialAsset, resource) {
        materialAsset.data.graphData.iocVars[iocVarIndex].valueTex = resource;
        materialAsset.resource.graphData.iocVars[iocVarIndex].valueTex = resource;
    },

    _assignSubGraph: function (subGraphIndex, materialAsset, resource) {
        materialAsset.data.graphData.subGraphs[subGraphIndex] = resource;
        materialAsset.resource.graphData.subGraphs[subGraphIndex] = resource;
    },

    _assignGlsl: function (propertyName, materialAsset, resource) {
        materialAsset.data.graphData[propertyName] = resource;
        materialAsset.resource.graphData[propertyName] = resource;
    },

    // assign a placeholder texture and graph while waiting for one to load
    // placeholder textures and graph do not replace the data[parameterName] value
    // in the asset.data thus preserving the final asset id until it is loaded
    _assignPlaceholderTexture: function (iocVarIndex, materialAsset) {
        // create placeholders on-demand
        if (!this._placeholderTextures) {
            this._createPlaceholders();
        }

        var texture = this._placeholderTextures.white;

        materialAsset.resource.graphData.iocVars[iocVarIndex].valueTex = texture;
    },

    _assignPlaceholderSubGraph: function (subGraphIndex, materialAsset) {
        // create placeholders on-demand
        if (!this._placeholderGraph) {
            this._createPlaceholders();
        }

        var graph = this._placeholderGraph;

        materialAsset.resource.graphData.subGraphs[subGraphIndex] = graph;
    },

    _assignPlaceholderCustomGlsl: function (propertyName, materialAsset) {
        // create placeholders on-demand
        if (!this._placeholderGlsl) {
            this._createPlaceholders();
        }

        var glsl = this._placeholderGlsl;

        materialAsset.resource.graphData[propertyName] = glsl;
    },

    _onGlslLoad: function (parameterName, materialAsset, glslAsset) {
        this._assignGlsl(parameterName, materialAsset, glslAsset.resource);
        this._parser.initialize(materialAsset.resource, materialAsset.data);
    },

    _onGlslAdd: function (parameterName, materialAsset, glslAsset) {
        this._assets.load(glslAsset);
    },

    _onGlslRemove: function (parameterName, materialAsset, glslAsset) {
        var material = materialAsset.resource;

        if (material.graphData[parameterName] === glslAsset.resource) {
            this._assignGlsl(parameterName, materialAsset, null);
            this._parser.initialize(materialAsset.resource, materialAsset.data);
        }
    },

    _onIocVarTexLoad: function (i, materialAsset, textureAsset) {
        this._assignTexture(i, materialAsset, textureAsset.resource);
        this._parser.initialize(materialAsset.resource, materialAsset.data);
    },

    _onIocVarTexAdd: function (i, materialAsset, textureAsset) {
        this._assets.load(textureAsset);
    },

    _onIocVarTexRemove: function (i, materialAsset, textureAsset) {
        var material = materialAsset.resource;

        if (material.graphData.iocVars[i].valueTex === textureAsset.resource) {
            this._assignTexture(i, materialAsset, null);
            this._parser.initialize(materialAsset.resource, materialAsset.data);
        }
    },

    _onSubGraphLoad: function (i, materialAsset, subGraphAsset) {
        this._assignSubGraph(i, materialAsset, subGraphAsset.resource);
        this._parser.initialize(materialAsset.resource, materialAsset.data);
    },

    _onSubGraphAdd: function (i, materialAsset, subGraphAsset) {
        this._assets.load(subGraphAsset);
    },

    _onSubGraphRemove: function (i, materialAsset, subGraphAsset) {
        var material = materialAsset.resource;

        if (material.graphData.subGraphs[i] === subGraphAsset.resource) {
            this._assignSubGraph(i, materialAsset, null);
            this._parser.initialize(materialAsset.resource, materialAsset.data);
        }
    },

    bindAndAssignAssets: function (materialAsset, assets) {
        var i;
        // always migrate before updating material from asset data
        var data = this._parser.migrate(materialAsset.data);

        var material = materialAsset.resource;

        var pathMapping = (data.mappingFormat === "path");

        var assetReference;

        // deal with textures (which are only in the iocVars block)
        if (data.graphData.iocVars) {
            for (i = 0; i < Object.keys(data.graphData.iocVars).length; i++) {
                if (data.graphData.iocVars[i].type === 'sampler2D' && data.graphData.iocVars[i].valueTex) {
                    assetReference = material._iocVarAssetReferences[i];

                    if (!(data.graphData.iocVars[i].valueTex instanceof Texture)) {
                        if (!assetReference) {
                            assetReference = new AssetReference(i, materialAsset, assets, {
                                load: this._onIocVarTexLoad,
                                add: this._onIocVarTexAdd,
                                remove: this._onIocVarTexRemove
                            }, this);

                            material._iocVarAssetReferences[i] = assetReference;
                        }

                        if (pathMapping) {
                            // texture paths are measured from the material directory
                            assetReference.url = materialAsset.getAbsoluteUrl(data.iocVars[i].valueTex);
                        } else {
                            assetReference.id = data.graphData.iocVars[i].valueTex;
                        }

                        if (assetReference.asset) {
                            if (assetReference.asset.resource) {
                                // asset is already loaded
                                material.graphData.iocVars[i] = {};
                                Object.assign(material.graphData.iocVars[i], data.graphData.iocVars[i]);
                                this._assignTexture(i, materialAsset, assetReference.asset.resource);
                            } else {
                                // assign placeholder texture
                                material.graphData.iocVars[i] = {};
                                Object.assign(material.graphData.iocVars[i], data.graphData.iocVars[i]);
                                this._assignPlaceholderTexture(i, materialAsset);
                            }

                            assets.load(assetReference.asset);
                        }
                    }
                }
            }
        }

        // custom / built-in shaders
        var customGlslNames = ['customFuncGlsl', 'customDeclGlsl'];

        for (i = 0; i < customGlslNames.length; i++) {
            var name = customGlslNames[i];
            if (data.graphData[name]) {
                assetReference = material._glslAssetReferences[name];

                // if (!(data.graphData[name] instanceof String))
                if (typeof(data.graphData[name]) === 'number' && data.graphData[name] > 0) {
                    if (!assetReference) {
                        assetReference = new AssetReference(name, materialAsset, assets, {
                            load: this._onGlslLoad,
                            add: this._onGlslAdd,
                            remove: this._onGlslRemove
                        }, this);

                        material._glslAssetReferences[name] = assetReference;
                    }

                    if (pathMapping) {
                        // texture paths are measured from the material directory
                        assetReference.url = materialAsset.getAbsoluteUrl(data[name]);
                    } else {
                        assetReference.id = data.graphData[name];
                    }

                    if (assetReference.asset) {
                        if (assetReference.asset.resource) {
                            // asset is already loaded
                            this._assignGlsl(name, materialAsset, assetReference.asset.resource);
                        } else {
                            // assign placeholder glsl
                            // this._assignPlaceholderCustomGlsl(name, materialAsset);
                        }

                        assets.load(assetReference.asset);
                    }
                }
            }
        }

        // deal with sub graphs
        if (data.graphData.subGraphs) {
            for (i = 0; i < Object.keys(data.graphData.subGraphs).length; i++) {
                if (data.graphData.subGraphs[i]) {
                    assetReference = material._subGraphAssetReferences[i];

                    if (!(data.graphData.subGraphs[i] instanceof NodeMaterial)) {
                        if (!assetReference) {
                            assetReference = new AssetReference(i, materialAsset, assets, {
                                load: this._onSubGraphLoad,
                                add: this._onSubGraphAdd,
                                remove: this._onSubGraphRemove
                            }, this);

                            material._subGraphAssetReferences[i] = assetReference;
                        }

                        if (pathMapping) {
                            // texture paths are measured from the material directory
                            assetReference.url = materialAsset.getAbsoluteUrl(data.graphData.subGraphs[i]);
                        } else {
                            assetReference.id = data.graphData.subGraphs[i];
                        }

                        if (assetReference.asset) {
                            if (assetReference.asset.resource) {
                                // asset is already loaded
                                this._assignSubGraph(i, materialAsset, assetReference.asset.resource);
                            } else {
                                // assign placeholder texture
                                // this._assignPlaceholderSubGraph(i, materialAsset);
                            }

                            assets.load(assetReference.asset);
                        }
                    }
                }
            }
        }

        // call to re-initialize material after more asset resources assigned
        this._parser.initialize(material, data);
    }
});

export { NodeMaterialBinder };
