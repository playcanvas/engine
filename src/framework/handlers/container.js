import { path } from '../../core/path.js';

import { GlbParser } from '../parsers/glb-parser.js';

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

/**
 * @interface
 * @name ContainerResource
 * @description Container for a list of animations, textures, materials, renders and a model.
 * @property {import('../asset/asset.js').Asset[]} renders An array of the Render assets.
 * @property {import('../asset/asset.js').Asset[]} materials An array of {@link Material} and/or {@link StandardMaterial} assets.
 * @property {import('../asset/asset.js').Asset[]} textures An array of the {@link Texture} assets.
 * @property {import('../asset/asset.js').Asset[]} animations An array of the {@link Animation} assets.
 */
class ContainerResource {
    /**
     * Instantiates an entity with a model component.
     *
     * @param {object} [options] - The initialization data for the model component type
     * {@link ModelComponent}.
     * @returns {import('../entity.js').Entity} A single entity with a model component. Model
     * component internally contains a hierarchy based on {@link GraphNode}.
     * @example
     * // load a glb file and instantiate an entity with a model component based on it
     * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
     *     var entity = asset.resource.instantiateModelEntity({
     *         castShadows: true
     *     });
     *     app.root.addChild(entity);
     * });
     */
    instantiateModelEntity(options) {
        return null;
    }

    /**
     * Instantiates an entity with a render component.
     *
     * @param {object} [options] - The initialization data for the render component type
     * {@link RenderComponent}.
     * @returns {import('../entity.js').Entity} A hierarchy of entities with render components on
     * entities containing renderable geometry.
     * @example
     * // load a glb file and instantiate an entity with a render component based on it
     * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
     *     var entity = asset.resource.instantiateRenderEntity({
     *         castShadows: true
     *     });
     *     app.root.addChild(entity);
     *
     *     // find all render components containing mesh instances, and change blend mode on their materials
     *     var renders = entity.findComponents("render");
     *     renders.forEach(function (render) {
     *         render.meshInstances.forEach(function (meshInstance) {
     *             meshInstance.material.blendType = pc.BLEND_MULTIPLICATIVE;
     *             meshInstance.material.update();
     *         });
     *     });
     * });
     */
    instantiateRenderEntity(options) {
        return null;
    }

    /**
     * Queries the list of available material variants.
     *
     * @returns {string[]} An array of variant names.
     */
    getMaterialVariants() {
        return null;
    }

    /**
     * Applies a material variant to an entity hierarchy.
     *
     * @param {import('../entity.js').Entity} entity - The entity root to which material variants
     * will be applied.
     * @param {string} [name] - The name of the variant, as queried from getMaterialVariants,
     * if null the variant will be reset to the default.
     * @example
     * // load a glb file and instantiate an entity with a render component based on it
     * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
     *     var entity = asset.resource.instantiateRenderEntity({
     *         castShadows: true
     *     });
     *     app.root.addChild(entity);
     *     var materialVariants = asset.resource.getMaterialVariants();
     *     asset.resource.applyMaterialVariant(entity, materialVariants[0]);
     */
    applyMaterialVariant(entity, name) {}

    /**
     * Applies a material variant to a set of mesh instances. Compared to the applyMaterialVariant,
     * this method allows for setting the variant on a specific set of mesh instances instead of the
     * whole entity.
     *
     * @param {import('../../scene/mesh-instance').MeshInstance[]} instances - An array of mesh
     * instances.
     * @param {string} [name] - The the name of the variant, as quered from getMaterialVariants,
     * if null the variant will be reset to the default
     * @example
     * // load a glb file and instantiate an entity with a render component based on it
     * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
     *     var entity = asset.resource.instantiateRenderEntity({
     *         castShadows: true
     *     });
     *     app.root.addChild(entity);
     *     var materialVariants = asset.resource.getMaterialVariants();
     *     var renders = entity.findComponents("render");
     *     for (var i = 0; i < renders.length; i++) {
     *         var renderComponent = renders[i];
     *         asset.resource.applyMaterialVariantInstances(renderComponent.meshInstances, materialVariants[0]);
     *     }
     */
    applyMaterialVariantInstances(instances, name) {}
}

/**
 * Loads files that contain multiple resources. For example glTF files can contain textures, models
 * and animations.
 *
 * For glTF files, the asset options object can be used to pass load time callbacks for handling
 * the various resources at different stages of loading. The table below lists the resource types
 * and the corresponding supported process functions.
 *
 * ```
 * |---------------------------------------------------------------------|
 * |  resource   |  preprocess |   process   |processAsync | postprocess |
 * |-------------+-------------+-------------+-------------+-------------|
 * | global      |      x      |             |             |      x      |
 * | node        |      x      |      x      |             |      x      |
 * | light       |      x      |      x      |             |      x      |
 * | camera      |      x      |      x      |             |      x      |
 * | animation   |      x      |             |             |      x      |
 * | material    |      x      |      x      |             |      x      |
 * | image       |      x      |             |      x      |      x      |
 * | texture     |      x      |             |      x      |      x      |
 * | buffer      |      x      |             |      x      |      x      |
 * | bufferView  |      x      |             |      x      |      x      |
 * |---------------------------------------------------------------------|
 * ```
 *
 * Additional options that can be passed for glTF files:
 * [options.morphPreserveData] - When true, the morph target keeps its data passed using the options,
 * allowing the clone operation.
 * [options.morphPreferHighPrecision] - When true, high precision storage for morph targets should
 * be prefered. This is faster to create and allows higher precision, but takes more memory and
 * might be slower to render. Defaults to false.
 * [options.skipMeshes] - When true, the meshes from the container are not created. This can be
 * useful if you only need access to textures or animations and similar.
 *
 * For example, to receive a texture preprocess callback:
 *
 * ```javascript
 * var containerAsset = new pc.Asset(filename, 'container', { url: url, filename: filename }, null, {
 *     texture: {
 *         preprocess(gltfTexture) { console.log("texture preprocess"); }
 *     },
 * });
 * ```
 *
 * @implements {ResourceHandler}
 */
class ContainerHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = "container";

    /**
     * Create a new ContainerResource instance.
     *
     * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
     * @hideconstructor
     */
    constructor(app) {
        this.glbParser = new GlbParser(app.graphicsDevice, app.assets, 0);
        this.parsers = { };
    }

    set maxRetries(value) {
        this.glbParser.maxRetries = value;
        for (const parser in this.parsers) {
            if (this.parsers.hasOwnProperty(parser)) {
                this.parsers[parser].maxRetries = value;
            }
        }
    }

    get maxRetries() {
        return this.glbParser.maxRetries;
    }

    /**
     * @param {string} url - The resource URL.
     * @returns {string} The URL with query parameters removed.
     * @private
     */
    _getUrlWithoutParams(url) {
        return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
    }

    /**
     * @param {string} url - The resource URL.
     * @returns {*} A suitable parser to parse the resource.
     * @private
     */
    _getParser(url) {
        const ext = url ? path.getExtension(this._getUrlWithoutParams(url)).toLowerCase().replace('.', '') : null;
        return this.parsers[ext] || this.glbParser;
    }

    /**
     * @param {string|object} url - Either the URL of the resource to load or a structure
     * containing the load and original URL.
     * @param {string} [url.load] - The URL to be used for loading the resource.
     * @param {string} [url.original] - The original URL to be used for identifying the resource
     * format. This is necessary when loading, for example from blob.
     * @param {import('./handler.js').ResourceHandlerCallback} callback - The callback used when
     * the resource is loaded or an error occurs.
     * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed by
     * ResourceLoader.
     */
    load(url, callback, asset) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        this._getParser(url.original).load(url, callback, asset);
    }

    /**
     * @param {string} url - The URL of the resource to open.
     * @param {*} data - The raw resource data passed by callback from {@link ResourceHandler#load}.
     * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed by
     * ResourceLoader.
     * @returns {*} The parsed resource data.
     */
    open(url, data, asset) {
        return this._getParser(url).open(url, data, asset);
    }

    /**
     * @param {import('../asset/asset.js').Asset} asset - The asset to patch.
     * @param {import('../asset/asset-registry.js').AssetRegistry} assets - The asset registry.
     */
    patch(asset, assets) {

    }
}

export { ContainerResource, ContainerHandler };
