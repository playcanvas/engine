import { DebugHelper } from '../../core/debug.js';
import { math } from '../../core/math/math.js';

import { ShadowMap } from './shadow-map.js';
import {
    LIGHTTYPE_OMNI, LIGHTTYPE_SPOT
} from '../constants.js';

import { RenderPass } from '../../platform/graphics/render-pass.js';

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
     * Prepare render pass for rendering of shadows for local clustered lights. This is done inside
     * a single render pass, as all shadows are part of a single render target atlas.
     */
    prepareClusteredRenderPass(renderPass, lightsSpot, lightsOmni) {

        // prepare render targets / shadow cameras for rendering
        const shadowLights = this.shadowLights;
        const shadowCamSpot = this.prepareLights(shadowLights, lightsSpot);
        const shadowCamOmni = this.prepareLights(shadowLights, lightsOmni);
        const shadowCamera = shadowCamSpot ?? shadowCamOmni;

        // if any shadows need to be rendered
        const count = shadowLights.length;
        if (count) {

            // setup render pass using any of the cameras, they all have the same pass related properties
            // Note that the render pass is set up to not clear the render target, as individual shadow maps clear it
            this.shadowRenderer.setupRenderPass(renderPass, shadowCamera, false);

            // render shadows inside the pass
            renderPass.execute = () => {

                for (let i = 0; i < count; i++) {
                    const light = shadowLights[i];
                    for (let face = 0; face < light.numShadowFaces; face++) {
                        this.shadowRenderer.renderFace(light, null, face, true);
                    }
                }

                shadowLights.length = 0;
            };
        }
    }

    setupNonClusteredFaceRenderPass(frameGraph, light, face) {

        const shadowCamera = this.shadowRenderer.prepareFace(light, null, face);
        const renderPass = new RenderPass(this.device, () => {
            this.shadowRenderer.renderFace(light, null, face, false);
        });

        // clear the render target as well, as it contains a single shadow map
        this.shadowRenderer.setupRenderPass(renderPass, shadowCamera, true);
        DebugHelper.setName(renderPass, `SpotShadow-${light._node.name}`);

        frameGraph.addRenderPass(renderPass);
    }

    /**
     * Prepare render passes for rendering of shadows for local non-clustered lights. Each shadow face
     * is a separate render pass as it renders to a separate render target.
     */
    buildNonClusteredRenderPasses(frameGraph, lightsSpot, lightsOmni) {

        // spot lights
        for (let i = 0; i < lightsSpot.length; i++) {
            const light = lightsSpot[i];

            if (this.shadowRenderer.needsShadowRendering(light)) {
                this.setupNonClusteredFaceRenderPass(frameGraph, light, 0);
            }
        }

        // omni lights
        for (let i = 0; i < lightsOmni.length; i++) {
            const light = lightsOmni[i];

            if (this.shadowRenderer.needsShadowRendering(light)) {

                // create render pass per face
                const faceCount = light.numShadowFaces;
                for (let face = 0; face < faceCount; face++) {
                    this.setupNonClusteredFaceRenderPass(frameGraph, light, face);
                }
            }
        }
    }
}

export { ShadowRendererLocal };
