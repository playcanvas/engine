import { math } from '../../core/math/math.js';

import { ShadowMap } from './shadow-map.js';
import {
    LIGHTTYPE_OMNI, LIGHTTYPE_SPOT
} from '../constants.js';

import { RenderPassShadowLocalNonClustered } from './render-pass-shadow-local-non-clustered.js';

/**
 * @ignore
 */
class ShadowRendererLocal {
    // temporary list to collect lights to render shadows for
    shadowLights = [];

    /** @type {import('./renderer.js').Renderer} */
    renderer;

    /** @type {import('./shadow-renderer.js').ShadowRenderer} */
    shadowRenderer;

    /** @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice} */
    device;

    constructor(renderer, shadowRenderer) {
        this.renderer = renderer;
        this.shadowRenderer = shadowRenderer;
        this.device = renderer.device;
    }

    // cull local shadow map
    cull(light, comp, casters = null) {

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

            lightRenderData.depthRangeCompensation = shadowCam.farClip - shadowCam.nearClip;

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
            this.shadowRenderer.cullShadowCasters(comp, light, lightRenderData.visibleCasters, shadowCam, casters);
        }
    }

    prepareLights(shadowLights, lights) {

        let shadowCamera;
        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];

            if (this.shadowRenderer.needsShadowRendering(light) && light.atlasViewportAllocated) {

                shadowLights.push(light);

                for (let face = 0; face < light.numShadowFaces; face++) {
                    shadowCamera = this.shadowRenderer.prepareFace(light, null, face);
                }
            }
        }

        return shadowCamera;
    }

    /**
     * Prepare render passes for rendering of shadows for local non-clustered lights. Each shadow face
     * is a separate render pass as it renders to a separate render target.
     */
    buildNonClusteredRenderPasses(frameGraph, localLights) {

        for (let i = 0; i < localLights.length; i++) {
            const light = localLights[i];

            if (this.shadowRenderer.needsShadowRendering(light)) {

                // only spot lights support VSM
                const applyVsm = light._type === LIGHTTYPE_SPOT;

                // create render pass per face
                const faceCount = light.numShadowFaces;
                for (let face = 0; face < faceCount; face++) {
                    const renderPass = new RenderPassShadowLocalNonClustered(this.device, this.shadowRenderer, light, face, applyVsm);
                    frameGraph.addRenderPass(renderPass);
                }
            }
        }
    }
}

export { ShadowRendererLocal };
