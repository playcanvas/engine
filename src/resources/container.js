import { path } from '../core/path.js';
import { GlbParser } from './parser/glb-parser.js';

/**
 * @interface
 * @name ContainerResource
 * @description Container for a list of animations, textures, materials, renders and a model.
 */
class ContainerResource {
    /**
     * @function
     * @name ContainerResource#instantiateModelEntity
     * @description Instantiates an entity with a model component.
     * @param {object} [options] - The initialization data for the model component type {@link ModelComponent}.
     * @returns {Entity} A single entity with a model component. Model component internally contains a hierarchy based on {@link GraphNode}.
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
     * @function
     * @name ContainerResource#instantiateRenderEntity
     * @description Instantiates an entity with a render component.
     * @param {object} [options] - The initialization data for the render component type {@link RenderComponent}.
     * @returns {Entity} A hierarchy of entities with render components on entities containing renderable geometry.
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
 * @class
 * @name ContainerHandler
 * @implements {ResourceHandler}
 * @classdesc Loads files that contain multiple resources. For example glTF files can contain
 * textures, models and animations.
 * For glTF files, the asset options object can be used to pass load time callbacks for handling
 * the various resources at different stages of loading. The table below lists the resource types
 * and the corresponding supported process functions.
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
 * For example, to receive a texture preprocess callback:
 * ```javascript
 * var containerAsset = new pc.Asset(filename, 'container', { url: url, filename: filename }, null, {
 *     texture: {
 *         preprocess(gltfTexture) { console.log("texture preprocess"); }
 *     },
 * });
 * ```
 * @param {GraphicsDevice} device - The graphics device that will be rendering.
 * @param {AssetRegistry} assets - The asset registry
 * @param {StandardMaterial} defaultMaterial - The shared default material that is used in any place that a material is not specified.
 */
class ContainerHandler {
    constructor(device, assets) {
        this.glbParser = new GlbParser(device, assets, 0);
        this.parsers = { };
    }

    _getUrlWithoutParams(url) {
        return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
    }

    _getParser(url) {
        const ext = path.getExtension(this._getUrlWithoutParams(url)).toLowerCase().replace('.', '');
        return this.parsers[ext] || this.glbParser;

    }

    load(url, callback, asset) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        this._getParser(url.original).load(url, callback, asset);
    }

    open(url, data, asset) {
        return this._getParser(url).open(url, data, asset);
    }

    patch(asset, assets) {

    }
}

export { ContainerResource, ContainerHandler };
