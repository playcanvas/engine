/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { ResourceLoader } from '../handlers/loader.js'
 */

/**
 * An optional part of glTF parsing, such as a glTF extension or the animations, which creates a
 * collection of resources on the parse result. Extensions are registered with the resource loader
 * by the features and component systems that use their resources, so that applications without
 * them do not bundle their code.
 *
 * @typedef {object} GlbResourceExtension
 * @property {string} name - The name the extension is registered with, the glTF extension name for
 * a glTF extension.
 * @property {string} resourceName - Name of the property populated on the parsed resources.
 * @property {(primitive: object) => boolean} [handlesPrimitive] - Returns true when the extension
 * handles the primitive instead of the normal mesh path.
 * @property {(device: GraphicsDevice, gltf: object, bufferViews: Uint8Array[], nodes: object[], options: object) => *} createResources -
 * Creates the resources, given the graphics device, the glTF json, the data of its buffer views,
 * the created nodes and the options of the asset.
 * @ignore
 */

/**
 * The extensions registered with each resource loader. The registry lives on the loader rather
 * than on the container handler, so extensions can be registered before or after the handler is
 * added, and code registering them does not need the handler.
 *
 * @type {WeakMap<ResourceLoader, Map<string, GlbResourceExtension>>}
 */
const registries = new WeakMap();

/**
 * Registers a glTF resource extension with a resource loader, for the glTF files it loads.
 *
 * @param {ResourceLoader} loader - The resource loader.
 * @param {GlbResourceExtension} extension - The extension implementation.
 * @ignore
 */
const registerGlbResourceExtension = (loader, extension) => {
    let registry = registries.get(loader);
    if (!registry) {
        registry = new Map();
        registries.set(loader, registry);
    }
    registry.set(extension.name, extension);
};

/**
 * Unregisters a glTF resource extension from a resource loader.
 *
 * @param {ResourceLoader} loader - The resource loader.
 * @param {string} name - The name of the extension.
 * @ignore
 */
const unregisterGlbResourceExtension = (loader, name) => {
    registries.get(loader)?.delete(name);
};

/**
 * Returns the glTF resource extensions registered with a resource loader.
 *
 * @param {ResourceLoader|undefined} loader - The resource loader, undefined for a handler that was
 * not added to one.
 * @returns {GlbResourceExtension[]} The registered extensions.
 * @ignore
 */
const getGlbResourceExtensions = (loader) => {
    const registry = loader && registries.get(loader);
    return registry ? Array.from(registry.values()) : [];
};

export {
    registerGlbResourceExtension,
    unregisterGlbResourceExtension,
    getGlbResourceExtensions
};
