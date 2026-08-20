import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import {
    LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, SHADOWUPDATE_REALTIME
} from '../constants.js';
import { ShadowMap } from './shadow-map.js';
import { RenderPassShadowLocalNonClustered } from './render-pass-shadow-local-non-clustered.js';

/**
 * @import { Camera } from '../camera.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { FrameGraph } from '../../scene/frame-graph.js'
 * @import { Frustum } from '../../core/shape/frustum.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { LayerComposition } from '../composition/layer-composition.js'
 * @import { Light } from '../../scene/light.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { Renderer } from './renderer.js'
 * @import { ShadowRenderer } from './shadow-renderer.js'
 */

// a bit per omni shadow cube map face
const ALL_FACES = 0x3f;

// the world axis each omni cube map face looks down, in the face order of
// LightCamera.pointLightRotations: +X, -X, +Y, -Y, +Z, -Z. Each entry is the axis index the face
// looks along, the sign of that axis, and the two lateral axis indices.
const FACE_AXES = [
    [0, 1, 1, 2], [0, -1, 1, 2],
    [1, 1, 0, 2], [1, -1, 0, 2],
    [2, 1, 0, 1], [2, -1, 0, 1]
];

// scratch corner sets, as flat [x, y, z] triples
const _cameraCorners = new Float64Array(24);
const _faceCorners = new Float64Array(24);
const _lightPos = new Vec3();

/**
 * Tests whether every one of the eight corners lies outside a single plane of the frustum, which
 * proves the two volumes are disjoint. The converse does not hold - two disjoint volumes can fail
 * this test - so it is conservative in the safe direction.
 *
 * @param {Frustum} frustum - The frustum whose planes are tested.
 * @param {Float64Array} corners - 8 corners as 24 floats.
 * @returns {boolean} True when the corners are all outside one plane.
 */
function outsideAnyPlane(frustum, corners) {
    const p = frustum.planeData;
    for (let o = 0; o < 24; o += 4) {
        let allOutside = true;
        for (let c = 0; c < 24; c += 3) {
            if (p[o] * corners[c] + p[o + 1] * corners[c + 1] + p[o + 2] * corners[c + 2] + p[o + 3] >= 0) {
                allOutside = false;
                break;
            }
        }
        if (allOutside) {
            return true;
        }
    }
    return false;
}

class ShadowRendererLocal {
    // temporary list to collect lights to render shadows for
    shadowLights = [];

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

    // Minimal prerequisite for local shadow-pass creation: ensure the shadow map exists. This is
    // caster- and camera-independent, so it can run early in the frame (before the frame graph is
    // built and before mesh culling), mirroring ShadowRendererDirectional#prepareShadowMap, so the
    // map exists when the frame graph build and the forward pass reference it. Clustered lighting
    // uses the shadow atlas, so no per-light map is allocated.
    prepareShadowMap(light) {
        if (!this.renderer.scene.clusteredLightingEnabled && !light._shadowMap) {
            light._shadowMap = ShadowMap.create(this.device, light);
        }
    }

    /**
     * Which of an omni light's six shadow cube map faces can be sampled by any of the supplied
     * cameras. All six face frusta share the light's position as their apex, so a light sitting
     * inside a camera's frustum always needs all six - the saving is for lights outside a frustum
     * whose range still reaches into it.
     *
     * Only ever called for lights whose shadow is re-rendered every frame. A cached shadow must
     * keep all six faces: it would be retired by {@link Culler#consumeOneShotShadows} after the
     * partial render and could never fill in a face that a later camera position needs.
     *
     * @param {Light} light - The omni light, with its shadow cameras already set up.
     * @param {CameraComponent[]} cameras - The cameras that may sample this shadow map.
     * @returns {number} A bit per face, in the face order of LightCamera.pointLightRotations.
     * @private
     */
    _visibleShadowFaces(light, cameras) {

        const range = light.attenuationEnd;
        _lightPos.copy(light._node.getPosition());

        let mask = 0;
        for (let c = 0; c < cameras.length && mask !== ALL_FACES; c++) {

            const cameraComponent = cameras[c];
            if (!cameraComponent.enabled) {
                continue;
            }
            const camera = cameraComponent.camera;

            // a light inside the frustum needs every face, and this is the common case, so it is
            // worth short circuiting before any per-face work
            if (camera.frustum.containsPoint(_lightPos)) {
                return ALL_FACES;
            }

            // degenerate frustum (a zero sized canvas gives one) - assume everything is needed
            if (camera.frustum.getCorners(_cameraCorners) !== 8) {
                return ALL_FACES;
            }

            for (let face = 0; face < 6; face++) {
                const bit = 1 << face;
                if (mask & bit) {
                    continue;
                }

                const shadowCam = light.getRenderData(null, face).shadowCamera;
                const axis = FACE_AXES[face];
                const slope = Math.tan(shadowCam.fov * 0.5 * math.DEG_TO_RAD);
                const near = shadowCam.nearClip;

                // the face's eight corners: the near and far quads of its pyramid
                let n = 0;
                for (const axial of [near, range]) {
                    const lateral = axial * slope;
                    for (const su of [-1, 1]) {
                        for (const sv of [-1, 1]) {
                            _faceCorners[n] = _lightPos.x;
                            _faceCorners[n + 1] = _lightPos.y;
                            _faceCorners[n + 2] = _lightPos.z;
                            _faceCorners[n + axis[0]] += axis[1] * axial;
                            _faceCorners[n + axis[2]] += su * lateral;
                            _faceCorners[n + axis[3]] += sv * lateral;
                            n += 3;
                        }
                    }
                }

                if (!outsideAnyPlane(camera.frustum, _faceCorners) &&
                    !outsideAnyPlane(shadowCam.frustum, _cameraCorners)) {
                    mask |= bit;
                }
            }
        }

        return mask;
    }

    /**
     * Culls the shadow casters of a local light.
     *
     * @param {Light} light - The light.
     * @param {LayerComposition} comp - The layer composition, used as the source of shadow casters
     * when they are not supplied directly.
     * @param {MeshInstance[]} [casters] - Optional shadow casters to use instead of the
     * composition's.
     * @param {CameraComponent[]} [cameras] - The cameras that may sample this shadow map. When
     * supplied, an omni light's cube map faces that none of them can sample are skipped. Omit it
     * when there is no camera context - the lightmapper bakes with its own cameras - and all six
     * faces are culled and rendered.
     */
    cull(light, comp, casters = null, cameras = null) {

        const isClustered = this.renderer.scene.clusteredLightingEnabled;

        // force light visibility if function was manually called
        light.visibleThisFrame = true;

        // allocate shadow map unless in clustered lighting mode
        this.prepareShadowMap(light);

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

            shadowCam.updateFrustum();

            // cull shadow casters - a spot light has a single face and is culled against its
            // frustum, an omni light is culled against all six faces in a single pass below
            if (type === LIGHTTYPE_SPOT) {
                this.shadowRenderer.cullShadowCasters(comp, light, lightRenderData.visibleCasters, shadowCam, casters);
            }
        }

        if (type === LIGHTTYPE_OMNI) {

            // Skip the faces no camera can sample. Only for shadows that re-render every frame, so
            // a face that becomes visible later is simply rendered on that frame - see
            // _visibleShadowFaces. The skipped faces are still cleared by the render pass, they
            // just get no casters, so a face wrongly skipped costs a missing shadow rather than
            // leaving another light's depth in the atlas tile.
            const faceMask = (cameras && light.shadowUpdateMode === SHADOWUPDATE_REALTIME) ?
                this._visibleShadowFaces(light, cameras) : ALL_FACES;

            this.shadowRenderer.cullShadowCastersOmni(comp, light, casters, faceMask);
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
     *
     * @param {FrameGraph} frameGraph - The frame graph.
     * @param {Light[]} localLights - The list of local lights.
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
