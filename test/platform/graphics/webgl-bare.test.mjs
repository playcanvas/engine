import { expect } from 'chai';

import { DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL2_BARE } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { WebglGraphicsDevice } from '../../../src/platform/graphics/webgl/webgl-graphics-device.js';

// every extension the device queries, as reported by a fully featured desktop GPU
const allExtensions = [
    'EXT_color_buffer_float',
    'EXT_color_buffer_half_float',
    'EXT_disjoint_timer_query_webgl2',
    'EXT_float_blend',
    'EXT_texture_compression_bptc',
    'EXT_texture_filter_anisotropic',
    'KHR_parallel_shader_compile',
    'OES_draw_buffers_indexed',
    'OES_texture_float_linear',
    'WEBGL_blend_func_extended',
    'WEBGL_compressed_texture_astc',
    'WEBGL_compressed_texture_etc',
    'WEBGL_compressed_texture_etc1',
    'WEBGL_compressed_texture_pvrtc',
    'WEBGL_compressed_texture_s3tc',
    'WEBGL_compressed_texture_s3tc_srgb',
    'WEBGL_debug_renderer_info',
    'WEBGL_multi_draw',
    'WEBGL_provoking_vertex'
];

/**
 * A minimal WebGL2 context exposing every queried extension, and reporting the supplied
 * capabilities. Each parameter is given its own token, so that reads cannot alias.
 *
 * @param {Record<string, number>} params - The capabilities to report, keyed by parameter name.
 * @returns {object} The context.
 */
const createGl = (params) => {
    const values = new Map();
    let nextToken = 0x8000;

    // each read gets its own token, so that reads cannot alias
    const token = (value) => {
        const id = nextToken++;
        values.set(id, value);
        return id;
    };

    // the anisotropy limit and the renderer strings are read through extension tokens
    const anisotropyToken = token(params.maxAnisotropy ?? 16);
    const rendererToken = token('Test Renderer');
    const vendorToken = token('Test Vendor');

    const gl = {
        getSupportedExtensions: () => allExtensions.slice(),
        getParameter: id => values.get(id),
        getExtension: (name) => {
            if (name === 'EXT_texture_filter_anisotropic') {
                return { MAX_TEXTURE_MAX_ANISOTROPY_EXT: anisotropyToken };
            }
            if (name === 'WEBGL_debug_renderer_info') {
                return { UNMASKED_RENDERER_WEBGL: rendererToken, UNMASKED_VENDOR_WEBGL: vendorToken };
            }
            // the device only ever asks for extensions it has already found in
            // supportedExtensions, so any other name resolves to a token object
            return { name };
        },
        // HTML-in-Canvas, which is not an extension
        texElementImage2D: () => {}
    };

    for (const name in params) {
        gl[name] = token(params[name]);
    }

    return gl;
};

const fullCapabilities = {
    MAX_TEXTURE_SIZE: 16384,
    MAX_CUBE_MAP_TEXTURE_SIZE: 16384,
    MAX_RENDERBUFFER_SIZE: 16384,
    MAX_TEXTURE_IMAGE_UNITS: 32,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 64,
    MAX_VERTEX_TEXTURE_IMAGE_UNITS: 32,
    MAX_VERTEX_UNIFORM_VECTORS: 1024,
    MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
    MAX_COLOR_ATTACHMENTS: 8,
    MAX_3D_TEXTURE_SIZE: 8192,
    MAX_SAMPLES: 4
};

/**
 * Runs the WebGL extension and capability initialization against a mock context, without
 * requiring a browser.
 *
 * @param {string} deviceType - The requested device type.
 * @param {Record<string, number>} [params] - The capabilities the context reports.
 * @returns {object} The device.
 */
const initDevice = (deviceType, params = fullCapabilities) => {
    const device = new NullGraphicsDevice({ width: 4, height: 4 });
    const proto = WebglGraphicsDevice.prototype;

    device.initOptions.deviceType = deviceType;
    device.gl = createGl(params);
    device.getPrecision = () => 'highp';
    device.getExtension = proto.getExtension;
    Object.defineProperty(device, 'bare', Object.getOwnPropertyDescriptor(proto, 'bare'));
    Object.defineProperty(device, 'extDisjointTimerQuery',
        Object.getOwnPropertyDescriptor(proto, 'extDisjointTimerQuery'));

    proto.initializeExtensions.call(device);
    proto.initializeCapabilities.call(device);

    return device;
};

describe('WebglGraphicsDevice bare device type', function () {

    let devices;

    beforeEach(function () {
        devices = [];
    });

    afterEach(function () {
        devices.forEach(device => device.destroy());
    });

    /**
     * @param {string} deviceType - The requested device type.
     * @param {Record<string, number>} [params] - The capabilities the context reports.
     * @returns {object} The device, destroyed after the test.
     */
    const device = (deviceType, params) => {
        const created = initDevice(deviceType, params);
        devices.push(created);
        return created;
    };

    it('exposes every extension of the context by default', function () {
        const dev = device(DEVICETYPE_WEBGL2);
        expect(dev.supportedExtensions).to.deep.equal(allExtensions);
        expect(dev.bare).to.be.false;
    });

    it('hides all but the extensions available on almost all devices', function () {
        const dev = device(DEVICETYPE_WEBGL2_BARE);
        expect(dev.bare).to.be.true;
        expect(dev.supportedExtensions).to.deep.equal([
            'EXT_color_buffer_float',
            'EXT_texture_filter_anisotropic',
            'WEBGL_debug_renderer_info'
        ]);
    });

    it('reports the features of the hidden extensions as unsupported', function () {
        const full = device(DEVICETYPE_WEBGL2);
        expect(full.supportsMultiDraw).to.be.true;
        expect(full.supportsDualSourceBlending).to.be.true;
        expect(full.supportsIndependentBlending).to.be.true;
        expect(full.textureFloatFilterable).to.be.true;
        expect(full.textureFloatBlendable).to.be.true;
        expect(full.supportsHtmlTextures).to.be.true;

        const bare = device(DEVICETYPE_WEBGL2_BARE);
        expect(bare.supportsMultiDraw).to.be.false;
        expect(bare.supportsDualSourceBlending).to.be.false;
        expect(bare.supportsIndependentBlending).to.be.false;
        expect(bare.textureFloatFilterable).to.be.false;
        expect(bare.textureFloatBlendable).to.be.false;
        expect(bare.supportsHtmlTextures).to.be.false;
        expect(bare.extMultiDraw).to.be.null;
        expect(bare.extParallelShaderCompile).to.be.null;
        expect(bare.extProvokingVertex).to.be.null;
        expect(bare.extDisjointTimerQuery).to.be.null;
    });

    it('supports no compressed texture format', function () {
        const bare = device(DEVICETYPE_WEBGL2_BARE);
        expect(bare.extCompressedTextureS3TC).to.be.null;
        expect(bare.extCompressedTextureS3TC_SRGB).to.be.null;
        expect(bare.extCompressedTextureASTC).to.be.null;
        expect(bare.extCompressedTextureETC).to.be.null;
        expect(bare.extCompressedTextureETC1).to.be.null;
        expect(bare.extCompressedTexturePVRTC).to.be.null;
        expect(bare.extTextureCompressionBPTC).to.be.null;
    });

    it('keeps float and half float render targets renderable', function () {
        // EXT_color_buffer_float is kept, and covers half float as well
        const bare = device(DEVICETYPE_WEBGL2_BARE);
        expect(bare.extColorBufferFloat).to.not.be.null;
        expect(bare.extColorBufferHalfFloat).to.be.null;
        expect(bare.textureFloatRenderable).to.be.true;
        expect(bare.textureHalfFloatRenderable).to.be.true;
    });

    it('clamps the capabilities to the values almost all devices report', function () {
        const bare = device(DEVICETYPE_WEBGL2_BARE);
        expect(bare.maxTextureSize).to.equal(4096);
        expect(bare.maxCubeMapSize).to.equal(4096);
        expect(bare.maxRenderBufferSize).to.equal(8192);
        expect(bare.maxTextures).to.equal(16);
        expect(bare.maxCombinedTextures).to.equal(32);
        expect(bare.maxVertexTextures).to.equal(16);
        expect(bare.vertexUniformsCount).to.equal(256);
        expect(bare.fragmentUniformsCount).to.equal(256);
        expect(bare.maxColorAttachments).to.equal(4);
        expect(bare.maxVolumeSize).to.equal(2048);
        expect(bare.maxAnisotropy).to.equal(16);
        expect(bare.maxSamples).to.equal(4);
    });

    it('leaves the capabilities of the context alone by default', function () {
        const full = device(DEVICETYPE_WEBGL2);
        expect(full.maxTextureSize).to.equal(16384);
        expect(full.maxColorAttachments).to.equal(8);
        expect(full.fragmentUniformsCount).to.equal(1024);
        expect(full.maxVolumeSize).to.equal(8192);
    });

    it('does not raise a capability the context reports as smaller', function () {
        const bare = device(DEVICETYPE_WEBGL2_BARE, {
            ...fullCapabilities,
            MAX_TEXTURE_SIZE: 2048,
            MAX_COLOR_ATTACHMENTS: 4,
            MAX_FRAGMENT_UNIFORM_VECTORS: 224,
            maxAnisotropy: 2
        });
        expect(bare.maxTextureSize).to.equal(2048);
        expect(bare.maxColorAttachments).to.equal(4);
        expect(bare.fragmentUniformsCount).to.equal(224);
        expect(bare.maxAnisotropy).to.equal(2);
    });
});
