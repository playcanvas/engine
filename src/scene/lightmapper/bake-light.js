import { BoundingBox } from '../../shape/bounding-box.js';
import { BoundingSphere } from '../../shape/bounding-sphere.js';
import { LIGHTTYPE_DIRECTIONAL } from "../constants";

const tempSphere = new BoundingSphere();

// helper class to store all lights including their original state
class BakeLight {
    constructor(light) {

        // light of type Light
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
        const light = this.light;
        light.mask = this.mask;
        light.shadowUpdateMode = this.shadowUpdateMode;
        light.enabled = this.enabled;
        light.intensity = this.intensity;
        light._node.setLocalRotation(this.rotation);
        light.numCascades = this.numCascades;
    }

    startBake() {
        this.light.enabled = true;
        this.light._cacheShadowMap = true;
    }

    endBake() {
        const light = this.light;
        light.enabled = false;

        // release light shadowmap
        light._cacheShadowMap = false;
        if (light._isCachedShadowMap) {
            light._destroyShadowMap();
        }
    }

    prepareVirtualLight(index) {

        const light = this.light;
        const numVirtualLights = light.numBakeSamples;

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
            light._node.setLocalRotation(this.rotation);
            light._node.rotateLocal(angle1, 0, angle2);

        } else {

            // skylight - random direction from hemisphere
            // TODO: better distribution, perhaps Halton sequence, cosine weighted
            const angle = 90;
            light._node.setLocalEulerAngles(Math.random() * angle - (angle * 0.5), 10, Math.random() * angle - (angle * 0.5));
        }

        // update transform
        light._node.getWorldTransform();

        // TODO: this does not seem to work well and lightmap gets dark with more virtual lights
        light.intensity = this.intensity / numVirtualLights;
    }
}

export { BakeLight };
