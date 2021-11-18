import { BoundingBox } from '../../shape/bounding-box.js';
import { BoundingSphere } from '../../shape/bounding-sphere.js';
import { LIGHTTYPE_DIRECTIONAL } from '../constants.js';

const tempSphere = new BoundingSphere();

// helper class to store all lights including their original state
class BakeLight {
    constructor(scene, light) {

        this.scene = scene;

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

        // destroy shadow map the light might have
        this.light._destroyShadowMap();
    }

    endBake(shadowMapCache) {
        const light = this.light;
        light.enabled = false;

        // return shadow map to the cache
        if (light.shadowMap && light.shadowMap.cached) {
            shadowMapCache.add(light, light.shadowMap);
            light.shadowMap = null;
        }
    }
}

export { BakeLight };
