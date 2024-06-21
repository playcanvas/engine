import { math } from '../../../core/math/math.js';
import { Debug } from '../../../core/debug.js';
import { platform } from '../../../core/platform.js';
import { Color } from '../../../core/math/color.js';

import {
    CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL,
    CULLFACE_NONE,
    FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR,
    FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR,
    FUNC_ALWAYS,
    PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32F,
    STENCILOP_KEEP,
    UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3,
    UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2,
    UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4,
    UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_TEXTURE2D_SHADOW,
    UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY,
    UNIFORMTYPE_UINT, UNIFORMTYPE_UVEC2, UNIFORMTYPE_UVEC3, UNIFORMTYPE_UVEC4, UNIFORMTYPE_ITEXTURE2D, UNIFORMTYPE_UTEXTURE2D,
    UNIFORMTYPE_ITEXTURECUBE, UNIFORMTYPE_UTEXTURECUBE, UNIFORMTYPE_ITEXTURE3D, UNIFORMTYPE_UTEXTURE3D, UNIFORMTYPE_ITEXTURE2D_ARRAY,
    UNIFORMTYPE_UTEXTURE2D_ARRAY, UNIFORMTYPE_INTARRAY, UNIFORMTYPE_UINTARRAY, UNIFORMTYPE_BOOLARRAY, UNIFORMTYPE_IVEC2ARRAY,
    UNIFORMTYPE_BVEC2ARRAY, UNIFORMTYPE_UVEC2ARRAY, UNIFORMTYPE_IVEC3ARRAY, UNIFORMTYPE_BVEC3ARRAY, UNIFORMTYPE_UVEC3ARRAY,
    UNIFORMTYPE_IVEC4ARRAY, UNIFORMTYPE_BVEC4ARRAY, UNIFORMTYPE_UVEC4ARRAY, UNIFORMTYPE_MAT4ARRAY,
    semanticToLocation, getPixelFormatArrayType,
    UNIFORMTYPE_TEXTURE2D_ARRAY,
    PRIMITIVE_TRISTRIP,
    DEVICETYPE_WEBGL2
} from '../constants.js';

import { GraphicsDevice } from '../graphics-device.js';
import { RenderTarget } from '../render-target.js';
import { Texture } from '../texture.js';
import { DebugGraphics } from '../debug-graphics.js';

import { WebglVertexBuffer } from './webgl-vertex-buffer.js';
import { WebglIndexBuffer } from './webgl-index-buffer.js';
import { WebglShader } from './webgl-shader.js';
import { WebglTexture } from './webgl-texture.js';
import { WebglRenderTarget } from './webgl-render-target.js';
import { ShaderUtils } from '../shader-utils.js';
import { Shader } from '../shader.js';
import { BlendState } from '../blend-state.js';
import { DepthState } from '../depth-state.js';
import { StencilParameters } from '../stencil-parameters.js';
import { WebglGpuProfiler } from './webgl-gpu-profiler.js';
import { TextureUtils } from '../texture-utils.js';

const invalidateAttachments = [];

const _fullScreenQuadVS = /* glsl */`
attribute vec2 vertex_position;
varying vec2 vUv0;
void main(void)
{
    gl_Position = vec4(vertex_position, 0.5, 1.0);
    vUv0 = vertex_position.xy*0.5+0.5;
}
`;

const _precisionTest1PS = /* glsl */`
void main(void) { 
    gl_FragColor = vec4(2147483648.0);
}
`;

const _precisionTest2PS = /* glsl */`
uniform sampler2D source;
vec4 packFloat(float depth) {
    const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
    const vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
    vec4 res = mod(depth * bit_shift * vec4(255), vec4(256) ) / vec4(255);
    res -= res.xxyz * bit_mask;
    return res;
}
void main(void) {
    float c = texture2D(source, vec2(0.0)).r;
    float diff = abs(c - 2147483648.0) / 2147483648.0;
    gl_FragColor = packFloat(diff);
}
`;

const _outputTexture2D = /* glsl */`
varying vec2 vUv0;
uniform sampler2D source;
void main(void) {
    gl_FragColor = texture2D(source, vUv0);
}
`;

function quadWithShader(device, target, shader) {

    DebugGraphics.pushGpuMarker(device, "QuadWithShader");

    const oldRt = device.renderTarget;
    device.setRenderTarget(target);
    device.updateBegin();

    device.setCullMode(CULLFACE_NONE);
    device.setBlendState(BlendState.NOBLEND);
    device.setDepthState(DepthState.NODEPTH);
    device.setStencilState(null, null);

    device.setVertexBuffer(device.quadVertexBuffer, 0);
    device.setShader(shader);

    device.draw({
        type: PRIMITIVE_TRISTRIP,
        base: 0,
        count: 4,
        indexed: false
    });

    device.updateEnd();

    device.setRenderTarget(oldRt);
    device.updateBegin();

    DebugGraphics.popGpuMarker(device);
}

function testTextureFloatHighPrecision(device) {
    if (!device.textureFloatRenderable)
        return false;

    const shader1 = new Shader(device, ShaderUtils.createDefinition(device, {
        name: 'ptest1',
        vertexCode: _fullScreenQuadVS,
        fragmentCode: _precisionTest1PS
    }));

    const shader2 = new Shader(device, ShaderUtils.createDefinition(device, {
        name: 'ptest2',
        vertexCode: _fullScreenQuadVS,
        fragmentCode: _precisionTest2PS
    }));

    const textureOptions = {
        format: PIXELFORMAT_RGBA32F,
        width: 1,
        height: 1,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        name: 'testFHP'
    };
    const tex1 = new Texture(device, textureOptions);
    const targ1 = new RenderTarget({
        colorBuffer: tex1,
        depth: false
    });
    quadWithShader(device, targ1, shader1);

    textureOptions.format = PIXELFORMAT_RGBA8;
    const tex2 = new Texture(device, textureOptions);
    const targ2 = new RenderTarget({
        colorBuffer: tex2,
        depth: false
    });
    device.constantTexSource.setValue(tex1);
    quadWithShader(device, targ2, shader2);

    const prevFramebuffer = device.activeFramebuffer;
    device.setFramebuffer(targ2.impl._glFrameBuffer);

    const pixels = new Uint8Array(4);
    device.readPixels(0, 0, 1, 1, pixels);

    device.setFramebuffer(prevFramebuffer);

    const x = pixels[0] / 255;
    const y = pixels[1] / 255;
    const z = pixels[2] / 255;
    const w = pixels[3] / 255;
    const f = x / (256 * 256 * 256) + y / (256 * 256) + z / 256 + w;

    tex1.destroy();
    targ1.destroy();
    tex2.destroy();
    targ2.destroy();
    shader1.destroy();
    shader2.destroy();

    return f === 0;
}

/**
 * WebglGraphicsDevice extends the base {@link GraphicsDevice} to provide rendering capabilities
 * utilizing the WebGL 2.0 specification.
 *
 * @category Graphics
 */
class WebglGraphicsDevice extends GraphicsDevice {
    /**
     * The WebGL2 context managed by the graphics device.
     *
     * @type {WebGL2RenderingContext}
     * @ignore
     */
    gl;

    /**
     * WebGLFramebuffer object that represents the backbuffer of the device for a rendering frame.
     * When null, this is a framebuffer created when the device was created, otherwise it is a
     * framebuffer supplied by the XR session.
     *
     * @ignore
     */
    _defaultFramebuffer = null;

    /**
     * True if the default framebuffer has changed since the last frame.
     *
     * @ignore
     */
    _defaultFramebufferChanged = false;

    /**
     * Creates a new WebglGraphicsDevice instance.
     *
     * @param {HTMLCanvasElement} canvas - The canvas to which the graphics device will render.
     * @param {object} [options] - Options passed when creating the WebGL context.
     * @param {boolean} [options.alpha] - Boolean that indicates if the canvas contains an
     * alpha buffer. Defaults to true.
     * @param {boolean} [options.depth] - Boolean that indicates that the drawing buffer is
     * requested to have a depth buffer of at least 16 bits. Defaults to true.
     * @param {boolean} [options.stencil] - Boolean that indicates that the drawing buffer is
     * requested to have a stencil buffer of at least 8 bits. Defaults to true.
     * @param {boolean} [options.antialias] - Boolean that indicates whether or not to perform
     * anti-aliasing if possible. Defaults to true.
     * @param {boolean} [options.premultipliedAlpha] - Boolean that indicates that the page
     * compositor will assume the drawing buffer contains colors with pre-multiplied alpha.
     * Defaults to true.
     * @param {boolean} [options.preserveDrawingBuffer] - If the value is true the buffers will not
     * be cleared and will preserve their values until cleared or overwritten by the author.
     * Defaults to false.
     * @param {'default'|'high-performance'|'low-power'} [options.powerPreference] - A hint to the
     * user agent indicating what configuration of GPU is suitable for the WebGL context. Possible
     * values are:
     *
     * - 'default': Let the user agent decide which GPU configuration is most suitable. This is the
     * default value.
     * - 'high-performance': Prioritizes rendering performance over power consumption.
     * - 'low-power': Prioritizes power saving over rendering performance.
     *
     * Defaults to 'default'.
     * @param {boolean} [options.failIfMajorPerformanceCaveat] - Boolean that indicates if a
     * context will be created if the system performance is low or if no hardware GPU is available.
     * Defaults to false.
     * @param {boolean} [options.desynchronized] - Boolean that hints the user agent to reduce the
     * latency by desynchronizing the canvas paint cycle from the event loop. Defaults to false.
     * @param {boolean} [options.xrCompatible] - Boolean that hints to the user agent to use a
     * compatible graphics adapter for an immersive XR device.
     * @param {WebGL2RenderingContext} [options.gl] - The rendering context
     * to use. If not specified, a new context will be created.
     */
    constructor(canvas, options = {}) {
        super(canvas, options);
        options = this.initOptions;

        this.updateClientRect();

        // initialize this before registering lost context handlers to avoid undefined access when the device is created lost.
        this.initTextureUnits();

        // Add handlers for when the WebGL context is lost or restored
        this.contextLost = false;

        this._contextLostHandler = (event) => {
            event.preventDefault();
            this.loseContext();
            Debug.log('pc.GraphicsDevice: WebGL context lost.');
            this.fire('devicelost');
        };

        this._contextRestoredHandler = () => {
            Debug.log('pc.GraphicsDevice: WebGL context restored.');
            this.restoreContext();
            this.fire('devicerestored');
        };

        // #4136 - turn off antialiasing on AppleWebKit browsers 15.4
        const ua = (typeof navigator !== 'undefined') && navigator.userAgent;
        this.forceDisableMultisampling = ua && ua.includes('AppleWebKit') && (ua.includes('15.4') || ua.includes('15_4'));
        if (this.forceDisableMultisampling) {
            options.antialias = false;
            Debug.log("Antialiasing has been turned off due to rendering issues on AppleWebKit 15.4");
        }

        // #5856 - turn off antialiasing on Windows Firefox
        if (platform.browserName === 'firefox' && platform.name === 'windows') {
            const ua = (typeof navigator !== 'undefined') ? navigator.userAgent : '';
            const match = ua.match(/Firefox\/(\d+(\.\d+)*)/);
            const firefoxVersion = match ? match[1] : null;
            if (firefoxVersion) {
                const version = parseFloat(firefoxVersion);
                if (version >= 120 || version === 115) {
                    options.antialias = false;
                    Debug.log("Antialiasing has been turned off due to rendering issues on Windows Firefox esr115 and 120+. Current version: " + firefoxVersion);
                }
            }
        }

        // we always allocate the default framebuffer without antialiasing, so remove that option
        this.backBufferAntialias = options.antialias ?? false;
        options.antialias = false;

        // Retrieve the WebGL context
        /** @type {WebGL2RenderingContext} */
        const gl = options.gl ?? canvas.getContext('webgl2', options);

        if (!gl) {
            throw new Error("WebGL not supported");
        }

        this.gl = gl;
        this.isWebGL2 = true;
        this._deviceType = DEVICETYPE_WEBGL2;

        // pixel format of the framebuffer
        this.updateBackbufferFormat(null);

        const isChrome = platform.browserName === 'chrome';
        const isSafari = platform.browserName === 'safari';
        const isMac = platform.browser && navigator.appVersion.indexOf("Mac") !== -1;

        // enable temporary texture unit workaround on desktop safari
        this._tempEnableSafariTextureUnitWorkaround = isSafari;

        // enable temporary workaround for glBlitFramebuffer failing on Mac Chrome (#2504)
        this._tempMacChromeBlitFramebufferWorkaround = isMac && isChrome && !options.alpha;

        canvas.addEventListener("webglcontextlost", this._contextLostHandler, false);
        canvas.addEventListener("webglcontextrestored", this._contextRestoredHandler, false);

        this.initializeExtensions();
        this.initializeCapabilities();
        this.initializeRenderState();
        this.initializeContextCaches();

        this.createBackbuffer(null);

        // only enable ImageBitmap on chrome
        this.supportsImageBitmap = !isSafari && typeof ImageBitmap !== 'undefined';

        // supported sampler types
        this._samplerTypes = new Set([
            gl.SAMPLER_2D,
            gl.SAMPLER_CUBE,
            gl.UNSIGNED_INT_SAMPLER_2D,
            gl.INT_SAMPLER_2D,
            gl.SAMPLER_2D_SHADOW,
            gl.SAMPLER_CUBE_SHADOW,
            gl.SAMPLER_3D,
            gl.INT_SAMPLER_3D,
            gl.UNSIGNED_INT_SAMPLER_3D,
            gl.SAMPLER_2D_ARRAY,
            gl.INT_SAMPLER_2D_ARRAY,
            gl.UNSIGNED_INT_SAMPLER_2D_ARRAY
        ]);

        this.glAddress = [
            gl.REPEAT,
            gl.CLAMP_TO_EDGE,
            gl.MIRRORED_REPEAT
        ];

        this.glBlendEquation = [
            gl.FUNC_ADD,
            gl.FUNC_SUBTRACT,
            gl.FUNC_REVERSE_SUBTRACT,
            gl.MIN,
            gl.MAX
        ];

        this.glBlendFunctionColor = [
            gl.ZERO,
            gl.ONE,
            gl.SRC_COLOR,
            gl.ONE_MINUS_SRC_COLOR,
            gl.DST_COLOR,
            gl.ONE_MINUS_DST_COLOR,
            gl.SRC_ALPHA,
            gl.SRC_ALPHA_SATURATE,
            gl.ONE_MINUS_SRC_ALPHA,
            gl.DST_ALPHA,
            gl.ONE_MINUS_DST_ALPHA,
            gl.CONSTANT_COLOR,
            gl.ONE_MINUS_CONSTANT_COLOR
        ];

        this.glBlendFunctionAlpha = [
            gl.ZERO,
            gl.ONE,
            gl.SRC_COLOR,
            gl.ONE_MINUS_SRC_COLOR,
            gl.DST_COLOR,
            gl.ONE_MINUS_DST_COLOR,
            gl.SRC_ALPHA,
            gl.SRC_ALPHA_SATURATE,
            gl.ONE_MINUS_SRC_ALPHA,
            gl.DST_ALPHA,
            gl.ONE_MINUS_DST_ALPHA,
            gl.CONSTANT_ALPHA,
            gl.ONE_MINUS_CONSTANT_ALPHA
        ];

        this.glComparison = [
            gl.NEVER,
            gl.LESS,
            gl.EQUAL,
            gl.LEQUAL,
            gl.GREATER,
            gl.NOTEQUAL,
            gl.GEQUAL,
            gl.ALWAYS
        ];

        this.glStencilOp = [
            gl.KEEP,
            gl.ZERO,
            gl.REPLACE,
            gl.INCR,
            gl.INCR_WRAP,
            gl.DECR,
            gl.DECR_WRAP,
            gl.INVERT
        ];

        this.glClearFlag = [
            0,
            gl.COLOR_BUFFER_BIT,
            gl.DEPTH_BUFFER_BIT,
            gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT,
            gl.STENCIL_BUFFER_BIT,
            gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT,
            gl.STENCIL_BUFFER_BIT | gl.DEPTH_BUFFER_BIT,
            gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT
        ];

        this.glCull = [
            0,
            gl.BACK,
            gl.FRONT,
            gl.FRONT_AND_BACK
        ];

        this.glFilter = [
            gl.NEAREST,
            gl.LINEAR,
            gl.NEAREST_MIPMAP_NEAREST,
            gl.NEAREST_MIPMAP_LINEAR,
            gl.LINEAR_MIPMAP_NEAREST,
            gl.LINEAR_MIPMAP_LINEAR
        ];

        this.glPrimitive = [
            gl.POINTS,
            gl.LINES,
            gl.LINE_LOOP,
            gl.LINE_STRIP,
            gl.TRIANGLES,
            gl.TRIANGLE_STRIP,
            gl.TRIANGLE_FAN
        ];

        this.glType = [
            gl.BYTE,
            gl.UNSIGNED_BYTE,
            gl.SHORT,
            gl.UNSIGNED_SHORT,
            gl.INT,
            gl.UNSIGNED_INT,
            gl.FLOAT,
            gl.HALF_FLOAT
        ];

        this.pcUniformType = {};
        this.pcUniformType[gl.BOOL]         = UNIFORMTYPE_BOOL;
        this.pcUniformType[gl.INT]          = UNIFORMTYPE_INT;
        this.pcUniformType[gl.FLOAT]        = UNIFORMTYPE_FLOAT;
        this.pcUniformType[gl.FLOAT_VEC2]   = UNIFORMTYPE_VEC2;
        this.pcUniformType[gl.FLOAT_VEC3]   = UNIFORMTYPE_VEC3;
        this.pcUniformType[gl.FLOAT_VEC4]   = UNIFORMTYPE_VEC4;
        this.pcUniformType[gl.INT_VEC2]     = UNIFORMTYPE_IVEC2;
        this.pcUniformType[gl.INT_VEC3]     = UNIFORMTYPE_IVEC3;
        this.pcUniformType[gl.INT_VEC4]     = UNIFORMTYPE_IVEC4;
        this.pcUniformType[gl.BOOL_VEC2]    = UNIFORMTYPE_BVEC2;
        this.pcUniformType[gl.BOOL_VEC3]    = UNIFORMTYPE_BVEC3;
        this.pcUniformType[gl.BOOL_VEC4]    = UNIFORMTYPE_BVEC4;
        this.pcUniformType[gl.FLOAT_MAT2]   = UNIFORMTYPE_MAT2;
        this.pcUniformType[gl.FLOAT_MAT3]   = UNIFORMTYPE_MAT3;
        this.pcUniformType[gl.FLOAT_MAT4]   = UNIFORMTYPE_MAT4;
        this.pcUniformType[gl.SAMPLER_2D]   = UNIFORMTYPE_TEXTURE2D;
        this.pcUniformType[gl.SAMPLER_CUBE] = UNIFORMTYPE_TEXTURECUBE;
        this.pcUniformType[gl.UNSIGNED_INT]         = UNIFORMTYPE_UINT;
        this.pcUniformType[gl.UNSIGNED_INT_VEC2]    = UNIFORMTYPE_UVEC2;
        this.pcUniformType[gl.UNSIGNED_INT_VEC3]    = UNIFORMTYPE_UVEC3;
        this.pcUniformType[gl.UNSIGNED_INT_VEC4]    = UNIFORMTYPE_UVEC4;

        this.pcUniformType[gl.SAMPLER_2D_SHADOW]   = UNIFORMTYPE_TEXTURE2D_SHADOW;
        this.pcUniformType[gl.SAMPLER_CUBE_SHADOW] = UNIFORMTYPE_TEXTURECUBE_SHADOW;
        this.pcUniformType[gl.SAMPLER_2D_ARRAY]    = UNIFORMTYPE_TEXTURE2D_ARRAY;
        this.pcUniformType[gl.SAMPLER_3D]          = UNIFORMTYPE_TEXTURE3D;

        this.pcUniformType[gl.INT_SAMPLER_2D]           = UNIFORMTYPE_ITEXTURE2D;
        this.pcUniformType[gl.UNSIGNED_INT_SAMPLER_2D]  = UNIFORMTYPE_UTEXTURE2D;

        this.pcUniformType[gl.INT_SAMPLER_CUBE]         = UNIFORMTYPE_ITEXTURECUBE;
        this.pcUniformType[gl.UNSIGNED_INT_SAMPLER_2D]  = UNIFORMTYPE_UTEXTURECUBE;

        this.pcUniformType[gl.INT_SAMPLER_3D]           = UNIFORMTYPE_ITEXTURE3D;
        this.pcUniformType[gl.UNSIGNED_INT_SAMPLER_3D]  = UNIFORMTYPE_UTEXTURE3D;

        this.pcUniformType[gl.INT_SAMPLER_2D_ARRAY]     = UNIFORMTYPE_ITEXTURE2D_ARRAY;
        this.pcUniformType[gl.UNSIGNED_INT_SAMPLER_2D_ARRAY] = UNIFORMTYPE_UTEXTURE2D_ARRAY;

        this.targetToSlot = {};
        this.targetToSlot[gl.TEXTURE_2D] = 0;
        this.targetToSlot[gl.TEXTURE_CUBE_MAP] = 1;
        this.targetToSlot[gl.TEXTURE_3D] = 2;

        // Define the uniform commit functions
        let scopeX, scopeY, scopeZ, scopeW;
        let uniformValue;
        this.commitFunction = [];
        this.commitFunction[UNIFORMTYPE_BOOL] = function (uniform, value) {
            if (uniform.value !== value) {
                gl.uniform1i(uniform.locationId, value);
                uniform.value = value;
            }
        };
        this.commitFunction[UNIFORMTYPE_INT] = this.commitFunction[UNIFORMTYPE_BOOL];
        this.commitFunction[UNIFORMTYPE_FLOAT] = function (uniform, value) {
            if (uniform.value !== value) {
                gl.uniform1f(uniform.locationId, value);
                uniform.value = value;
            }
        };
        this.commitFunction[UNIFORMTYPE_VEC2]  = function (uniform, value) {
            uniformValue = uniform.value;
            scopeX = value[0];
            scopeY = value[1];
            if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY) {
                gl.uniform2fv(uniform.locationId, value);
                uniformValue[0] = scopeX;
                uniformValue[1] = scopeY;
            }
        };
        this.commitFunction[UNIFORMTYPE_VEC3]  = function (uniform, value) {
            uniformValue = uniform.value;
            scopeX = value[0];
            scopeY = value[1];
            scopeZ = value[2];
            if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ) {
                gl.uniform3fv(uniform.locationId, value);
                uniformValue[0] = scopeX;
                uniformValue[1] = scopeY;
                uniformValue[2] = scopeZ;
            }
        };
        this.commitFunction[UNIFORMTYPE_VEC4]  = function (uniform, value) {
            uniformValue = uniform.value;
            scopeX = value[0];
            scopeY = value[1];
            scopeZ = value[2];
            scopeW = value[3];
            if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ || uniformValue[3] !== scopeW) {
                gl.uniform4fv(uniform.locationId, value);
                uniformValue[0] = scopeX;
                uniformValue[1] = scopeY;
                uniformValue[2] = scopeZ;
                uniformValue[3] = scopeW;
            }
        };
        this.commitFunction[UNIFORMTYPE_IVEC2] = function (uniform, value) {
            uniformValue = uniform.value;
            scopeX = value[0];
            scopeY = value[1];
            if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY) {
                gl.uniform2iv(uniform.locationId, value);
                uniformValue[0] = scopeX;
                uniformValue[1] = scopeY;
            }
        };
        this.commitFunction[UNIFORMTYPE_BVEC2] = this.commitFunction[UNIFORMTYPE_IVEC2];
        this.commitFunction[UNIFORMTYPE_IVEC3] = function (uniform, value) {
            uniformValue = uniform.value;
            scopeX = value[0];
            scopeY = value[1];
            scopeZ = value[2];
            if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ) {
                gl.uniform3iv(uniform.locationId, value);
                uniformValue[0] = scopeX;
                uniformValue[1] = scopeY;
                uniformValue[2] = scopeZ;
            }
        };
        this.commitFunction[UNIFORMTYPE_BVEC3] = this.commitFunction[UNIFORMTYPE_IVEC3];
        this.commitFunction[UNIFORMTYPE_IVEC4] = function (uniform, value) {
            uniformValue = uniform.value;
            scopeX = value[0];
            scopeY = value[1];
            scopeZ = value[2];
            scopeW = value[3];
            if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ || uniformValue[3] !== scopeW) {
                gl.uniform4iv(uniform.locationId, value);
                uniformValue[0] = scopeX;
                uniformValue[1] = scopeY;
                uniformValue[2] = scopeZ;
                uniformValue[3] = scopeW;
            }
        };
        this.commitFunction[UNIFORMTYPE_BVEC4] = this.commitFunction[UNIFORMTYPE_IVEC4];
        this.commitFunction[UNIFORMTYPE_MAT2]  = function (uniform, value) {
            gl.uniformMatrix2fv(uniform.locationId, false, value);
        };
        this.commitFunction[UNIFORMTYPE_MAT3]  = function (uniform, value) {
            gl.uniformMatrix3fv(uniform.locationId, false, value);
        };
        this.commitFunction[UNIFORMTYPE_MAT4]  = function (uniform, value) {
            gl.uniformMatrix4fv(uniform.locationId, false, value);
        };
        this.commitFunction[UNIFORMTYPE_FLOATARRAY] = function (uniform, value) {
            gl.uniform1fv(uniform.locationId, value);
        };
        this.commitFunction[UNIFORMTYPE_VEC2ARRAY]  = function (uniform, value) {
            gl.uniform2fv(uniform.locationId, value);
        };
        this.commitFunction[UNIFORMTYPE_VEC3ARRAY]  = function (uniform, value) {
            gl.uniform3fv(uniform.locationId, value);
        };
        this.commitFunction[UNIFORMTYPE_VEC4ARRAY]  = function (uniform, value) {
            gl.uniform4fv(uniform.locationId, value);
        };

        this.commitFunction[UNIFORMTYPE_UINT] = function (uniform, value) {
            if (uniform.value !== value) {
                gl.uniform1ui(uniform.locationId, value);
                uniform.value = value;
            }
        };
        this.commitFunction[UNIFORMTYPE_UVEC2]  = function (uniform, value) {
            uniformValue = uniform.value;
            scopeX = value[0];
            scopeY = value[1];
            if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY) {
                gl.uniform2uiv(uniform.locationId, value);
                uniformValue[0] = scopeX;
                uniformValue[1] = scopeY;
            }
        };
        this.commitFunction[UNIFORMTYPE_UVEC3]  = function (uniform, value) {
            uniformValue = uniform.value;
            scopeX = value[0];
            scopeY = value[1];
            scopeZ = value[2];
            if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ) {
                gl.uniform3uiv(uniform.locationId, value);
                uniformValue[0] = scopeX;
                uniformValue[1] = scopeY;
                uniformValue[2] = scopeZ;
            }
        };
        this.commitFunction[UNIFORMTYPE_UVEC4] = function (uniform, value) {
            uniformValue = uniform.value;
            scopeX = value[0];
            scopeY = value[1];
            scopeZ = value[2];
            scopeW = value[3];
            if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ || uniformValue[3] !== scopeW) {
                gl.uniform4uiv(uniform.locationId, value);
                uniformValue[0] = scopeX;
                uniformValue[1] = scopeY;
                uniformValue[2] = scopeZ;
                uniformValue[3] = scopeW;
            }
        };

        this.commitFunction[UNIFORMTYPE_INTARRAY] = function (uniform, value) {
            gl.uniform1iv(uniform.locationId, value);
        };
        this.commitFunction[UNIFORMTYPE_UINTARRAY] = function (uniform, value) {
            gl.uniform1uiv(uniform.locationId, value);
        };
        this.commitFunction[UNIFORMTYPE_BOOLARRAY] = this.commitFunction[UNIFORMTYPE_INTARRAY];

        this.commitFunction[UNIFORMTYPE_IVEC2ARRAY]  = function (uniform, value) {
            gl.uniform2iv(uniform.locationId, value);
        };
        this.commitFunction[UNIFORMTYPE_UVEC2ARRAY]  = function (uniform, value) {
            gl.uniform2uiv(uniform.locationId, value);
        };
        this.commitFunction[UNIFORMTYPE_BVEC2ARRAY] = this.commitFunction[UNIFORMTYPE_IVEC2ARRAY];

        this.commitFunction[UNIFORMTYPE_IVEC3ARRAY]  = function (uniform, value) {
            gl.uniform3iv(uniform.locationId, value);
        };
        this.commitFunction[UNIFORMTYPE_UVEC3ARRAY]  = function (uniform, value) {
            gl.uniform3uiv(uniform.locationId, value);
        };
        this.commitFunction[UNIFORMTYPE_BVEC3ARRAY] = this.commitFunction[UNIFORMTYPE_IVEC3ARRAY];

        this.commitFunction[UNIFORMTYPE_IVEC4ARRAY]  = function (uniform, value) {
            gl.uniform4iv(uniform.locationId, value);
        };
        this.commitFunction[UNIFORMTYPE_UVEC4ARRAY]  = function (uniform, value) {
            gl.uniform4uiv(uniform.locationId, value);
        };
        this.commitFunction[UNIFORMTYPE_BVEC4ARRAY] = this.commitFunction[UNIFORMTYPE_IVEC4ARRAY];

        this.commitFunction[UNIFORMTYPE_MAT4ARRAY]  = function (uniform, value) {
            gl.uniformMatrix4fv(uniform.locationId, false, value);
        };

        this.constantTexSource = this.scope.resolve("source");

        // In WebGL2 float texture renderability is dictated by the EXT_color_buffer_float extension
        this.textureFloatRenderable = !!this.extColorBufferFloat;

        // render to half float buffers support - either of these two extensions
        this.extColorBufferHalfFloat = this.extColorBufferHalfFloat || !!this.extColorBufferFloat;

        this.supportsMorphTargetTexturesCore = (this.maxPrecision === "highp" && this.maxVertexTextures >= 2);

        this._textureFloatHighPrecision = undefined;

        this.postInit();
    }

    postInit() {
        super.postInit();

        this.gpuProfiler = new WebglGpuProfiler(this);
    }

    /**
     * Destroy the graphics device.
     */
    destroy() {
        super.destroy();
        const gl = this.gl;

        if (this.feedback) {
            gl.deleteTransformFeedback(this.feedback);
        }

        this.clearVertexArrayObjectCache();

        this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler, false);
        this.canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler, false);

        this._contextLostHandler = null;
        this._contextRestoredHandler = null;

        this.gl = null;

        super.postDestroy();
    }

    createBackbuffer(frameBuffer) {
        this.supportsStencil = this.initOptions.stencil;

        this.backBuffer = new RenderTarget({
            name: 'WebglFramebuffer',
            graphicsDevice: this,
            depth: this.initOptions.depth,
            stencil: this.supportsStencil,
            samples: this.samples
        });

        // use the default WebGL framebuffer for rendering
        this.backBuffer.impl.suppliedColorFramebuffer = frameBuffer;
    }

    // Update framebuffer format based on the current framebuffer, as this is use to create matching multi-sampled framebuffer
    updateBackbufferFormat(framebuffer) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        const alphaBits = this.gl.getParameter(this.gl.ALPHA_BITS);
        this.backBufferFormat = alphaBits ? PIXELFORMAT_RGBA8 : PIXELFORMAT_RGB8;
    }

    updateBackbuffer() {

        const resolutionChanged = this.canvas.width !== this.backBufferSize.x || this.canvas.height !== this.backBufferSize.y;
        if (this._defaultFramebufferChanged || resolutionChanged) {

            // if the default framebuffer changes (entering or exiting XR for example)
            if (this._defaultFramebufferChanged) {
                this.updateBackbufferFormat(this._defaultFramebuffer);
            }

            this._defaultFramebufferChanged = false;
            this.backBufferSize.set(this.canvas.width, this.canvas.height);

            // recreate the backbuffer with newly supplied framebuffer
            this.backBuffer.destroy();
            this.createBackbuffer(this._defaultFramebuffer);
        }
    }

    // provide webgl implementation for the vertex buffer
    createVertexBufferImpl(vertexBuffer, format) {
        return new WebglVertexBuffer();
    }

    // provide webgl implementation for the index buffer
    createIndexBufferImpl(indexBuffer) {
        return new WebglIndexBuffer(indexBuffer);
    }

    createShaderImpl(shader) {
        return new WebglShader(shader);
    }

    createTextureImpl(texture) {
        return new WebglTexture(texture);
    }

    createRenderTargetImpl(renderTarget) {
        return new WebglRenderTarget();
    }

    // #if _DEBUG
    pushMarker(name) {
        if (platform.browser && window.spector) {
            const label = DebugGraphics.toString();
            window.spector.setMarker(`${label} #`);
        }
    }

    popMarker() {
        if (platform.browser && window.spector) {
            const label = DebugGraphics.toString();
            if (label.length)
                window.spector.setMarker(`${label} #`);
            else
                window.spector.clearMarker();
        }
    }
    // #endif

    /**
     * Query the precision supported by ints and floats in vertex and fragment shaders. Note that
     * getShaderPrecisionFormat is not guaranteed to be present (such as some instances of the
     * default Android browser). In this case, assume highp is available.
     *
     * @returns {string} "highp", "mediump" or "lowp"
     * @ignore
     */
    getPrecision() {
        const gl = this.gl;
        let precision = "highp";

        if (gl.getShaderPrecisionFormat) {
            const vertexShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
            const vertexShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT);

            const fragmentShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
            const fragmentShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT);

            if (vertexShaderPrecisionHighpFloat && vertexShaderPrecisionMediumpFloat && fragmentShaderPrecisionHighpFloat && fragmentShaderPrecisionMediumpFloat) {

                const highpAvailable = vertexShaderPrecisionHighpFloat.precision > 0 && fragmentShaderPrecisionHighpFloat.precision > 0;
                const mediumpAvailable = vertexShaderPrecisionMediumpFloat.precision > 0 && fragmentShaderPrecisionMediumpFloat.precision > 0;

                if (!highpAvailable) {
                    if (mediumpAvailable) {
                        precision = "mediump";
                        Debug.warn("WARNING: highp not supported, using mediump");
                    } else {
                        precision = "lowp";
                        Debug.warn("WARNING: highp and mediump not supported, using lowp");
                    }
                }
            }
        }

        return precision;
    }

    getExtension() {
        for (let i = 0; i < arguments.length; i++) {
            if (this.supportedExtensions.indexOf(arguments[i]) !== -1) {
                return this.gl.getExtension(arguments[i]);
            }
        }
        return null;
    }

    get extDisjointTimerQuery() {
        // lazy evaluation as this is not typically used
        if (!this._extDisjointTimerQuery) {
            // Note that Firefox exposes EXT_disjoint_timer_query under WebGL2 rather than EXT_disjoint_timer_query_webgl2
            this._extDisjointTimerQuery = this.getExtension('EXT_disjoint_timer_query_webgl2', 'EXT_disjoint_timer_query');
        }
        return this._extDisjointTimerQuery;
    }

    /**
     * Initialize the extensions provided by the WebGL context.
     *
     * @ignore
     */
    initializeExtensions() {
        const gl = this.gl;
        this.supportedExtensions = gl.getSupportedExtensions() ?? [];
        this._extDisjointTimerQuery = null;

        this.textureRG11B10Renderable = true;

        if (this.isWebGL2) {
            this.extColorBufferFloat = this.getExtension('EXT_color_buffer_float');
        } else {
            this.extColorBufferFloat = null;
        }

        this.extDebugRendererInfo = this.getExtension('WEBGL_debug_renderer_info');

        this.extTextureFloatLinear = this.getExtension("OES_texture_float_linear");
        this.textureFloatFilterable = !!this.extTextureFloatLinear;

        this.extFloatBlend = this.getExtension("EXT_float_blend");
        this.extTextureFilterAnisotropic = this.getExtension('EXT_texture_filter_anisotropic', 'WEBKIT_EXT_texture_filter_anisotropic');
        this.extParallelShaderCompile = this.getExtension('KHR_parallel_shader_compile');

        // compressed textures
        this.extCompressedTextureETC1 = this.getExtension('WEBGL_compressed_texture_etc1');
        this.extCompressedTextureETC = this.getExtension('WEBGL_compressed_texture_etc');
        this.extCompressedTexturePVRTC = this.getExtension('WEBGL_compressed_texture_pvrtc', 'WEBKIT_WEBGL_compressed_texture_pvrtc');
        this.extCompressedTextureS3TC = this.getExtension('WEBGL_compressed_texture_s3tc', 'WEBKIT_WEBGL_compressed_texture_s3tc');
        this.extCompressedTextureATC = this.getExtension('WEBGL_compressed_texture_atc');
        this.extCompressedTextureASTC = this.getExtension('WEBGL_compressed_texture_astc');

        // iOS exposes this for half precision render targets on WebGL2 from iOS v 14.5beta
        this.extColorBufferHalfFloat = this.getExtension("EXT_color_buffer_half_float");
    }

    /**
     * Query the capabilities of the WebGL context.
     *
     * @ignore
     */
    initializeCapabilities() {
        const gl = this.gl;
        let ext;

        const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : "";

        this.maxPrecision = this.precision = this.getPrecision();

        const contextAttribs = gl.getContextAttributes();
        this.supportsMsaa = contextAttribs?.antialias ?? false;
        this.supportsStencil = contextAttribs?.stencil ?? false;

        // Query parameter values from the WebGL context
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        this.maxCubeMapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
        this.maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
        this.maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        this.maxCombinedTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
        this.maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
        this.vertexUniformsCount = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
        this.fragmentUniformsCount = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
        this.maxColorAttachments = gl.getParameter(gl.MAX_COLOR_ATTACHMENTS);
        this.maxVolumeSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);

        ext = this.extDebugRendererInfo;
        this.unmaskedRenderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
        this.unmaskedVendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '';

        // Mali-G52 has rendering issues with GPU particles including
        // SM-A225M, M2003J15SC and KFRAWI (Amazon Fire HD 8 2022)
        const maliRendererRegex = /\bMali-G52+/;

        // Samsung devices with Exynos (ARM) either crash or render incorrectly when using GPU for particles. See:
        // https://github.com/playcanvas/engine/issues/3967
        // https://github.com/playcanvas/engine/issues/3415
        // https://github.com/playcanvas/engine/issues/4514
        // Example UA matches: Starting 'SM' and any combination of letters or numbers:
        // Mozilla/5.0 (Linux, Android 12; SM-G970F Build/SP1A.210812.016; wv)
        const samsungModelRegex = /SM-[a-zA-Z0-9]+/;
        this.supportsGpuParticles = !(this.unmaskedVendor === 'ARM' && userAgent.match(samsungModelRegex)) &&
            !(this.unmaskedRenderer.match(maliRendererRegex));

        ext = this.extTextureFilterAnisotropic;
        this.maxAnisotropy = ext ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;

        const antialiasSupported = !this.forceDisableMultisampling;
        this.maxSamples = antialiasSupported ? gl.getParameter(gl.MAX_SAMPLES) : 1;

        // some devices incorrectly report max samples larger than 4
        this.maxSamples = Math.min(this.maxSamples, 4);

        // we handle anti-aliasing internally by allocating multi-sampled backbuffer
        this.samples = antialiasSupported && this.backBufferAntialias ? this.maxSamples : 1;

        // Don't allow area lights on old android devices, they often fail to compile the shader, run it incorrectly or are very slow.
        this.supportsAreaLights = !platform.android;

        // Also do not allow them when we only have small number of texture units
        if (this.maxTextures <= 8) {
            this.supportsAreaLights = false;
        }
    }

    /**
     * Set the initial render state on the WebGL context.
     *
     * @ignore
     */
    initializeRenderState() {
        super.initializeRenderState();

        const gl = this.gl;

        // Initialize render state to a known start state

        // default blend state
        gl.disable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ZERO);
        gl.blendEquation(gl.FUNC_ADD);
        gl.colorMask(true, true, true, true);

        gl.blendColor(0, 0, 0, 0);

        gl.enable(gl.CULL_FACE);

        this.cullFace = gl.BACK;
        gl.cullFace(gl.BACK);

        // default depth state
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);

        this.stencil = false;
        gl.disable(gl.STENCIL_TEST);

        this.stencilFuncFront = this.stencilFuncBack = FUNC_ALWAYS;
        this.stencilRefFront = this.stencilRefBack = 0;
        this.stencilMaskFront = this.stencilMaskBack = 0xFF;
        gl.stencilFunc(gl.ALWAYS, 0, 0xFF);

        this.stencilFailFront = this.stencilFailBack = STENCILOP_KEEP;
        this.stencilZfailFront = this.stencilZfailBack = STENCILOP_KEEP;
        this.stencilZpassFront = this.stencilZpassBack = STENCILOP_KEEP;
        this.stencilWriteMaskFront = 0xFF;
        this.stencilWriteMaskBack = 0xFF;
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        gl.stencilMask(0xFF);

        this.alphaToCoverage = false;
        this.raster = true;
        gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
        gl.disable(gl.RASTERIZER_DISCARD);

        this.depthBiasEnabled = false;
        gl.disable(gl.POLYGON_OFFSET_FILL);

        this.clearDepth = 1;
        gl.clearDepth(1);

        this.clearColor = new Color(0, 0, 0, 0);
        gl.clearColor(0, 0, 0, 0);

        this.clearStencil = 0;
        gl.clearStencil(0);

        gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);

        gl.enable(gl.SCISSOR_TEST);

        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

        this.unpackFlipY = false;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

        this.unpackPremultiplyAlpha = false;
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    }

    initTextureUnits(count = 16) {
        this.textureUnits = [];
        for (let i = 0; i < count; i++) {
            this.textureUnits.push([null, null, null]);
        }
    }

    initializeContextCaches() {
        super.initializeContextCaches();

        // cache of VAOs
        this._vaoMap = new Map();

        this.boundVao = null;
        this.activeFramebuffer = null;
        this.feedback = null;
        this.transformFeedbackBuffer = null;

        this.textureUnit = 0;
        this.initTextureUnits(this.maxCombinedTextures);
    }

    /**
     * Called when the WebGL context was lost. It releases all context related resources.
     *
     * @ignore
     */
    loseContext() {

        super.loseContext();

        // release shaders
        for (const shader of this.shaders) {
            shader.loseContext();
        }
    }

    /**
     * Called when the WebGL context is restored. It reinitializes all context related resources.
     *
     * @ignore
     */
    restoreContext() {

        this.initializeExtensions();
        this.initializeCapabilities();

        super.restoreContext();

        // Recompile all shaders
        for (const shader of this.shaders) {
            shader.restoreContext();
        }
    }

    /**
     * Set the active rectangle for rendering on the specified device.
     *
     * @param {number} x - The pixel space x-coordinate of the bottom left corner of the viewport.
     * @param {number} y - The pixel space y-coordinate of the bottom left corner of the viewport.
     * @param {number} w - The width of the viewport in pixels.
     * @param {number} h - The height of the viewport in pixels.
     */
    setViewport(x, y, w, h) {
        if ((this.vx !== x) || (this.vy !== y) || (this.vw !== w) || (this.vh !== h)) {
            this.gl.viewport(x, y, w, h);
            this.vx = x;
            this.vy = y;
            this.vw = w;
            this.vh = h;
        }
    }

    /**
     * Set the active scissor rectangle on the specified device.
     *
     * @param {number} x - The pixel space x-coordinate of the bottom left corner of the scissor rectangle.
     * @param {number} y - The pixel space y-coordinate of the bottom left corner of the scissor rectangle.
     * @param {number} w - The width of the scissor rectangle in pixels.
     * @param {number} h - The height of the scissor rectangle in pixels.
     */
    setScissor(x, y, w, h) {
        if ((this.sx !== x) || (this.sy !== y) || (this.sw !== w) || (this.sh !== h)) {
            this.gl.scissor(x, y, w, h);
            this.sx = x;
            this.sy = y;
            this.sw = w;
            this.sh = h;
        }
    }

    /**
     * Binds the specified framebuffer object.
     *
     * @param {WebGLFramebuffer | null} fb - The framebuffer to bind.
     * @ignore
     */
    setFramebuffer(fb) {
        if (this.activeFramebuffer !== fb) {
            const gl = this.gl;
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            this.activeFramebuffer = fb;
        }
    }

    /**
     * Copies source render target into destination render target. Mostly used by post-effects.
     *
     * @param {RenderTarget} [source] - The source render target. Defaults to frame buffer.
     * @param {RenderTarget} [dest] - The destination render target. Defaults to frame buffer.
     * @param {boolean} [color] - If true, will copy the color buffer. Defaults to false.
     * @param {boolean} [depth] - If true, will copy the depth buffer. Defaults to false.
     * @returns {boolean} True if the copy was successful, false otherwise.
     */
    copyRenderTarget(source, dest, color, depth) {
        const gl = this.gl;

        // if copying from the backbuffer
        if (source === this.backBuffer) {
            source = null;
        }

        if (color) {
            if (!dest) {
                // copying to backbuffer
                if (!source._colorBuffer) {
                    Debug.error("Can't copy empty color buffer to backbuffer");
                    return false;
                }
            } else if (source) {
                // copying to render target
                if (!source._colorBuffer || !dest._colorBuffer) {
                    Debug.error("Can't copy color buffer, because one of the render targets doesn't have it");
                    return false;
                }
                if (source._colorBuffer._format !== dest._colorBuffer._format) {
                    Debug.error("Can't copy render targets of different color formats");
                    return false;
                }
            }
        }
        if (depth && source) {
            if (!source._depth) {   // when depth is automatic, we cannot test the buffer nor its format
                if (!source._depthBuffer || !dest._depthBuffer) {
                    Debug.error("Can't copy depth buffer, because one of the render targets doesn't have it");
                    return false;
                }
                if (source._depthBuffer._format !== dest._depthBuffer._format) {
                    Debug.error("Can't copy render targets of different depth formats");
                    return false;
                }
            }
        }

        DebugGraphics.pushGpuMarker(this, 'COPY-RT');

        if (this.isWebGL2 && dest) {
            const prevRt = this.renderTarget;
            this.renderTarget = dest;
            this.updateBegin();

            // copy from single sampled framebuffer
            const src = source ? source.impl._glFrameBuffer : this.backBuffer?.impl._glFrameBuffer;

            const dst = dest.impl._glFrameBuffer;
            Debug.assert(src !== dst, 'Source and destination framebuffers must be different when blitting.');

            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
            const w = source ? source.width : dest.width;
            const h = source ? source.height : dest.height;

            gl.blitFramebuffer(0, 0, w, h,
                               0, 0, w, h,
                               (color ? gl.COLOR_BUFFER_BIT : 0) | (depth ? gl.DEPTH_BUFFER_BIT : 0),
                               gl.NEAREST);

            // TODO: not sure we need to restore the prev target, as this only should run in-between render passes
            this.renderTarget = prevRt;
            gl.bindFramebuffer(gl.FRAMEBUFFER, prevRt ? prevRt.impl._glFrameBuffer : null);
        } else {
            const shader = this.getCopyShader();
            this.constantTexSource.setValue(source._colorBuffer);
            quadWithShader(this, dest, shader);
        }

        DebugGraphics.popGpuMarker(this);

        return true;
    }

    /**
     * Get copy shader for efficient rendering of fullscreen-quad with texture.
     *
     * @returns {Shader} The copy shader (based on `fullscreenQuadVS` and `outputTex2DPS` in
     * `shaderChunks`).
     * @ignore
     */
    getCopyShader() {
        if (!this._copyShader) {
            this._copyShader = new Shader(this, ShaderUtils.createDefinition(this, {
                name: 'outputTex2D',
                vertexCode: _fullScreenQuadVS,
                fragmentCode: _outputTexture2D
            }));
        }
        return this._copyShader;
    }

    frameStart() {
        super.frameStart();

        this.updateBackbuffer();

        this.gpuProfiler.frameStart();
    }

    frameEnd() {
        super.frameEnd();
        this.gpuProfiler.frameEnd();
        this.gpuProfiler.request();
    }

    /**
     * Start a render pass.
     *
     * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to start.
     * @ignore
     */
    startRenderPass(renderPass) {

        DebugGraphics.pushGpuMarker(this, `Pass:${renderPass.name}`);
        DebugGraphics.pushGpuMarker(this, `START-PASS`);

        // set up render target
        const rt = renderPass.renderTarget ?? this.backBuffer;
        this.renderTarget = rt;
        Debug.assert(rt);

        this.updateBegin();

        // the pass always start using full size of the target
        const { width, height } = rt;
        this.setViewport(0, 0, width, height);
        this.setScissor(0, 0, width, height);

        // clear the render target
        const colorOps = renderPass.colorOps;
        const depthStencilOps = renderPass.depthStencilOps;
        if (colorOps?.clear || depthStencilOps.clearDepth || depthStencilOps.clearStencil) {

            let clearFlags = 0;
            const clearOptions = {};

            if (colorOps?.clear) {
                clearFlags |= CLEARFLAG_COLOR;
                clearOptions.color = [colorOps.clearValue.r, colorOps.clearValue.g, colorOps.clearValue.b, colorOps.clearValue.a];
            }

            if (depthStencilOps.clearDepth) {
                clearFlags |= CLEARFLAG_DEPTH;
                clearOptions.depth = depthStencilOps.clearDepthValue;
            }

            if (depthStencilOps.clearStencil) {
                clearFlags |= CLEARFLAG_STENCIL;
                clearOptions.stencil = depthStencilOps.clearStencilValue;
            }

            // clear it
            clearOptions.flags = clearFlags;
            this.clear(clearOptions);
        }

        Debug.call(() => {
            if (this.insideRenderPass) {
                Debug.errorOnce('RenderPass cannot be started while inside another render pass.');
            }
        });
        this.insideRenderPass = true;

        DebugGraphics.popGpuMarker(this);
    }

    /**
     * End a render pass.
     *
     * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to end.
     * @ignore
     */
    endRenderPass(renderPass) {

        DebugGraphics.pushGpuMarker(this, `END-PASS`);

        this.unbindVertexArray();

        const target = this.renderTarget;
        const colorBufferCount = renderPass.colorArrayOps.length;
        if (target) {

            // invalidate buffers to stop them being written to on tiled architectures
            invalidateAttachments.length = 0;
            const gl = this.gl;

            // color buffers
            for (let i = 0; i < colorBufferCount; i++) {
                const colorOps = renderPass.colorArrayOps[i];

                // invalidate color only if we don't need to resolve it
                if (!(colorOps.store || colorOps.resolve)) {
                    invalidateAttachments.push(gl.COLOR_ATTACHMENT0 + i);
                }
            }

            // we cannot invalidate depth/stencil buffers of the backbuffer
            if (target !== this.backBuffer) {
                if (!renderPass.depthStencilOps.storeDepth) {
                    invalidateAttachments.push(gl.DEPTH_ATTACHMENT);
                }
                if (!renderPass.depthStencilOps.storeStencil) {
                    invalidateAttachments.push(gl.STENCIL_ATTACHMENT);
                }
            }

            if (invalidateAttachments.length > 0) {

                // invalidate the whole buffer
                // TODO: we could handle viewport invalidation as well
                if (renderPass.fullSizeClearRect) {
                    gl.invalidateFramebuffer(gl.DRAW_FRAMEBUFFER, invalidateAttachments);
                }
            }

            // resolve the color buffer (this resolves all MRT color buffers at once)
            if (renderPass.colorOps?.resolve) {
                if (renderPass.samples > 1 && target.autoResolve) {
                    target.resolve(true, false);
                }
            }

            // generate mipmaps
            for (let i = 0; i < colorBufferCount; i++) {
                const colorOps = renderPass.colorArrayOps[i];
                if (colorOps.mipmaps) {
                    const colorBuffer = target._colorBuffers[i];
                    if (colorBuffer && colorBuffer.impl._glTexture && colorBuffer.mipmaps) {

                        DebugGraphics.pushGpuMarker(this, `MIPS${i}`);

                        this.activeTexture(this.maxCombinedTextures - 1);
                        this.bindTexture(colorBuffer);
                        this.gl.generateMipmap(colorBuffer.impl._glTarget);

                        DebugGraphics.popGpuMarker(this);
                    }
                }
            }
        }

        this.insideRenderPass = false;

        DebugGraphics.popGpuMarker(this);
        DebugGraphics.popGpuMarker(this);   // pop the pass-start marker
    }

    set defaultFramebuffer(value) {
        if (this._defaultFramebuffer !== value) {
            this._defaultFramebuffer = value;
            this._defaultFramebufferChanged = true;
        }
    }

    get defaultFramebuffer() {
        return this._defaultFramebuffer;
    }

    /**
     * Marks the beginning of a block of rendering. Internally, this function binds the render
     * target currently set on the device. This function should be matched with a call to
     * {@link GraphicsDevice#updateEnd}. Calls to {@link GraphicsDevice#updateBegin} and
     * {@link GraphicsDevice#updateEnd} must not be nested.
     *
     * @ignore
     */
    updateBegin() {
        DebugGraphics.pushGpuMarker(this, 'UPDATE-BEGIN');

        this.boundVao = null;

        // clear texture units once a frame on desktop safari
        if (this._tempEnableSafariTextureUnitWorkaround) {
            for (let unit = 0; unit < this.textureUnits.length; ++unit) {
                for (let slot = 0; slot < 3; ++slot) {
                    this.textureUnits[unit][slot] = null;
                }
            }
        }

        // Set the render target
        const target = this.renderTarget ?? this.backBuffer;
        Debug.assert(target);

        // Initialize the framebuffer
        const targetImpl = target.impl;
        if (!targetImpl.initialized) {
            this.initRenderTarget(target);
        }

        // Bind the framebuffer
        this.setFramebuffer(targetImpl._glFrameBuffer);

        DebugGraphics.popGpuMarker(this);
    }

    /**
     * Marks the end of a block of rendering. This function should be called after a matching call
     * to {@link GraphicsDevice#updateBegin}. Calls to {@link GraphicsDevice#updateBegin} and
     * {@link GraphicsDevice#updateEnd} must not be nested.
     *
     * @ignore
     */
    updateEnd() {

        DebugGraphics.pushGpuMarker(this, `UPDATE-END`);

        this.unbindVertexArray();

        // Unset the render target
        const target = this.renderTarget;
        if (target && target !== this.backBuffer) {
            // Resolve MSAA if needed
            if (target._samples > 1 && target.autoResolve) {
                target.resolve();
            }

            // If the active render target is auto-mipmapped, generate its mip chain
            const colorBuffer = target._colorBuffer;
            if (colorBuffer && colorBuffer.impl._glTexture && colorBuffer.mipmaps) {
                // FIXME: if colorBuffer is a cubemap currently we're re-generating mipmaps after
                // updating each face!
                this.activeTexture(this.maxCombinedTextures - 1);
                this.bindTexture(colorBuffer);
                this.gl.generateMipmap(colorBuffer.impl._glTarget);
            }
        }

        DebugGraphics.popGpuMarker(this);
    }

    /**
     * Updates a texture's vertical flip.
     *
     * @param {boolean} flipY - True to flip the texture vertically.
     * @ignore
     */
    setUnpackFlipY(flipY) {
        if (this.unpackFlipY !== flipY) {
            this.unpackFlipY = flipY;

            // Note: the WebGL spec states that UNPACK_FLIP_Y_WEBGL only affects
            // texImage2D and texSubImage2D, not compressedTexImage2D
            const gl = this.gl;
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
        }
    }

    /**
     * Updates a texture to have its RGB channels premultiplied by its alpha channel or not.
     *
     * @param {boolean} premultiplyAlpha - True to premultiply the alpha channel against the RGB
     * channels.
     * @ignore
     */
    setUnpackPremultiplyAlpha(premultiplyAlpha) {
        if (this.unpackPremultiplyAlpha !== premultiplyAlpha) {
            this.unpackPremultiplyAlpha = premultiplyAlpha;

            // Note: the WebGL spec states that UNPACK_PREMULTIPLY_ALPHA_WEBGL only affects
            // texImage2D and texSubImage2D, not compressedTexImage2D
            const gl = this.gl;
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
        }
    }

    /**
     * Activate the specified texture unit.
     *
     * @param {number} textureUnit - The texture unit to activate.
     * @ignore
     */
    activeTexture(textureUnit) {
        if (this.textureUnit !== textureUnit) {
            this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
            this.textureUnit = textureUnit;
        }
    }

    /**
     * If the texture is not already bound on the currently active texture unit, bind it.
     *
     * @param {Texture} texture - The texture to bind.
     * @ignore
     */
    bindTexture(texture) {
        const impl = texture.impl;
        const textureTarget = impl._glTarget;
        const textureObject = impl._glTexture;
        const textureUnit = this.textureUnit;
        const slot = this.targetToSlot[textureTarget];
        if (this.textureUnits[textureUnit][slot] !== textureObject) {
            this.gl.bindTexture(textureTarget, textureObject);
            this.textureUnits[textureUnit][slot] = textureObject;
        }
    }

    /**
     * If the texture is not bound on the specified texture unit, active the texture unit and bind
     * the texture to it.
     *
     * @param {Texture} texture - The texture to bind.
     * @param {number} textureUnit - The texture unit to activate and bind the texture to.
     * @ignore
     */
    bindTextureOnUnit(texture, textureUnit) {
        const impl = texture.impl;
        const textureTarget = impl._glTarget;
        const textureObject = impl._glTexture;
        const slot = this.targetToSlot[textureTarget];
        if (this.textureUnits[textureUnit][slot] !== textureObject) {
            this.activeTexture(textureUnit);
            this.gl.bindTexture(textureTarget, textureObject);
            this.textureUnits[textureUnit][slot] = textureObject;
        }
    }

    /**
     * Update the texture parameters for a given texture if they have changed.
     *
     * @param {Texture} texture - The texture to update.
     * @ignore
     */
    setTextureParameters(texture) {
        const gl = this.gl;
        const flags = texture.impl.dirtyParameterFlags;
        const target = texture.impl._glTarget;

        if (flags & 1) {
            let filter = texture._minFilter;
            if (!texture._mipmaps || (texture._compressed && texture._levels.length === 1)) {
                if (filter === FILTER_NEAREST_MIPMAP_NEAREST || filter === FILTER_NEAREST_MIPMAP_LINEAR) {
                    filter = FILTER_NEAREST;
                } else if (filter === FILTER_LINEAR_MIPMAP_NEAREST || filter === FILTER_LINEAR_MIPMAP_LINEAR) {
                    filter = FILTER_LINEAR;
                }
            }
            gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, this.glFilter[filter]);
        }
        if (flags & 2) {
            gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, this.glFilter[texture._magFilter]);
        }
        if (flags & 4) {
            gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.glAddress[texture._addressU]);
        }
        if (flags & 8) {
            gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.glAddress[texture._addressV]);
        }
        if (flags & 16) {
            gl.texParameteri(target, gl.TEXTURE_WRAP_R, this.glAddress[texture._addressW]);
        }
        if (flags & 32) {
            gl.texParameteri(target, gl.TEXTURE_COMPARE_MODE, texture._compareOnRead ? gl.COMPARE_REF_TO_TEXTURE : gl.NONE);
        }
        if (flags & 64) {
            gl.texParameteri(target, gl.TEXTURE_COMPARE_FUNC, this.glComparison[texture._compareFunc]);
        }
        if (flags & 128) {
            const ext = this.extTextureFilterAnisotropic;
            if (ext) {
                gl.texParameterf(target, ext.TEXTURE_MAX_ANISOTROPY_EXT, math.clamp(Math.round(texture._anisotropy), 1, this.maxAnisotropy));
            }
        }
    }

    /**
     * Sets the specified texture on the specified texture unit.
     *
     * @param {Texture} texture - The texture to set.
     * @param {number} textureUnit - The texture unit to set the texture on.
     * @ignore
     */
    setTexture(texture, textureUnit) {

        const impl = texture.impl;
        if (!impl._glTexture)
            impl.initialize(this, texture);

        if (impl.dirtyParameterFlags > 0 || texture._needsUpload || texture._needsMipmapsUpload) {

            // Ensure the specified texture unit is active
            this.activeTexture(textureUnit);

            // Ensure the texture is bound on correct target of the specified texture unit
            this.bindTexture(texture);

            if (impl.dirtyParameterFlags) {
                this.setTextureParameters(texture);
                impl.dirtyParameterFlags = 0;
            }

            if (texture._needsUpload || texture._needsMipmapsUpload) {
                impl.upload(this, texture);
                texture._needsUpload = false;
                texture._needsMipmapsUpload = false;
            }
        } else {
            // Ensure the texture is currently bound to the correct target on the specified texture unit.
            // If the texture is already bound to the correct target on the specified unit, there's no need
            // to actually make the specified texture unit active because the texture itself does not need
            // to be updated.
            this.bindTextureOnUnit(texture, textureUnit);
        }
    }

    // function creates VertexArrayObject from list of vertex buffers
    createVertexArray(vertexBuffers) {

        let key, vao;

        // only use cache when more than 1 vertex buffer, otherwise it's unique
        const useCache = vertexBuffers.length > 1;
        if (useCache) {

            // generate unique key for the vertex buffers
            key = "";
            for (let i = 0; i < vertexBuffers.length; i++) {
                const vertexBuffer = vertexBuffers[i];
                key += vertexBuffer.id + vertexBuffer.format.renderingHash;
            }

            // try to get VAO from cache
            vao = this._vaoMap.get(key);
        }

        // need to create new vao
        if (!vao) {

            // create VA object
            const gl = this.gl;
            vao = gl.createVertexArray();
            gl.bindVertexArray(vao);

            // don't capture index buffer in VAO
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            let locZero = false;
            for (let i = 0; i < vertexBuffers.length; i++) {

                // bind buffer
                const vertexBuffer = vertexBuffers[i];
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.impl.bufferId);

                // for each attribute
                const elements = vertexBuffer.format.elements;
                for (let j = 0; j < elements.length; j++) {
                    const e = elements[j];
                    const loc = semanticToLocation[e.name];

                    if (loc === 0) {
                        locZero = true;
                    }

                    if (e.asInt) {
                        gl.vertexAttribIPointer(loc, e.numComponents, this.glType[e.dataType], e.stride, e.offset);
                    } else {
                        gl.vertexAttribPointer(loc, e.numComponents, this.glType[e.dataType], e.normalize, e.stride, e.offset);
                    }

                    gl.enableVertexAttribArray(loc);

                    if (vertexBuffer.format.instancing) {
                        gl.vertexAttribDivisor(loc, 1);
                    }
                }
            }

            // end of VA object
            gl.bindVertexArray(null);

            // unbind any array buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, null);

            // add it to cache
            if (useCache) {
                this._vaoMap.set(key, vao);
            }

            if (!locZero) {
                Debug.warn("No vertex attribute is mapped to location 0, which might cause compatibility issues on Safari on MacOS - please use attribute SEMANTIC_POSITION or SEMANTIC_ATTR15");
            }
        }

        return vao;
    }

    unbindVertexArray() {
        // unbind VAO from device to protect it from being changed
        if (this.boundVao) {
            this.boundVao = null;
            this.gl.bindVertexArray(null);
        }
    }

    setBuffers() {
        const gl = this.gl;
        let vao;

        // create VAO for specified vertex buffers
        if (this.vertexBuffers.length === 1) {

            // single VB keeps its VAO
            const vertexBuffer = this.vertexBuffers[0];
            Debug.assert(vertexBuffer.device === this, "The VertexBuffer was not created using current GraphicsDevice");
            if (!vertexBuffer.impl.vao) {
                vertexBuffer.impl.vao = this.createVertexArray(this.vertexBuffers);
            }
            vao = vertexBuffer.impl.vao;
        } else {
            // obtain temporary VAO for multiple vertex buffers
            vao = this.createVertexArray(this.vertexBuffers);
        }

        // set active VAO
        if (this.boundVao !== vao) {
            this.boundVao = vao;
            gl.bindVertexArray(vao);
        }

        // empty array of vertex buffers
        this.clearVertexBuffer();

        // Set the active index buffer object
        // Note: we don't cache this state and set it only when it changes, as VAO captures last bind buffer in it
        // and so we don't know what VAO sets it to.
        const bufferId = this.indexBuffer ? this.indexBuffer.impl.bufferId : null;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
    }

    /**
     * Submits a graphical primitive to the hardware for immediate rendering.
     *
     * @param {object} primitive - Primitive object describing how to submit current vertex/index
     * buffers.
     * @param {number} primitive.type - The type of primitive to render. Can be:
     *
     * - {@link PRIMITIVE_POINTS}
     * - {@link PRIMITIVE_LINES}
     * - {@link PRIMITIVE_LINELOOP}
     * - {@link PRIMITIVE_LINESTRIP}
     * - {@link PRIMITIVE_TRIANGLES}
     * - {@link PRIMITIVE_TRISTRIP}
     * - {@link PRIMITIVE_TRIFAN}
     *
     * @param {number} primitive.base - The offset of the first index or vertex to dispatch in the
     * draw call.
     * @param {number} primitive.count - The number of indices or vertices to dispatch in the draw
     * call.
     * @param {boolean} [primitive.indexed] - True to interpret the primitive as indexed, thereby
     * using the currently set index buffer and false otherwise.
     * @param {number} [numInstances] - The number of instances to render when using instancing.
     * Defaults to 1.
     * @param {boolean} [keepBuffers] - Optionally keep the current set of vertex / index buffers /
     * VAO. This is used when rendering of multiple views, for example under WebXR.
     * @example
     * // Render a single, unindexed triangle
     * device.draw({
     *     type: pc.PRIMITIVE_TRIANGLES,
     *     base: 0,
     *     count: 3,
     *     indexed: false
     * });
     */
    draw(primitive, numInstances, keepBuffers) {
        const gl = this.gl;

        this.activateShader(this);
        if (!this.shaderValid)
            return;

        let sampler, samplerValue, texture, numTextures; // Samplers
        let uniform, scopeId, uniformVersion, programVersion; // Uniforms
        const shader = this.shader;
        if (!shader)
            return;
        const samplers = shader.impl.samplers;
        const uniforms = shader.impl.uniforms;

        // vertex buffers
        if (!keepBuffers) {
            this.setBuffers();
        }

        // Commit the shader program variables
        let textureUnit = 0;

        for (let i = 0, len = samplers.length; i < len; i++) {
            sampler = samplers[i];
            samplerValue = sampler.scopeId.value;
            if (!samplerValue) {

                // #if _DEBUG
                const samplerName = sampler.scopeId.name;
                if (samplerName === 'uSceneDepthMap' || samplerName === 'uDepthMap') {
                    Debug.warnOnce(`A sampler ${samplerName} is used by the shader but a scene depth texture is not available. Use CameraComponent.requestSceneDepthMap / enable Depth Grabpass on the Camera Component to enable it.`);
                }
                if (samplerName === 'uSceneColorMap' || samplerName === 'texture_grabPass') {
                    Debug.warnOnce(`A sampler ${samplerName} is used by the shader but a scene color texture is not available. Use CameraComponent.requestSceneColorMap / enable Color Grabpass on the Camera Component to enable it.`);
                }
                // #endif

                Debug.errorOnce(`Shader [${shader.label}] requires texture sampler [${samplerName}] which has not been set, while rendering [${DebugGraphics.toString()}]`);

                // skip this draw call to avoid incorrect rendering / webgl errors
                return;
            }

            if (samplerValue instanceof Texture) {
                texture = samplerValue;
                this.setTexture(texture, textureUnit);

                // #if _DEBUG
                if (this.renderTarget) {
                    // Set breakpoint here to debug "Source and destination textures of the draw are the same" errors
                    if (this.renderTarget._samples < 2) {
                        if (this.renderTarget.colorBuffer && this.renderTarget.colorBuffer === texture) {
                            Debug.error("Trying to bind current color buffer as a texture", { renderTarget: this.renderTarget, texture });
                        } else if (this.renderTarget.depthBuffer && this.renderTarget.depthBuffer === texture) {
                            Debug.error("Trying to bind current depth buffer as a texture", { texture });
                        }
                    }
                }
                // #endif

                if (sampler.slot !== textureUnit) {
                    gl.uniform1i(sampler.locationId, textureUnit);
                    sampler.slot = textureUnit;
                }
                textureUnit++;
            } else { // Array
                sampler.array.length = 0;
                numTextures = samplerValue.length;
                for (let j = 0; j < numTextures; j++) {
                    texture = samplerValue[j];
                    this.setTexture(texture, textureUnit);

                    sampler.array[j] = textureUnit;
                    textureUnit++;
                }
                gl.uniform1iv(sampler.locationId, sampler.array);
            }
        }

        // Commit any updated uniforms
        for (let i = 0, len = uniforms.length; i < len; i++) {
            uniform = uniforms[i];
            scopeId = uniform.scopeId;
            uniformVersion = uniform.version;
            programVersion = scopeId.versionObject.version;

            // Check the value is valid
            if (uniformVersion.globalId !== programVersion.globalId || uniformVersion.revision !== programVersion.revision) {
                uniformVersion.globalId = programVersion.globalId;
                uniformVersion.revision = programVersion.revision;

                // Call the function to commit the uniform value
                if (scopeId.value !== null) {
                    this.commitFunction[uniform.dataType](uniform, scopeId.value);
                } else {
                    // commented out till engine issue #4971 is sorted out
                    // Debug.warnOnce(`Shader [${shader.label}] requires uniform [${uniform.scopeId.name}] which has not been set, while rendering [${DebugGraphics.toString()}]`);
                }
            }
        }

        if (this.transformFeedbackBuffer) {
            // Enable TF, start writing to out buffer
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.transformFeedbackBuffer.impl.bufferId);
            gl.beginTransformFeedback(gl.POINTS);
        }

        const mode = this.glPrimitive[primitive.type];
        const count = primitive.count;

        if (primitive.indexed) {
            const indexBuffer = this.indexBuffer;
            Debug.assert(indexBuffer.device === this, "The IndexBuffer was not created using current GraphicsDevice");

            const format = indexBuffer.impl.glFormat;
            const offset = primitive.base * indexBuffer.bytesPerIndex;

            if (numInstances > 0) {
                gl.drawElementsInstanced(mode, count, format, offset, numInstances);
            } else {
                gl.drawElements(mode, count, format, offset);
            }
        } else {
            const first = primitive.base;

            if (numInstances > 0) {
                gl.drawArraysInstanced(mode, first, count, numInstances);
            } else {
                gl.drawArrays(mode, first, count);
            }
        }

        if (this.transformFeedbackBuffer) {
            // disable TF
            gl.endTransformFeedback();
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        }

        this._drawCallsPerFrame++;

        // #if _PROFILER
        this._primsPerFrame[primitive.type] += primitive.count * (numInstances > 1 ? numInstances : 1);
        // #endif
    }

    /**
     * Clears the frame buffer of the currently set render target.
     *
     * @param {object} [options] - Optional options object that controls the behavior of the clear
     * operation defined as follows:
     * @param {number[]} [options.color] - The color to clear the color buffer to in the range 0 to
     * 1 for each component.
     * @param {number} [options.depth] - The depth value to clear the depth buffer to in the
     * range 0 to 1. Defaults to 1.
     * @param {number} [options.flags] - The buffers to clear (the types being color, depth and
     * stencil). Can be any bitwise combination of:
     *
     * - {@link CLEARFLAG_COLOR}
     * - {@link CLEARFLAG_DEPTH}
     * - {@link CLEARFLAG_STENCIL}
     *
     * @param {number} [options.stencil] - The stencil value to clear the stencil buffer to.
     * Defaults to 0.
     * @example
     * // Clear color buffer to black and depth buffer to 1
     * device.clear();
     *
     * // Clear just the color buffer to red
     * device.clear({
     *     color: [1, 0, 0, 1],
     *     flags: pc.CLEARFLAG_COLOR
     * });
     *
     * // Clear color buffer to yellow and depth to 1.0
     * device.clear({
     *     color: [1, 1, 0, 1],
     *     depth: 1,
     *     flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH
     * });
     */
    clear(options) {
        const defaultOptions = this.defaultClearOptions;
        options = options || defaultOptions;

        const flags = options.flags ?? defaultOptions.flags;
        if (flags !== 0) {
            const gl = this.gl;

            // Set the clear color
            if (flags & CLEARFLAG_COLOR) {
                const color = options.color ?? defaultOptions.color;
                const r = color[0];
                const g = color[1];
                const b = color[2];
                const a = color[3];

                const c = this.clearColor;
                if ((r !== c.r) || (g !== c.g) || (b !== c.b) || (a !== c.a)) {
                    this.gl.clearColor(r, g, b, a);
                    this.clearColor.set(r, g, b, a);
                }

                this.setBlendState(BlendState.NOBLEND);
            }

            if (flags & CLEARFLAG_DEPTH) {
                // Set the clear depth
                const depth = options.depth ?? defaultOptions.depth;

                if (depth !== this.clearDepth) {
                    this.gl.clearDepth(depth);
                    this.clearDepth = depth;
                }

                this.setDepthState(DepthState.WRITEDEPTH);
            }

            if (flags & CLEARFLAG_STENCIL) {
                // Set the clear stencil
                const stencil = options.stencil ?? defaultOptions.stencil;
                if (stencil !== this.clearStencil) {
                    this.gl.clearStencil(stencil);
                    this.clearStencil = stencil;
                }
            }

            // Clear the frame buffer
            gl.clear(this.glClearFlag[flags]);
        }
    }

    submit() {
        this.gl.flush();
    }

    /**
     * Reads a block of pixels from a specified rectangle of the current color framebuffer into an
     * ArrayBufferView object.
     *
     * @param {number} x - The x-coordinate of the rectangle's lower-left corner.
     * @param {number} y - The y-coordinate of the rectangle's lower-left corner.
     * @param {number} w - The width of the rectangle, in pixels.
     * @param {number} h - The height of the rectangle, in pixels.
     * @param {ArrayBufferView} pixels - The ArrayBufferView object that holds the returned pixel
     * data.
     * @ignore
     */
    readPixels(x, y, w, h, pixels) {
        const gl = this.gl;
        gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    }

    /**
     * Asynchronously reads a block of pixels from a specified rectangle of the current color framebuffer
     * into an ArrayBufferView object.
     *
     * @param {number} x - The x-coordinate of the rectangle's lower-left corner.
     * @param {number} y - The y-coordinate of the rectangle's lower-left corner.
     * @param {number} w - The width of the rectangle, in pixels.
     * @param {number} h - The height of the rectangle, in pixels.
     * @param {ArrayBufferView} pixels - The ArrayBufferView object that holds the returned pixel
     * data.
     * @ignore
     */
    async readPixelsAsync(x, y, w, h, pixels) {
        const gl = this.gl;

        const clientWaitAsync = (flags, interval_ms) => {
            const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            this.submit();

            return new Promise((resolve, reject) => {
                function test() {
                    const res = gl.clientWaitSync(sync, flags, 0);
                    if (res === gl.WAIT_FAILED) {
                        gl.deleteSync(sync);
                        reject(new Error('webgl clientWaitSync sync failed'));
                    } else if (res === gl.TIMEOUT_EXPIRED) {
                        setTimeout(test, interval_ms);
                    } else {
                        gl.deleteSync(sync);
                        resolve();
                    }
                }
                test();
            });
        };

        const impl = this.renderTarget.colorBuffer?.impl;
        const format = impl?._glFormat ?? gl.RGBA;
        const pixelType = impl?._glPixelType ?? gl.UNSIGNED_BYTE;

        // create temporary (gpu-side) buffer and copy data into it
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
        gl.bufferData(gl.PIXEL_PACK_BUFFER, pixels.byteLength, gl.STREAM_READ);
        gl.readPixels(x, y, w, h, format, pixelType, 0);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

        // async wait for previous read to finish
        await clientWaitAsync(0, 20);

        // copy the resulting data once it's arrived
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        gl.deleteBuffer(buf);

        return pixels;
    }

    readTextureAsync(texture, x, y, width, height, options) {

        const face = options.face ?? 0;

        // create a temporary render target if needed
        const renderTarget = options.renderTarget ?? new RenderTarget({
            colorBuffer: texture,
            depth: false,
            face: face
        });
        Debug.assert(renderTarget.colorBuffer === texture);

        const buffer = new ArrayBuffer(TextureUtils.calcLevelGpuSize(width, height, 1, texture._format));
        const data = new (getPixelFormatArrayType(texture._format))(buffer);

        this.setRenderTarget(renderTarget);
        this.initRenderTarget(renderTarget);

        return new Promise((resolve, reject) => {
            this.readPixelsAsync(x, y, width, height, data).then((data) => {

                // destroy RT if we created it
                if (!options.renderTarget) {
                    renderTarget.destroy();
                }
                resolve(data);
            });
        });
    }

    /**
     * Enables or disables alpha to coverage.
     *
     * @param {boolean} state - True to enable alpha to coverage and false to disable it.
     * @ignore
     */
    setAlphaToCoverage(state) {
        if (this.alphaToCoverage !== state) {
            this.alphaToCoverage = state;

            if (state) {
                this.gl.enable(this.gl.SAMPLE_ALPHA_TO_COVERAGE);
            } else {
                this.gl.disable(this.gl.SAMPLE_ALPHA_TO_COVERAGE);
            }
        }
    }

    /**
     * Sets the output vertex buffer. It will be written to by a shader with transform feedback
     * varyings.
     *
     * @param {import('../vertex-buffer.js').VertexBuffer} tf - The output vertex buffer.
     * @ignore
     */
    setTransformFeedbackBuffer(tf) {
        if (this.transformFeedbackBuffer !== tf) {
            this.transformFeedbackBuffer = tf;

            const gl = this.gl;
            if (tf) {
                if (!this.feedback) {
                    this.feedback = gl.createTransformFeedback();
                }
                gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
            } else {
                gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
            }
        }
    }

    /**
     * Toggles the rasterization render state. Useful with transform feedback, when you only need
     * to process the data without drawing.
     *
     * @param {boolean} on - True to enable rasterization and false to disable it.
     * @ignore
     */
    setRaster(on) {
        if (this.raster !== on) {
            this.raster = on;

            if (on) {
                this.gl.disable(this.gl.RASTERIZER_DISCARD);
            } else {
                this.gl.enable(this.gl.RASTERIZER_DISCARD);
            }
        }
    }

    setStencilTest(enable) {
        if (this.stencil !== enable) {
            const gl = this.gl;
            if (enable) {
                gl.enable(gl.STENCIL_TEST);
            } else {
                gl.disable(gl.STENCIL_TEST);
            }
            this.stencil = enable;
        }
    }

    setStencilFunc(func, ref, mask) {
        if (this.stencilFuncFront !== func || this.stencilRefFront !== ref || this.stencilMaskFront !== mask ||
            this.stencilFuncBack !== func || this.stencilRefBack !== ref || this.stencilMaskBack !== mask) {
            this.gl.stencilFunc(this.glComparison[func], ref, mask);
            this.stencilFuncFront = this.stencilFuncBack = func;
            this.stencilRefFront = this.stencilRefBack = ref;
            this.stencilMaskFront = this.stencilMaskBack = mask;
        }
    }

    setStencilFuncFront(func, ref, mask) {
        if (this.stencilFuncFront !== func || this.stencilRefFront !== ref || this.stencilMaskFront !== mask) {
            const gl = this.gl;
            gl.stencilFuncSeparate(gl.FRONT, this.glComparison[func], ref, mask);
            this.stencilFuncFront = func;
            this.stencilRefFront = ref;
            this.stencilMaskFront = mask;
        }
    }

    setStencilFuncBack(func, ref, mask) {
        if (this.stencilFuncBack !== func || this.stencilRefBack !== ref || this.stencilMaskBack !== mask) {
            const gl = this.gl;
            gl.stencilFuncSeparate(gl.BACK, this.glComparison[func], ref, mask);
            this.stencilFuncBack = func;
            this.stencilRefBack = ref;
            this.stencilMaskBack = mask;
        }
    }

    setStencilOperation(fail, zfail, zpass, writeMask) {
        if (this.stencilFailFront !== fail || this.stencilZfailFront !== zfail || this.stencilZpassFront !== zpass ||
            this.stencilFailBack !== fail || this.stencilZfailBack !== zfail || this.stencilZpassBack !== zpass) {
            this.gl.stencilOp(this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
            this.stencilFailFront = this.stencilFailBack = fail;
            this.stencilZfailFront = this.stencilZfailBack = zfail;
            this.stencilZpassFront = this.stencilZpassBack = zpass;
        }
        if (this.stencilWriteMaskFront !== writeMask || this.stencilWriteMaskBack !== writeMask) {
            this.gl.stencilMask(writeMask);
            this.stencilWriteMaskFront = writeMask;
            this.stencilWriteMaskBack = writeMask;
        }
    }

    setStencilOperationFront(fail, zfail, zpass, writeMask) {
        if (this.stencilFailFront !== fail || this.stencilZfailFront !== zfail || this.stencilZpassFront !== zpass) {
            this.gl.stencilOpSeparate(this.gl.FRONT, this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
            this.stencilFailFront = fail;
            this.stencilZfailFront = zfail;
            this.stencilZpassFront = zpass;
        }
        if (this.stencilWriteMaskFront !== writeMask) {
            this.gl.stencilMaskSeparate(this.gl.FRONT, writeMask);
            this.stencilWriteMaskFront = writeMask;
        }
    }

    setStencilOperationBack(fail, zfail, zpass, writeMask) {
        if (this.stencilFailBack !== fail || this.stencilZfailBack !== zfail || this.stencilZpassBack !== zpass) {
            this.gl.stencilOpSeparate(this.gl.BACK, this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
            this.stencilFailBack = fail;
            this.stencilZfailBack = zfail;
            this.stencilZpassBack = zpass;
        }
        if (this.stencilWriteMaskBack !== writeMask) {
            this.gl.stencilMaskSeparate(this.gl.BACK, writeMask);
            this.stencilWriteMaskBack = writeMask;
        }
    }

    setBlendState(blendState) {
        const currentBlendState = this.blendState;
        if (!currentBlendState.equals(blendState)) {
            const gl = this.gl;

            // state values to set
            const { blend, colorOp, alphaOp, colorSrcFactor, colorDstFactor, alphaSrcFactor, alphaDstFactor } = blendState;

            // enable blend
            if (currentBlendState.blend !== blend) {
                if (blend) {
                    gl.enable(gl.BLEND);
                } else {
                    gl.disable(gl.BLEND);
                }
            }

            // blend ops
            if (currentBlendState.colorOp !== colorOp || currentBlendState.alphaOp !== alphaOp) {
                const glBlendEquation = this.glBlendEquation;
                gl.blendEquationSeparate(glBlendEquation[colorOp], glBlendEquation[alphaOp]);
            }

            // blend factors
            if (currentBlendState.colorSrcFactor !== colorSrcFactor || currentBlendState.colorDstFactor !== colorDstFactor ||
                currentBlendState.alphaSrcFactor !== alphaSrcFactor || currentBlendState.alphaDstFactor !== alphaDstFactor) {

                gl.blendFuncSeparate(this.glBlendFunctionColor[colorSrcFactor], this.glBlendFunctionColor[colorDstFactor],
                                     this.glBlendFunctionAlpha[alphaSrcFactor], this.glBlendFunctionAlpha[alphaDstFactor]);
            }

            // color write
            if (currentBlendState.allWrite !== blendState.allWrite) {
                this.gl.colorMask(blendState.redWrite, blendState.greenWrite, blendState.blueWrite, blendState.alphaWrite);
            }

            // update internal state
            currentBlendState.copy(blendState);
        }
    }

    /**
     * Set the source and destination blending factors.
     *
     * @param {number} r - The red component in the range of 0 to 1. Default value is 0.
     * @param {number} g - The green component in the range of 0 to 1. Default value is 0.
     * @param {number} b - The blue component in the range of 0 to 1. Default value is 0.
     * @param {number} a - The alpha component in the range of 0 to 1. Default value is 0.
     * @ignore
     */
    setBlendColor(r, g, b, a) {
        const c = this.blendColor;
        if ((r !== c.r) || (g !== c.g) || (b !== c.b) || (a !== c.a)) {
            this.gl.blendColor(r, g, b, a);
            c.set(r, g, b, a);
        }
    }

    setStencilState(stencilFront, stencilBack) {
        if (stencilFront || stencilBack) {
            this.setStencilTest(true);
            if (stencilFront === stencilBack) {

                // identical front/back stencil
                this.setStencilFunc(stencilFront.func, stencilFront.ref, stencilFront.readMask);
                this.setStencilOperation(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);

            } else {

                // front
                stencilFront ??= StencilParameters.DEFAULT;
                this.setStencilFuncFront(stencilFront.func, stencilFront.ref, stencilFront.readMask);
                this.setStencilOperationFront(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);

                // back
                stencilBack ??= StencilParameters.DEFAULT;
                this.setStencilFuncBack(stencilBack.func, stencilBack.ref, stencilBack.readMask);
                this.setStencilOperationBack(stencilBack.fail, stencilBack.zfail, stencilBack.zpass, stencilBack.writeMask);
            }
        } else {
            this.setStencilTest(false);
        }
    }

    setDepthState(depthState) {
        const currentDepthState = this.depthState;
        if (!currentDepthState.equals(depthState)) {
            const gl = this.gl;

            // write
            const write = depthState.write;
            if (currentDepthState.write !== write) {
                gl.depthMask(write);
            }

            // handle case where depth testing is off, but depth write is on => enable always test to depth write
            // Note on WebGL API behavior: When depth testing is disabled, writes to the depth buffer are also disabled.
            let { func, test } = depthState;
            if (!test && write) {
                test = true;
                func = FUNC_ALWAYS;
            }

            if (currentDepthState.func !== func) {
                gl.depthFunc(this.glComparison[func]);
            }

            if (currentDepthState.test !== test) {
                if (test) {
                    gl.enable(gl.DEPTH_TEST);
                } else {
                    gl.disable(gl.DEPTH_TEST);
                }
            }

            // depth bias
            const { depthBias, depthBiasSlope } = depthState;
            if (depthBias || depthBiasSlope) {

                // enable bias
                if (!this.depthBiasEnabled) {
                    this.depthBiasEnabled = true;
                    this.gl.enable(this.gl.POLYGON_OFFSET_FILL);
                }

                // values
                gl.polygonOffset(depthBiasSlope, depthBias);

            } else {

                // disable bias
                if (this.depthBiasEnabled) {
                    this.depthBiasEnabled = false;
                    this.gl.disable(this.gl.POLYGON_OFFSET_FILL);
                }
            }

            // update internal state
            currentDepthState.copy(depthState);
        }
    }

    setCullMode(cullMode) {
        if (this.cullMode !== cullMode) {
            if (cullMode === CULLFACE_NONE) {
                this.gl.disable(this.gl.CULL_FACE);
            } else {
                if (this.cullMode === CULLFACE_NONE) {
                    this.gl.enable(this.gl.CULL_FACE);
                }

                const mode = this.glCull[cullMode];
                if (this.cullFace !== mode) {
                    this.gl.cullFace(mode);
                    this.cullFace = mode;
                }
            }
            this.cullMode = cullMode;
        }
    }

    /**
     * Sets the active shader to be used during subsequent draw calls.
     *
     * @param {Shader} shader - The shader to assign to the device.
     */

    /**
     * Sets the active shader to be used during subsequent draw calls.
     *
     * @param {Shader} shader - The shader to assign to the device.
     * @param {boolean} asyncCompile - If true, rendering will be skipped until the shader is
     * compiled, otherwise the rendering will wait for the shader compilation to finish. Defaults to
     * false.
     */
    setShader(shader, asyncCompile = false) {
        if (shader !== this.shader) {
            this.shader = shader;
            this.shaderAsyncCompile = asyncCompile;
            this.shaderValid = undefined;   // need to run activation / validation

            // #if _PROFILER
            this._shaderSwitchesPerFrame++;
            // #endif
        }
    }

    activateShader(device) {

        const { shader } = this;
        const { impl } = shader;
        if (this.shaderValid === undefined) {

            if (shader.failed) {
                this.shaderValid = false;
            } else if (!shader.ready) {

                // if the shader is async compiled and can be skipped if not ready
                if (this.shaderAsyncCompile) {

                    // if the shader is linked, finalize it
                    if (impl.isLinked(device)) {
                        if (!impl.finalize(this, shader)) {
                            shader.failed = true;
                            this.shaderValid = false;
                        }
                    } else {
                        // skip the async shader rendering
                        this.shaderValid = false;
                    }

                } else {

                    // this cannot be skipped, wait for the shader to be ready
                    if (!impl.finalize(this, shader)) {
                        shader.failed = true;
                        this.shaderValid = false;
                    }
                }
            }
        }

        if (this.shaderValid === undefined) {
            // Set the active shader
            this.gl.useProgram(impl.glProgram);
            this.shaderValid = true;
        }
    }

    /**
     * Frees memory from all vertex array objects ever allocated with this device.
     *
     * @ignore
     */
    clearVertexArrayObjectCache() {
        const gl = this.gl;
        this._vaoMap.forEach((item, key, mapObj) => {
            gl.deleteVertexArray(item);
        });

        this._vaoMap.clear();
    }

    /**
     * Sets whether the device is currently in fullscreen mode.
     *
     * @type {boolean}
     */
    set fullscreen(fullscreen) {
        if (fullscreen) {
            const canvas = this.gl.canvas;
            canvas.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Gets whether the device is currently in fullscreen mode.
     *
     * @type {boolean}
     */
    get fullscreen() {
        return !!document.fullscreenElement;
    }

    /**
     * Check if high precision floating-point textures are supported.
     *
     * @type {boolean}
     */
    get textureFloatHighPrecision() {
        if (this._textureFloatHighPrecision === undefined) {
            this._textureFloatHighPrecision = testTextureFloatHighPrecision(this);
        }
        return this._textureFloatHighPrecision;
    }

    // #if _DEBUG
    // debug helper to force lost context
    debugLoseContext(sleep = 100) {
        const context = this.gl.getExtension('WEBGL_lose_context');
        context.loseContext();
        setTimeout(() => context.restoreContext(), sleep);
    }
    // #endif
}

export { WebglGraphicsDevice };
