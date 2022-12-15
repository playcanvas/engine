import { math } from '../../core/math/math.js';

import { ShadowMap } from './shadow-map.js';
import {
    LIGHTTYPE_OMNI, LIGHTTYPE_SPOT
} from '../constants.js';

/**
 * @ignore
 */
class ShadowRendererLocal {
    constructor(renderer, shadowRenderer) {
        this.renderer = renderer;
        this.shadowRenderer = shadowRenderer;
        this.device = renderer.device;
    }

    // cull local shadow map
    cull(light, drawCalls) {

        const isClustered = this.renderer.scene.clusteredLightingEnabled;

        // force light visibility if function was manually called
        light.visibleThisFrame = true;

        // allocate shadow map unless in clustered lighting mode
        if (!isClustered) {
            if (!light._shadowMap) {
                light._shadowMap = ShadowMap.create(this.device, light);
            }
        }

        const type = light._type;
        const faceCount = type === LIGHTTYPE_SPOT ? 1 : 6;

        for (let face = 0; face < faceCount; face++) {

            // render data are shared between cameras for local lights, so pass null for camera
            const lightRenderData = light.getRenderData(null, face);
            const shadowCam = lightRenderData.shadowCamera;

            shadowCam.nearClip = light.attenuationEnd / 1000;
            shadowCam.farClip = light.attenuationEnd;

            const shadowCamNode = shadowCam._node;
            const lightNode = light._node;
            shadowCamNode.setPosition(lightNode.getPosition());

            if (type === LIGHTTYPE_SPOT) {
                shadowCam.fov = light._outerConeAngle * 2;

                // Camera looks down the negative Z, and spot light points down the negative Y
                shadowCamNode.setRotation(lightNode.getRotation());
                shadowCamNode.rotateLocal(-90, 0, 0);

            } else if (type === LIGHTTYPE_OMNI) {

                // when rendering omni shadows to an atlas, use larger fov by few pixels to allow shadow filtering to stay on a single face
                if (isClustered) {
                    const tileSize = this.shadowRenderer.lightTextureAtlas.shadowAtlasResolution * light.atlasViewport.z / 3;    // using 3x3 for cubemap
                    const texelSize = 2 / tileSize;
                    const filterSize = texelSize * this.shadowRenderer.lightTextureAtlas.shadowEdgePixels;
                    shadowCam.fov = Math.atan(1 + filterSize) * math.RAD_TO_DEG * 2;
                } else {
                    shadowCam.fov = 90;
                }
            }

            // cull shadow casters
            this.renderer.updateCameraFrustum(shadowCam);
            this.shadowRenderer.cullShadowCasters(drawCalls, lightRenderData.visibleCasters, shadowCam);
        }
    }
}

export { ShadowRendererLocal };
