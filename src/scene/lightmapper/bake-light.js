import { BoundingBox } from '../../shape/bounding-box.js';
import { BoundingSphere } from '../../shape/bounding-sphere.js';
import { LIGHTTYPE_DIRECTIONAL } from "../constants";

const tempSphere = new BoundingSphere();

// helper class to store all lights including their original state
class BakeLight {
    constructor(light) {
        this.light = light;

        // original light properties
        this.store();

        // don't use cascades
        light.numCascades = 1;

        // bounds for non-directional light
        if (light.type !== LIGHTTYPE_DIRECTIONAL) {

            // world sphere
            light._node.getWorldTransform();
            light.getBoundingSphere(tempSphere);

            // world aabb
            this.lightBounds = new BoundingBox();
            this.lightBounds.center.copy(tempSphere.center);
            this.lightBounds.halfExtents.set(tempSphere.radius, tempSphere.radius, tempSphere.radius);
        }
    }

    store() {
        this.mask = this.light.mask;
        this.shadowUpdateMode = this.light.shadowUpdateMode;
        this.enabled = this.light.enabled;
        this.intensity = this.light.intensity;
        this.rotation = this.light._node.getLocalRotation().clone();
        this.numCascades = this.light.numCascades;
    }

    restore() {
        this.light.mask = this.mask;
        this.light.shadowUpdateMode = this.shadowUpdateMode;
        this.light.enabled = this.enabled;
        this.light.intensity = this.intensity;
        this.light._node.setLocalRotation(this.rotation);
        this.light.numCascades = this.numCascades;
    }
}

export { BakeLight };
