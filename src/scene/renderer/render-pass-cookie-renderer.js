import { Debug } from '../../core/debug.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Mat4 } from '../../core/math/mat4.js';
import { CULLFACE_NONE, FRONTFACE_CCW, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI } from '../constants.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import { LightCamera } from './light-camera.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { QuadRender } from '../graphics/quad-render.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

/**
 * @import { EventHandle } from '../../core/event-handle.js';
 */

const _viewport = new Vec4();

// for rendering of cookies, store inverse view projection matrices for 6 faces, allowing cubemap faces to be copied into the atlas
const _invViewProjMatrices = [];

/**
 * A render pass used to render cookie textures (both 2D and Cubemap) into the texture atlas.
 *
 * @ignore
 */
class RenderPassCookieRenderer extends RenderPass {
    /** @type {QuadRender|null} */
    _quadRenderer2D = null;

    /** @type {QuadRender|null} */
    _quadRendererCube = null;

    _filteredLights = [];

    _forceCopy = false;

    /**
     * Event handle for device restored event.
     *
     * @type {EventHandle|null}
     * @private
     */
    _evtDeviceRestored = null;

    constructor(device, cubeSlotsOffsets) {
        super(device);
        this._cubeSlotsOffsets = cubeSlotsOffsets;

        this.requiresCubemaps = false;

        this.blitTextureId = device.scope.resolve('blitTexture');
        this.invViewProjId = device.scope.resolve('invViewProj');

        this._evtDeviceRestored = device.on('devicerestored', this.onDeviceRestored, this);
    }

    destroy() {
        this._quadRenderer2D?.destroy();
        this._quadRenderer2D = null;

        this._quadRendererCube?.destroy();
        this._quadRendererCube = null;

        this._evtDeviceRestored?.off();
        this._evtDeviceRestored = null;
    }

    static create(renderTarget, cubeSlotsOffsets) {

        Debug.assert(renderTarget);

        // prepare a single render pass to render all quads to the render target
        const renderPass = new RenderPassCookieRenderer(renderTarget.device, cubeSlotsOffsets);
        renderPass.init(renderTarget);
        renderPass.colorOps.clear = false;
        renderPass.depthStencilOps.clearDepth = false;

        return renderPass;
    }

    onDeviceRestored() {
        this._forceCopy = true;
    }

    update(lights) {

        // pick lights we need to update the cookies for
        const filteredLights = this._filteredLights;
        this.filter(lights, filteredLights);

        // enabled / disable the pass
        this.executeEnabled = filteredLights.length > 0;
    }

    filter(lights, filteredLights) {

        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];

            // skip directional lights
            if (light._type === LIGHTTYPE_DIRECTIONAL) {
                continue;
            }

            // skip clustered cookies with no assigned atlas slot
            if (!light.atlasViewportAllocated) {
                continue;
            }

            // only render cookie when the slot is reassigned (assuming the cookie texture is static)
            if (!light.atlasSlotUpdated && !this._forceCopy) {
                continue;
            }

            if (light.enabled && light.cookie && light.visibleThisFrame) {
                filteredLights.push(light);
            }
        }

        this._forceCopy = false;
    }

    initInvViewProjMatrices() {
        if (!_invViewProjMatrices.length) {
            for (let face = 0; face < 6; face++) {
                const camera = LightCamera.create(null, LIGHTTYPE_OMNI, face);
                const projMat = camera.projectionMatrix;
                const viewMat = camera.node.getLocalTransform().clone().invert();
                _invViewProjMatrices[face] = new Mat4().mul2(projMat, viewMat).invert();
            }
        }
    }

    get quadRenderer2D() {
        if (!this._quadRenderer2D) {
            const shader = ShaderUtils.createShader(this.device, {
                uniqueName: 'cookieRenderer2d',
                attributes: { vertex_position: SEMANTIC_POSITION },
                vertexChunk: 'cookieBlitVS',
                fragmentChunk: 'cookieBlit2DPS'
            });
            this._quadRenderer2D = new QuadRender(shader);
        }
        return this._quadRenderer2D;
    }

    get quadRendererCube() {
        if (!this._quadRendererCube) {
            const shader = ShaderUtils.createShader(this.device, {
                uniqueName: 'cookieRendererCube',
                attributes: { vertex_position: SEMANTIC_POSITION },
                vertexChunk: 'cookieBlitVS',
                fragmentChunk: 'cookieBlitCubePS'
            });
            this._quadRendererCube = new QuadRender(shader);
        }
        return this._quadRendererCube;
    }

    execute() {

        // render state
        const device = this.device;
        device.setBlendState(BlendState.NOBLEND);
        device.setCullMode(CULLFACE_NONE);
        device.setFrontFace(FRONTFACE_CCW);
        device.setDepthState(DepthState.NODEPTH);
        device.setStencilState();

        const renderTargetWidth = this.renderTarget.colorBuffer.width;
        const cubeSlotsOffsets = this._cubeSlotsOffsets;

        const filteredLights = this._filteredLights;
        for (let i = 0; i < filteredLights.length; i++) {
            const light = filteredLights[i];

            DebugGraphics.pushGpuMarker(this.device, `COOKIE ${light._node.name}`);

            const faceCount = light.numShadowFaces;
            const quad = faceCount > 1 ? this.quadRendererCube : this.quadRenderer2D;

            if (faceCount > 1) {
                this.initInvViewProjMatrices();
            }

            // source texture
            this.blitTextureId.setValue(light.cookie);

            // render it to a viewport of the target
            for (let face = 0; face < faceCount; face++) {

                _viewport.copy(light.atlasViewport);

                if (faceCount > 1) {

                    // for cubemap, render to one of the 3x3 sub-areas
                    const smallSize = _viewport.z / 3;
                    const offset = cubeSlotsOffsets[face];
                    _viewport.x += smallSize * offset.x;
                    _viewport.y += smallSize * offset.y;
                    _viewport.z = smallSize;
                    _viewport.w = smallSize;

                    // cubemap face projection uniform
                    this.invViewProjId.setValue(_invViewProjMatrices[face].data);
                }

                _viewport.mulScalar(renderTargetWidth);

                quad.render(_viewport);
            }

            DebugGraphics.popGpuMarker(device);
        }

        filteredLights.length = 0;
    }
}

export { RenderPassCookieRenderer };
