import { DebugHelper } from '../../core/debug.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Mat4 } from '../../core/math/mat4.js';

import { ADDRESS_CLAMP_TO_EDGE, CULLFACE_NONE, FILTER_NEAREST, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { Texture } from '../../platform/graphics/texture.js';

import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI } from '../constants.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { LightCamera } from './light-camera.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { QuadRender } from '../graphics/quad-render.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

const textureBlitVertexShader = `
    attribute vec2 vertex_position;
    varying vec2 uv0;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.5, 1.0);
        uv0 = vertex_position.xy * 0.5 + 0.5;
        #ifndef WEBGPU
            uv0.y = 1.0 - uv0.y;
        #endif
    }`;

const textureBlitFragmentShader = `
    varying vec2 uv0;
    uniform sampler2D blitTexture;
    void main(void) {
        gl_FragColor = texture2D(blitTexture, uv0);
    }`;

// shader runs for each face, with inViewProj matrix representing a face camera
const textureCubeBlitFragmentShader = `
    varying vec2 uv0;
    uniform samplerCube blitTexture;
    uniform mat4 invViewProj;
    void main(void) {
        vec4 projPos = vec4(uv0 * 2.0 - 1.0, 0.5, 1.0);
        vec4 worldPos = invViewProj * projPos;
        gl_FragColor = textureCube(blitTexture, worldPos.xyz);
    }`;

const _viewport = new Vec4();
const _filteredLights = [];

// helper class used by clustered lighting system to render cookies into the texture atlas, similarly to shadow renderer
class CookieRenderer {
    /** @type {QuadRender|null} */
    _quadRenderer2D = null;

    /** @type {QuadRender|null} */
    _quadRendererCube = null;

    constructor(device, lightTextureAtlas) {
        this.device = device;
        this.lightTextureAtlas = lightTextureAtlas;

        this.blitTextureId = this.device.scope.resolve('blitTexture');
        this.invViewProjId = this.device.scope.resolve('invViewProj');
    }

    destroy() {
        this._quadRenderer2D?.destroy();
        this._quadRenderer2D = null;

        this._quadRendererCube?.destroy();
        this._quadRendererCube = null;
    }

    get quadRenderer2D() {
        if (!this._quadRenderer2D) {
            const shader = createShaderFromCode(this.device, textureBlitVertexShader, textureBlitFragmentShader, `cookieRenderer2d`);
            this._quadRenderer2D = new QuadRender(shader);
        }
        return this._quadRenderer2D;
    }

    get quadRendererCube() {
        if (!this._quadRendererCube) {
            const shader = createShaderFromCode(this.device, textureBlitVertexShader, textureCubeBlitFragmentShader, `cookieRendererCube`);
            this._quadRendererCube = new QuadRender(shader);
        }
        return this._quadRendererCube;
    }

    static createTexture(device, resolution) {

        const texture = new Texture(device, {
            name: 'CookieAtlas',
            width: resolution,
            height: resolution,
            format: PIXELFORMAT_RGBA8,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        return texture;
    }

    // for rendering of cookies, store inverse view projection matrices for 6 faces, allowing cubemap faces to be copied into the atlas
    static _invViewProjMatrices = null;

    initInvViewProjMatrices() {
        if (!CookieRenderer._invViewProjMatrices) {
            CookieRenderer._invViewProjMatrices = [];

            for (let face = 0; face < 6; face++) {
                const camera = LightCamera.create(null, LIGHTTYPE_OMNI, face);
                const projMat = camera.projectionMatrix;
                const viewMat = camera.node.getLocalTransform().clone().invert();
                CookieRenderer._invViewProjMatrices[face] = new Mat4().mul2(projMat, viewMat).invert();
            }
        }
    }

    filter(lights) {

        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];

            // skip directional lights
            if (light._type === LIGHTTYPE_DIRECTIONAL)
                continue;

            // skip clustered cookies with no assigned atlas slot
            if (!light.atlasViewportAllocated)
                continue;

            // only render cookie when the slot is reassigned (assuming the cookie texture is static)
            if (!light.atlasSlotUpdated)
                continue;

            if (light.enabled && light.cookie && light.visibleThisFrame) {
                _filteredLights.push(light);
            }
        }
    }

    render(renderTarget, lights) {

        // pick lights we need to update the cookies for
        this.filter(lights);
        if (_filteredLights.length <= 0)
            return;

        // prepare a single render pass to render all quads to the render target
        const device = this.device;
        const renderPass = new RenderPass(device, () => {

            // render state
            device.setBlendState(BlendState.NOBLEND);
            device.setCullMode(CULLFACE_NONE);
            device.setDepthState(DepthState.NODEPTH);
            device.setStencilState(null, null);

            for (let i = 0; i < _filteredLights.length; i++) {
                const light = _filteredLights[i];

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
                        const offset = this.lightTextureAtlas.cubeSlotsOffsets[face];
                        _viewport.x += smallSize * offset.x;
                        _viewport.y += smallSize * offset.y;
                        _viewport.z = smallSize;
                        _viewport.w = smallSize;

                        // cubemap face projection uniform
                        this.invViewProjId.setValue(CookieRenderer._invViewProjMatrices[face].data);
                    }

                    _viewport.mulScalar(renderTarget.colorBuffer.width);

                    quad.render(_viewport);
                }

                DebugGraphics.popGpuMarker(device);
            }
        });

        DebugHelper.setName(renderPass, `RenderPass-CookieRenderer`);
        renderPass.init(renderTarget);
        renderPass.colorOps.clear = false;
        renderPass.depthStencilOps.clearDepth = false;

        // render the pass
        renderPass.render();

        _filteredLights.length = 0;
    }
}

export { CookieRenderer };
