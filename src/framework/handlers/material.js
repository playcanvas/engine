import { standardMaterialCubemapParameters, standardMaterialTextureParameters } from '../../scene/materials/standard-material-parameters.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { AssetReference } from '../asset/asset-reference.js';
import { JsonStandardMaterialParser } from '../parsers/material/json-standard-material.js';
import { ResourceHandler } from './handler.js';
import { PlaceholderTextures } from './placeholder-textures.js';
import { getTextureAssetEncoding } from './texture.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { Asset } from '../asset/asset.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

// whether a reference of a material is to a texture asset - to the asset itself, or by the id or
// url it keeps when the asset is removed from the registry, as the references of a material learn
// of the removal one after another
const referencesAsset = (reference, asset) => reference.asset === asset ||
    (reference.id !== null && reference.id === asset.id) ||
    (reference.url !== null && reference.url === asset.file?.url);

/**
 * Resource handler for the `material` asset type. Loads material JSON into a
 * {@link StandardMaterial} and binds the texture assets it references. A custom parser may
 * produce another kind of {@link Material}.
 *
 * @category Asset
 */
class MaterialHandler extends ResourceHandler {
    /**
     * Create a new MaterialHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'material');

        this._assets = app.assets;

        // the textures assigned to the texture parameters of materials while their textures load
        this._placeholders = new PlaceholderTextures(app.graphicsDevice);

        // the json parser is the catch-all for material assets; the handler keeps a reference to
        // it as patch uses its migrate/initialize when binding standard material assets
        this._parser = new JsonStandardMaterialParser();
        this.addParser(this._parser);
    }

    patch(asset, assets) {
        // patching (the engine-only _data handoff, the name sync and the asset binding below) is
        // specific to StandardMaterial, the built-in json parser's output; materials produced by
        // user-registered parsers manage their own data and asset references
        if (!(asset.resource instanceof StandardMaterial)) {
            return;
        }

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

    /**
     * Returns the placeholder texture for a texture parameter of a material while its texture
     * asset loads. The placeholder decodes like the texture of the asset, and the parameters of
     * the material which reference the same texture asset get the same placeholder, as they get
     * the same texture, so the material is drawn with the same shader before and after the texture
     * loads.
     *
     * @param {string} parameterName - The name of the texture parameter.
     * @param {Asset} materialAsset - The material asset.
     * @param {Asset} textureAsset - The texture asset the parameter references.
     * @returns {Texture} The placeholder texture.
     * @private
     */
    _getPlaceholderTexture(parameterName, materialAsset, textureAsset) {
        const material = materialAsset.resource;
        const references = material._assetReferences;

        // the parameters referencing the texture asset, each with the channels of it they sample
        const maps = [];
        for (const name of standardMaterialTextureParameters) {
            const reference = references[name];
            if (name === parameterName || (reference && referencesAsset(reference, textureAsset))) {
                maps.push({ name, channel: material[`${name}Channel`] });
            }
        }

        const { srgb, type } = getTextureAssetEncoding(textureAsset);
        return this._placeholders.get(maps, srgb, type);
    }

    // assign a placeholder texture while waiting for one to load
    _assignPlaceholderTexture(parameterName, materialAsset, textureAsset) {
        materialAsset.resource[parameterName] = this._getPlaceholderTexture(parameterName, materialAsset, textureAsset);
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
                this._assignPlaceholderTexture(parameterName, materialAsset, textureAsset);
                material.update();
            }
        }
    }

    _assignCubemap(parameterName, materialAsset, textures) {
        // the primary cubemap texture
        materialAsset.resource[parameterName] = textures[0];

        // set prefiltered textures
        if (parameterName === 'cubeMap') {
            const prefiltered = textures.slice(1);
            if (prefiltered.every(t => t)) {
                materialAsset.resource.prefilteredCubemaps = prefiltered;
            } else if (prefiltered[0]) {
                materialAsset.resource.envAtlas = prefiltered[0];
            }
        }
    }

    _onCubemapLoad(parameterName, materialAsset, cubemapAsset) {
        this._assignCubemap(parameterName, materialAsset, cubemapAsset.resources);
        this._parser.initialize(materialAsset.resource, materialAsset.data);
    }

    _onCubemapAdd(parameterName, materialAsset, cubemapAsset) {
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

        const pathMapping = (data.mappingFormat === 'path');

        const TEXTURES = standardMaterialTextureParameters;

        let i, name, assetReference;
        const boundTextures = [];

        // iterate through all texture parameters
        for (i = 0; i < TEXTURES.length; i++) {
            name = TEXTURES[i];

            assetReference = material._assetReferences[name];

            // data[name] contains an asset id for a texture
            // if we have an asset id and nothing is assigned to the texture resource or the placeholder texture is assigned
            // or the data has changed
            const dataAssetId = data[name];

            const materialTexture = material[name];
            const isPlaceHolderTexture = this._placeholders.has(materialTexture);
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
                    boundTextures.push(name);
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

        // the textures are assigned once all the parameters reference their assets, as the
        // placeholder of a texture asset is shared by all the parameters referencing it
        for (i = 0; i < boundTextures.length; i++) {
            name = boundTextures[i];
            const textureAsset = material._assetReferences[name].asset;
            if (textureAsset.resource) {
                // asset is already loaded
                this._assignTexture(name, materialAsset, textureAsset.resource);
            } else {
                this._assignPlaceholderTexture(name, materialAsset, textureAsset);
            }

            assets.load(textureAsset);
        }

        const CUBEMAPS = standardMaterialCubemapParameters;

        // iterate through all cubemap parameters
        for (i = 0; i < CUBEMAPS.length; i++) {
            name = CUBEMAPS[i];

            assetReference = material._assetReferences[name];

            // data[name] contains an asset id for a cubemap
            // if we have an asset id and the prefiltered cubemap data is not set
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
