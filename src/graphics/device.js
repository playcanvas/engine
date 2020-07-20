import '../polyfill/OESVertexArrayObject.js';
import { EventHandler } from '../core/event-handler.js';
import { now } from '../core/time.js';

import {
    ADDRESS_CLAMP_TO_EDGE,
    BLENDEQUATION_ADD,
    BLENDMODE_ZERO, BLENDMODE_ONE,
    CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL,
    CULLFACE_BACK, CULLFACE_NONE,
    FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR,
    FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR,
    FUNC_ALWAYS, FUNC_LESSEQUAL,
    PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_L8_A8, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R5_G5_B5_A1, PIXELFORMAT_R4_G4_B4_A4,
    PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA32F, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH,
    PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_111110F, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_ETC1,
    PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1,
    PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB,
    PIXELFORMAT_ATC_RGBA,
    PRIMITIVE_POINTS, PRIMITIVE_TRIFAN,
    SHADERTAG_MATERIAL,
    STENCILOP_KEEP,
    TEXHINT_SHADOWMAP, TEXHINT_ASSET, TEXHINT_LIGHTMAP,
    UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3,
    UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2,
    UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4,
    UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_TEXTURE2D_SHADOW,
    UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY,
    semanticToLocation
} from './graphics.js';

import { createShaderFromCode } from './program-lib/utils.js';
import { drawQuadWithShader } from './simple-post-effect.js';
import { programlib } from './program-lib/program-lib.js';
import { shaderChunks } from './program-lib/chunks/chunks.js';
import { RenderTarget } from './render-target.js';
import { ProgramLibrary } from './program-library.js';
import { ScopeSpace } from './scope-space.js';
import { ShaderInput } from './shader-input.js';
import { Texture } from './texture.js';
import { VertexFormat } from './vertex-format.js';

var EVENT_RESIZE = 'resizecanvas';

var _downsampleImage = function (image, size) {
    var srcW = image.width;
    var srcH = image.height;

    if ((srcW > size) || (srcH > size)) {
        var scale = size / Math.max(srcW, srcH);
        var dstW = Math.floor(srcW * scale);
        var dstH = Math.floor(srcH * scale);

        console.warn('Image dimensions larger than max supported texture size of ' + size + '. ' +
                     'Resizing from ' + srcW + ', ' + srcH + ' to ' + dstW + ', ' + dstH + '.');

        var canvas = document.createElement('canvas');
        canvas.width = dstW;
        canvas.height = dstH;

        var context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, srcW, srcH, 0, 0, dstW, dstH);

        return canvas;
    }

    return image;
};

function testRenderable(gl, pixelFormat) {
    var result = true;

    // Create a 2x2 texture
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, pixelFormat, null);

    // Try to use this texture as a render target
    var framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    // It is legal for a WebGL implementation exposing the OES_texture_float extension to
    // support floating-point textures but not as attachments to framebuffer objects.
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        result = false;
    }

    // Clean up
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.deleteTexture(texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);

    return result;
}

function testTextureHalfFloatUpdatable(gl, pixelFormat) {
    var result = true;

    // Create a 2x2 texture
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // upload some data - on iOS prior to about November 2019, passing data to half texture would fail here
    // see details here: https://bugs.webkit.org/show_bug.cgi?id=169999
    // note that if not supported, this prints an error to console, the error can be safely ignored as it's handled
    var data = new Uint16Array(4 * 2 * 2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, pixelFormat, data);

    if (gl.getError() !== gl.NO_ERROR) {
        result = false;
        console.log("Above error related to HALF_FLOAT_OES can be ignored, it was triggered by testing half float texture support");
    }

    // Clean up
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.deleteTexture(texture);

    return result;
}

function testTextureFloatHighPrecision(device) {
    if (!device.textureFloatRenderable)
        return false;

    var test1 = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, shaderChunks.precisionTestPS, "ptest1");
    var test2 = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, shaderChunks.precisionTest2PS, "ptest2");

    var textureOptions = {
        format: PIXELFORMAT_RGBA32F,
        width: 1,
        height: 1,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST
    };
    var tex1 = new Texture(device, textureOptions);
    tex1.name = 'testFHP';
    var targ1 = new RenderTarget(device, tex1, {
        depth: false
    });
    drawQuadWithShader(device, targ1, test1);

    textureOptions.format = PIXELFORMAT_R8_G8_B8_A8;
    var tex2 = new Texture(device, textureOptions);
    tex2.name = 'testFHP';
    var targ2 = new RenderTarget(device, tex2, {
        depth: false
    });
    device.constantTexSource.setValue(tex1);
    drawQuadWithShader(device, targ2, test2);

    var prevFramebuffer = device.activeFramebuffer;
    device.setFramebuffer(targ2._glFrameBuffer);

    var pixels = new Uint8Array(4);
    device.readPixels(0, 0, 1, 1, pixels);

    device.setFramebuffer(prevFramebuffer);

    var x = pixels[0] / 255;
    var y = pixels[1] / 255;
    var z = pixels[2] / 255;
    var w = pixels[3] / 255;
    var f = x / (256 * 256 * 256) + y / (256 * 256) + z / 256 + w;

    tex1.destroy();
    targ1.destroy();
    tex2.destroy();
    targ2.destroy();

    return f === 0;
}

/**
 * @readonly
 * @name pc.GraphicsDevice#precision
 * @type {string}
 * @description The highest shader precision supported by this graphics device. Can be 'hiphp', 'mediump' or 'lowp'.
 */
/**
 * @readonly
 * @name pc.GraphicsDevice#maxCubeMapSize
 * @type {number}
 * @description The maximum supported dimension of a cube map.
 */
/**
 * @readonly
 * @name pc.GraphicsDevice#maxTextureSize
 * @type {number}
 * @description The maximum supported dimension of a texture.
 */
/**
 * @readonly
 * @name pc.GraphicsDevice#maxVolumeSize
 * @type {number}
 * @description The maximum supported dimension of a 3D texture (any axis).
 */
/**
 * @readonly
 * @name pc.GraphicsDevice#maxAnisotropy
 * @type {number}
 * @description The maximum supported texture anisotropy setting.
 */
/**
 * @readonly
 * @name pc.GraphicsDevice#supportsInstancing
 * @type {boolean}
 * @description True if hardware instancing is supported.
 */
/**
 * @event
 * @name pc.GraphicsDevice#resizecanvas
 * @description The 'resizecanvas' event is fired when the canvas is resized.
 * @param {number} width - The new width of the canvas in pixels.
 * @param {number} height - The new height of the canvas in pixels.
 */

/**
 * @class
 * @name pc.GraphicsDevice
 * @augments pc.EventHandler
 * @classdesc The graphics device manages the underlying graphics context. It is responsible
 * for submitting render state changes and graphics primitives to the hardware. A graphics
 * device is tied to a specific canvas HTML element. It is valid to have more than one
 * canvas element per page and create a new graphics device against each.
 * @description Creates a new graphics device.
 * @param {HTMLCanvasElement} canvas - The canvas to which the graphics device will render.
 * @param {object} [options] - Options passed when creating the WebGL context. More info {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext here}.
 * @property {HTMLCanvasElement} canvas The canvas DOM element that provides the underlying WebGL context used by the graphics device.
 * @property {boolean} textureFloatRenderable Determines if 32-bit floating-point textures can be used as frame buffer. [read only].
 * @property {boolean} textureHalfFloatRenderable Determines if 16-bit floating-point textures can be used as frame buffer. [read only].
 * @property {pc.ScopeSpace} scope The scope namespace for shader attributes and variables. [read only].
 */
var GraphicsDevice = function (canvas, options) {
    EventHandler.call(this);

    var i;
    this.canvas = canvas;
    this.shader = null;
    this.indexBuffer = null;
    this.vertexBuffers = [];
    this._enableAutoInstancing = false;
    this.autoInstancingMaxObjects = 16384;
    this.defaultFramebuffer = null;
    this.boundVao = null;
    this.transformFeedbackBuffer = null;
    this.activeFramebuffer = null;
    this.textureUnit = 0;
    this.textureUnits = [];
    this._maxPixelRatio = 1;
    this.renderTarget = null;
    this.feedback = null;

    // enable temporary texture unit workaround on desktop safari
    this._tempEnableSafariTextureUnitWorkaround = !!window.safari;

    // local width/height without pixelRatio applied
    this._width = 0;
    this._height = 0;

    this.updateClientRect();

    // Shader code to WebGL shader cache
    this.vertexShaderCache = {};
    this.fragmentShaderCache = {};

    // Array of WebGL objects that need to be re-initialized after a context restore event
    this.shaders = [];
    this.buffers = [];
    this.textures = [];
    this.targets = [];

    // cache of VAOs
    this._vaoMap = new Map();

    // Add handlers for when the WebGL context is lost or restored
    this.contextLost = false;

    this._contextLostHandler = function (event) {
        event.preventDefault();
        this.contextLost = true;
        // #ifdef DEBUG
        console.log('pc.GraphicsDevice: WebGL context lost.');
        // #endif
        this.fire('devicelost');
    }.bind(this);

    this._contextRestoredHandler = function () {
        // #ifdef DEBUG
        console.log('pc.GraphicsDevice: WebGL context restored.');
        // #endif
        this.initializeContext();
        this.contextLost = false;
        this.fire('devicerestored');
    }.bind(this);

    // Retrieve the WebGL context
    var preferWebGl2 = (options && options.preferWebGl2 !== undefined) ? options.preferWebGl2 : true;

    var names = preferWebGl2 ? ["webgl2", "experimental-webgl2", "webgl", "experimental-webgl"] :
        ["webgl", "experimental-webgl"];
    var gl = null;
    options = options || {};
    options.stencil = true;
    for (i = 0; i < names.length; i++) {
        try {
            gl = canvas.getContext(names[i], options);
        } catch (e) { }

        if (gl) {
            this.webgl2 = preferWebGl2 && i < 2;
            break;
        }
    }

    if (!gl) {
        throw new Error("WebGL not supported");
    }

    this.gl = gl;

    // init polyfill for VAOs
    window.setupVertexArrayObject(gl);

    canvas.addEventListener("webglcontextlost", this._contextLostHandler, false);
    canvas.addEventListener("webglcontextrestored", this._contextRestoredHandler, false);

    this.initializeExtensions();
    this.initializeCapabilities();
    this.initializeRenderState();

    for (i = 0; i < this.maxCombinedTextures; i++) {
        this.textureUnits.push([null, null, null]);
    }

    this.defaultClearOptions = {
        color: [0, 0, 0, 1],
        depth: 1,
        stencil: 0,
        flags: CLEARFLAG_COLOR | CLEARFLAG_DEPTH
    };

    this.glAddress = [
        gl.REPEAT,
        gl.CLAMP_TO_EDGE,
        gl.MIRRORED_REPEAT
    ];

    this.glBlendEquation = [
        gl.FUNC_ADD,
        gl.FUNC_SUBTRACT,
        gl.FUNC_REVERSE_SUBTRACT,
        this.webgl2 ? gl.MIN : this.extBlendMinmax ? this.extBlendMinmax.MIN_EXT : gl.FUNC_ADD,
        this.webgl2 ? gl.MAX : this.extBlendMinmax ? this.extBlendMinmax.MAX_EXT : gl.FUNC_ADD
    ];

    this.glBlendFunction = [
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
        gl.ONE_MINUS_DST_ALPHA
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
        gl.FLOAT
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
    if (this.webgl2) {
        this.pcUniformType[gl.SAMPLER_2D_SHADOW]   = UNIFORMTYPE_TEXTURE2D_SHADOW;
        this.pcUniformType[gl.SAMPLER_CUBE_SHADOW] = UNIFORMTYPE_TEXTURECUBE_SHADOW;
        this.pcUniformType[gl.SAMPLER_3D]          = UNIFORMTYPE_TEXTURE3D;
    }

    this.targetToSlot = {};
    this.targetToSlot[gl.TEXTURE_2D] = 0;
    this.targetToSlot[gl.TEXTURE_CUBE_MAP] = 1;
    this.targetToSlot[gl.TEXTURE_3D] = 2;

    // Define the uniform commit functions
    var scopeX, scopeY, scopeZ, scopeW;
    var uniformValue;
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

    // Create the ScopeNamespace for shader attributes and variables
    this.scope = new ScopeSpace("Device");

    this.programLib = new ProgramLibrary(this);
    for (var generator in programlib)
        this.programLib.register(generator, programlib[generator]);

    this.supportsBoneTextures = this.extTextureFloat && this.maxVertexTextures > 0;
    this.useTexCubeLod = this.extTextureLod && this.maxTextures < 16;

    // Calculate an estimate of the maximum number of bones that can be uploaded to the GPU
    // based on the number of available uniforms and the number of uniforms required for non-
    // bone data.  This is based off of the Standard shader.  A user defined shader may have
    // even less space available for bones so this calculated value can be overridden via
    // pc.GraphicsDevice.setBoneLimit.
    var numUniforms = this.vertexUniformsCount;
    numUniforms -= 4 * 4; // Model, view, projection and shadow matrices
    numUniforms -= 8;     // 8 lights max, each specifying a position vector
    numUniforms -= 1;     // Eye position
    numUniforms -= 4 * 4; // Up to 4 texture transforms
    this.boneLimit = Math.floor(numUniforms / 3);   // each bone uses 3 uniforms

    // Put a limit on the number of supported bones before skin partitioning must be performed
    // Some GPUs have demonstrated performance issues if the number of vectors allocated to the
    // skin matrix palette is left unbounded
    this.boneLimit = Math.min(this.boneLimit, 128);

    if (this.unmaskedRenderer === 'Mali-450 MP') {
        this.boneLimit = 34;
    }

    // Profiler stats
    this._drawCallsPerFrame = 0;
    this._shaderSwitchesPerFrame = 0;
    this._primsPerFrame = [];
    for (i = PRIMITIVE_POINTS; i <= PRIMITIVE_TRIFAN; i++) {
        this._primsPerFrame[i] = 0;
    }
    this._renderTargetCreationTime = 0;

    this._vram = {
        // #ifdef PROFILER
        texShadow: 0,
        texAsset: 0,
        texLightmap: 0,
        // #endif
        tex: 0,
        vb: 0,
        ib: 0
    };

    this._shaderStats = {
        vsCompiled: 0,
        fsCompiled: 0,
        linked: 0,
        materialShaders: 0,
        compileTime: 0
    };

    this.constantTexSource = this.scope.resolve("source");

    if (this.extTextureFloat) {
        if (this.webgl2) {
            // In WebGL2 float texture renderability is dictated by the EXT_color_buffer_float extension
            this.textureFloatRenderable = !!this.extColorBufferFloat;
        } else {
            // In WebGL1 we should just try rendering into a float texture
            this.textureFloatRenderable = testRenderable(gl, gl.FLOAT);
        }
    } else {
        this.textureFloatRenderable = false;
    }
    if (this.extTextureHalfFloat) {
        if (this.webgl2) {
            // EXT_color_buffer_float should affect both float and halffloat formats
            this.textureHalfFloatRenderable = !!this.extColorBufferFloat;
        } else {
            // Manual render check for half float
            this.textureHalfFloatRenderable = testRenderable(gl, this.extTextureHalfFloat.HALF_FLOAT_OES);
        }
    } else {
        this.textureHalfFloatRenderable = false;
    }

    this.supportsMorphTargetTexturesCore = (this.maxPrecision === "highp" && this.maxVertexTextures >= 2);

    this._textureFloatHighPrecision = undefined;
    this._textureHalfFloatUpdatable = undefined;

    // #ifdef DEBUG
    this._spectorMarkers = [];
    this._spectorCurrentMarker = "";
    // #endif

    this.createGrabPass(options.alpha);

    VertexFormat.init(this);
};
GraphicsDevice.prototype = Object.create(EventHandler.prototype);
GraphicsDevice.prototype.constructor = GraphicsDevice;

Object.assign(GraphicsDevice.prototype, {

    // #ifdef DEBUG
    updateMarker: function () {
        this._spectorCurrentMarker = this._spectorMarkers.join(" | ") + " # ";
    },

    pushMarker: function (name) {
        if (window.spector) {
            this._spectorMarkers.push(name);
            this.updateMarker();
            window.spector.setMarker(this._spectorCurrentMarker);
        }
    },

    popMarker: function () {
        if (window.spector) {
            if (this._spectorMarkers.length) {
                this._spectorMarkers.pop();
                this.updateMarker();

                if (this._spectorMarkers.length)
                    window.spector.setMarker(this._spectorCurrentMarker);
                else
                    window.spector.clearMarker();
            }
        }
    },
    // #endif

    getPrecision: function () {
        var gl = this.gl;
        var precision = "highp";

        // Query the precision supported by ints and floats in vertex and fragment shaders.
        // Note that getShaderPrecisionFormat is not guaranteed to be present (such as some
        // instances of the default Android browser). In this case, assume highp is available.
        if (gl.getShaderPrecisionFormat) {
            var vertexShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
            var vertexShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT);

            var fragmentShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
            var fragmentShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT );

            var highpAvailable = vertexShaderPrecisionHighpFloat.precision > 0 && fragmentShaderPrecisionHighpFloat.precision > 0;
            var mediumpAvailable = vertexShaderPrecisionMediumpFloat.precision > 0 && fragmentShaderPrecisionMediumpFloat.precision > 0;

            if (!highpAvailable) {
                if (mediumpAvailable) {
                    precision = "mediump";
                    // #ifdef DEBUG
                    console.warn("WARNING: highp not supported, using mediump");
                    // #endif
                } else {
                    precision = "lowp";
                    // #ifdef DEBUG
                    console.warn( "WARNING: highp and mediump not supported, using lowp" );
                    // #endif
                }
            }
        }

        return precision;
    },

    initializeExtensions: function () {
        var gl = this.gl;
        var ext;

        var supportedExtensions = gl.getSupportedExtensions();

        var getExtension = function () {
            for (var i = 0; i < arguments.length; i++) {
                if (supportedExtensions.indexOf(arguments[i]) !== -1) {
                    return gl.getExtension(arguments[i]);
                }
            }
            return null;
        };

        if (this.webgl2) {
            this.extBlendMinmax = true;
            this.extDrawBuffers = true;
            this.extInstancing = true;
            this.extStandardDerivatives = true;
            this.extTextureFloat = true;
            this.extTextureHalfFloat = true;
            this.extTextureHalfFloatLinear = true;
            this.extTextureLod = true;
            this.extUintElement = true;
            this.extVertexArrayObject = true;
            this.extColorBufferFloat = getExtension('EXT_color_buffer_float');
            // Note that Firefox exposes EXT_disjoint_timer_query under WebGL2 rather than
            // EXT_disjoint_timer_query_webgl2
            this.extDisjointTimerQuery = getExtension('EXT_disjoint_timer_query_webgl2', 'EXT_disjoint_timer_query');
        } else {
            this.extBlendMinmax = getExtension("EXT_blend_minmax");
            this.extDrawBuffers = getExtension('EXT_draw_buffers');
            this.extInstancing = getExtension("ANGLE_instanced_arrays");
            if (this.extInstancing) {
                // Install the WebGL 2 Instancing API for WebGL 1.0
                ext = this.extInstancing;
                gl.drawArraysInstanced = ext.drawArraysInstancedANGLE.bind(ext);
                gl.drawElementsInstanced = ext.drawElementsInstancedANGLE.bind(ext);
                gl.vertexAttribDivisor = ext.vertexAttribDivisorANGLE.bind(ext);
            }

            this.extStandardDerivatives = getExtension("OES_standard_derivatives");
            this.extTextureFloat = getExtension("OES_texture_float");
            this.extTextureHalfFloat = getExtension("OES_texture_half_float");
            this.extTextureHalfFloatLinear = getExtension("OES_texture_half_float_linear");
            this.extTextureLod = getExtension('EXT_shader_texture_lod');
            this.extUintElement = getExtension("OES_element_index_uint");
            this.extVertexArrayObject = getExtension("OES_vertex_array_object");
            if (this.extVertexArrayObject) {
                // Install the WebGL 2 VAO API for WebGL 1.0
                ext = this.extVertexArrayObject;
                gl.createVertexArray = ext.createVertexArrayOES.bind(ext);
                gl.deleteVertexArray = ext.deleteVertexArrayOES.bind(ext);
                gl.isVertexArray = ext.isVertexArrayOES.bind(ext);
                gl.bindVertexArray = ext.bindVertexArrayOES.bind(ext);
            }
            this.extColorBufferFloat = null;
            this.extDisjointTimerQuery = null;
        }

        this.extDebugRendererInfo = getExtension('WEBGL_debug_renderer_info');
        this.extTextureFloatLinear = getExtension("OES_texture_float_linear");
        this.extFloatBlend = getExtension("EXT_float_blend");
        this.extTextureFilterAnisotropic = getExtension('EXT_texture_filter_anisotropic', 'WEBKIT_EXT_texture_filter_anisotropic');
        this.extCompressedTextureETC1 = getExtension('WEBGL_compressed_texture_etc1');
        this.extCompressedTextureETC = getExtension('WEBGL_compressed_texture_etc');
        this.extCompressedTexturePVRTC = getExtension('WEBGL_compressed_texture_pvrtc', 'WEBKIT_WEBGL_compressed_texture_pvrtc');
        this.extCompressedTextureS3TC = getExtension('WEBGL_compressed_texture_s3tc', 'WEBKIT_WEBGL_compressed_texture_s3tc');
        this.extCompressedTextureATC = getExtension('WEBGL_compressed_texture_atc');
        this.extCompressedTextureASTC = getExtension('WEBGL_compressed_texture_astc');
        this.extParallelShaderCompile = getExtension('KHR_parallel_shader_compile');

        this.supportsInstancing = !!this.extInstancing;
    },

    initializeCapabilities: function () {
        var gl = this.gl;
        var ext;

        this.maxPrecision = this.precision = this.getPrecision();

        var contextAttribs = gl.getContextAttributes();
        this.supportsMsaa = contextAttribs.antialias;
        this.supportsStencil = contextAttribs.stencil;

        // Query parameter values from the WebGL context
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        this.maxCubeMapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
        this.maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
        this.maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        this.maxCombinedTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
        this.maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
        this.vertexUniformsCount = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
        this.fragmentUniformsCount = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
        if (this.webgl2) {
            this.maxDrawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS);
            this.maxColorAttachments = gl.getParameter(gl.MAX_COLOR_ATTACHMENTS);
            this.maxVolumeSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
        } else {
            ext = this.extDrawBuffers;
            this.maxDrawBuffers = ext ? gl.getParameter(ext.MAX_DRAW_BUFFERS_EXT) : 1;
            this.maxColorAttachments = ext ? gl.getParameter(ext.MAX_COLOR_ATTACHMENTS_EXT) : 1;
            this.maxVolumeSize = 1;
        }

        ext = this.extDebugRendererInfo;
        this.unmaskedRenderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
        this.unmaskedVendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '';

        ext = this.extTextureFilterAnisotropic;
        this.maxAnisotropy = ext ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;

        this.samples = gl.getParameter(gl.SAMPLES);
    },

    initializeRenderState: function () {
        var gl = this.gl;

        // Initialize render state to a known start state
        this.blending = false;
        gl.disable(gl.BLEND);

        this.blendSrc = BLENDMODE_ONE;
        this.blendDst = BLENDMODE_ZERO;
        this.blendSrcAlpha = BLENDMODE_ONE;
        this.blendDstAlpha = BLENDMODE_ZERO;
        this.separateAlphaBlend = false;
        this.blendEquation = BLENDEQUATION_ADD;
        this.blendAlphaEquation = BLENDEQUATION_ADD;
        this.separateAlphaEquation = false;
        gl.blendFunc(gl.ONE, gl.ZERO);
        gl.blendEquation(gl.FUNC_ADD);

        this.writeRed = true;
        this.writeGreen = true;
        this.writeBlue = true;
        this.writeAlpha = true;
        gl.colorMask(true, true, true, true);

        this.cullMode = CULLFACE_BACK;
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        this.depthTest = true;
        gl.enable(gl.DEPTH_TEST);

        this.depthFunc = FUNC_LESSEQUAL;
        gl.depthFunc(gl.LEQUAL);

        this.depthWrite = true;
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
        if (this.webgl2) {
            gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
            gl.disable(gl.RASTERIZER_DISCARD);
        }

        this.depthBiasEnabled = false;
        gl.disable(gl.POLYGON_OFFSET_FILL);

        this.clearDepth = 1;
        gl.clearDepth(1);

        this.clearRed = 0;
        this.clearBlue = 0;
        this.clearGreen = 0;
        this.clearAlpha = 0;
        gl.clearColor(0, 0, 0, 0);

        this.clearStencil = 0;
        gl.clearStencil(0);

        // Cached viewport and scissor dimensions
        this.vx = this.vy = this.vw = this.vh = 0;
        this.sx = this.sy = this.sw = this.sh = 0;

        if (this.webgl2) {
            gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
        } else {
            if (this.extStandardDerivatives) {
                gl.hint(this.extStandardDerivatives.FRAGMENT_SHADER_DERIVATIVE_HINT_OES, gl.NICEST);
            }
        }

        gl.enable(gl.SCISSOR_TEST);

        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

        this.unpackFlipY = false;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

        this.unpackPremultiplyAlpha = false;
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    },

    initializeContext: function () {
        this.initializeExtensions();
        this.initializeCapabilities();
        this.initializeRenderState();

        // Recompile all shaders (they'll be linked when they're next actually used)
        var i, len;
        for (i = 0, len = this.shaders.length; i < len; i++) {
            this.compileAndLinkShader(this.shaders[i]);
        }
        this.shader = null;

        // Recreate buffer objects and reupload buffer data to the GPU
        for (i = 0, len = this.buffers.length; i < len; i++) {
            this.buffers[i].bufferId = undefined;
            this.buffers[i].unlock();
        }
        this.boundVao = null;
        this.indexBuffer = null;
        this.vertexBuffers = [];

        // Force all textures to be recreated and reuploaded
        for (i = 0, len = this.textures.length; i < len; i++) {
            var texture = this.textures[i];
            this.destroyTexture(texture);
            texture.dirtyAll();
        }
        this.textureUnit = 0;
        this.textureUnits.length = 0;
        for (i = 0; i < this.maxCombinedTextures; i++) {
            this.textureUnits.push([null, null, null]);
        }

        // Reset all render targets so they'll be recreated as required.
        // TODO: a solution for the case where a render target contains something
        // that was previously generated that needs to be re-rendered.
        for (i = 0, len = this.targets.length; i < len; i++) {
            this.targets[i]._glFrameBuffer = undefined;
            this.targets[i]._glDepthBuffer = undefined;
            this.targets[i]._glResolveFrameBuffer = undefined;
            this.targets[i]._glMsaaColorBuffer = undefined;
            this.targets[i]._glMsaaDepthBuffer = undefined;
        }
        this.renderTarget = null;
        this.activeFramebuffer = null;
        this.feedback = null;
        this.transformFeedbackBuffer = null;
    },

    createGrabPass: function (alpha) {
        if (this.grabPassTexture) return;

        var format = alpha ? PIXELFORMAT_R8_G8_B8_A8 : PIXELFORMAT_R8_G8_B8;

        var grabPassTexture = new Texture(this, {
            format: format,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            mipmaps: false
        });

        grabPassTexture.name = 'texture_grabPass';

        var grabPassTextureId = this.scope.resolve(grabPassTexture.name);
        grabPassTextureId.setValue(grabPassTexture);

        var grabPassRenderTarget = new RenderTarget({
            colorBuffer: grabPassTexture,
            depth: false
        });

        this.grabPassRenderTarget = grabPassRenderTarget;
        this.grabPassTextureId = grabPassTextureId;
        this.grabPassTexture = grabPassTexture;
    },

    updateGrabPass: function () {
        var gl = this.gl;

        var renderTarget = this.renderTarget;
        var resolveRenderTarget = renderTarget && renderTarget._glResolveFrameBuffer;
        var grabPassTexture = this.grabPassTexture;
        var width = this.width;
        var height = this.height;

        if (this.webgl2 && width === grabPassTexture._width && height === grabPassTexture._height) {
            if (resolveRenderTarget) renderTarget.resolve(true);

            var currentFrameBuffer = renderTarget ? renderTarget._glFrameBuffer : null;
            var resolvedFrameBuffer = renderTarget ? renderTarget._glResolveFrameBuffer || renderTarget._glFrameBuffer : null;

            this.initRenderTarget(this.grabPassRenderTarget);
            var grabPassFrameBuffer = this.grabPassRenderTarget._glFrameBuffer;

            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, resolvedFrameBuffer);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, grabPassFrameBuffer);
            gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, currentFrameBuffer);

        } else {
            if (resolveRenderTarget) {
                renderTarget.resolve(true);
                gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget._glResolveFrameBuffer);
            }

            var format = grabPassTexture._glFormat;
            gl.copyTexImage2D(gl.TEXTURE_2D, 0, format, 0, 0, width, height, 0);
            grabPassTexture._width = width;
            grabPassTexture._height = height;

            if (resolveRenderTarget) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget._glFrameBuffer);
            }
        }
    },

    destroyGrabPass: function () {
        this.grabPassRenderTarget.destroy();
        this.grabPassRenderTarget = null;

        this.grabPassTextureId = null;
        this.grabPassTexture.destroy();
        this.grabPassTexture = null;
    },

    updateClientRect: function () {
        this.clientRect = this.canvas.getBoundingClientRect();
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setViewport
     * @description Set the active rectangle for rendering on the specified device.
     * @param {number} x - The pixel space x-coordinate of the bottom left corner of the viewport.
     * @param {number} y - The pixel space y-coordinate of the bottom left corner of the viewport.
     * @param {number} w - The width of the viewport in pixels.
     * @param {number} h - The height of the viewport in pixels.
     */
    setViewport: function (x, y, w, h) {
        if ((this.vx !== x) || (this.vy !== y) || (this.vw !== w) || (this.vh !== h)) {
            this.gl.viewport(x, y, w, h);
            this.vx = x;
            this.vy = y;
            this.vw = w;
            this.vh = h;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setScissor
     * @description Set the active scissor rectangle on the specified device.
     * @param {number} x - The pixel space x-coordinate of the bottom left corner of the scissor rectangle.
     * @param {number} y - The pixel space y-coordinate of the bottom left corner of the scissor rectangle.
     * @param {number} w - The width of the scissor rectangle in pixels.
     * @param {number} h - The height of the scissor rectangle in pixels.
     */
    setScissor: function (x, y, w, h) {
        if ((this.sx !== x) || (this.sy !== y) || (this.sw !== w) || (this.sh !== h)) {
            this.gl.scissor(x, y, w, h);
            this.sx = x;
            this.sy = y;
            this.sw = w;
            this.sh = h;
        }
    },

    /**
     * @private
     * @function
     * @name pc.GraphicsDevice#getProgramLibrary
     * @description Retrieves the program library assigned to the specified graphics device.
     * @returns {pc.ProgramLibrary} The program library assigned to the device.
     */
    getProgramLibrary: function () {
        return this.programLib;
    },

    /**
     * @private
     * @function
     * @name pc.GraphicsDevice#setProgramLibrary
     * @description Assigns a program library to the specified device. By default, a graphics
     * device is created with a program library that manages all of the programs that are
     * used to render any graphical primitives. However, this function allows the user to
     * replace the existing program library with a new one.
     * @param {pc.ProgramLibrary} programLib - The program library to assign to the device.
     */
    setProgramLibrary: function (programLib) {
        this.programLib = programLib;
    },

    setFramebuffer: function (fb) {
        if (this.activeFramebuffer !== fb) {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
            this.activeFramebuffer = fb;
        }
    },

    _checkFbo: function () {
        // Ensure all is well
        var gl = this.gl;
        var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        switch (status) {
            case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                console.error("ERROR: FRAMEBUFFER_INCOMPLETE_ATTACHMENT");
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                console.error("ERROR: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT");
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                console.error("ERROR: FRAMEBUFFER_INCOMPLETE_DIMENSIONS");
                break;
            case gl.FRAMEBUFFER_UNSUPPORTED:
                console.error("ERROR: FRAMEBUFFER_UNSUPPORTED");
                break;
            case gl.FRAMEBUFFER_COMPLETE:
                break;
            default:
                break;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#copyRenderTarget
     * @description Copies source render target into destination render target. Mostly used by post-effects.
     * @param {pc.RenderTarget} source - The source render target.
     * @param {pc.RenderTarget} [dest] - The destination render target. Defaults to frame buffer.
     * @param {boolean} [color] - If true will copy the color buffer. Defaults to false.
     * @param {boolean} [depth] - If true will copy the depth buffer. Defaults to false.
     * @returns {boolean} True if the copy was successful, false otherwise.
     */
    copyRenderTarget: function (source, dest, color, depth) {
        var gl = this.gl;

        if (!this.webgl2 && depth) {
            // #ifdef DEBUG
            console.error("Depth is not copyable on WebGL 1.0");
            // #endif
            return false;
        }
        if (color) {
            if (!dest) {
                // copying to backbuffer
                if (!source._colorBuffer) {
                    // #ifdef DEBUG
                    console.error("Can't copy empty color buffer to backbuffer");
                    // #endif
                    return false;
                }
            } else {
                // copying to render target
                if (!source._colorBuffer || !dest._colorBuffer) {
                    // #ifdef DEBUG
                    console.error("Can't copy color buffer, because one of the render targets doesn't have it");
                    // #endif
                    return false;
                }
                if (source._colorBuffer._format !== dest._colorBuffer._format) {
                    // #ifdef DEBUG
                    console.error("Can't copy render targets of different color formats");
                    // #endif
                    return false;
                }
            }
        }
        if (depth) {
            if (!source._depthBuffer || !dest._depthBuffer) {
                // #ifdef DEBUG
                console.error("Can't copy depth buffer, because one of the render targets doesn't have it");
                // #endif
                return false;
            }
            if (source._depthBuffer._format !== dest._depthBuffer._format) {
                // #ifdef DEBUG
                console.error("Can't copy render targets of different depth formats");
                // #endif
                return false;
            }
        }

        if (this.webgl2 && dest) {
            var prevRt = this.renderTarget;
            this.renderTarget = dest;
            this.updateBegin();
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source ? source._glFrameBuffer : null);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dest._glFrameBuffer);
            var w = source ? source.width : dest.width;
            var h = source ? source.height : dest.height;
            gl.blitFramebuffer( 0, 0, w, h,
                                0, 0, w, h,
                                (color ? gl.COLOR_BUFFER_BIT : 0) | (depth ? gl.DEPTH_BUFFER_BIT : 0),
                                gl.NEAREST);
            this.renderTarget = prevRt;
            gl.bindFramebuffer(gl.FRAMEBUFFER, prevRt ? prevRt._glFrameBuffer : null);
        } else {
            var shader = this.getCopyShader();
            this.constantTexSource.setValue(source._colorBuffer);
            drawQuadWithShader(this, dest, shader);
        }

        return true;
    },


    /**
     * @private
     * @function
     * @name pc.GraphicsDevice#initRenderTarget
     * @description Initialize render target before it can be used.
     * @param {pc.RenderTarget} target - The render target to be initialized.
     */
    initRenderTarget: function (target) {
        if (target._glFrameBuffer) return;

        // #ifdef PROFILER
        var startTime = now();
        this.fire('fbo:create', {
            timestamp: startTime,
            target: this
        });
        // #endif

        // Set RT's device
        target._device = this;
        var gl = this.gl;

        // ##### Create main FBO #####
        target._glFrameBuffer = gl.createFramebuffer();
        this.setFramebuffer(target._glFrameBuffer);

        // --- Init the provided color buffer (optional) ---
        var colorBuffer = target._colorBuffer;
        if (colorBuffer) {
            if (!colorBuffer._glTexture) {
                // Clamp the render buffer size to the maximum supported by the device
                colorBuffer._width = Math.min(colorBuffer.width, this.maxRenderBufferSize);
                colorBuffer._height = Math.min(colorBuffer.height, this.maxRenderBufferSize);
                this.setTexture(colorBuffer, 0);
            }
            // Attach the color buffer
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                colorBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D,
                colorBuffer._glTexture,
                0
            );
        }

        var depthBuffer = target._depthBuffer;
        if (depthBuffer && this.webgl2) {
            // --- Init the provided depth/stencil buffer (optional, WebGL2 only) ---
            if (!depthBuffer._glTexture) {
                // Clamp the render buffer size to the maximum supported by the device
                depthBuffer._width = Math.min(depthBuffer.width, this.maxRenderBufferSize);
                depthBuffer._height = Math.min(depthBuffer.height, this.maxRenderBufferSize);
                this.setTexture(depthBuffer, 0);
            }
            // Attach
            if (target._stencil) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT,
                                        depthBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D,
                                        target._depthBuffer._glTexture, 0);
            } else {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
                                        depthBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D,
                                        target._depthBuffer._glTexture, 0);
            }
        } else if (target._depth) {
            // --- Init a new depth/stencil buffer (optional) ---
            // if this is a MSAA RT, and no buffer to resolve to, skip creating non-MSAA depth
            var willRenderMsaa = target._samples > 1 && this.webgl2;
            if (!willRenderMsaa) {
                if (!target._glDepthBuffer) {
                    target._glDepthBuffer = gl.createRenderbuffer();
                }
                gl.bindRenderbuffer(gl.RENDERBUFFER, target._glDepthBuffer);
                if (target._stencil) {
                    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, target.width, target.height);
                    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, target._glDepthBuffer);
                } else {
                    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, target.width, target.height);
                    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, target._glDepthBuffer);
                }
                gl.bindRenderbuffer(gl.RENDERBUFFER, null);
            }
        }

        // #ifdef DEBUG
        this._checkFbo();
        // #endif

        // ##### Create MSAA FBO (WebGL2 only) #####
        if (this.webgl2 && target._samples > 1) {

            // Use previous FBO for resolves
            target._glResolveFrameBuffer = target._glFrameBuffer;

            // Actual FBO will be MSAA
            target._glFrameBuffer = gl.createFramebuffer();
            this.setFramebuffer(target._glFrameBuffer);

            // Create an optional MSAA color buffer
            if (colorBuffer) {
                if (!target._glMsaaColorBuffer) {
                    target._glMsaaColorBuffer = gl.createRenderbuffer();
                }
                gl.bindRenderbuffer(gl.RENDERBUFFER, target._glMsaaColorBuffer);
                gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, colorBuffer._glInternalFormat, target.width, target.height);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, target._glMsaaColorBuffer);
            }

            // Optionally add a MSAA depth/stencil buffer
            if (target._depth) {
                if (!target._glMsaaDepthBuffer) {
                    target._glMsaaDepthBuffer = gl.createRenderbuffer();
                }
                gl.bindRenderbuffer(gl.RENDERBUFFER, target._glMsaaDepthBuffer);
                if (target._stencil) {
                    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, gl.DEPTH24_STENCIL8, target.width, target.height);
                    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, target._glMsaaDepthBuffer);
                } else {
                    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, gl.DEPTH_COMPONENT32F, target.width, target.height);
                    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, target._glMsaaDepthBuffer);
                }
            }
            // #ifdef DEBUG
            this._checkFbo();
            // #endif
        }

        this.targets.push(target);

        // #ifdef PROFILER
        this._renderTargetCreationTime += now() - startTime;
        // #endif
    },

    /**
     * @private
     * @function
     * @name pc.GraphicsDevice#getCopyShader
     * @description Get copy shader for efficient rendering of fullscreen-quad with texture.
     * @returns {pc.Shader} The copy shader (based on `fullscreenQuadVS` and `outputTex2DPS` in `pc.shaderChunks`).
     */
    getCopyShader: function () {
        if (!this._copyShader) {
            this._copyShader = createShaderFromCode(this,
                                                    shaderChunks.fullscreenQuadVS,
                                                    shaderChunks.outputTex2DPS,
                                                    "outputTex2D");
        }
        return this._copyShader;
    },

    /**
     * @function
     * @name pc.GraphicsDevice#updateBegin
     * @description Marks the beginning of a block of rendering. Internally, this function
     * binds the render target currently set on the device. This function should be matched
     * with a call to pc.GraphicsDevice#updateEnd. Calls to pc.GraphicsDevice#updateBegin
     * and pc.GraphicsDevice#updateEnd must not be nested.
     */
    updateBegin: function () {
        this.boundVao = null;

        // clear texture units once a frame on desktop safari
        if (this._tempEnableSafariTextureUnitWorkaround) {
            for (var unit = 0; unit < this.textureUnits.length; ++unit) {
                for (var slot = 0; slot < 3; ++slot) {
                    this.textureUnits[unit][slot] = null;
                }
            }
        }

        // Set the render target
        var target = this.renderTarget;
        if (target) {
            // Create a new WebGL frame buffer object
            if (!target._glFrameBuffer) {
                this.initRenderTarget(target);

            } else {
                this.setFramebuffer(target._glFrameBuffer);
            }
        } else {
            this.setFramebuffer(this.defaultFramebuffer);
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#updateEnd
     * @description Marks the end of a block of rendering. This function should be called
     * after a matching call to pc.GraphicsDevice#updateBegin. Calls to pc.GraphicsDevice#updateBegin
     * and pc.GraphicsDevice#updateEnd must not be nested.
     */
    updateEnd: function () {
        var gl = this.gl;

        // Unset the render target
        var target = this.renderTarget;
        if (target) {
            // If the active render target is auto-mipmapped, generate its mip chain
            var colorBuffer = target._colorBuffer;
            if (colorBuffer && colorBuffer._glTexture && colorBuffer.mipmaps && colorBuffer.pot) {
                this.activeTexture(this.maxCombinedTextures - 1);
                this.bindTexture(colorBuffer);
                gl.generateMipmap(colorBuffer._glTarget);
            }

            // Resolve MSAA if needed
            if (this.webgl2 && target._samples > 1 && target.autoResolve) {
                target.resolve();
            }
        }
    },

    initializeTexture: function (texture) {
        var gl = this.gl;
        var ext;

        texture._glTexture = gl.createTexture();

        texture._glTarget = texture._cubemap ? gl.TEXTURE_CUBE_MAP :
            (texture._volume ? gl.TEXTURE_3D : gl.TEXTURE_2D);

        switch (texture._format) {
            case PIXELFORMAT_A8:
                texture._glFormat = gl.ALPHA;
                texture._glInternalFormat = gl.ALPHA;
                texture._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_L8:
                texture._glFormat = gl.LUMINANCE;
                texture._glInternalFormat = gl.LUMINANCE;
                texture._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_L8_A8:
                texture._glFormat = gl.LUMINANCE_ALPHA;
                texture._glInternalFormat = gl.LUMINANCE_ALPHA;
                texture._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_R5_G6_B5:
                texture._glFormat = gl.RGB;
                texture._glInternalFormat = gl.RGB;
                texture._glPixelType = gl.UNSIGNED_SHORT_5_6_5;
                break;
            case PIXELFORMAT_R5_G5_B5_A1:
                texture._glFormat = gl.RGBA;
                texture._glInternalFormat = gl.RGBA;
                texture._glPixelType = gl.UNSIGNED_SHORT_5_5_5_1;
                break;
            case PIXELFORMAT_R4_G4_B4_A4:
                texture._glFormat = gl.RGBA;
                texture._glInternalFormat = gl.RGBA;
                texture._glPixelType = gl.UNSIGNED_SHORT_4_4_4_4;
                break;
            case PIXELFORMAT_R8_G8_B8:
                texture._glFormat = gl.RGB;
                texture._glInternalFormat = this.webgl2 ? gl.RGB8 : gl.RGB;
                texture._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_R8_G8_B8_A8:
                texture._glFormat = gl.RGBA;
                texture._glInternalFormat = this.webgl2 ? gl.RGBA8 : gl.RGBA;
                texture._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_DXT1:
                ext = this.extCompressedTextureS3TC;
                texture._glFormat = gl.RGB;
                texture._glInternalFormat = ext.COMPRESSED_RGB_S3TC_DXT1_EXT;
                break;
            case PIXELFORMAT_DXT3:
                ext = this.extCompressedTextureS3TC;
                texture._glFormat = gl.RGBA;
                texture._glInternalFormat = ext.COMPRESSED_RGBA_S3TC_DXT3_EXT;
                break;
            case PIXELFORMAT_DXT5:
                ext = this.extCompressedTextureS3TC;
                texture._glFormat = gl.RGBA;
                texture._glInternalFormat = ext.COMPRESSED_RGBA_S3TC_DXT5_EXT;
                break;
            case PIXELFORMAT_ETC1:
                ext = this.extCompressedTextureETC1;
                texture._glFormat = gl.RGB;
                texture._glInternalFormat = ext.COMPRESSED_RGB_ETC1_WEBGL;
                break;
            case PIXELFORMAT_PVRTC_2BPP_RGB_1:
                ext = this.extCompressedTexturePVRTC;
                texture._glFormat = gl.RGB;
                texture._glInternalFormat = ext.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
                break;
            case PIXELFORMAT_PVRTC_2BPP_RGBA_1:
                ext = this.extCompressedTexturePVRTC;
                texture._glFormat = gl.RGBA;
                texture._glInternalFormat = ext.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
                break;
            case PIXELFORMAT_PVRTC_4BPP_RGB_1:
                ext = this.extCompressedTexturePVRTC;
                texture._glFormat = gl.RGB;
                texture._glInternalFormat = ext.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
                break;
            case PIXELFORMAT_PVRTC_4BPP_RGBA_1:
                ext = this.extCompressedTexturePVRTC;
                texture._glFormat = gl.RGBA;
                texture._glInternalFormat = ext.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
                break;
            case PIXELFORMAT_ETC2_RGB:
                ext = this.extCompressedTextureETC;
                texture._glFormat = gl.RGB;
                texture._glInternalFormat = ext.COMPRESSED_RGB8_ETC2;
                break;
            case PIXELFORMAT_ETC2_RGBA:
                ext = this.extCompressedTextureETC;
                texture._glFormat = gl.RGBA;
                texture._glInternalFormat = ext.COMPRESSED_RGBA8_ETC2_EAC;
                break;
            case PIXELFORMAT_ASTC_4x4:
                ext = this.extCompressedTextureASTC;
                texture._glFormat = gl.RGBA;
                texture._glInternalFormat = ext.COMPRESSED_RGBA_ASTC_4x4_KHR;
                break;
            case PIXELFORMAT_ATC_RGB:
                ext = this.extCompressedTextureATC;
                texture._glFormat = gl.RGB;
                texture._glInternalFormat = ext.COMPRESSED_RGB_ATC_WEBGL;
                break;
            case PIXELFORMAT_ATC_RGBA:
                ext = this.extCompressedTextureATC;
                texture._glFormat = gl.RGBA;
                texture._glInternalFormat = ext.COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL;
                break;
            case PIXELFORMAT_RGB16F:
                // definition varies between WebGL1 and 2
                ext = this.extTextureHalfFloat;
                texture._glFormat = gl.RGB;
                if (this.webgl2) {
                    texture._glInternalFormat = gl.RGB16F;
                    texture._glPixelType = gl.HALF_FLOAT;
                } else {
                    texture._glInternalFormat = gl.RGB;
                    texture._glPixelType = ext.HALF_FLOAT_OES;
                }
                break;
            case PIXELFORMAT_RGBA16F:
                // definition varies between WebGL1 and 2
                ext = this.extTextureHalfFloat;
                texture._glFormat = gl.RGBA;
                if (this.webgl2) {
                    texture._glInternalFormat = gl.RGBA16F;
                    texture._glPixelType = gl.HALF_FLOAT;
                } else {
                    texture._glInternalFormat = gl.RGBA;
                    texture._glPixelType = ext.HALF_FLOAT_OES;
                }
                break;
            case PIXELFORMAT_RGB32F:
                // definition varies between WebGL1 and 2
                texture._glFormat = gl.RGB;
                if (this.webgl2) {
                    texture._glInternalFormat = gl.RGB32F;
                } else {
                    texture._glInternalFormat = gl.RGB;
                }
                texture._glPixelType = gl.FLOAT;
                break;
            case PIXELFORMAT_RGBA32F:
                // definition varies between WebGL1 and 2
                texture._glFormat = gl.RGBA;
                if (this.webgl2) {
                    texture._glInternalFormat = gl.RGBA32F;
                } else {
                    texture._glInternalFormat = gl.RGBA;
                }
                texture._glPixelType = gl.FLOAT;
                break;
            case PIXELFORMAT_R32F: // WebGL2 only
                texture._glFormat = gl.RED;
                texture._glInternalFormat = gl.R32F;
                texture._glPixelType = gl.FLOAT;
                break;
            case PIXELFORMAT_DEPTH:
                if (this.webgl2) {
                    // native WebGL2
                    texture._glFormat = gl.DEPTH_COMPONENT;
                    texture._glInternalFormat = gl.DEPTH_COMPONENT32F; // should allow 16/24 bits?
                    texture._glPixelType = gl.FLOAT;
                } else {
                    // using WebGL1 extension
                    texture._glFormat = gl.DEPTH_COMPONENT;
                    texture._glInternalFormat = gl.DEPTH_COMPONENT;
                    texture._glPixelType = gl.UNSIGNED_SHORT; // the only acceptable value?
                }
                break;
            case PIXELFORMAT_DEPTHSTENCIL: // WebGL2 only
                texture._glFormat = gl.DEPTH_STENCIL;
                texture._glInternalFormat = gl.DEPTH24_STENCIL8;
                texture._glPixelType = gl.UNSIGNED_INT_24_8;
                break;
            case PIXELFORMAT_111110F: // WebGL2 only
                texture._glFormat = gl.RGB;
                texture._glInternalFormat = gl.R11F_G11F_B10F;
                texture._glPixelType = gl.FLOAT;
                break;
            case PIXELFORMAT_SRGB: // WebGL2 only
                texture._glFormat = gl.RGB;
                texture._glInternalFormat = gl.SRGB8;
                texture._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_SRGBA: // WebGL2 only
                texture._glFormat = gl.RGBA;
                texture._glInternalFormat = gl.SRGB8_ALPHA8;
                texture._glPixelType = gl.UNSIGNED_BYTE;
                break;
        }

        // Track this texture now that it is a WebGL resource
        this.textures.push(texture);
    },

    destroyTexture: function (texture) {
        if (texture._glTexture) {
            // Remove texture from device's texture cache
            var idx = this.textures.indexOf(texture);
            if (idx !== -1) {
                this.textures.splice(idx, 1);
            }

            // Remove texture from any uniforms
            for (var uniformName in this.scope.variables) {
                var uniform = this.scope.variables[uniformName];
                if (uniform.value === texture) {
                    uniform.value = null;
                }
            }

            // Update shadowed texture unit state to remove texture from any units
            for (var i = 0; i < this.textureUnits.length; i++) {
                var textureUnit = this.textureUnits[i];
                for (var j = 0; j < textureUnit.length; j++) {
                    if (textureUnit[j] === texture._glTexture) {
                        textureUnit[j] = null;
                    }
                }
            }

            // Blow away WebGL texture resource
            var gl = this.gl;
            gl.deleteTexture(texture._glTexture);
            delete texture._glTexture;
            delete texture._glTarget;
            delete texture._glFormat;
            delete texture._glInternalFormat;
            delete texture._glPixelType;

            // Update texture stats
            this._vram.tex -= texture._gpuSize;
            // #ifdef PROFILER
            if (texture.profilerHint === TEXHINT_SHADOWMAP) {
                this._vram.texShadow -= texture._gpuSize;
            } else if (texture.profilerHint === TEXHINT_ASSET) {
                this._vram.texAsset -= texture._gpuSize;
            } else if (texture.profilerHint === TEXHINT_LIGHTMAP) {
                this._vram.texLightmap -= texture._gpuSize;
            }
            // #endif
        }
    },

    setUnpackFlipY: function (flipY) {
        if (this.unpackFlipY !== flipY) {
            this.unpackFlipY = flipY;

            // Note: the WebGL spec states that UNPACK_FLIP_Y_WEBGL only affects
            // texImage2D and texSubImage2D, not compressedTexImage2D
            var gl = this.gl;
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
        }
    },

    setUnpackPremultiplyAlpha: function (premultiplyAlpha) {
        if (this.unpackPremultiplyAlpha !== premultiplyAlpha) {
            this.unpackPremultiplyAlpha = premultiplyAlpha;

            // Note: the WebGL spec states that UNPACK_PREMULTIPLY_ALPHA_WEBGL only affects
            // texImage2D and texSubImage2D, not compressedTexImage2D
            var gl = this.gl;
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
        }
    },

    _isBrowserInterface: function (texture) {
        return (typeof HTMLCanvasElement !== 'undefined' && texture instanceof HTMLCanvasElement) ||
               (typeof HTMLImageElement !== 'undefined' && texture instanceof HTMLImageElement) ||
               (typeof HTMLVideoElement !== 'undefined' && texture instanceof HTMLVideoElement) ||
               (typeof ImageBitmap !== 'undefined' && texture instanceof ImageBitmap);
    },

    uploadTexture: function (texture) {
        var gl = this.gl;

        if (!texture._needsUpload && ((texture._needsMipmapsUpload && texture._mipmapsUploaded) || !texture.pot))
            return;

        var mipLevel = 0;
        var mipObject;
        var resMult;

        var requiredMipLevels = Math.log2(Math.max(texture._width, texture._height)) + 1;

        while (texture._levels[mipLevel] || mipLevel === 0) {
            // Upload all existing mip levels. Initialize 0 mip anyway.

            if (!texture._needsUpload && mipLevel === 0) {
                mipLevel++;
                continue;
            } else if (mipLevel && (!texture._needsMipmapsUpload || !texture._mipmaps)) {
                break;
            }

            mipObject = texture._levels[mipLevel];

            if (mipLevel == 1 && !texture._compressed && texture._levels.length < requiredMipLevels) {
                // We have more than one mip levels we want to assign, but we need all mips to make
                // the texture complete. Therefore first generate all mip chain from 0, then assign custom mips.
                // (this implies the call to _completePartialMipLevels above was unsuccessful)
                gl.generateMipmap(texture._glTarget);
                texture._mipmapsUploaded = true;
            }

            if (texture._cubemap) {
                // ----- CUBEMAP -----
                var face;

                if (this._isBrowserInterface(mipObject[0])) {
                    // Upload the image, canvas or video
                    for (face = 0; face < 6; face++) {
                        if (!texture._levelsUpdated[0][face])
                            continue;

                        var src = mipObject[face];
                        // Downsize images that are too large to be used as cube maps
                        if (src instanceof HTMLImageElement) {
                            if (src.width > this.maxCubeMapSize || src.height > this.maxCubeMapSize) {
                                src = _downsampleImage(src, this.maxCubeMapSize);
                                if (mipLevel === 0) {
                                    texture._width = src.width;
                                    texture._height = src.height;
                                }
                            }
                        }

                        this.setUnpackFlipY(false);
                        this.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
                        gl.texImage2D(
                            gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                            mipLevel,
                            texture._glInternalFormat,
                            texture._glFormat,
                            texture._glPixelType,
                            src
                        );
                    }
                } else {
                    // Upload the byte array
                    resMult = 1 / Math.pow(2, mipLevel);
                    for (face = 0; face < 6; face++) {
                        if (!texture._levelsUpdated[0][face])
                            continue;

                        var texData = mipObject[face];
                        if (texture._compressed) {
                            gl.compressedTexImage2D(
                                gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                mipLevel,
                                texture._glInternalFormat,
                                Math.max(texture._width * resMult, 1),
                                Math.max(texture._height * resMult, 1),
                                0,
                                texData
                            );
                        } else {
                            this.setUnpackFlipY(false);
                            this.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
                            gl.texImage2D(
                                gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                mipLevel,
                                texture._glInternalFormat,
                                Math.max(texture._width * resMult, 1),
                                Math.max(texture._height * resMult, 1),
                                0,
                                texture._glFormat,
                                texture._glPixelType,
                                texData
                            );
                        }
                    }
                }
            } else if (texture._volume) {
                // ----- 3D -----
                // Image/canvas/video not supported (yet?)
                // Upload the byte array
                resMult = 1 / Math.pow(2, mipLevel);
                if (texture._compressed) {
                    gl.compressedTexImage3D(gl.TEXTURE_3D,
                                            mipLevel,
                                            texture._glInternalFormat,
                                            Math.max(texture._width * resMult, 1),
                                            Math.max(texture._height * resMult, 1),
                                            Math.max(texture._depth * resMult, 1),
                                            0,
                                            mipObject);
                } else {
                    this.setUnpackFlipY(false);
                    this.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
                    gl.texImage3D(gl.TEXTURE_3D,
                                  mipLevel,
                                  texture._glInternalFormat,
                                  Math.max(texture._width * resMult, 1),
                                  Math.max(texture._height * resMult, 1),
                                  Math.max(texture._depth * resMult, 1),
                                  0,
                                  texture._glFormat,
                                  texture._glPixelType,
                                  mipObject);
                }
            } else {
                // ----- 2D -----
                if (this._isBrowserInterface(mipObject)) {
                    // Downsize images that are too large to be used as textures
                    if (mipObject instanceof HTMLImageElement) {
                        if (mipObject.width > this.maxTextureSize || mipObject.height > this.maxTextureSize) {
                            mipObject = _downsampleImage(mipObject, this.maxTextureSize);
                            if (mipLevel === 0) {
                                texture._width = mipObject.width;
                                texture._height = mipObject.height;
                            }
                        }
                    }

                    // Upload the image, canvas or video
                    this.setUnpackFlipY(texture._flipY);
                    this.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
                    gl.texImage2D(
                        gl.TEXTURE_2D,
                        mipLevel,
                        texture._glInternalFormat,
                        texture._glFormat,
                        texture._glPixelType,
                        mipObject
                    );
                } else {
                    // Upload the byte array
                    resMult = 1 / Math.pow(2, mipLevel);
                    if (texture._compressed) {
                        gl.compressedTexImage2D(
                            gl.TEXTURE_2D,
                            mipLevel,
                            texture._glInternalFormat,
                            Math.max(texture._width * resMult, 1),
                            Math.max(texture._height * resMult, 1),
                            0,
                            mipObject
                        );
                    } else {
                        this.setUnpackFlipY(false);
                        this.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
                        gl.texImage2D(
                            gl.TEXTURE_2D,
                            mipLevel,
                            texture._glInternalFormat,
                            Math.max(texture._width * resMult, 1),
                            Math.max(texture._height * resMult, 1),
                            0,
                            texture._glFormat,
                            texture._glPixelType,
                            mipObject
                        );
                    }
                }

                if (mipLevel === 0) {
                    texture._mipmapsUploaded = false;
                } else {
                    texture._mipmapsUploaded = true;
                }
            }
            mipLevel++;
        }

        if (texture._needsUpload) {
            if (texture._cubemap) {
                for (var i = 0; i < 6; i++)
                    texture._levelsUpdated[0][i] = false;
            } else {
                texture._levelsUpdated[0] = false;
            }
        }

        if (!texture._compressed && texture._mipmaps && texture._needsMipmapsUpload && texture.pot && texture._levels.length === 1) {
            gl.generateMipmap(texture._glTarget);
            texture._mipmapsUploaded = true;
        }

        if (texture._gpuSize) {
            this._vram.tex -= texture._gpuSize;
            // #ifdef PROFILER
            if (texture.profilerHint === TEXHINT_SHADOWMAP) {
                this._vram.texShadow -= texture._gpuSize;
            } else if (texture.profilerHint === TEXHINT_ASSET) {
                this._vram.texAsset -= texture._gpuSize;
            } else if (texture.profilerHint === TEXHINT_LIGHTMAP) {
                this._vram.texLightmap -= texture._gpuSize;
            }
            // #endif
        }

        texture._gpuSize = texture.gpuSize;
        this._vram.tex += texture._gpuSize;
        // #ifdef PROFILER
        if (texture.profilerHint === TEXHINT_SHADOWMAP) {
            this._vram.texShadow += texture._gpuSize;
        } else if (texture.profilerHint === TEXHINT_ASSET) {
            this._vram.texAsset += texture._gpuSize;
        } else if (texture.profilerHint === TEXHINT_LIGHTMAP) {
            this._vram.texLightmap += texture._gpuSize;
        }
        // #endif
    },

    // Activate the specified texture unit
    activeTexture: function (textureUnit) {
        if (this.textureUnit !== textureUnit) {
            this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
            this.textureUnit = textureUnit;
        }
    },

    // If the texture is not already bound on the currently active texture
    // unit, bind it
    bindTexture: function (texture) {
        var textureTarget = texture._glTarget;
        var textureObject = texture._glTexture;
        var textureUnit = this.textureUnit;
        var slot = this.targetToSlot[textureTarget];
        if (this.textureUnits[textureUnit][slot] !== textureObject) {
            this.gl.bindTexture(textureTarget, textureObject);
            this.textureUnits[textureUnit][slot] = textureObject;
        }
    },

    // If the texture is not bound on the specified texture unit, active the
    // texture unit and bind the texture to it
    bindTextureOnUnit: function (texture, textureUnit) {
        var textureTarget = texture._glTarget;
        var textureObject = texture._glTexture;
        var slot = this.targetToSlot[textureTarget];
        if (this.textureUnits[textureUnit][slot] !== textureObject) {
            this.activeTexture(textureUnit);
            this.gl.bindTexture(textureTarget, textureObject);
            this.textureUnits[textureUnit][slot] = textureObject;
        }
    },

    setTextureParameters: function (texture) {
        var gl = this.gl;
        var flags = texture._parameterFlags;
        var target = texture._glTarget;

        if (flags & 1) {
            var filter = texture._minFilter;
            if (!texture.pot || !texture._mipmaps || (texture._compressed && texture._levels.length === 1)) {
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
            if (this.webgl2) {
                gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.glAddress[texture._addressU]);
            } else {
                // WebGL1 doesn't support all addressing modes with NPOT textures
                gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.glAddress[texture.pot ? texture._addressU : ADDRESS_CLAMP_TO_EDGE]);
            }
        }
        if (flags & 8) {
            if (this.webgl2) {
                gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.glAddress[texture._addressV]);
            } else {
                // WebGL1 doesn't support all addressing modes with NPOT textures
                gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.glAddress[texture.pot ? texture._addressV : ADDRESS_CLAMP_TO_EDGE]);
            }
        }
        if (flags & 16) {
            if (this.webgl2) {
                gl.texParameteri(target, gl.TEXTURE_WRAP_R, this.glAddress[texture._addressW]);
            }
        }
        if (flags & 32) {
            if (this.webgl2) {
                gl.texParameteri(target, gl.TEXTURE_COMPARE_MODE, texture._compareOnRead ? gl.COMPARE_REF_TO_TEXTURE : gl.NONE);
            }
        }
        if (flags & 64) {
            if (this.webgl2) {
                gl.texParameteri(target, gl.TEXTURE_COMPARE_FUNC, this.glComparison[texture._compareFunc]);
            }
        }
        if (flags & 128) {
            var ext = this.extTextureFilterAnisotropic;
            if (ext) {
                gl.texParameterf(target, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.max(1, Math.min(Math.round(texture._anisotropy), this.maxAnisotropy)));
            }
        }
    },

    setTexture: function (texture, textureUnit) {
        if (!texture._glTexture)
            this.initializeTexture(texture);

        if (texture._parameterFlags > 0 || texture._needsUpload || texture._needsMipmapsUpload || texture === this.grabPassTexture) {
            // Ensure the specified texture unit is active
            this.activeTexture(textureUnit);
            // Ensure the texture is bound on correct target of the specified texture unit
            this.bindTexture(texture);

            if (texture._parameterFlags) {
                this.setTextureParameters(texture);
                texture._parameterFlags = 0;
            }

            if (texture === this.grabPassTexture) {
                this.updateGrabPass();

            } else if (texture._needsUpload || texture._needsMipmapsUpload) {
                this.uploadTexture(texture);
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
    },

    // function creates VertexArrayObject from list of vertex buffers
    createVertexArray: function (vertexBuffers) {

        var i, vertexBuffer, key;
        var vao;

        // only use cache when more than 1 vertex buffer, otherwise it's unique
        var useCache = vertexBuffers.length > 1;
        if (useCache) {

            // generate unique key for the vertex buffers
            key = "";
            for (i = 0; i < vertexBuffers.length; i++) {
                vertexBuffer = vertexBuffers[i];
                key += vertexBuffer.id + vertexBuffer.format.renderingingHash;
            }

            // try to get VAO from cache
            vao = this._vaoMap.get(key);
        }

        // need to create new vao
        if (!vao) {

            // create VA object
            var gl = this.gl;
            vao = gl.createVertexArray();
            gl.bindVertexArray(vao);

            // don't capture index buffer in VAO
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            // #ifdef DEBUG
            var locZero = false;
            // #endif

            var e, elements;
            for (i = 0; i < vertexBuffers.length; i++) {

                // bind buffer
                vertexBuffer = vertexBuffers[i];
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.bufferId);

                // for each attribute
                elements = vertexBuffer.format.elements;
                for (var j = 0; j < elements.length; j++) {
                    e = elements[j];
                    var loc = semanticToLocation[e.name];

                    // #ifdef DEBUG
                    if (loc === 0) {
                        locZero = true;
                    }
                    // #endif

                    gl.vertexAttribPointer(loc, e.numComponents, this.glType[e.dataType], e.normalize, e.stride, e.offset);
                    gl.enableVertexAttribArray(loc);

                    if (vertexBuffer.instancing) {
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

            // #ifdef DEBUG
            if (!locZero) {
                console.warn("No vertex attribute is mapped to location 0, which might cause compatibility issues on Safari on MacOS - please use attribute SEMANTIC_POSITION or SEMANTIC_ATTR15");
            }
            // #endif
        }

        return vao;
    },

    setBuffers: function () {
        var gl = this.gl;
        var vertexBuffer, vao;

        // create VAO for specified vertex buffers
        if (this.vertexBuffers.length === 1) {

            // single VB keeps its VAO
            vertexBuffer = this.vertexBuffers[0];
            if (!vertexBuffer._vao) {
                vertexBuffer._vao = this.createVertexArray(this.vertexBuffers);
            }
            vao = vertexBuffer._vao;
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
        this.vertexBuffers.length = 0;

        // Set the active index buffer object
        // Note: we don't cache this state and set it only when it changes, as VAO captures last bind buffer in it
        // and so we don't know what VAO sets it to.
        var bufferId = this.indexBuffer ? this.indexBuffer.bufferId : null;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
    },

    /**
     * @function
     * @name pc.GraphicsDevice#draw
     * @description Submits a graphical primitive to the hardware for immediate rendering.
     * @param {object} primitive - Primitive object describing how to submit current vertex/index buffers defined as follows:
     * @param {number} primitive.type - The type of primitive to render. Can be:
     * * {@link pc.PRIMITIVE_POINTS}
     * * {@link pc.PRIMITIVE_LINES}
     * * {@link pc.PRIMITIVE_LINELOOP}
     * * {@link pc.PRIMITIVE_LINESTRIP}
     * * {@link pc.PRIMITIVE_TRIANGLES}
     * * {@link pc.PRIMITIVE_TRISTRIP}
     * * {@link pc.PRIMITIVE_TRIFAN}
     * @param {number} primitive.base - The offset of the first index or vertex to dispatch in the draw call.
     * @param {number} primitive.count - The number of indices or vertices to dispatch in the draw call.
     * @param {boolean} [primitive.indexed] - True to interpret the primitive as indexed, thereby using the currently set index buffer and false otherwise.
     * @param {number} [numInstances=1] - The number of instances to render when using ANGLE_instanced_arrays. Defaults to 1.
     * @param {boolean} [keepBuffers] - Optionally keep the current set of vertex buffers / VAO. This is used when rendering of
     * multiple views, for example under WebXR.
     * @example
     * // Render a single, unindexed triangle
     * device.draw({
     *     type: pc.PRIMITIVE_TRIANGLES,
     *     base: 0,
     *     count: 3,
     *     indexed: false
     * });
     */
    draw: function (primitive, numInstances, keepBuffers) {
        var gl = this.gl;

        var i, j, len; // Loop counting
        var sampler, samplerValue, texture, numTextures; // Samplers
        var uniform, scopeId, uniformVersion, programVersion; // Uniforms
        var shader = this.shader;
        var samplers = shader.samplers;
        var uniforms = shader.uniforms;

        // vertex buffers
        if (!keepBuffers) {
            this.setBuffers();
        }

        // Commit the shader program variables
        var textureUnit = 0;

        for (i = 0, len = samplers.length; i < len; i++) {
            sampler = samplers[i];
            samplerValue = sampler.scopeId.value;
            if (!samplerValue) {
                continue; // Because unset constants shouldn't raise random errors
            }

            if (samplerValue instanceof Texture) {
                texture = samplerValue;
                this.setTexture(texture, textureUnit);

                // #ifdef DEBUG
                if (this.renderTarget) {
                    // Set breakpoint here to debug "Source and destination textures of the draw are the same" errors
                    if (this.renderTarget._samples < 2) {
                        if (this.renderTarget.colorBuffer && this.renderTarget.colorBuffer === texture) {
                            console.error("Trying to bind current color buffer as a texture");
                        } else if (this.renderTarget.depthBuffer && this.renderTarget.depthBuffer === texture) {
                            console.error("Trying to bind current depth buffer as a texture");
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
                for (j = 0; j < numTextures; j++) {
                    texture = samplerValue[j];
                    this.setTexture(texture, textureUnit);

                    sampler.array[j] = textureUnit;
                    textureUnit++;
                }
                gl.uniform1iv(sampler.locationId, sampler.array);
            }
        }

        // Commit any updated uniforms
        for (i = 0, len = uniforms.length; i < len; i++) {
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
                }
            }
        }

        if (this.webgl2 && this.transformFeedbackBuffer) {
            // Enable TF, start writing to out buffer
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.transformFeedbackBuffer.bufferId);
            gl.beginTransformFeedback(gl.POINTS);
        }

        var mode = this.glPrimitive[primitive.type];
        var count = primitive.count;

        if (primitive.indexed) {
            var indexBuffer = this.indexBuffer;
            var format = indexBuffer.glFormat;
            var offset = primitive.base * indexBuffer.bytesPerIndex;

            if (numInstances > 0) {
                gl.drawElementsInstanced(mode, count, format, offset, numInstances);
            } else {
                gl.drawElements(mode, count, format, offset);
            }
        } else {
            var first = primitive.base;

            if (numInstances > 0) {
                gl.drawArraysInstanced(mode, first, count, numInstances);
            } else {
                gl.drawArrays(mode, first, count);
            }
        }

        if (this.webgl2 && this.transformFeedbackBuffer) {
            // disable TF
            gl.endTransformFeedback();
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        }

        // #ifdef PROFILER
        this._drawCallsPerFrame++;
        this._primsPerFrame[primitive.type] += primitive.count * (numInstances > 1 ? numInstances : 1);
        // #endif
    },

    /**
     * @function
     * @name pc.GraphicsDevice#clear
     * @description Clears the frame buffer of the currently set render target.
     * @param {object} options - Optional options object that controls the behavior of the clear operation defined as follows:
     * @param {number[]} options.color - The color to clear the color buffer to in the range 0.0 to 1.0 for each component.
     * @param {number} options.depth - The depth value to clear the depth buffer to in the range 0.0 to 1.0.
     * @param {number} options.flags - The buffers to clear (the types being color, depth and stencil). Can be any bitwise
     * combination of:
     * * pc.CLEARFLAG_COLOR
     * * pc.CLEARFLAG_DEPTH
     * * pc.CLEARFLAG_STENCIL
     * @example
     * // Clear color buffer to black and depth buffer to 1.0
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
     *     depth: 1.0,
     *     flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH
     * });
     */
    clear: function (options) {
        var defaultOptions = this.defaultClearOptions;
        options = options || defaultOptions;

        var flags = (options.flags == undefined) ? defaultOptions.flags : options.flags;
        if (flags !== 0) {
            var gl = this.gl;

            // Set the clear color
            if (flags & CLEARFLAG_COLOR) {
                var color = (options.color == undefined) ? defaultOptions.color : options.color;
                this.setClearColor(color[0], color[1], color[2], color[3]);
            }

            if (flags & CLEARFLAG_DEPTH) {
                // Set the clear depth
                var depth = (options.depth == undefined) ? defaultOptions.depth : options.depth;
                this.setClearDepth(depth);
                if (!this.depthWrite) {
                    gl.depthMask(true);
                }
            }

            if (flags & CLEARFLAG_STENCIL) {
                // Set the clear stencil
                var stencil = (options.stencil == undefined) ? defaultOptions.stencil : options.stencil;
                this.setClearStencil(stencil);
            }

            // Clear the frame buffer
            gl.clear(this.glClearFlag[flags]);

            if (flags & CLEARFLAG_DEPTH) {
                if (!this.depthWrite) {
                    gl.depthMask(false);
                }
            }
        }
    },

    readPixels: function (x, y, w, h, pixels) {
        var gl = this.gl;
        gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    },

    setClearDepth: function (depth) {
        if (depth !== this.clearDepth) {
            this.gl.clearDepth(depth);
            this.clearDepth = depth;
        }
    },

    setClearColor: function (r, g, b, a) {
        if ((r !== this.clearRed) || (g !== this.clearGreen) || (b !== this.clearBlue) || (a !== this.clearAlpha)) {
            this.gl.clearColor(r, g, b, a);
            this.clearRed = r;
            this.clearGreen = g;
            this.clearBlue = b;
            this.clearAlpha = a;
        }
    },

    setClearStencil: function (value) {
        if (value !== this.clearStencil) {
            this.gl.clearStencil(value);
            this.clearStencil = value;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setRenderTarget
     * @description Sets the specified render target on the device. If null
     * is passed as a parameter, the back buffer becomes the current target
     * for all rendering operations.
     * @param {pc.RenderTarget} renderTarget - The render target to activate.
     * @example
     * // Set a render target to receive all rendering output
     * device.setRenderTarget(renderTarget);
     *
     * // Set the back buffer to receive all rendering output
     * device.setRenderTarget(null);
     */
    setRenderTarget: function (renderTarget) {
        this.renderTarget = renderTarget;
    },

    /**
     * @function
     * @name pc.GraphicsDevice#getRenderTarget
     * @description Queries the currently set render target on the device.
     * @returns {pc.RenderTarget} The current render target.
     * @example
     * // Get the current render target
     * var renderTarget = device.getRenderTarget();
     */
    getRenderTarget: function () {
        return this.renderTarget;
    },

    /**
     * @function
     * @name pc.GraphicsDevice#getDepthTest
     * @description Queries whether depth testing is enabled.
     * @returns {boolean} True if depth testing is enabled and false otherwise.
     * @example
     * var depthTest = device.getDepthTest();
     * console.log('Depth testing is ' + depthTest ? 'enabled' : 'disabled');
     */
    getDepthTest: function () {
        return this.depthTest;
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setDepthTest
     * @description Enables or disables depth testing of fragments. Once this state
     * is set, it persists until it is changed. By default, depth testing is enabled.
     * @param {boolean} depthTest - True to enable depth testing and false otherwise.
     * @example
     * device.setDepthTest(true);
     */
    setDepthTest: function (depthTest) {
        if (this.depthTest !== depthTest) {
            var gl = this.gl;
            if (depthTest) {
                gl.enable(gl.DEPTH_TEST);
            } else {
                gl.disable(gl.DEPTH_TEST);
            }
            this.depthTest = depthTest;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setDepthFunc
     * @description Configures the depth test.
     * @param {number} func - A function to compare a new depth value with an existing z-buffer value and decide if to write a pixel. Can be:
     * * {@link pc.FUNC_NEVER}: don't draw
     * * {@link pc.FUNC_LESS}: draw if new depth < depth buffer
     * * {@link pc.FUNC_EQUAL}: draw if new depth == depth buffer
     * * {@link pc.FUNC_LESSEQUAL}: draw if new depth <= depth buffer
     * * {@link pc.FUNC_GREATER}: draw if new depth > depth buffer
     * * {@link pc.FUNC_NOTEQUAL}: draw if new depth != depth buffer
     * * {@link pc.FUNC_GREATEREQUAL}: draw if new depth >= depth buffer
     * * {@link pc.FUNC_ALWAYS}: always draw
     */
    setDepthFunc: function (func) {
        if (this.depthFunc === func) return;
        this.gl.depthFunc(this.glComparison[func]);
        this.depthFunc = func;
    },

    /**
     * @function
     * @name pc.GraphicsDevice#getDepthWrite
     * @description Queries whether writes to the depth buffer are enabled.
     * @returns {boolean} True if depth writing is enabled and false otherwise.
     * @example
     * var depthWrite = device.getDepthWrite();
     * console.log('Depth writing is ' + depthWrite ? 'enabled' : 'disabled');
     */
    getDepthWrite: function () {
        return this.depthWrite;
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setDepthWrite
     * @description Enables or disables writes to the depth buffer. Once this state
     * is set, it persists until it is changed. By default, depth writes are enabled.
     * @param {boolean} writeDepth - True to enable depth writing and false otherwise.
     * @example
     * device.setDepthWrite(true);
     */
    setDepthWrite: function (writeDepth) {
        if (this.depthWrite !== writeDepth) {
            this.gl.depthMask(writeDepth);
            this.depthWrite = writeDepth;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setColorWrite
     * @description Enables or disables writes to the color buffer. Once this state
     * is set, it persists until it is changed. By default, color writes are enabled
     * for all color channels.
     * @param {boolean} writeRed - True to enable writing of the red channel and false otherwise.
     * @param {boolean} writeGreen - True to enable writing of the green channel and false otherwise.
     * @param {boolean} writeBlue - True to enable writing of the blue channel and false otherwise.
     * @param {boolean} writeAlpha - True to enable writing of the alpha channel and false otherwise.
     * @example
     * // Just write alpha into the frame buffer
     * device.setColorWrite(false, false, false, true);
     */
    setColorWrite: function (writeRed, writeGreen, writeBlue, writeAlpha) {
        if ((this.writeRed !== writeRed) ||
            (this.writeGreen !== writeGreen) ||
            (this.writeBlue !== writeBlue) ||
            (this.writeAlpha !== writeAlpha)) {
            this.gl.colorMask(writeRed, writeGreen, writeBlue, writeAlpha);
            this.writeRed = writeRed;
            this.writeGreen = writeGreen;
            this.writeBlue = writeBlue;
            this.writeAlpha = writeAlpha;
        }
    },

    /**
     * @private
     * @function
     * @name pc.GraphicsDevice#setAlphaToCoverage
     * @description Enables or disables alpha to coverage (WebGL2 only).
     * @param {boolean} state - True to enable alpha to coverage and false to disable it.
     */
    setAlphaToCoverage: function (state) {
        if (!this.webgl2) return;
        if (this.alphaToCoverage === state) return;
        this.alphaToCoverage = state;

        if (state) {
            this.gl.enable(this.gl.SAMPLE_ALPHA_TO_COVERAGE);
        } else {
            this.gl.disable(this.gl.SAMPLE_ALPHA_TO_COVERAGE);
        }
    },

    /**
     * @private
     * @function
     * @name pc.GraphicsDevice#setTransformFeedbackBuffer
     * @description Sets the output vertex buffer. It will be written to by a shader with transform feedback varyings.
     * @param {pc.VertexBuffer} tf - The output vertex buffer.
     */
    setTransformFeedbackBuffer: function (tf) {
        if (this.transformFeedbackBuffer === tf)
            return;

        this.transformFeedbackBuffer = tf;

        if (this.webgl2) {
            var gl = this.gl;
            if (tf) {
                if (!this.feedback) {
                    this.feedback = gl.createTransformFeedback();
                }
                gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
            } else {
                gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
            }
        }
    },

    /**
     * @private
     * @function
     * @name pc.GraphicsDevice#setRaster
     * @description Enables or disables rasterization. Useful with transform feedback, when you only need to process the data without drawing.
     * @param {boolean} on - True to enable rasterization and false to disable it.
     */
    setRaster: function (on) {
        if (this.raster === on) return;

        this.raster = on;

        if (this.webgl2) {
            if (on) {
                this.gl.disable(this.gl.RASTERIZER_DISCARD);
            } else {
                this.gl.enable(this.gl.RASTERIZER_DISCARD);
            }
        }
    },

    setDepthBias: function (on) {
        if (this.depthBiasEnabled === on) return;

        this.depthBiasEnabled = on;

        if (on) {
            this.gl.enable(this.gl.POLYGON_OFFSET_FILL);
        } else {
            this.gl.disable(this.gl.POLYGON_OFFSET_FILL);
        }
    },

    setDepthBiasValues: function (constBias, slopeBias) {
        this.gl.polygonOffset(slopeBias, constBias);
    },

    /**
     * @function
     * @name pc.GraphicsDevice#getBlending
     * @description Queries whether blending is enabled.
     * @returns {boolean} True if blending is enabled and false otherwise.
     */
    getBlending: function () {
        return this.blending;
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setBlending
     * @description Enables or disables blending.
     * @param {boolean} blending - True to enable blending and false to disable it.
     */
    setBlending: function (blending) {
        if (this.blending !== blending) {
            var gl = this.gl;
            if (blending) {
                gl.enable(gl.BLEND);
            } else {
                gl.disable(gl.BLEND);
            }
            this.blending = blending;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setStencilTest
     * @description Enables or disables stencil test.
     * @param {boolean} enable - True to enable stencil test and false to disable it.
     */
    setStencilTest: function (enable) {
        if (this.stencil !== enable) {
            var gl = this.gl;
            if (enable) {
                gl.enable(gl.STENCIL_TEST);
            } else {
                gl.disable(gl.STENCIL_TEST);
            }
            this.stencil = enable;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setStencilFunc
     * @description Configures stencil test for both front and back faces.
     * @param {number} func - A comparison function that decides if the pixel should be written, based on the current stencil buffer value,
     * reference value, and mask value. Can be:
     * * {@link pc.FUNC_NEVER}: never pass
     * * {@link pc.FUNC_LESS}: pass if (ref & mask) < (stencil & mask)
     * * {@link pc.FUNC_EQUAL}: pass if (ref & mask) == (stencil & mask)
     * * {@link pc.FUNC_LESSEQUAL}: pass if (ref & mask) <= (stencil & mask)
     * * {@link pc.FUNC_GREATER}: pass if (ref & mask) > (stencil & mask)
     * * {@link pc.FUNC_NOTEQUAL}: pass if (ref & mask) != (stencil & mask)
     * * {@link pc.FUNC_GREATEREQUAL}: pass if (ref & mask) >= (stencil & mask)
     * * {@link pc.FUNC_ALWAYS}: always pass
     * @param {number} ref - Reference value used in comparison.
     * @param {number} mask - Mask applied to stencil buffer value and reference value before comparison.
     */
    setStencilFunc: function (func, ref, mask) {
        if (this.stencilFuncFront !== func || this.stencilRefFront !== ref || this.stencilMaskFront !== mask ||
            this.stencilFuncBack !== func || this.stencilRefBack !== ref || this.stencilMaskBack !== mask) {
            var gl = this.gl;
            gl.stencilFunc(this.glComparison[func], ref, mask);
            this.stencilFuncFront = this.stencilFuncBack = func;
            this.stencilRefFront = this.stencilRefBack = ref;
            this.stencilMaskFront = this.stencilMaskBack = mask;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setStencilFuncFront
     * @description Configures stencil test for front faces.
     * @param {number} func - A comparison function that decides if the pixel should be written,
     * based on the current stencil buffer value, reference value, and mask value. Can be:
     * * {@link pc.FUNC_NEVER}: never pass
     * * {@link pc.FUNC_LESS}: pass if (ref & mask) < (stencil & mask)
     * * {@link pc.FUNC_EQUAL}: pass if (ref & mask) == (stencil & mask)
     * * {@link pc.FUNC_LESSEQUAL}: pass if (ref & mask) <= (stencil & mask)
     * * {@link pc.FUNC_GREATER}: pass if (ref & mask) > (stencil & mask)
     * * {@link pc.FUNC_NOTEQUAL}: pass if (ref & mask) != (stencil & mask)
     * * {@link pc.FUNC_GREATEREQUAL}: pass if (ref & mask) >= (stencil & mask)
     * * {@link pc.FUNC_ALWAYS}: always pass
     * @param {number} ref - Reference value used in comparison.
     * @param {number} mask - Mask applied to stencil buffer value and reference value before comparison.
     */
    setStencilFuncFront: function (func, ref, mask) {
        if (this.stencilFuncFront !== func || this.stencilRefFront !== ref || this.stencilMaskFront !== mask) {
            var gl = this.gl;
            gl.stencilFuncSeparate(gl.FRONT, this.glComparison[func], ref, mask);
            this.stencilFuncFront = func;
            this.stencilRefFront = ref;
            this.stencilMaskFront = mask;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setStencilFuncBack
     * @description Configures stencil test for back faces.
     * @param {number} func - A comparison function that decides if the pixel should be written,
     * based on the current stencil buffer value, reference value, and mask value. Can be:
     * * {@link pc.FUNC_NEVER}: never pass
     * * {@link pc.FUNC_LESS}: pass if (ref & mask) < (stencil & mask)
     * * {@link pc.FUNC_EQUAL}: pass if (ref & mask) == (stencil & mask)
     * * {@link pc.FUNC_LESSEQUAL}: pass if (ref & mask) <= (stencil & mask)
     * * {@link pc.FUNC_GREATER}: pass if (ref & mask) > (stencil & mask)
     * * {@link pc.FUNC_NOTEQUAL}: pass if (ref & mask) != (stencil & mask)
     * * {@link pc.FUNC_GREATEREQUAL}: pass if (ref & mask) >= (stencil & mask)
     * * {@link pc.FUNC_ALWAYS}: always pass
     * @param {number} ref - Reference value used in comparison.
     * @param {number} mask - Mask applied to stencil buffer value and reference value before comparison.
     */
    setStencilFuncBack: function (func, ref, mask) {
        if (this.stencilFuncBack !== func || this.stencilRefBack !== ref || this.stencilMaskBack !== mask) {
            var gl = this.gl;
            gl.stencilFuncSeparate(gl.BACK, this.glComparison[func], ref, mask);
            this.stencilFuncBack = func;
            this.stencilRefBack = ref;
            this.stencilMaskBack = mask;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setStencilOperation
     * @description Configures how stencil buffer values should be modified based on the result
     * of depth/stencil tests. Works for both front and back faces.
     * @param {number} fail - Action to take if stencil test is failed.
     * @param {number} zfail - Action to take if depth test is failed.
     * @param {number} zpass - Action to take if both depth and stencil test are passed
     * All arguments can be:
     * * {@link pc.STENCILOP_KEEP}: don't change the stencil buffer value
     * * {@link pc.STENCILOP_ZERO}: set value to zero
     * * {@link pc.STENCILOP_REPLACE}: replace value with the reference value (see {@link pc.GraphicsDevice#setStencilFunc})
     * * {@link pc.STENCILOP_INCREMENT}: increment the value
     * * {@link pc.STENCILOP_INCREMENTWRAP}: increment the value, but wrap it to zero when it's larger than a maximum representable value
     * * {@link pc.STENCILOP_DECREMENT}: decrement the value
     * * {@link pc.STENCILOP_DECREMENTWRAP}: decrement the value, but wrap it to a maximum representable value, if the current value is 0
     * * {@link pc.STENCILOP_INVERT}: invert the value bitwise
     * @param {number} writeMask - A bit mask applied to the reference value, when written.
     */
    setStencilOperation: function (fail, zfail, zpass, writeMask) {
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
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setStencilOperationFront
     * @description Configures how stencil buffer values should be modified based on the result
     * of depth/stencil tests. Works for front faces.
     * @param {number} fail - Action to take if stencil test is failed.
     * @param {number} zfail - Action to take if depth test is failed.
     * @param {number} zpass - Action to take if both depth and stencil test are passed
     * All arguments can be:
     * * {@link pc.STENCILOP_KEEP}: don't change the stencil buffer value
     * * {@link pc.STENCILOP_ZERO}: set value to zero
     * * {@link pc.STENCILOP_REPLACE}: replace value with the reference value (see {@link pc.GraphicsDevice#setStencilFunc})
     * * {@link pc.STENCILOP_INCREMENT}: increment the value
     * * {@link pc.STENCILOP_INCREMENTWRAP}: increment the value, but wrap it to zero when it's larger than a maximum representable value
     * * {@link pc.STENCILOP_DECREMENT}: decrement the value
     * * {@link pc.STENCILOP_DECREMENTWRAP}: decrement the value, but wrap it to a maximum representable value, if the current value is 0
     * * {@link pc.STENCILOP_INVERT}: invert the value bitwise
     * @param {number} writeMask - A bit mask applied to the reference value, when written.
     */
    setStencilOperationFront: function (fail, zfail, zpass, writeMask) {
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
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setStencilOperationBack
     * @description Configures how stencil buffer values should be modified based on the result
     * of depth/stencil tests. Works for back faces.
     * @param {number} fail - Action to take if stencil test is failed.
     * @param {number} zfail - Action to take if depth test is failed.
     * @param {number} zpass - Action to take if both depth and stencil test are passed
     * All arguments can be:
     * * {@link pc.STENCILOP_KEEP}: don't change the stencil buffer value
     * * {@link pc.STENCILOP_ZERO}: set value to zero
     * * {@link pc.STENCILOP_REPLACE}: replace value with the reference value (see {@link pc.GraphicsDevice#setStencilFunc})
     * * {@link pc.STENCILOP_INCREMENT}: increment the value
     * * {@link pc.STENCILOP_INCREMENTWRAP}: increment the value, but wrap it to zero when it's larger than a maximum representable value
     * * {@link pc.STENCILOP_DECREMENT}: decrement the value
     * * {@link pc.STENCILOP_DECREMENTWRAP}: decrement the value, but wrap it to a maximum representable value, if the current value is 0
     * * {@link pc.STENCILOP_INVERT}: invert the value bitwise
     * @param {number} writeMask - A bit mask applied to the reference value, when written.
     */
    setStencilOperationBack: function (fail, zfail, zpass, writeMask) {
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
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setBlendFunction
     * @description Configures blending operations. Both source and destination
     * blend modes can take the following values:
     * * {@link pc.BLENDMODE_ZERO}
     * * {@link pc.BLENDMODE_ONE}
     * * {@link pc.BLENDMODE_SRC_COLOR}
     * * {@link pc.BLENDMODE_ONE_MINUS_SRC_COLOR}
     * * {@link pc.BLENDMODE_DST_COLOR}
     * * {@link pc.BLENDMODE_ONE_MINUS_DST_COLOR}
     * * {@link pc.BLENDMODE_SRC_ALPHA}
     * * {@link pc.BLENDMODE_SRC_ALPHA_SATURATE}
     * * {@link pc.BLENDMODE_ONE_MINUS_SRC_ALPHA}
     * * {@link pc.BLENDMODE_DST_ALPHA}
     * * {@link pc.BLENDMODE_ONE_MINUS_DST_ALPHA}
     * @param {number} blendSrc - The source blend function.
     * @param {number} blendDst - The destination blend function.
     */
    setBlendFunction: function (blendSrc, blendDst) {
        if (this.blendSrc !== blendSrc || this.blendDst !== blendDst || this.separateAlphaBlend) {
            this.gl.blendFunc(this.glBlendFunction[blendSrc], this.glBlendFunction[blendDst]);
            this.blendSrc = blendSrc;
            this.blendDst = blendDst;
            this.separateAlphaBlend = false;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setBlendFunctionSeparate
     * @description Configures blending operations. Both source and destination
     * blend modes can take the following values:
     * * {@link pc.BLENDMODE_ZERO}
     * * {@link pc.BLENDMODE_ONE}
     * * {@link pc.BLENDMODE_SRC_COLOR}
     * * {@link pc.BLENDMODE_ONE_MINUS_SRC_COLOR}
     * * {@link pc.BLENDMODE_DST_COLOR}
     * * {@link pc.BLENDMODE_ONE_MINUS_DST_COLOR}
     * * {@link pc.BLENDMODE_SRC_ALPHA}
     * * {@link pc.BLENDMODE_SRC_ALPHA_SATURATE}
     * * {@link pc.BLENDMODE_ONE_MINUS_SRC_ALPHA}
     * * {@link pc.BLENDMODE_DST_ALPHA}
     * * {@link pc.BLENDMODE_ONE_MINUS_DST_ALPHA}
     * @param {number} blendSrc - The source blend function.
     * @param {number} blendDst - The destination blend function.
     * @param {number} blendSrcAlpha - The separate source blend function for the alpha channel.
     * @param {number} blendDstAlpha - The separate destination blend function for the alpha channel.
     */
    setBlendFunctionSeparate: function (blendSrc, blendDst, blendSrcAlpha, blendDstAlpha) {
        if (this.blendSrc !== blendSrc || this.blendDst !== blendDst || this.blendSrcAlpha !== blendSrcAlpha || this.blendDstAlpha !== blendDstAlpha || !this.separateAlphaBlend) {
            this.gl.blendFuncSeparate(this.glBlendFunction[blendSrc], this.glBlendFunction[blendDst],
                                      this.glBlendFunction[blendSrcAlpha], this.glBlendFunction[blendDstAlpha]);
            this.blendSrc = blendSrc;
            this.blendDst = blendDst;
            this.blendSrcAlpha = blendSrcAlpha;
            this.blendDstAlpha = blendDstAlpha;
            this.separateAlphaBlend = true;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setBlendEquation
     * @description Configures the blending equation. The default blend equation is
     * pc.BLENDEQUATION_ADD.
     * @param {number} blendEquation - The blend equation. Can be:
     * * {@link pc.BLENDEQUATION_ADD}
     * * {@link pc.BLENDEQUATION_SUBTRACT}
     * * {@link pc.BLENDEQUATION_REVERSE_SUBTRACT}
     * * {@link pc.BLENDEQUATION_MIN}
     * * {@link pc.BLENDEQUATION_MAX}
     *
     * Note that MIN and MAX modes require either EXT_blend_minmax or WebGL2 to work (check device.extBlendMinmax).
     */
    setBlendEquation: function (blendEquation) {
        if (this.blendEquation !== blendEquation || this.separateAlphaEquation) {
            this.gl.blendEquation(this.glBlendEquation[blendEquation]);
            this.blendEquation = blendEquation;
            this.separateAlphaEquation = false;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setBlendEquationSeparate
     * @description Configures the blending equation. The default blend equation is
     * pc.BLENDEQUATION_ADD.
     * @param {number} blendEquation - The blend equation. Can be:
     * * {@link pc.BLENDEQUATION_ADD}
     * * {@link pc.BLENDEQUATION_SUBTRACT}
     * * {@link pc.BLENDEQUATION_REVERSE_SUBTRACT}
     * * {@link pc.BLENDEQUATION_MIN}
     * * {@link pc.BLENDEQUATION_MAX}
     *
     * Note that MIN and MAX modes require either EXT_blend_minmax or WebGL2 to work (check device.extBlendMinmax).
     * @param {number} blendAlphaEquation - A separate blend equation for the alpha channel. Accepts same values as blendEquation.
     */
    setBlendEquationSeparate: function (blendEquation, blendAlphaEquation) {
        if (this.blendEquation !== blendEquation || this.blendAlphaEquation !== blendAlphaEquation || !this.separateAlphaEquation) {
            this.gl.blendEquationSeparate(this.glBlendEquation[blendEquation], this.glBlendEquation[blendAlphaEquation]);
            this.blendEquation = blendEquation;
            this.blendAlphaEquation = blendAlphaEquation;
            this.separateAlphaEquation = true;
        }
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setCullMode
     * @description Controls how triangles are culled based on their face direction.
     * The default cull mode is pc.CULLFACE_BACK.
     * @param {number} cullMode - The cull mode to set. Can be:
     * * {@link pc.CULLFACE_NONE}
     * * {@link pc.CULLFACE_BACK}
     * * {@link pc.CULLFACE_FRONT}
     * * {@link pc.CULLFACE_FRONTANDBACK}
     */
    setCullMode: function (cullMode) {
        if (this.cullMode !== cullMode) {
            if (cullMode === CULLFACE_NONE) {
                this.gl.disable(this.gl.CULL_FACE);
            } else {
                if (this.cullMode === CULLFACE_NONE) {
                    this.gl.enable(this.gl.CULL_FACE);
                }

                var mode = this.glCull[cullMode];
                if (this.cullFace !== mode) {
                    this.gl.cullFace(mode);
                    this.cullFace = mode;
                }
            }
            this.cullMode = cullMode;
        }
    },

    getCullMode: function () {
        return this.cullMode;
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setIndexBuffer
     * @description Sets the current index buffer on the graphics device. On subsequent
     * calls to pc.GraphicsDevice#draw, the specified index buffer will be used to provide
     * index data for any indexed primitives.
     * @param {pc.IndexBuffer} indexBuffer - The index buffer to assign to the device.
     */
    setIndexBuffer: function (indexBuffer) {
        // Store the index buffer
        this.indexBuffer = indexBuffer;
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setVertexBuffer
     * @description Sets the current vertex buffer on the graphics device. On subsequent calls to
     * {@link pc.GraphicsDevice#draw}, the specified vertex buffer(s) will be used to provide vertex data for any primitives.
     * @param {pc.VertexBuffer} vertexBuffer - The vertex buffer to assign to the device.
     */
    setVertexBuffer: function (vertexBuffer) {

        if (vertexBuffer) {
            this.vertexBuffers.push(vertexBuffer);
        }
    },

    compileShaderSource: function (src, isVertexShader) {
        var gl = this.gl;

        var glShader = isVertexShader ? this.vertexShaderCache[src] : this.fragmentShaderCache[src];

        if (!glShader) {
            // #ifdef PROFILER
            var startTime = now();
            this.fire('shader:compile:start', {
                timestamp: startTime,
                target: this
            });
            // #endif

            glShader = gl.createShader(isVertexShader ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);

            gl.shaderSource(glShader, src);
            gl.compileShader(glShader);

            // #ifdef PROFILER
            var endTime = now();
            this.fire('shader:compile:end', {
                timestamp: endTime,
                target: this
            });
            this._shaderStats.compileTime += endTime - startTime;
            // #endif

            if (isVertexShader) {
                this.vertexShaderCache[src] = glShader;
                // #ifdef PROFILER
                this._shaderStats.vsCompiled++;
                // #endif
            } else {
                this.fragmentShaderCache[src] = glShader;
                // #ifdef PROFILER
                this._shaderStats.fsCompiled++;
                // #endif
            }
        }

        return glShader;
    },

    compileAndLinkShader: function (shader) {
        var gl = this.gl;

        var definition = shader.definition;
        var attr, attrs = definition.attributes;
        var glVertexShader = this.compileShaderSource(definition.vshader, true);
        var glFragmentShader = this.compileShaderSource(definition.fshader, false);

        var glProgram = gl.createProgram();

        gl.attachShader(glProgram, glVertexShader);
        gl.attachShader(glProgram, glFragmentShader);

        if (this.webgl2 && definition.useTransformFeedback) {
            // Collect all "out_" attributes and use them for output
            var outNames = [];
            for (attr in attrs) {
                if (attrs.hasOwnProperty(attr)) {
                    outNames.push("out_" + attr);
                }
            }
            gl.transformFeedbackVaryings(glProgram, outNames, gl.INTERLEAVED_ATTRIBS);
        }

        // map all vertex input attributes to fixed locations
        var locations = {};
        for (attr in attrs) {
            if (attrs.hasOwnProperty(attr)) {
                var semantic = attrs[attr];
                var loc = semanticToLocation[semantic];

                if (locations.hasOwnProperty(loc)) {
                    // #ifdef DEBUG
                    console.warn("WARNING: Two attribues are mapped to the same location in a shader: " + locations[loc] + " and " + attr);
                    // #endif
                }

                locations[loc] = attr;
                gl.bindAttribLocation(glProgram, loc, attr);
            }
        }

        gl.linkProgram(glProgram);

        // Cache the WebGL objects on the shader
        shader._glVertexShader = glVertexShader;
        shader._glFragmentShader = glFragmentShader;
        shader._glProgram = glProgram;

        // #ifdef PROFILER
        this._shaderStats.linked++;
        if (definition.tag === SHADERTAG_MATERIAL) {
            this._shaderStats.materialShaders++;
        }
        // #endif
    },

    createShader: function (shader) {
        this.compileAndLinkShader(shader);

        this.shaders.push(shader);
    },

    destroyShader: function (shader) {
        var idx = this.shaders.indexOf(shader);
        if (idx !== -1) {
            this.shaders.splice(idx, 1);
        }

        if (shader._glProgram) {
            this.gl.deleteProgram(shader._glProgram);
            shader._glProgram = null;
            this.removeShaderFromCache(shader);
        }
    },

    _addLineNumbers: function (src) {
        var lines = src.split("\n");

        // Chrome reports shader errors on lines indexed from 1
        for (var i = 0, len = lines.length; i < len; i++) {
            lines[i] = (i + 1) + ":\t" + lines[i];
        }

        return lines.join( "\n" );
    },

    postLink: function (shader) {
        var gl = this.gl;

        var glVertexShader = shader._glVertexShader;
        var glFragmentShader = shader._glFragmentShader;
        var glProgram = shader._glProgram;

        var definition = shader.definition;

        // #ifdef PROFILER
        var startTime = now();
        this.fire('shader:link:start', {
            timestamp: startTime,
            target: this
        });
        // #endif

        // Check for errors
        if (!gl.getShaderParameter(glVertexShader, gl.COMPILE_STATUS)) {
            console.error("Failed to compile vertex shader:\n\n" + this._addLineNumbers(definition.vshader) + "\n\n" + gl.getShaderInfoLog(glVertexShader));
            return false;
        }
        if (!gl.getShaderParameter(glFragmentShader, gl.COMPILE_STATUS)) {
            console.error("Failed to compile fragment shader:\n\n" + this._addLineNumbers(definition.fshader) + "\n\n" + gl.getShaderInfoLog(glFragmentShader));
            return false;
        }
        if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
            console.error("Failed to link shader program. Error: " + gl.getProgramInfoLog(glProgram));
            return false;
        }

        var i, info, location, shaderInput;

        // Query the program for each vertex buffer input (GLSL 'attribute')
        i = 0;
        var numAttributes = gl.getProgramParameter(glProgram, gl.ACTIVE_ATTRIBUTES);
        while (i < numAttributes) {
            info = gl.getActiveAttrib(glProgram, i++);
            location = gl.getAttribLocation(glProgram, info.name);

            // Check attributes are correctly linked up
            if (definition.attributes[info.name] === undefined) {
                console.error('Vertex shader attribute "' + info.name + '" is not mapped to a semantic in shader definition.');
            }

            shaderInput = new ShaderInput(this, definition.attributes[info.name], this.pcUniformType[info.type], location);

            shader.attributes.push(shaderInput);
        }

        // Query the program for each shader state (GLSL 'uniform')
        i = 0;
        var numUniforms = gl.getProgramParameter(glProgram, gl.ACTIVE_UNIFORMS);
        while (i < numUniforms) {
            info = gl.getActiveUniform(glProgram, i++);
            location = gl.getUniformLocation(glProgram, info.name);

            shaderInput = new ShaderInput(this, info.name, this.pcUniformType[info.type], location);

            if (info.type === gl.SAMPLER_2D || info.type === gl.SAMPLER_CUBE ||
                (this.webgl2 && (info.type === gl.SAMPLER_2D_SHADOW || info.type === gl.SAMPLER_CUBE_SHADOW || info.type === gl.SAMPLER_3D))
            ) {
                shader.samplers.push(shaderInput);
            } else {
                shader.uniforms.push(shaderInput);
            }
        }

        shader.ready = true;

        // #ifdef PROFILER
        var endTime = now();
        this.fire('shader:link:end', {
            timestamp: endTime,
            target: this
        });
        this._shaderStats.compileTime += endTime - startTime;
        // #endif

        return true;
    },

    /**
     * @function
     * @name pc.GraphicsDevice#setShader
     * @description Sets the active shader to be used during subsequent draw calls.
     * @param {pc.Shader} shader - The shader to set to assign to the device.
     * @returns {boolean} True if the shader was successfully set, false otherwise.
     */
    setShader: function (shader) {
        if (shader !== this.shader) {
            if (!shader.ready) {
                if (!this.postLink(shader)) {
                    return false;
                }
            }

            this.shader = shader;

            // Set the active shader
            this.gl.useProgram(shader._glProgram);

            // #ifdef PROFILER
            this._shaderSwitchesPerFrame++;
            // #endif

            this.attributesInvalidated = true;
        }
        return true;
    },

    getHdrFormat: function () {
        if (this.textureHalfFloatRenderable) {
            return PIXELFORMAT_RGB16F;
        } else if (this.textureFloatRenderable) {
            return PIXELFORMAT_RGB32F;
        }
        return PIXELFORMAT_R8_G8_B8_A8;
    },

    /**
     * @private
     * @function
     * @name pc.GraphicsDevice#getBoneLimit
     * @description Queries the maximum number of bones that can be referenced by a shader.
     * The shader generators (pc.programlib) use this number to specify the matrix array
     * size of the uniform 'matrix_pose[0]'. The value is calculated based on the number of
     * available uniform vectors available after subtracting the number taken by a typical
     * heavyweight shader. If a different number is required, it can be tuned via
     * pc.GraphicsDevice#setBoneLimit.
     * @returns {number} The maximum number of bones that can be supported by the host hardware.
     */
    getBoneLimit: function () {
        return this.boneLimit;
    },

    /**
     * @private
     * @function
     * @name pc.GraphicsDevice#setBoneLimit
     * @description Specifies the maximum number of bones that the device can support on
     * the current hardware. This function allows the default calculated value based on
     * available vector uniforms to be overridden.
     * @param {number} maxBones - The maximum number of bones supported by the host hardware.
     */
    setBoneLimit: function (maxBones) {
        this.boneLimit = maxBones;
    },

    /**
     * @function
     * @name pc.GraphicsDevice#resizeCanvas
     * @description Sets the width and height of the canvas, then fires the 'resizecanvas' event.
     * Note that the specified width and height values will be multiplied by the value of
     * {@link pc.GraphicsDevice#maxPixelRatio} to give the final resultant width and height for
     * the canvas.
     * @param {number} width - The new width of the canvas.
     * @param {number} height - The new height of the canvas.
     */
    resizeCanvas: function (width, height) {
        this._width = width;
        this._height = height;

        var ratio = Math.min(this._maxPixelRatio, window.devicePixelRatio);
        width *= ratio;
        height *= ratio;

        if (this.canvas.width === width && this.canvas.height === height)
            return;

        this.canvas.width = width;
        this.canvas.height = height;
        this.fire(EVENT_RESIZE, width, height);
    },

    setResolution: function (width, height) {
        this._width = width;
        this._height = height;
        this.canvas.width = width;
        this.canvas.height = height;
        this.fire(EVENT_RESIZE, width, height);
    },

    /**
     * @function
     * @name pc.GraphicsDevice#clearShaderCache
     * @description Frees memory from all shaders ever allocated with this device.
     */
    clearShaderCache: function () {
        var gl = this.gl;
        var shaderSrc;
        for (shaderSrc in this.fragmentShaderCache) {
            gl.deleteShader(this.fragmentShaderCache[shaderSrc]);
            delete this.fragmentShaderCache[shaderSrc];
        }
        for (shaderSrc in this.vertexShaderCache) {
            gl.deleteShader(this.vertexShaderCache[shaderSrc]);
            delete this.vertexShaderCache[shaderSrc];
        }

        this.programLib.clearCache();
    },

    /**
     * @function
     * @name pc.GraphicsDevice#clearVertexArrayObjectCache
     * @description Frees memory from all vertex array objects ever allocated with this device.
     */
    clearVertexArrayObjectCache: function () {

        var gl = this.gl;
        this._vaoMap.forEach(function (item, key, mapObj) {
            gl.deleteVertexArray(item);
        });

        this._vaoMap.clear();
    },

    removeShaderFromCache: function (shader) {
        this.programLib.removeFromCache(shader);
    },

    destroy: function () {
        var gl = this.gl;

        this.destroyGrabPass();

        if (this.webgl2 && this.feedback) {
            gl.deleteTransformFeedback(this.feedback);
        }

        this.clearShaderCache();
        this.clearVertexArrayObjectCache();

        this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler, false);
        this.canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler, false);

        this._contextLostHandler = null;
        this._contextRestoredHandler = null;

        this.canvas = null;
        this.gl = null;
    }
});

/**
 * @readonly
 * @name pc.GraphicsDevice#width
 * @type {number}
 * @description Width of the back buffer in pixels.
 */
Object.defineProperty(GraphicsDevice.prototype, 'width', {
    get: function () {
        return this.gl.drawingBufferWidth || this.canvas.width;
    }
});

/**
 * @readonly
 * @name pc.GraphicsDevice#height
 * @type {number}
 * @description Height of the back buffer in pixels.
 */
Object.defineProperty(GraphicsDevice.prototype, 'height', {
    get: function () {
        return this.gl.drawingBufferHeight || this.canvas.height;
    }
});

/**
 * @name pc.GraphicsDevice#fullscreen
 * @type {boolean}
 * @description Fullscreen mode.
 */
Object.defineProperty(GraphicsDevice.prototype, 'fullscreen', {
    get: function () {
        return !!document.fullscreenElement;
    },
    set: function (fullscreen) {
        if (fullscreen) {
            var canvas = this.gl.canvas;
            canvas.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
});

/**
 * @private
 * @name pc.GraphicsDevice#enableAutoInstancing
 * @type {boolean}
 * @description Automatic instancing.
 */
Object.defineProperty(GraphicsDevice.prototype, 'enableAutoInstancing', {
    get: function () {
        return this._enableAutoInstancing;
    },
    set: function (value) {
        this._enableAutoInstancing = value && this.extInstancing;
    }
});

/**
 * @name pc.GraphicsDevice#maxPixelRatio
 * @type {number}
 * @description Maximum pixel ratio.
 */
Object.defineProperty(GraphicsDevice.prototype, 'maxPixelRatio', {
    get: function () {
        return this._maxPixelRatio;
    },
    set: function (ratio) {
        this._maxPixelRatio = ratio;
        this.resizeCanvas(this._width, this._height);
    }
});

/**
 * @readonly
 * @name pc.GraphicsDevice#textureFloatHighPrecision
 * @type {number}
 * @description Check if high precision floating-point textures are supported.
 */
Object.defineProperty(GraphicsDevice.prototype, 'textureFloatHighPrecision', {
    get: function () {
        if (this._textureFloatHighPrecision === undefined) {
            this._textureFloatHighPrecision = testTextureFloatHighPrecision(this);
        }
        return this._textureFloatHighPrecision;
    }
});

/**
 * @readonly
 * @name pc.GraphicsDevice#textureHalfFloatUpdatable
 * @type {number}
 * @description Check if texture with half float format can be updated with data.
 */
Object.defineProperties(GraphicsDevice.prototype, {
    textureHalfFloatUpdatable: {
        get: function () {
            if (this._textureHalfFloatUpdatable === undefined) {
                if (this.webgl2) {
                    this._textureHalfFloatUpdatable = true;
                } else {
                    this._textureHalfFloatUpdatable = testTextureHalfFloatUpdatable(this.gl, this.extTextureHalfFloat.HALF_FLOAT_OES);
                }
            }
            return this._textureHalfFloatUpdatable;
        }
    }
});

export { GraphicsDevice };
