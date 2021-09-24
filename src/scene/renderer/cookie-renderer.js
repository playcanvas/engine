import { Vec4 } from '../../math/vec4.js';

import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R8_G8_B8_A8 } from '../../graphics/constants.js';
import { Texture } from "../../graphics/texture.js";
import { createShaderFromCode } from '../../graphics/program-lib/utils.js';
import { drawQuadWithShader } from '../../graphics/simple-post-effect.js';

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

const _viewport = new Vec4();

class CookieRenderer {
    constructor(device) {
        this.device = device;
        this.blitShader = null;
        this.blitTextureId = null;
    }

    destroy() {
    }

    get shader() {

        if (!this.blitShader) {
            this.blitShader = createShaderFromCode(this.device, textureBlitVertexShader, textureBlitFragmentShader, "cookieTextureBlitShader");
            this.blitTextureId = this.device.scope.resolve("blitTexture");
        }

        return this.blitShader;
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

    render(light, renderTarget) {

        if (light.enabled && light.cookie && light.visibleThisFrame) {

            // #if _DEBUG
            this.device.pushMarker("COOKIE " + light._node.name);
            // #endif

            const shader = this.shader;
            const device = this.device;

            const faceCount = light.numShadowFaces;
            for (let face = 0; face < faceCount; face++) {

                // source texture
                this.blitTextureId.setValue(light.cookie);

                // render it viewport of the target
                const lightRenderData = light.getRenderData(null, face);
                _viewport.copy(lightRenderData.shadowViewport).mulScalar(renderTarget.colorBuffer.width);
                drawQuadWithShader(device, renderTarget, shader, _viewport);
            }

            // #if _DEBUG
            this.device.popMarker();
            // #endif
        }
    }
}

export { CookieRenderer };
