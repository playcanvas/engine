/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * An optional glTF extension which replaces normal mesh creation for primitives it handles and
 * creates an aligned resource collection on the parse result.
 *
 * @typedef {object} GlbResourceExtension
 * @property {string} name - The glTF extension name.
 * @property {string} resourceName - Name of the property populated on the parsed resources.
 * @property {(primitive: object) => boolean} handlesPrimitive - Returns true when the extension
 * handles the primitive instead of the normal mesh path.
 * @property {(device: GraphicsDevice, gltf: object, bufferViews: Uint8Array[]) => *} createResources -
 * Creates resources for all matching primitives.
 * @ignore
 */

// A symbol keeps the handler-owned registry internal while allowing parsers registered later to
// discover it through their ResourceHandler back-reference.
const glbResourceExtensions = Symbol('glbResourceExtensions');

/**
 * @param {object} handler - The container resource handler.
 * @ignore
 */
const initializeGlbResourceExtensions = (handler) => {
    Object.defineProperty(handler, glbResourceExtensions, {
        value: new Map()
    });
};

/**
 * @param {object} handler - The container resource handler.
 * @returns {Map<string, GlbResourceExtension>|undefined} The handler's extension registry.
 * @ignore
 */
const getRegistry = (handler) => {
    return /** @type {Map<string, GlbResourceExtension>|undefined} */ (Reflect.get(handler, glbResourceExtensions));
};

/**
 * @param {object} handler - The container resource handler.
 * @param {GlbResourceExtension} extension - The extension implementation.
 * @returns {boolean} True if the handler supports glTF resource extensions.
 * @ignore
 */
const registerGlbResourceExtension = (handler, extension) => {
    const registry = getRegistry(handler);
    if (!registry) {
        return false;
    }

    registry.set(extension.name, extension);
    return true;
};

/**
 * @param {object} handler - The container resource handler.
 * @param {string} name - The glTF extension name.
 * @ignore
 */
const unregisterGlbResourceExtension = (handler, name) => {
    getRegistry(handler)?.delete(name);
};

/**
 * @param {object} handler - The container resource handler.
 * @returns {GlbResourceExtension[]} The registered extensions.
 * @ignore
 */
const getGlbResourceExtensions = (handler) => {
    return Array.from(getRegistry(handler)?.values() ?? []);
};

export {
    initializeGlbResourceExtensions,
    registerGlbResourceExtension,
    unregisterGlbResourceExtension,
    getGlbResourceExtensions
};
