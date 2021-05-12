import {
    LIGHTTYPE_OMNI
} from '../constants.js';
import { ShadowMap } from './shadow-map.js';

// In the normal case where the light renders a shadow, the light has a unique shadow map.
// ShadowMapCache is used in two cases:
// 1) by Lightmapper - when lights are baked to lightmaps one at a time, shadow maps are re-used
//    to limit allocations. Those are deleted when baking is done.
// 2) by ShadowRenderer - when VSM blur is done, a temporary buffer is grabbed from the cache
class ShadowMapCache {
    constructor() {
        // maps a shadow map key to an array of shadow maps in the cache
        this.shadowMapCache = new Map();
    }

    destroy() {
        this.clear();
        this.shadowMapCache = null;
    }

    // remove all shadowmaps from the cache
    clear() {
        this.shadowMapCache.forEach((shadowMaps) => {
            shadowMaps.forEach((shadowMap) => {
                shadowMap.destroy();
            });
        });
        this.shadowMapCache.clear();
    }

    // generates a string key for the shadow map required by the light
    getKey(light) {
        const isCubeMap = light._type === LIGHTTYPE_OMNI;
        const shadowType = light._shadowType;
        const resolution = light._shadowResolution;
        return `${isCubeMap}-${shadowType}-${resolution}`;
    }

    // returns shadow map from the cache, or creates a new one if none available
    get(device, light) {

        // get matching shadow buffer from the cache
        const key = this.getKey(light);
        const shadowMaps = this.shadowMapCache.get(key);
        if (shadowMaps && shadowMaps.length) {
            return shadowMaps.pop();
        }

        // create new one if not in cache
        const shadowMap = ShadowMap.create(device, light);
        shadowMap.cached = true;
        return shadowMap;
    }

    // returns shadow map for the light back to the cache
    add(light, shadowMap) {
        const key = this.getKey(light);
        const shadowMaps = this.shadowMapCache.get(key);
        if (shadowMaps) {
            shadowMaps.push(shadowMap);
        } else {
            this.shadowMapCache.set(key, [shadowMap]);
        }
    }
}

export { ShadowMapCache };
