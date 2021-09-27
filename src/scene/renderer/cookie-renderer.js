import { Vec3 } from '../../math/vec3.js';
import { Vec4 } from '../../math/vec4.js';
import { Mat4 } from '../../math/mat4.js';

import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R8_G8_B8_A8 } from '../../graphics/constants.js';
import { Texture } from "../../graphics/texture.js";
import { createShaderFromCode } from '../../graphics/program-lib/utils.js';
import { drawQuadWithShader } from '../../graphics/simple-post-effect.js';

import { PROJECTION_PERSPECTIVE } from '../constants.js';
import { Camera } from '../camera.js';
import { GraphNode } from '../graph-node.js';

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
const _viewMat = new Mat4();
const _viewProjMat = new Mat4();
const _viewportMatrix = new Mat4();

// helper class used by clustered lighting system to render cookies into the texture atlas, similarly to shadow renderer
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

    // temporary camera to calculate spot light cookie view-projection matrix
    static _cookieCamera = null;

    static evalCookieMatrix(light) {

        let cookieCamera = CookieRenderer._cookieCamera;
        if (!cookieCamera) {
            cookieCamera = new Camera();
            cookieCamera.projection = PROJECTION_PERSPECTIVE;
            cookieCamera.aspectRatio = 1;
            cookieCamera.node = new GraphNode();
            CookieRenderer._cookieCamera = cookieCamera;
        }

        cookieCamera.fov = light._outerConeAngle * 2;

        const cookieNode = cookieCamera._node;
        cookieNode.setPosition(light._node.getPosition());
        cookieNode.setRotation(light._node.getRotation());
        cookieNode.rotateLocal(-90, 0, 0);

        _viewMat.setTRS(cookieNode.getPosition(), cookieNode.getRotation(), Vec3.ONE).invert();
        _viewProjMat.mul2(cookieCamera.projectionMatrix, _viewMat);

        const cookieMatrix = light.cookieMatrix;

        const rectViewport = light.cookieViewport;
        _viewportMatrix.setViewport(rectViewport.x, rectViewport.y, rectViewport.z, rectViewport.w);
        cookieMatrix.mul2(_viewportMatrix, _viewProjMat);

        return cookieMatrix;
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

                // render it to a viewport of the target
                _viewport.copy(light.cookieViewport).mulScalar(renderTarget.colorBuffer.width);
                drawQuadWithShader(device, renderTarget, shader, _viewport);
            }

            // #if _DEBUG
            this.device.popMarker();
            // #endif
        }
    }
}

export { CookieRenderer };
