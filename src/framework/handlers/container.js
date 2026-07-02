import { GlbContainerParser } from '../parsers/glb-container-parser.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { Asset } from '../asset/asset.js'
 * @import { Entity } from '../entity.js'
 * @import { MeshInstance } from '../../scene/mesh-instance.js'
 */

/**
 * Container for a list of animations, textures, materials, renders, gsplats and a model.
 *
 * @property {Asset[]} renders An array of the Render assets.
 * @property {Asset[]} materials An array of {@link Material} and/or {@link StandardMaterial} assets.
 * @property {Asset[]} textures An array of the {@link Texture} assets.
 * @property {Asset[]} animations An array of the {@link Animation} assets.
 * @property {Asset[]} gsplats An array of the gsplat assets, created for meshes using the
 * KHR_gaussian_splatting glTF extension.
 * @interface
 * @category Graphics
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
     * app.assets.loadFromUrl("statue.glb", "container", (err, asset) => {
     *     const entity = asset.resource.instantiateModelEntity({
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
     * app.assets.loadFromUrl("statue.glb", "container", (err, asset) => {
     *     const entity = asset.resource.instantiateRenderEntity({
     *         castShadows: true
     *     });
     *     app.root.addChild(entity);
     *
     *     // find all render components containing mesh instances, and change blend mode on their materials
     *     const renders = entity.findComponents("render");
     *     renders.forEach((render) => {
     *         render.meshInstances.forEach((meshInstance) => {
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
     * @param {Entity} entity - The entity root to which material variants will be applied.
     * @param {string} [name] - The name of the variant, as queried from getMaterialVariants, if
     * null the variant will be reset to the default.
     * @example
     * // load a glb file and instantiate an entity with a render component based on it
     * app.assets.loadFromUrl("statue.glb", "container", (err, asset) => {
     *     const entity = asset.resource.instantiateRenderEntity({
     *         castShadows: true
     *     });
     *     app.root.addChild(entity);
     *     const materialVariants = asset.resource.getMaterialVariants();
     *     asset.resource.applyMaterialVariant(entity, materialVariants[0]);
     * });
     */
    applyMaterialVariant(entity, name) {}

    /**
     * Applies a material variant to a set of mesh instances. Compared to the applyMaterialVariant,
     * this method allows for setting the variant on a specific set of mesh instances instead of the
     * whole entity.
     *
     * @param {MeshInstance[]} instances - An array of mesh instances.
     * @param {string} [name] - The name of the variant, as queried by getMaterialVariants. If null,
     * the variant will be reset to the default.
     * @example
     * // load a glb file and instantiate an entity with a render component based on it
     * app.assets.loadFromUrl("statue.glb", "container", (err, asset) => {
     *     const entity = asset.resource.instantiateRenderEntity({
     *         castShadows: true
     *     });
     *     app.root.addChild(entity);
     *     const materialVariants = asset.resource.getMaterialVariants();
     *     const renders = entity.findComponents("render");
     *     for (let i = 0; i < renders.length; i++) {
     *         const renderComponent = renders[i];
     *         asset.resource.applyMaterialVariantInstances(renderComponent.meshInstances, materialVariants[0]);
     *     }
     * });
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
 * | resource   | preprocess | process | processAsync | postprocess |
 * | ---------- | :--------: | :-----: | :----------: | :---------: |
 * | global     |      √     |         |              |      √      |
 * | node       |      √     |    √    |              |      √      |
 * | light      |      √     |    √    |              |      √      |
 * | camera     |      √     |    √    |              |      √      |
 * | animation  |      √     |         |              |      √      |
 * | material   |      √     |    √    |              |      √      |
 * | image      |      √     |         |      √       |      √      |
 * | texture    |      √     |         |      √       |      √      |
 * | buffer     |      √     |         |      √       |      √      |
 * | bufferView |      √     |         |      √       |      √      |
 *
 * Additional options that can be passed for glTF files:
 * [options.morphPreserveData] - When true, the morph target keeps its data passed using the options,
 * allowing the clone operation.
 * [options.morphPreferHighPrecision] - When true, high precision storage for morph targets should
 * be preferred. This is faster to create and allows higher precision, but takes more memory and
 * might be slower to render. Defaults to false.
 * [options.skipMeshes] - When true, the meshes and gaussian splats from the container are not
 * created. This can be useful if you only need access to textures or animations and similar.
 *
 * For example, to receive a texture preprocess callback:
 *
 * ```javascript
 * const containerAsset = new pc.Asset(filename, 'container', { url: url, filename: filename }, null, {
 *     texture: {
 *         preprocess: (gltfTexture) => {
 *             console.log("texture preprocess");
 *         }
 *     }
 * });
 * ```
 *
 * @category Graphics
 */
class ContainerHandler extends ResourceHandler {
    /**
     * Create a new ContainerResource instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'container');

        // GLB is the only built-in container format and acts as the catch-all; users can register
        // more specific parsers (for example usdz), which are consulted first (newest-first).
        this.addParser(new GlbContainerParser(app.graphicsDevice, app.assets));
    }
}

export { ContainerResource, ContainerHandler };
