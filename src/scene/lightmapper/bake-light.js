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

    get numVirtualLights() {
        const numVirtualLights = this.light.type === LIGHTTYPE_DIRECTIONAL ? 100 : 1;
        return numVirtualLights;
    }

    prepareVirtualLight(index, numVirtualLights) {

        // bake type factor (0..1)
        // - more skylight: smaller value
        // - more directional: larger values
        const directionalFactor = 0.6;
        if (index < numVirtualLights * directionalFactor) {

            // soft directional
            // TODO: diferent distribution? Perhaps 2d loop in the plane of light direction to get more uniform and predictable pattern
            const directionalSpreadAngle = 20;
            const angle1 = Math.random() * directionalSpreadAngle - directionalSpreadAngle * 0.5;
            const angle2 = Math.random() * directionalSpreadAngle - directionalSpreadAngle * 0.5;

            // set to original rotation and add adjustement
            this.light._node.setLocalRotation(this.rotation);
            this.light._node.rotateLocal(angle1, 0, angle2);

        } else {

            // skylight - random direction from hemisphere
            // TODO: better distribution, perhaps Halton sequence, cosine weighted
            const angle = 90;
            this.light._node.setLocalEulerAngles(Math.random() * angle - (angle * 0.5), 10, Math.random() * angle - (angle * 0.5));
        }

        // update transform
        this.light._node.getWorldTransform();

        // TODO: this does not seem to work well and lightmap gets dark with more virtual lights
        this.light.intensity = this.intensity / numVirtualLights;
    }
}

export { BakeLight };
