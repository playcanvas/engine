import { http } from '../net/http.js';

import { PIXELFORMAT_R8_G8_B8_A8 } from '../graphics/constants.js';
import { Texture } from '../graphics/texture.js';

import { SPECULAR_PHONG } from '../scene/constants.js';
import { standardMaterialCubemapParameters, standardMaterialTextureParameters } from '../scene/materials/standard-material-parameters.js';

import { AssetReference } from '../asset/asset-reference.js';

import { JsonStandardMaterialParser } from './parser/material/json-standard-material.js';

const PLACEHOLDER_MAP = {
    aoMap: 'white',
    diffuseMap: 'gray',
    specularMap: 'gray',
    metalnessMap: 'black',
    glossMap: 'gray',
    emissiveMap: 'gray',
    normalMap: 'normal',
    heightMap: 'gray',
    opacityMap: 'gray',
    sphereMap: 'gray',
    lightMap: 'white'
};

/**
 * @class
 * @name MaterialHandler
 * @implements {ResourceHandler}
 * @classdesc Resource handler used for loading {@link Material} resources.
 * @param {Application} app - The running {@link Application}.
 */
class MaterialHandler {
    constructor(app) {
        this._assets = app.assets;
        this._device = app.graphicsDevice;

        this._placeholderTextures = null;

        this._parser = new JsonStandardMaterialParser();
        this.maxRetries = 0;
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // Loading from URL (engine-only)
        http.get(url.load, {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
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
    }

    open(url, data) {
        const material = this._parser.parse(data);

        // temp storage for engine-only as we need this during patching
        if (data._engine) {
            material._data = data;
            delete data._engine;
        }

        return material;
    }

    // creates placeholders for textures
    // that are used while texture is loading
    _createPlaceholders() {
        this._placeholderTextures = {};

        const textures = {
            white: [255, 255, 255, 255],
            gray: [128, 128, 128, 255],
            black: [0, 0, 0, 255],
            normal: [128, 128, 255, 255]
        };

        for (const key in textures) {
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
            const pixels = this._placeholderTextures[key].lock();
            for (let i = 0; i < 4; i++) {
                for (let c = 0; c < 4; c++) {
                    pixels[i * 4 + c] = textures[key][c];
                }
            }
            this._placeholderTextures[key].unlock();
        }
    }

    patch(asset, assets) {
        // in an engine-only environment we manually copy the source data into the asset
        if (asset.resource._data) {
            asset._data = asset.resource._data; // use _data to avoid firing events
            delete asset.resource._data; // remove from temp storage
        }

        // patch the name of the asset over the material name property
        asset.data.name = asset.name;
        asset.resource.name = asset.name;

        this._bindAndAssignAssets(asset, assets);

        asset.off('unload', this._onAssetUnload, this);
        asset.on('unload', this._onAssetUnload, this);
    }

    _onAssetUnload(asset) {
        // remove the parameter block we created which includes texture references
        delete asset.data.parameters;
        delete asset.data.chunks;
        delete asset.data.name;
    }

    _assignTexture(parameterName, materialAsset, texture) {
        // NB removed swapping out asset id for resource here
        materialAsset.resource[parameterName] = texture;
    }

    // returns the correct placeholder texture for the texture parameter
    _getPlaceholderTexture(parameterName) {
        // create placeholder textures on-demand
        if (!this._placeholderTextures) {
            this._createPlaceholders();
        }

        const placeholder = PLACEHOLDER_MAP[parameterName];
        const texture = this._placeholderTextures[placeholder];

        return texture;
    }

    // assign a placeholder texture while waiting for one to load
    _assignPlaceholderTexture(parameterName, materialAsset) {

        materialAsset.resource[parameterName] = this._getPlaceholderTexture(parameterName, materialAsset);
    }

    _onTextureLoad(parameterName, materialAsset, textureAsset) {
        this._assignTexture(parameterName, materialAsset, textureAsset.resource);
        materialAsset.resource.update();
    }

    _onTextureAdd(parameterName, materialAsset, textureAsset) {
        this._assets.load(textureAsset);
    }

    _onTextureRemoveOrUnload(parameterName, materialAsset, textureAsset) {
        const material = materialAsset.resource;
        if (material) {
            if (materialAsset.resource[parameterName] === textureAsset.resource) {
                this._assignPlaceholderTexture(parameterName, materialAsset);
                material.update();
            }
        }
    }

    _assignCubemap(parameterName, materialAsset, textures) {
        // NB we now set resource directly (like textures)
        materialAsset.resource[parameterName] = textures[0]; // the primary cubemap texture
        if (textures.length === 7) {
            // the prefiltered textures
            materialAsset.resource.prefilteredCubeMap128 = textures[1];
            materialAsset.resource.prefilteredCubeMap64 = textures[2];
            materialAsset.resource.prefilteredCubeMap32 = textures[3];
            materialAsset.resource.prefilteredCubeMap16 = textures[4];
            materialAsset.resource.prefilteredCubeMap8 = textures[5];
            materialAsset.resource.prefilteredCubeMap4 = textures[6];
        }
    }

    _onCubemapLoad(parameterName, materialAsset, cubemapAsset) {
        this._assignCubemap(parameterName, materialAsset, cubemapAsset.resources);
        this._parser.initialize(materialAsset.resource, materialAsset.data);
    }

    _onCubemapAdd(parameterName, materialAsset, cubemapAsset) {
        // phong based - so ensure we load individual faces
        if (materialAsset.data.shadingModel === SPECULAR_PHONG) {
            materialAsset.loadFaces = true;
        }

        this._assets.load(cubemapAsset);
    }

    _onCubemapRemoveOrUnload(parameterName, materialAsset, cubemapAsset) {
        const material = materialAsset.resource;

        if (materialAsset.data.prefilteredCubeMap128 === cubemapAsset.resources[1]) {
            this._assignCubemap(parameterName, materialAsset, [null, null, null, null, null, null, null]);
            material.update();
        }
    }

    _bindAndAssignAssets(materialAsset, assets) {
        // always migrate before updating material from asset data
        const data = this._parser.migrate(materialAsset.data);

        const material = materialAsset.resource;

        const pathMapping = (data.mappingFormat === "path");

        const TEXTURES = standardMaterialTextureParameters;

        let i, name, assetReference;
        // iterate through all texture parameters
        for (i = 0; i < TEXTURES.length; i++) {
            name = TEXTURES[i];

            assetReference = material._assetReferences[name];

            // data[name] contains an asset id for a texture
            // if we have an asset id and nothing is assigned to the texture resource or the placeholder texture is assigned
            // or the data has changed
            const dataAssetId = data[name];

            const materialTexture = material[name];
            const isPlaceHolderTexture = materialTexture === this._getPlaceholderTexture(name, materialAsset);
            const dataValidated = data.validated;

            if (dataAssetId && (!materialTexture || !dataValidated || isPlaceHolderTexture)) {
                if (!assetReference) {
                    assetReference = new AssetReference(name, materialAsset, assets, {
                        load: this._onTextureLoad,
                        add: this._onTextureAdd,
                        remove: this._onTextureRemoveOrUnload,
                        unload: this._onTextureRemoveOrUnload
                    }, this);

                    material._assetReferences[name] = assetReference;
                }

                if (pathMapping) {
                    // texture paths are measured from the material directory
                    assetReference.url = materialAsset.getAbsoluteUrl(dataAssetId);
                } else {
                    assetReference.id = dataAssetId;
                }

                if (assetReference.asset) {
                    if (assetReference.asset.resource) {
                        // asset is already loaded
                        this._assignTexture(name, materialAsset, assetReference.asset.resource);
                    } else {
                        this._assignPlaceholderTexture(name, materialAsset);
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

        const CUBEMAPS = standardMaterialCubemapParameters;

        // iterate through all cubemap parameters
        for (i = 0; i < CUBEMAPS.length; i++) {
            name = CUBEMAPS[i];

            assetReference = material._assetReferences[name];

            // data[name] contains an asset id for a cubemap
            // if we have a asset id and the prefiltered cubemap data is not set
            if (data[name] && !materialAsset.data.prefilteredCubeMap128) {
                if (!assetReference) {
                    assetReference = new AssetReference(name, materialAsset, assets, {
                        load: this._onCubemapLoad,
                        add: this._onCubemapAdd,
                        remove: this._onCubemapRemoveOrUnload,
                        unload: this._onCubemapRemoveOrUnload
                    }, this);

                    material._assetReferences[name] = assetReference;
                }

                if (pathMapping) {
                    assetReference.url = data[name];
                } else {
                    assetReference.id = data[name];
                }

                if (assetReference.asset) {
                    if (assetReference.asset.loaded) {
                        // asset loaded
                        this._assignCubemap(name, materialAsset, assetReference.asset.resources);
                    }

                    assets.load(assetReference.asset);
                }
            }


        }

        // call to re-initialize material after all textures assigned
        this._parser.initialize(material, data);
    }
}

export { MaterialHandler };
