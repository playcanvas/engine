
import { PIXELFORMAT_R8_G8_B8_A8 } from '../graphics/graphics.js';
import { Texture } from '../graphics/texture.js';

import { AssetReference } from '../asset/asset-reference.js';
import { ShaderGraphNode } from '../scene/materials/shader-node.js';

/**
 * @class
 * @name pc.NodeMaterialBinder
 * @classdesc Resource binder used for binding {@link pc.NodeMaterial} resources.
 */
function NodeMaterialBinder(assets, device, parser) {
    this._assets = assets;
    this._device = device;
    this._parser = parser;

    this._placeholderGraph = null;

    this._placeholderTextures = null;
}

Object.assign(NodeMaterialHandler.prototype, {

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

        var rootNode = new ShaderGraphNode('void root(in vec4 rgba, in vec3 color, in float alpha, in vec3 vertexOffset){}');
        rootNode.color = new ShaderGraphNode('vec3 v3_pink() { return vec3(1,0,1); }');
        rootNode.alpha = new ShaderGraphNode('float f_one() { return 1.0; }');
        rootNode.vertexOffset = new ShaderGraphNode('vec3 v3_zero() { return vec3(0); }');

        this._placeholderGraph = rootNode;
    },

    onAssetUnload: function (asset) {
        // remove the parameter block we created which includes texture references
        delete asset.data.parameters;
        //delete asset.data.chunks;
        delete asset.data.name;
    },

    _assignResource: function (parameterName, materialAsset, resource) {
        materialAsset.data[parameterName] = resource;
        materialAsset.resource[parameterName] = resource;
    },

    // assign a placeholder texture and graph while waiting for one to load
    // placeholder textures and graph do not replace the data[parameterName] value
    // in the asset.data thus preserving the final asset id until it is loaded
    _assignPlaceholderTexture: function (parameterName, materialAsset) {
        // create placeholder textures on-demand
        if (!this._placeholderTextures && !_placeholderGraph) {
            this._createPlaceholders();
        }

        var texture = this._placeholderTextures['white'];

        materialAsset.resource[parameterName] = texture;
    },

    _assignPlaceholderGraph: function (parameterName, materialAsset) {
        // create placeholder textures on-demand
        if (!this._placeholderGraph) {
            this._createPlaceholders();
        }

        var graph = this._placeholderGraph;

        materialAsset.resource[parameterName] = graph;
    },

    _onResourceLoad: function (parameterName, materialAsset, textureAsset) {
        this._assignResource(parameterName, materialAsset, textureAsset.resource);
        materialAsset.resource.update();
    },

    _onResourceAdd: function (parameterName, materialAsset, textureAsset) {
        this._assets.load(textureAsset);
    },

    _onResourceRemove: function (parameterName, materialAsset, textureAsset) {
        var material = materialAsset.resource;

        if (material[parameterName] === textureAsset.resource) {
            this._assignResource(parameterName, materialAsset, null);
            material.update();
        }
    },

    bindAndAssignAssets: function (materialAsset, assets) {
        // always migrate before updating material from asset data
        var data = this._parser.migrate(materialAsset.data);

        var material = materialAsset.resource;

        var pathMapping = (data.mappingFormat === "path");

        var i, name, assetReference;
        
        for (var prop in data) 
        {
            name = prop;

            var isTexture = (name.indexOf('tex_')===0);
            var isShaderGraph = (name==='shaderGraph');

            if (isTexture|| isShaderGraph)
            {
                assetReference = material._assetReferences[name];

                // data[name] contains an asset id for a texture
                if ( (isTexture && data[name] && !(data[name] instanceof Texture)) || (isShaderGraph && data[name] && !(data[name] instanceof ShaderNodeGraph)) ) 
                {
                    if (!assetReference) 
                    {
                        assetReference = new AssetReference(name, materialAsset, assets, {
                            load: this._onResourceLoad,
                            add: this._onResourceAdd,
                            remove: this._onResourceRemove
                        }, this);
                        
                        material._assetReferences[name] = assetReference;
                    }

                    if (pathMapping) {
                        // texture paths are measured from the material directory
                        assetReference.url = materialAsset.getAbsoluteUrl(data[name]);
                    } else {
                        assetReference.id = data[name];
                    }

                    if (assetReference.asset) {
                        if (assetReference.asset.resource) {
                            // asset is already loaded
                            this._assignResource(name, materialAsset, assetReference.asset.resource);
                        } else {
                            if (isTexture) 
                            {   
                                this._assignPlaceholderTexture(name, materialAsset);
                            }
                            else
                            {
                                this._assignPlaceholderGraph(name, materialAsset);
                            }
                        }

                        assets.load(assetReference.asset);
                    }
                } else {
                    if (assetReference) {
                        // texture has been removed
                        if (pathMapping) {
                            assetReference.url = null;
                        } else {
                            assetReference.id = null;
                        }
                    } else {
                        // no asset reference and no data field
                        // do nothing
                    }
                }
            }
        }

        // call to re-initialize material after all textures assigned
        this._parser.initialize(material, data);
    }
});

export { NodeMaterialBinder };
