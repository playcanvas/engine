import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';

import {
    LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_NONE
} from '../constants.js';

import { ShadowMap } from './shadow-map.js';
import { RenderPassShadowDirectional } from './render-pass-shadow-directional.js';

const visibleSceneAabb = new BoundingBox();
const center = new Vec3();
const shadowCamView = new Mat4();

const aabbPoints = [
    new Vec3(), new Vec3(), new Vec3(), new Vec3(),
    new Vec3(), new Vec3(), new Vec3(), new Vec3()
];

// evaluate depth range the aabb takes in the space of the camera
const _depthRange = { min: 0, max: 0 };
function getDepthRange(cameraViewMatrix, aabbMin, aabbMax) {
    aabbPoints[0].x = aabbPoints[1].x = aabbPoints[2].x = aabbPoints[3].x = aabbMin.x;
    aabbPoints[1].y = aabbPoints[3].y = aabbPoints[7].y = aabbPoints[5].y = aabbMin.y;
    aabbPoints[2].z = aabbPoints[3].z = aabbPoints[6].z = aabbPoints[7].z = aabbMin.z;
    aabbPoints[4].x = aabbPoints[5].x = aabbPoints[6].x = aabbPoints[7].x = aabbMax.x;
    aabbPoints[0].y = aabbPoints[2].y = aabbPoints[4].y = aabbPoints[6].y = aabbMax.y;
    aabbPoints[0].z = aabbPoints[1].z = aabbPoints[4].z = aabbPoints[5].z = aabbMax.z;

    let minz = 9999999999;
    let maxz = -9999999999;

    for (let i = 0; i < 8; ++i) {
        cameraViewMatrix.transformPoint(aabbPoints[i], aabbPoints[i]);
        const z = aabbPoints[i].z;
        if (z < minz) minz = z;
        if (z > maxz) maxz = z;
    }

    _depthRange.min = minz;
    _depthRange.max = maxz;
    return _depthRange;
}

/**
 * @ignore
 */
class ShadowRendererDirectional {
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

    // cull directional shadow map
    cull(light, comp, camera, casters = null) {

        // force light visibility if function was manually called
        light.visibleThisFrame = true;

        if (!light._shadowMap) {
            light._shadowMap = ShadowMap.create(this.device, light);
        }

        // generate splits for the cascades
        const nearDist = camera._nearClip;
        this.generateSplitDistances(light, nearDist, Math.min(camera._farClip, light.shadowDistance));

        const shadowUpdateOverrides = light.shadowUpdateOverrides;
        for (let cascade = 0; cascade < light.numCascades; cascade++) {

            // if manually controlling cascade rendering and the cascade does not render this frame
            if (shadowUpdateOverrides?.[cascade] === SHADOWUPDATE_NONE) {
                break;
            }

            const lightRenderData = light.getRenderData(camera, cascade);
            const shadowCam = lightRenderData.shadowCamera;

            // assign render target
            // Note: this is done during rendering for all shadow maps, but do it here for the case shadow rendering for the directional light
            // is disabled - we need shadow map to be assigned for rendering to work even in this case. This needs further refactoring - as when
            // shadow rendering is set to SHADOWUPDATE_NONE, we should not even execute shadow map culling
            shadowCam.renderTarget = light._shadowMap.renderTargets[0];

            // viewport
            lightRenderData.shadowViewport.copy(light.cascades[cascade]);
            lightRenderData.shadowScissor.copy(light.cascades[cascade]);

            const shadowCamNode = shadowCam._node;
            const lightNode = light._node;

            shadowCamNode.setPosition(lightNode.getPosition());

            // Camera looks down the negative Z, and directional light points down the negative Y
            shadowCamNode.setRotation(lightNode.getRotation());
            shadowCamNode.rotateLocal(-90, 0, 0);

            // get camera's frustum corners for the cascade, convert them to world space and find their center
            const frustumNearDist = cascade === 0 ? nearDist : light._shadowCascadeDistances[cascade - 1];
            const frustumFarDist = light._shadowCascadeDistances[cascade];
            const frustumPoints = camera.getFrustumCorners(frustumNearDist, frustumFarDist);
            center.set(0, 0, 0);
            const cameraWorldMat = camera.node.getWorldTransform();
            for (let i = 0; i < 8; i++) {
                cameraWorldMat.transformPoint(frustumPoints[i], frustumPoints[i]);
                center.add(frustumPoints[i]);
            }
            center.mulScalar(1 / 8);

            // radius of the world space bounding sphere for the frustum slice
            let radius = 0;
            for (let i = 0; i < 8; i++) {
                const dist = frustumPoints[i].sub(center).length();
                if (dist > radius)
                    radius = dist;
            }

            // axis of light coordinate system
            const right = shadowCamNode.right;
            const up = shadowCamNode.up;
            const lightDir = shadowCamNode.forward;

            // transform the sphere's center into the center of the shadow map, pixel aligned.
            // this makes the shadow map stable and avoids shimmering on the edges when the camera moves
            const sizeRatio = 0.25 * light._shadowResolution / radius;
            const x = Math.ceil(center.dot(up) * sizeRatio) / sizeRatio;
            const y = Math.ceil(center.dot(right) * sizeRatio) / sizeRatio;

            const scaledUp = up.mulScalar(x);
            const scaledRight = right.mulScalar(y);
            const dot = center.dot(lightDir);
            const scaledDir = lightDir.mulScalar(dot);
            center.add2(scaledUp, scaledRight).add(scaledDir);

            // look at the center from far away to include all casters during culling
            shadowCamNode.setPosition(center);
            shadowCamNode.translateLocal(0, 0, 1000000);
            shadowCam.nearClip = 0.01;
            shadowCam.farClip = 2000000;
            shadowCam.orthoHeight = radius;

            // cull shadow casters
            this.renderer.updateCameraFrustum(shadowCam);
            this.shadowRenderer.cullShadowCasters(comp, light, lightRenderData.visibleCasters, shadowCam, casters);

            // find out AABB of visible shadow casters
            let emptyAabb = true;
            const visibleCasters = lightRenderData.visibleCasters;
            for (let i = 0; i < visibleCasters.length; i++) {
                const meshInstance = visibleCasters[i];

                if (emptyAabb) {
                    emptyAabb = false;
                    visibleSceneAabb.copy(meshInstance.aabb);
                } else {
                    visibleSceneAabb.add(meshInstance.aabb);
                }
            }

            // calculate depth range of the caster's AABB from the point of view of the shadow camera
            shadowCamView.copy(shadowCamNode.getWorldTransform()).invert();
            const depthRange = getDepthRange(shadowCamView, visibleSceneAabb.getMin(), visibleSceneAabb.getMax());

            // adjust shadow camera's near and far plane to the depth range of casters to maximize precision
            // of values stored in the shadow map. Make it slightly larger to avoid clipping on near / far plane.
            shadowCamNode.translateLocal(0, 0, depthRange.max + 0.1);
            shadowCam.farClip = depthRange.max - depthRange.min + 0.2;

            lightRenderData.depthRangeCompensation = shadowCam.farClip;
            lightRenderData.projectionCompensation = radius;
        }
    }

    // function to generate frustum split distances
    generateSplitDistances(light, nearDist, farDist) {

        light._shadowCascadeDistances.fill(farDist);
        for (let i = 1; i < light.numCascades; i++) {

            //  lerp between linear and logarithmic distance, called practical split distance
            const fraction = i / light.numCascades;
            const linearDist = nearDist + (farDist - nearDist) * fraction;
            const logDist = nearDist * (farDist / nearDist) ** fraction;
            const dist = math.lerp(linearDist, logDist, light.cascadeDistribution);
            light._shadowCascadeDistances[i - 1] = dist;
        }
    }

    /**
     * Create a render pass for directional light shadow rendering for a specified camera.
     *
     * @param {import('../light.js').Light} light - The directional light.
     * @param {import('../camera.js').Camera} camera - The camera.
     * @returns {RenderPassShadowDirectional|null} - The render pass if the shadow rendering is
     * required, or null otherwise.
     */
    getLightRenderPass(light, camera) {

        Debug.assert(light && light._type === LIGHTTYPE_DIRECTIONAL);

        let renderPass = null;
        if (this.shadowRenderer.needsShadowRendering(light)) {

            // shadow cascades have more faces rendered within a singe render pass
            const faceCount = light.numShadowFaces;
            const shadowUpdateOverrides = light.shadowUpdateOverrides;

            // prepare render targets / cameras for rendering
            let allCascadesRendering = true;
            let shadowCamera;
            for (let face = 0; face < faceCount; face++) {

                if (shadowUpdateOverrides?.[face] === SHADOWUPDATE_NONE)
                    allCascadesRendering = false;

                shadowCamera = this.shadowRenderer.prepareFace(light, camera, face);
            }

            renderPass = new RenderPassShadowDirectional(this.device, this.shadowRenderer, light, camera, allCascadesRendering);

            // setup render pass using any of the cameras, they all have the same pass related properties
            this.shadowRenderer.setupRenderPass(renderPass, shadowCamera, allCascadesRendering);
        }

        return renderPass;
    }
}

export { ShadowRendererDirectional };
