/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { ShaderChunkCollection } from '../../platform/graphics/shader-chunk-collection.js'
 * @import { Renderer } from '../renderer/renderer.js'
 */

/**
 * What features are installed into: the graphics device, and the renderer. The application is the
 * host; the type only keeps scene level code from referencing it.
 *
 * @typedef {object} FeatureHost
 * @property {GraphicsDevice} graphicsDevice - The graphics device the feature's shader chunks are
 * registered with.
 * @property {Renderer} [renderer] - The renderer.
 * @ignore
 */

/**
 * An optional part of the engine: the engine code and the shader chunks of one piece of
 * functionality. An application installs the features it uses, and features it does not reference
 * can be dropped by tree-shaking.
 *
 * Features are created at module scope, so every `new Feature()` must be annotated
 * `/* #__PURE__ *\/` for bundlers to drop the features an application does not use, together with
 * the chunks they reference. The constructor must therefore stay free of side effects.
 *
 * A feature is named with `DebugHelper.setName` after its definition. The name is used by debug
 * checks and error messages only, so release builds strip it and identify features by object.
 *
 * @ignore
 */
class Feature {
    /**
     * The name of the feature, assigned with `DebugHelper.setName`, which only debug builds keep, for
     * the debug checks of installed features and for error messages.
     *
     * @type {string|undefined}
     * @ignore
     */
    name;

    /**
     * The shader chunks of the feature, registered with the graphics device in the language of
     * the collection.
     *
     * @type {ShaderChunkCollection|null}
     * @ignore
     */
    chunks;

    /**
     * Creates the engine objects of the feature.
     *
     * @type {((host: FeatureHost) => void)|null}
     * @ignore
     */
    install;

    /**
     * The features this feature needs, installed before it.
     *
     * @type {Feature[]}
     * @ignore
     */
    requires;

    /**
     * The component system classes of the feature. The application creates them together with
     * the component systems it lists, all in their `order`, rather than the feature creating them
     * when it is installed, so that they handle the per-frame events in the same order however
     * they are added. Only the features listed in the options of the application bring component
     * systems.
     *
     * @type {Function[]}
     * @ignore
     */
    componentSystems;

    /**
     * Creates a new Feature.
     *
     * @param {object} definition - The definition of the feature.
     * @param {ShaderChunkCollection} [definition.chunks] - The shader chunks of the feature.
     * @param {(host: FeatureHost) => void} [definition.install] - Creates the engine objects of
     * the feature.
     * @param {Feature[]} [definition.requires] - The features this feature needs.
     * @param {Function[]} [definition.componentSystems] - The component system classes of the
     * feature.
     * @ignore
     */
    constructor({ chunks = null, install = null, requires = [], componentSystems = [] }) {
        this.chunks = chunks;
        this.install = install;
        this.requires = requires;
        this.componentSystems = componentSystems;
    }
}

export { Feature };
