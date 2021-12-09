import { Debug } from "../../core/debug.js";

// Default material used in case no other material is available.
// There is one instance of it per device (application) stored in the cache in this class.
class DefaultMaterial {
    // dictionary of Device -> default material
    static cache = new Map();

    // returns a default material for the device
    static get(device) {
        const material = this.cache.get(device);
        Debug.assert(material);
        return material;
    }

    static add(device, material) {
        Debug.assert(!this.cache.has(device));
        this.cache.set(device, material);
    }

    // releases a default material for the device (when device is getting destroyed)
    static remove(device) {
        Debug.assert(this.cache.has(device));
        this.cache.delete(device);
    }
}

export { DefaultMaterial };
