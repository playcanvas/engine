import { Vec4 } from '../../math/vec4.js';
import { Mat4 } from '../../math/mat4.js';

import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R8_G8_B8_A8 } from '../../graphics/constants.js';
import { Texture } from '../../graphics/texture.js';
import { createShaderFromCode } from '../../graphics/program-lib/utils.js';
import { drawQuadWithShader } from '../../graphics/simple-post-effect.js';

import { LIGHTTYPE_OMNI } from '../constants.js';
import { LightCamera } from './light-camera.js';

const textureBlitVertexShader = `
    attribute vec2 vertex_position;
    varying vec2 uv0;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.5, 1.0);
        uv0 = vertex_position.xy * 0.5 + 0.5;
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

// helper class used by clustered lighting system to render cookies into the texture atlas, similarly to shadow renderer
class CookieRenderer {
    constructor(device, lightTextureAtlas) {
        this.device = device;
        this.lightTextureAtlas = lightTextureAtlas;

        this.blitShader2d = null;
        this.blitShaderCube = null;
        this.blitTextureId = null;
        this.invViewProjId = null;
    }

    destroy() {
    }

    getShader(shader, fragment) {

        if (!this[shader])
            this[shader] = createShaderFromCode(this.device, textureBlitVertexShader, fragment, `cookie_renderer_${shader}`);

        if (!this.blitTextureId)
            this.blitTextureId = this.device.scope.resolve("blitTexture");

        if (!this.invViewProjId)
            this.invViewProjId = this.device.scope.resolve("invViewProj");

        return this[shader];
    }

    get shader2d() {
        return this.getShader("blitShader2d", textureBlitFragmentShader);
    }

    get shaderCube() {
        return this.getShader("blitShaderCube", textureCubeBlitFragmentShader);
    }

    static createTexture(device, resolution) {

        const texture = new Texture(device, {
            width: resolution,
            height: resolution,
            format: PIXELFORMAT_R8_G8_B8_A8,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        texture.name = "CookieAtlas";

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

    render(light, renderTarget) {

        if (light.enabled && light.cookie && light.visibleThisFrame) {

            // #if _DEBUG
            this.device.pushMarker("COOKIE " + light._node.name);
            // #endif

            const faceCount = light.numShadowFaces;
            const shader = faceCount > 1 ? this.shaderCube : this.shader2d;
            const device = this.device;

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
                drawQuadWithShader(device, renderTarget, shader, _viewport);
            }

            // #if _DEBUG
            this.device.popMarker();
            // #endif
        }
    }
}

export { CookieRenderer };
