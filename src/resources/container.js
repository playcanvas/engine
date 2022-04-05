import { path } from '../core/path.js';
import { GlbParser } from './parser/glb-parser.js';

/** @typedef {import('../framework/entity.js').Entity} Entity */
/** @typedef {import('../framework/app-base.js').AppBase} AppBase */
/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */
/** @typedef {import('./handler.js').ResourceHandlerCallback} ResourceHandlerCallback */

/**
 * @interface
 * @name ContainerResource
 * @description Container for a list of animations, textures, materials, renders and a model.
 */
class ContainerResource {
    /**
     * Instantiates an entity with a model component.
     *
     * @param {object} [options] - The initialization data for the model component type
     * {@link ModelComponent}.
     * @returns {Entity} A single entity with a model component. Model component internally
     * contains a hierarchy based on {@link GraphNode}.
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
     * @returns {Entity} A hierarchy of entities with render components on entities containing
     * renderable geometry.
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
     * @param {AppBase} app - The running {@link AppBase}.
     * @hideconstructor
     */
    constructor(app) {
        this.glbParser = new GlbParser(app.graphicsDevice, app.assets, 0);
        this.parsers = { };
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
     * @param {ResourceHandlerCallback} callback - The callback used when the resource is loaded or
     * an error occurs.
     * @param {Asset} [asset] - Optional asset that is passed by ResourceLoader.
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
     * @param {Asset} [asset] - Optional asset that is passed by ResourceLoader.
     * @returns {*} The parsed resource data.
     */
    open(url, data, asset) {
        return this._getParser(url).open(url, data, asset);
    }

    /**
     * @param {Asset} asset - The asset to patch.
     * @param {AssetRegistry} assets - The asset registry.
     */
    patch(asset, assets) {

    }
}

export { ContainerResource, ContainerHandler };
