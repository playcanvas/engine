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

/**
 * @import { Camera } from '../camera.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { LayerComposition } from '../composition/layer-composition.js'
 * @import { Light } from '../light.js'
 * @import { Renderer } from './renderer.js'
 * @import { ShadowRenderer } from './shadow-renderer.js'
 */

// Per-cascade scratch state for shadow camera fitting. PCSS retains each cascade's caster
// bounds in its render data so the union includes cached cascades as well as updating ones.
const _unionSceneAabb = new BoundingBox();
const _cascadeAabbs = [new BoundingBox(), new BoundingBox(), new BoundingBox(), new BoundingBox()];
const _cascadeAabbValid = [false, false, false, false];
const _cascadeRadii = [0, 0, 0, 0];
const center = new Vec3();
const shadowCamView = new Mat4();

// Scratch state for fitting the shadow camera of a light to its shadow bounds.
const _boundsRight = new Vec3();
const _boundsUp = new Vec3();
const _boundsDir = new Vec3();
const _boundsCenter = new Vec3();
const _boundsAxis = new Vec3();

// The texels left empty around the shadow bounds in the shadow map. The receivers outside of the
// bounds sample them, as the shadow map is sampled clamped to its edge.
const BOUNDS_BORDER = 2;

// the half extent of the projection of a box with the given half extents on a normalized axis
function projectExtent(axis, halfExtents) {
    return Math.abs(axis.x) * halfExtents.x + Math.abs(axis.y) * halfExtents.y + Math.abs(axis.z) * halfExtents.z;
}

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

class ShadowRendererDirectional {
    /** @type {Renderer} */
    renderer;

    /** @type {ShadowRenderer} */
    shadowRenderer;

    /** @type {GraphicsDevice} */
    device;

    constructor(renderer, shadowRenderer) {
        this.renderer = renderer;
        this.shadowRenderer = shadowRenderer;
        this.device = renderer.device;
    }

    /**
     * Ensure the shadow map exists and the light is marked visible. When a camera is supplied,
     * bind its shadow buffer even for cached shadows: forward lighting needs the sampler without
     * a shadow pass or cull (#3588). A light with shadow bounds binds the shadow buffer shared by
     * all cameras instead.
     *
     * @param {Light} light - The shadow-casting light.
     * @param {Camera|null} [camera] - The camera that will sample the shadow map, if any.
     */
    prepareShadowMap(light, camera = null) {

        // force light visibility if function was manually called
        light.visibleThisFrame = true;

        if (!light._shadowMap) {
            light._shadowMap = ShadowMap.create(this.device, light);
        }

        if (light._shadowBounds) {
            this.shadowRenderer.prepareFace(light, null, 0);
        } else if (camera) {
            for (let cascade = 0; cascade < light.numCascades; cascade++) {
                this.shadowRenderer.prepareFace(light, camera, cascade);
            }
        }
    }

    /**
     * Fits the shadow camera of a directional light with shadow bounds to the bounds, and culls
     * its shadow casters. The square shadow map covers the bounds as seen from the light, with
     * square texels, and its depth range reaches toward the light to include the casters between
     * the light and the bounds. The receivers beyond the bounds, along the light, sample the
     * shadow at the far end of the range, so they are shadowed by the casters within the bounds
     * too. The shadow is shared by all cameras. prepareShadowMap(light) must have been called
     * first.
     *
     * @param {Light} light - The directional light with shadow bounds.
     * @param {LayerComposition} comp - The layer composition.
     */
    cullBounds(light, comp) {

        Debug.assert(light._shadowMap, 'ShadowRendererDirectional.cullBounds requires prepareShadowMap() to have been called for the light first.');

        const bounds = light._shadowBounds;
        const lightRenderData = light.getRenderData(null, 0);
        const shadowCam = lightRenderData.shadowCamera;
        const shadowCamNode = shadowCam._node;

        // Camera looks down the negative Z, and directional light points down the negative Y
        shadowCamNode.setRotation(light._node.getRotation());
        shadowCamNode.rotateLocal(-90, 0, 0);

        // axis of light coordinate system
        const right = _boundsRight.copy(shadowCamNode.right);
        const up = _boundsUp.copy(shadowCamNode.up);
        const lightDir = _boundsDir.copy(shadowCamNode.forward);

        // the bounds in the coordinate system of the light, covered by a square, for square texels
        const { center: boundsCenter, halfExtents } = bounds;
        let halfSize = Math.max(projectExtent(right, halfExtents), projectExtent(up, halfExtents), 1e-4);
        const halfDepth = projectExtent(lightDir, halfExtents);
        let x = boundsCenter.dot(right);
        let y = boundsCenter.dot(up);
        const z = boundsCenter.dot(lightDir);

        // the bounds map to the shadow map inside a border of empty texels. The blur of a VSM
        // spreads the casters over its radius, which the border needs to be wider than
        const resolution = light._shadowResolution;
        const borderTexels = light._isVsm ? Math.max(BOUNDS_BORDER, (light._vsmBlurSize >> 1) + 1) : BOUNDS_BORDER;
        const border = borderTexels / resolution;
        const size = 1 - 2 * border;
        lightRenderData.shadowViewport.set(border, border, size, size);
        lightRenderData.shadowScissor.set(border, border, size, size);

        // snap the center to whole texels, so the shadow of a static caster does not shimmer while
        // the bounds move. The extents grow by the texel the snap can move the center by
        const texels = resolution * size;
        halfSize *= texels / (texels - 1);
        const texelSize = 2 * halfSize / texels;
        x = Math.round(x / texelSize) * texelSize;
        y = Math.round(y / texelSize) * texelSize;

        // look at the center from far away to include all casters toward the light during culling
        _boundsCenter.copy(right).mulScalar(x);
        _boundsCenter.add(_boundsAxis.copy(up).mulScalar(y));
        _boundsCenter.add(_boundsAxis.copy(lightDir).mulScalar(z));
        shadowCamNode.setPosition(_boundsCenter);
        shadowCamNode.translateLocal(0, 0, 1000000);
        shadowCam.nearClip = 0.01;
        shadowCam.farClip = 2000000;
        shadowCam.orthoHeight = halfSize;
        shadowCam.aspectRatio = 1;

        // cull shadow casters
        shadowCam.updateFrustum();
        const visibleCasters = lightRenderData.visibleCasters;
        this.shadowRenderer.cullShadowCasters(comp, light, visibleCasters, shadowCam);

        // keep the casters starting before the far end of the bounds, as the ones behind them cannot
        // shadow them, and extend the depth range toward the light to the closest one
        const far = z + halfDepth;
        let near = z - halfDepth;
        let numVisibleCasters = 0;
        const origNumVisibleCasters = visibleCasters.length;
        for (let i = 0; i < origNumVisibleCasters; i++) {
            const meshInstance = visibleCasters[i];
            if (meshInstance.shadowCascadeMask & 1) {
                const aabb = meshInstance.aabb;
                const casterNear = aabb.center.dot(lightDir) - projectExtent(lightDir, aabb.halfExtents);
                if (casterNear <= far) {
                    visibleCasters[numVisibleCasters++] = meshInstance;
                    near = Math.min(near, casterNear);
                }
            }
        }
        visibleCasters.length = numVisibleCasters;

        // adjust the camera to the depth range, made slightly larger to avoid clipping on near / far plane
        shadowCamNode.setPosition(_boundsCenter);
        shadowCamNode.translateLocal(0, 0, z - near + 0.1);
        shadowCam.farClip = far - near + 0.2;

        // the world space half size of the whole shadow map, including its border, which PCSS uses
        // to convert between the shadow map and the world space
        lightRenderData.projectionCompensation = halfSize / size;
    }

    // cull directional shadow map. prepareShadowMap(light) must have been called first.
    cull(light, comp, camera, casters = null, cascadeMask = this.getCascadeMask(light)) {

        Debug.assert(light._shadowMap, 'ShadowRendererDirectional.cull requires prepareShadowMap() to have been called for the light first.');

        // generate splits for the cascades
        const nearDist = camera._nearClip;
        this.generateSplitDistances(light, nearDist, Math.min(camera._farClip, light.shadowDistance));

        // PASS 1: per-cascade culling + per-cascade visible-caster AABB building. Defers the depth-range
        // tightening (which moves the shadow camera and sets farClip) until pass 2 so that PCSS
        // can use a stable cross-cascade union AABB rather than each cascade's own jumpy
        // visible-caster bounds.
        for (let cascade = 0; cascade < light.numCascades; cascade++) {

            // if manually controlling cascade rendering and the cascade does not render this frame
            if (!(cascadeMask & (1 << cascade))) {
                continue;
            }

            const lightRenderData = light.getRenderData(camera, cascade);
            const shadowCam = lightRenderData.shadowCamera;

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
                if (dist > radius) {
                    radius = dist;
                }
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
            shadowCam.updateFrustum();
            this.shadowRenderer.cullShadowCasters(comp, light, lightRenderData.visibleCasters, shadowCam, casters);

            const cascadeFlag = 1 << cascade;
            const visibleCasters = lightRenderData.visibleCasters;
            const origNumVisibleCasters = visibleCasters.length;

            let numVisibleCasters = 0;
            const cascadeAabb = _cascadeAabbs[cascade];

            // exclude all mesh instances that are hidden for this cascade.
            // find out AABB of visible shadow casters
            for (let i = 0; i < origNumVisibleCasters; i++) {
                const meshInstance = visibleCasters[i];
                if (meshInstance.shadowCascadeMask & cascadeFlag) {
                    visibleCasters[numVisibleCasters++] = meshInstance;
                    if (numVisibleCasters === 1) {
                        cascadeAabb.copy(meshInstance.aabb);
                    } else {
                        cascadeAabb.add(meshInstance.aabb);
                    }
                }
            }

            // remove empty tail
            if (origNumVisibleCasters !== numVisibleCasters) {
                visibleCasters.length = numVisibleCasters;
            }

            _cascadeAabbValid[cascade] = numVisibleCasters > 0;
            _cascadeRadii[cascade] = radius;

            if (light._isPcss) {
                lightRenderData.shadowCasterAabbValid = numVisibleCasters > 0;
                if (lightRenderData.shadowCasterAabbValid) {
                    lightRenderData.shadowCasterAabb ??= new BoundingBox();
                    lightRenderData.shadowCasterAabb.copy(cascadeAabb);
                }
            }
        }

        // PCSS depth fitting must not depend on which cascades happen to update this frame.
        // Include the last culled bounds of cached cascades without culling their casters again.
        // Non-PCSS shadows retain per-cascade tightening for depth precision.
        let useUnion = false;
        if (light._isPcss) {
            for (let cascade = 0; cascade < light.numCascades; cascade++) {
                const renderData = light.getRenderData(camera, cascade);
                if (!renderData.shadowCasterAabbValid) continue;
                if (!useUnion) {
                    _unionSceneAabb.copy(renderData.shadowCasterAabb);
                    useUnion = true;
                } else {
                    _unionSceneAabb.add(renderData.shadowCasterAabb);
                }
            }
        }

        // PASS 2: depth-range tightening per cascade. PCSS uses the cross-cascade union AABB
        // to tighten requested cascades, including ones with no own casters. Cached cascades keep
        // the camera fitting that matches their existing shadow-map contents.
        // Non-PCSS uses the per-cascade AABB and skips cascades with no casters (nothing to render).
        for (let cascade = 0; cascade < light.numCascades; cascade++) {
            if (!(cascadeMask & (1 << cascade))) continue;

            let aabbSource;
            if (useUnion) {
                aabbSource = _unionSceneAabb;
            } else if (_cascadeAabbValid[cascade]) {
                aabbSource = _cascadeAabbs[cascade];
            } else {
                continue;
            }

            const lightRenderData = light.getRenderData(camera, cascade);
            const shadowCam = lightRenderData.shadowCamera;
            const shadowCamNode = shadowCam._node;

            // calculate depth range of the chosen AABB from the point of view of the shadow camera
            shadowCamView.copy(shadowCamNode.getWorldTransform()).invert();
            const depthRange = getDepthRange(shadowCamView, aabbSource.getMin(), aabbSource.getMax());

            // adjust shadow camera's near and far plane to the depth range. Made slightly larger
            // to avoid clipping on near / far plane.
            shadowCamNode.translateLocal(0, 0, depthRange.max + 0.1);
            shadowCam.farClip = depthRange.max - depthRange.min + 0.2;

            lightRenderData.projectionCompensation = _cascadeRadii[cascade];
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
     * @param {Light} light - The directional light.
     * @returns {number} Bit mask of cascades needing initialization or enabled by the overrides.
     */
    getCascadeMask(light) {
        const numCascades = light.shadowCascadeCount;
        if (light._shadowCascadesInvalidated) {
            return (1 << numCascades) - 1;
        }

        let mask = 0;
        for (let cascade = 0; cascade < numCascades; cascade++) {
            if (light.shadowUpdateOverrides?.[cascade] !== SHADOWUPDATE_NONE) {
                mask |= 1 << cascade;
            }
        }
        return mask;
    }

    /**
     * Create a render pass for directional light shadow rendering for a specified camera.
     *
     * @param {Light} light - The directional light.
     * @param {Camera|null} camera - The camera, or null for a light with shadow bounds, which
     * renders one shadow for all cameras.
     * @returns {RenderPassShadowDirectional|null} - The render pass if the shadow rendering is
     * required, or null otherwise.
     */
    getLightRenderPass(light, camera) {

        Debug.assert(light && light._type === LIGHTTYPE_DIRECTIONAL);

        let renderPass = null;
        if (this.shadowRenderer.needsShadowRendering(light)) {

            const cascadeMask = this.getCascadeMask(light);
            if (!cascadeMask) {
                return null;
            }

            // shadow cascades have more faces rendered within a single render pass
            const faceCount = light.numShadowFaces;

            // prepare render targets / cameras for rendering
            let shadowCamera;
            for (let face = 0; face < faceCount; face++) {
                shadowCamera = this.shadowRenderer.prepareFace(light, camera, face);
            }

            renderPass = new RenderPassShadowDirectional(this.device, this.shadowRenderer, light, camera, cascadeMask);

            // setup render pass using any of the cameras, they all have the same pass related properties
            this.shadowRenderer.setupRenderPass(renderPass, shadowCamera, renderPass.allCascadesRendering);
        }

        return renderPass;
    }
}

export { ShadowRendererDirectional };
