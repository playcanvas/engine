import { SPECULAR_BLINN } from "../constants.js";
import { StandardMaterial } from "./standard-material.js";

// Default material used in case no other material is available.
// There is one instance of it per device (application) stored in the cache in this class.
class DefaultMaterial {
    // dictionary of Device -> default material
    static cache = new Map();

    // returns a default material for the device
    static get(device) {
        let material = this.cache.get(device);
        if (!material) {
            material = new StandardMaterial();
            material.name = "Default Material";
            material.shadingModel = SPECULAR_BLINN;

            this.cache.set(device, material);
        }
        return material;
    }

    // releases a default material for the device (when device is getting destroyed)
    static remove(device) {
        this.cache.delete(device);
    }
}

export { DefaultMaterial };
