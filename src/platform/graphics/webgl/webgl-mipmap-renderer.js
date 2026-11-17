import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PRIMITIVE_TRIANGLES, SEMANTIC_POSITION,
    TEXPROPERTY_ADDRESS_U, TEXPROPERTY_ADDRESS_V, TEXPROPERTY_MAG_FILTER, TEXPROPERTY_MIN_FILTER
} from '../constants.js';
import { BlendState } from '../blend-state.js';
import { DebugGraphics } from '../debug-graphics.js';
import { DepthState } from '../depth-state.js';
import { Shader } from '../shader.js';
import { ShaderDefinitionUtils } from '../shader-definition-utils.js';
import { Texture } from '../texture.js';
import { TextureUtils } from '../texture-utils.js';

/**
 * @import { ScopeId } from '../scope-id.js'
 * @import { WebglGraphicsDevice } from './webgl-graphics-device.js'
 */

/**
 * @typedef {object} ScratchTarget
 * @property {Texture} texture - The texture the mip levels are rendered to.
 * @property {WebGLFramebuffer|null} framebuffer - Its framebuffer, null until created.
 * @ignore
 */

const _quadPrimitive = {
    type: PRIMITIVE_TRIANGLES,
    base: 0,
    count: 6,
    indexed: true
};

const vsSrc = /* glsl */`
    attribute vec2 vertex_position;
    varying vec2 pcTexCoord;
    void main() {
        gl_Position = vec4(vertex_position, 0.0, 1.0);
        pcTexCoord = vertex_position * 0.5 + 0.5;
    }
`;

// 13 bilinear taps of the previous mip level, weighted to approximate a Gaussian blur over about
// 6x6 of its texels - the same filter as the Gaussian variant of the WebGPU mipmap renderer
const fsSrc = /* glsl */`
    uniform sampler2D pcSource;
    uniform vec3 pcSourceLevel;
    varying vec2 pcTexCoord;

    vec4 tap(float x, float y) {
        return texture2DLod(pcSource, pcTexCoord + vec2(x, y) * pcSourceLevel.xy, pcSourceLevel.z);
    }

    void main() {
        gl_FragColor = tap(0.0, 0.0) * 0.125 +
            (tap(-2.0, 2.0) + tap(2.0, 2.0) + tap(-2.0, -2.0) + tap(2.0, -2.0)) * 0.03125 +
            (tap(0.0, 2.0) + tap(-2.0, 0.0) + tap(2.0, 0.0) + tap(0.0, -2.0)) * 0.0625 +
            (tap(-1.0, 1.0) + tap(1.0, 1.0) + tap(-1.0, -1.0) + tap(1.0, -1.0)) * 0.125;
    }
`;

/**
 * Generates the mipmaps of 2D textures with the Gaussian filter of {@link MIPMAPFILTER_GAUSSIAN},
 * which WebGL's own mipmap generation does not provide. A texture cannot be rendered to while it
 * is sampled, and limiting the levels it is sampled from makes the level rendered to an incomplete
 * attachment. So each mip level is rendered from the previous one into a scratch texture, and then
 * blitted into the texture.
 *
 * @ignore
 */
class WebglMipmapRenderer {
    /**
     * @type {WebglGraphicsDevice}
     * @private
     */
    _device;

    /**
     * @type {Shader|null}
     * @private
     */
    _shader = null;

    /**
     * @type {ScopeId|null}
     * @private
     */
    _sourceId = null;

    /**
     * @type {ScopeId|null}
     * @private
     */
    _sourceLevelId = null;

    /**
     * The texel size and the mip level of the level sampled.
     *
     * @private
     */
    _sourceLevel = new Float32Array(3);

    /**
     * The scratch targets, one per texture format, each as large as the largest first mip level
     * it was used for.
     *
     * @type {Map<number, ScratchTarget>}
     * @private
     */
    _scratch = new Map();

    /**
     * The framebuffer the mip levels of the texture are attached to, to be blitted to.
     *
     * @type {WebGLFramebuffer|null}
     * @private
     */
    _levelFramebuffer = null;

    /**
     * The WebGL textures whose mip levels were allocated. The levels of a texture are only defined
     * once WebGL generates them, and a level which is not defined cannot be blitted to.
     *
     * @type {WeakSet<WebGLTexture>}
     * @private
     */
    _allocated = new WeakSet();

    /**
     * @param {WebglGraphicsDevice} device - The WebGL graphics device.
     */
    constructor(device) {
        this._device = device;
    }

    destroy() {
        this._shader?.destroy();
        this._shader = null;
        this._scratch.forEach(scratch => this._destroyScratch(scratch));
        this._scratch.clear();
        if (this._levelFramebuffer) {
            this._device.gl.deleteFramebuffer(this._levelFramebuffer);
            this._levelFramebuffer = null;
        }
    }

    /**
     * Forgets the framebuffers, which are gone with the lost context. The shader and the scratch
     * textures are restored by the device.
     */
    loseContext() {
        this._scratch.forEach((scratch) => {
            scratch.framebuffer = null;
        });
        this._levelFramebuffer = null;
        this._allocated = new WeakSet();
    }

    /**
     * @param {ScratchTarget} scratch - The scratch target to destroy.
     * @private
     */
    _destroyScratch(scratch) {
        scratch.texture.destroy();
        if (scratch.framebuffer) {
            this._device.gl.deleteFramebuffer(scratch.framebuffer);
        }
    }

    /**
     * Returns the shader, creating it on first call.
     *
     * @returns {Shader} The shader.
     * @private
     */
    _getShader() {
        if (!this._shader) {
            const device = this._device;
            this._shader = new Shader(device, ShaderDefinitionUtils.createDefinition(device, {
                name: 'MipmapGaussian',
                attributes: { vertex_position: SEMANTIC_POSITION },
                vertexCode: vsSrc,
                fragmentCode: fsSrc
            }));
            this._sourceId = device.scope.resolve('pcSource');
            this._sourceLevelId = device.scope.resolve('pcSourceLevel');
        }
        return this._shader;
    }

    /**
     * Returns the scratch target for the first mip level of the texture, creating or growing it as
     * needed, with its framebuffer.
     *
     * @param {Texture} texture - The texture.
     * @returns {ScratchTarget} The scratch target.
     * @private
     */
    _getScratch(texture) {
        const device = this._device;
        const gl = device.gl;
        const width = Math.max(1, texture.width >> 1);
        const height = Math.max(1, texture.height >> 1);

        let scratch = this._scratch.get(texture.format);
        if (!scratch || scratch.texture.width < width || scratch.texture.height < height) {

            // grow to fit the textures it was used for before as well
            if (scratch) {
                this._destroyScratch(scratch);
            }
            scratch = {
                texture: new Texture(device, {
                    name: 'MipmapScratch',
                    width: Math.max(width, scratch?.texture.width ?? 0),
                    height: Math.max(height, scratch?.texture.height ?? 0),
                    format: texture.format,
                    mipmaps: false,
                    minFilter: FILTER_NEAREST,
                    magFilter: FILTER_NEAREST,
                    addressU: ADDRESS_CLAMP_TO_EDGE,
                    addressV: ADDRESS_CLAMP_TO_EDGE
                }),
                framebuffer: null
            };
            this._scratch.set(texture.format, scratch);
        }

        // allocate the texture (also after a context loss), and attach it to its framebuffer
        if (!scratch.framebuffer) {
            device.setTexture(scratch.texture, device.maxCombinedTextures - 1);
            scratch.framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, scratch.framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, scratch.texture.impl._glTexture, 0);
            device.activeFramebuffer = scratch.framebuffer;
        }

        return scratch;
    }

    /**
     * Generates the mip levels of a 2D texture from its top level.
     *
     * @param {Texture} texture - The texture.
     */
    generate(texture) {
        const device = this._device;
        const gl = device.gl;
        const glTexture = texture.impl._glTexture;

        DebugGraphics.pushGpuMarker(device, 'MIPMAP-GAUSSIAN');

        device.activeTexture(device.maxCombinedTextures - 1);
        device.bindTexture(texture);

        // apply the pending sampling setup of the texture now, which the draws below would apply
        // otherwise, replacing the setup the levels are sampled with
        if (texture.impl.dirtyParameterFlags) {
            device.setTextureParameters(texture);
            texture.impl.dirtyParameterFlags = 0;
        }

        // let WebGL define the mip levels the first time, they are replaced below
        if (!this._allocated.has(glTexture)) {
            gl.generateMipmap(gl.TEXTURE_2D);
            this._allocated.add(glTexture);
        }

        // sample single levels bilinearly and clamped, whatever the sampling setup of the texture,
        // which is restored when the texture is next bound
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // the texture can be the color buffer of the render target still set on the device, and
        // the device reports sampling it as an error
        const renderTarget = device.renderTarget;
        device.renderTarget = null;
        const prevFramebuffer = device.activeFramebuffer;
        const { vx, vy, vw, vh, sx, sy, sw, sh } = device;

        const scratch = this._getScratch(texture);
        this._levelFramebuffer ??= gl.createFramebuffer();

        device.setDrawStates(BlendState.NOBLEND, DepthState.NODEPTH);
        device.setShader(this._getShader());

        // WebGL defines the whole mip chain, whatever the number of levels of the texture, and
        // samples all of it, so all of its levels are generated, as WebGL's own generation does
        const numLevels = TextureUtils.calcMipLevelsCount(texture.width, texture.height);

        let width = texture.width;
        let height = texture.height;
        for (let level = 1; level < numLevels; level++) {
            this._sourceLevel[0] = 1 / width;
            this._sourceLevel[1] = 1 / height;
            this._sourceLevel[2] = level - 1;
            width = Math.max(1, width >> 1);
            height = Math.max(1, height >> 1);

            // render the level from the previous one, into the scratch texture
            this._sourceId.setValue(texture);
            this._sourceLevelId.setValue(this._sourceLevel);
            device.setFramebuffer(scratch.framebuffer);
            device.setViewport(0, 0, width, height);
            device.setScissor(0, 0, width, height);

            // the device forgets the vertex buffers after each draw
            device.setVertexBuffer(device.quadVertexBuffer);
            device.draw(_quadPrimitive, device.quadIndexBuffer);

            // and copy it into the level of the texture
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, scratch.framebuffer);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._levelFramebuffer);
            gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glTexture, level);
            gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
            gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);

            // the blit left other framebuffers bound than the device knows about
            gl.bindFramebuffer(gl.FRAMEBUFFER, scratch.framebuffer);
        }

        texture.propertyChanged(TEXPROPERTY_MIN_FILTER | TEXPROPERTY_MAG_FILTER | TEXPROPERTY_ADDRESS_U | TEXPROPERTY_ADDRESS_V);

        gl.bindFramebuffer(gl.FRAMEBUFFER, prevFramebuffer);
        device.activeFramebuffer = prevFramebuffer;
        device.setViewport(vx, vy, vw, vh);
        device.setScissor(sx, sy, sw, sh);
        device.renderTarget = renderTarget;

        DebugGraphics.popGpuMarker(device);
    }
}

export { WebglMipmapRenderer };
