import { Debug } from '../../core/debug.js';

import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_NEAREST,
    PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_R32F
} from '../../platform/graphics/constants.js';

import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';

import {
    LAYERID_DEPTH,
    SHADER_DEPTH
} from '../constants.js';

import { Layer } from '../layer.js';

// uniform names (first is current name, second one is deprecated name for compatibility)
const _depthUniformNames = ['uSceneDepthMap', 'uDepthMap'];

/**
 * Internal class abstracting the access to the depth texture of the scene.
 * For webgl 2 devices, the depth buffer is copied to a texture
 * for webgl 1 devices, the scene's depth is rendered to a separate RGBA texture
 *
 * @ignore
 */
class SceneGrab {
    /**
     * Create an instance of SceneGrab.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device.
     * @param {import('../scene.js').Scene} scene - The scene.
     */
    constructor(device, scene) {

        Debug.assert(scene);
        this.scene = scene;

        Debug.assert(device);
        this.device = device;

        // create depth layer
        this.layer = null;

        // null device does not support scene grab
        if (this.device.isNull) {

            this.layer = new Layer({
                enabled: false,
                name: "Depth",
                id: LAYERID_DEPTH
            });

            return;
        }

        // create a depth layer, which is a default depth layer, but also a template used
        // to patch application created depth layers to behave as one
        if (this.device.webgl2 || this.device.isWebGPU) {
            this.initMainPath();
        } else {
            this.initFallbackPath();
        }
    }

    /**
     * Returns true if the camera rendering scene grab textures requires a render pass to do it.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device used for rendering.
     * @param {import('../../framework/components/camera/component.js').CameraComponent} camera - The camera that
     * needs scene grab textures.
     */
    static requiresRenderPass(device, camera) {

        // just copy out the textures, no render pass needed
        if (device.webgl2 || device.isWebGPU) {
            return false;
        }

        // on WebGL1 device, only depth rendering needs render pass
        return camera.renderSceneDepthMap;
    }

    setupUniform(device, buffer) {

        // assign it to scopes to expose it to shaders
        _depthUniformNames.forEach(name => device.scope.resolve(name).setValue(buffer));
    }

    allocateTexture(device, source, name, format) {

        // allocate texture that will store the depth
        return new Texture(device, {
            name,
            format,
            width: source ? source.colorBuffer.width : device.width,
            height: source ? source.colorBuffer.height : device.height,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
    }

    // texture format of the source texture the grab pass needs to copy
    getSourceColorFormat(texture) {
        // based on the RT the camera renders to, otherwise framebuffer
        return texture?.format ?? this.device.backBufferFormat;
    }

    shouldReallocate(targetRT, sourceTexture) {

        // need to reallocate if dimensions don't match
        const width = sourceTexture?.width || this.device.width;
        const height = sourceTexture?.height || this.device.height;
        return !targetRT || width !== targetRT.width || height !== targetRT.height;
    }

    allocateRenderTarget(renderTarget, sourceRenderTarget, device, format, isDepth) {

        // allocate texture buffer
        const buffer = this.allocateTexture(device, sourceRenderTarget, _depthUniformNames[0], format);

        if (renderTarget) {

            // if reallocating RT size, release previous framebuffer
            renderTarget.destroyFrameBuffers();

            // assign new texture
            if (isDepth) {
                renderTarget._depthBuffer = buffer;
            } else {
                renderTarget._colorBuffer = buffer;
                renderTarget._colorBuffers = [buffer];
            }
        } else {

            // create new render target with the texture
            renderTarget = new RenderTarget({
                name: 'renderTargetSceneGrab',
                colorBuffer: isDepth ? null : buffer,
                depthBuffer: isDepth ? buffer : null,
                depth: !isDepth,
                stencil: device.supportsStencil,
                autoResolve: false
            });
        }

        return renderTarget;
    }

    releaseRenderTarget(rt) {

        if (rt) {
            rt.destroyTextureBuffers();
            rt.destroy();
        }
    }

    // main path where both color and depth is copied from existing surface
    initMainPath() {

        const device = this.device;
        const self = this;

        // WebGL 2 depth layer just copies existing color or depth
        this.layer = new Layer({
            enabled: false,
            name: "Depth",
            id: LAYERID_DEPTH,

            onDisable: function () {
                self.releaseRenderTarget(this.depthRenderTarget);
                this.depthRenderTarget = null;
            },

            onPreRenderOpaque: function (cameraPass) { // resize depth map if needed

                /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
                const camera = this.cameras[cameraPass];

                if (camera.renderSceneDepthMap) {

                    let useDepthBuffer = true;
                    let format = PIXELFORMAT_DEPTHSTENCIL;
                    if (device.isWebGPU) {
                        const numSamples = camera.renderTarget?.samples ?? device.samples;

                        // when depth buffer is multi-sampled, instead of copying it out, we use custom shader to resolve it
                        // to a R32F texture, used as a color attachment of the render target
                        if (numSamples > 1) {
                            format = PIXELFORMAT_R32F;
                            useDepthBuffer = false;
                        }
                    }

                    const sourceTexture = camera.renderTarget?.depthBuffer ?? camera.renderTarget?.colorBuffer;

                    // reallocate RT if needed
                    if (self.shouldReallocate(this.depthRenderTarget, sourceTexture)) {
                        self.releaseRenderTarget(this.depthRenderTarget);
                        this.depthRenderTarget = self.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, format, useDepthBuffer);
                    }

                    // WebGL2 multisampling depth handling: we resolve multi-sampled depth buffer to a single-sampled destination buffer.
                    // We could use existing API and resolve depth first and then blit it to destination, but this avoids the extra copy.
                    if (device.webgl2 && device.renderTarget.samples > 1) {

                        // multi-sampled buffer
                        const src = device.renderTarget.impl._glFrameBuffer;

                        // single sampled destination buffer
                        const dest = this.depthRenderTarget;
                        device.renderTarget = dest;
                        device.updateBegin();

                        this.depthRenderTarget.impl.internalResolve(device, src, dest.impl._glFrameBuffer, this.depthRenderTarget, device.gl.DEPTH_BUFFER_BIT);

                    } else {

                        // copy depth
                        DebugGraphics.pushGpuMarker(device, 'GRAB-DEPTH');
                        device.copyRenderTarget(device.renderTarget, this.depthRenderTarget, false, true);
                        DebugGraphics.popGpuMarker(device);
                    }

                    // assign uniform
                    self.setupUniform(device, useDepthBuffer ? this.depthRenderTarget.depthBuffer : this.depthRenderTarget.colorBuffer);
                }
            },

            onPostRenderOpaque: function (cameraPass) {
            }
        });
    }

    // unused but left till the above path is converted to a render pass
    initFallbackPath() {

        this.layer = new Layer({
            enabled: false,
            name: "Depth",
            id: LAYERID_DEPTH,
            shaderPass: SHADER_DEPTH,

            onEnable: function () {
            },

            onDisable: function () {
            },

            onPostCull: function (cameraPass) {
            },

            onPreRenderOpaque: function (cameraPass) {
            },

            onDrawCall: function () {
            },

            onPostRenderOpaque: function (cameraPass) {
            }
        });
    }

    // function which patches a layer to use depth layer set up in this class
    patch(layer) {

        layer.onEnable = this.layer.onEnable;
        layer.onDisable = this.layer.onDisable;
        layer.onPreRenderOpaque = this.layer.onPreRenderOpaque;
        layer.onPostRenderOpaque = this.layer.onPostRenderOpaque;
        layer.shaderPass = this.layer.shaderPass;
        layer.onPostCull = this.layer.onPostCull;
        layer.onDrawCall = this.layer.onDrawCall;
    }
}

export { SceneGrab };
