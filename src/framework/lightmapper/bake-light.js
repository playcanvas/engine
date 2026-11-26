import { BoundingBox } from '../../core/shape/bounding-box.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';
import { LIGHTTYPE_DIRECTIONAL } from '../../scene/constants.js';

/**
 * @import { Light } from '../../scene/light.js'
 * @import { LightingParams } from '../../scene/lighting/lighting-params.js'
 * @import { Scene } from '../../scene/scene.js'
 */

const tempSphere = new BoundingSphere();

// helper class to store all lights including their original state
class BakeLight {
    /**
     * @param {Scene} scene - The scene being baked.
     * @param {Light} light - The light to bake.
     * @param {LightingParams} lightingParams - The lighting parameters of the lightmapper.
     * @param {boolean} usePhysicalUnits - Whether the light uses its luminance (true) or its
     * intensity (false) while baking.
     */
    constructor(scene, light, lightingParams, usePhysicalUnits) {

        this.scene = scene;

        // light of type Light
        this.light = light;

        // original light properties
        this.store();

        // the bake can run before the first frame is rendered, which is when the culler sets this
        light.usePhysicalUnits = usePhysicalUnits;

        // don't use cascades or shadow bounds, the lightmapper fits the shadow to the baked nodes
        light.numCascades = 1;
        light.shadowBounds = null;

        // if clustered shadows are disabled, disable them on the light
        if (this.scene.clusteredLightingEnabled && !lightingParams.shadowsEnabled) {
            light.castShadows = false;
        }

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
        this.luminance = this.light.luminance;
        this.usePhysicalUnits = this.light.usePhysicalUnits;
        this.rotation = this.light._node.getLocalRotation().clone();
        this.numCascades = this.light.numCascades;
        this.shadowBounds = this.light.shadowBounds?.clone() ?? null;
        this.castShadows = this.light._castShadows;
    }

    restore() {
        const light = this.light;
        light.mask = this.mask;
        light.shadowUpdateMode = this.shadowUpdateMode;
        light.enabled = this.enabled;
        light.intensity = this.intensity;
        light.luminance = this.luminance;
        light.usePhysicalUnits = this.usePhysicalUnits;
        light._node.setLocalRotation(this.rotation);
        light.numCascades = this.numCascades;
        light.shadowBounds = this.shadowBounds;
        light._castShadows = this.castShadows;
    }

    /**
     * Scales the light's original brightness, for example to split it between virtual lights.
     * Both the intensity and the luminance are scaled, as either can be in use.
     *
     * @param {number} scale - The linear scale applied to the brightness.
     */
    setBrightnessScale(scale) {
        this.light.intensity = this.intensity * scale;
        this.light.luminance = this.luminance * scale;
    }

    startBake() {
        this.light.enabled = true;

        // destroy shadow map the light might have
        this.light._destroyShadowMap();

        this.light.beginFrame();
    }

    endBake(shadowMapCache) {
        const light = this.light;
        light.enabled = false;

        if (light.shadowMap) {
            // return shadow map to the cache
            if (light.shadowMap.cached) {
                shadowMapCache.add(light, light.shadowMap);
            }

            light.shadowMap = null;
        }
    }
}

export { BakeLight };
