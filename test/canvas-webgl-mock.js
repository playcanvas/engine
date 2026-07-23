import { createSandbox } from 'sinon';

export function createMockWebGL2Context(options = {}) {
    const sandbox = options.sandbox || createSandbox();

    const gl = {};
    const spies = {};
    const stubs = {};

    /*
    const defineSpy = (name) => {
        const fn = options[name] || sandbox.spy();
        gl[name] = fn;
        spies[name] = fn;
        return fn;
    };
    */

    const defineStub = (name, defaultValue) => {
        const fn = options[name] || sandbox.stub().returns(defaultValue);
        gl[name] = fn;
        stubs[name] = fn;
        return fn;
    };

    const defineNoReturnSpy = (name) => {
        const fn = options[name] || sandbox.spy();
        gl[name] = fn;
        spies[name] = fn;
        return fn;
    };

    defineNoReturnSpy('hint');
    defineNoReturnSpy('enable');
    defineNoReturnSpy('disable');
    defineNoReturnSpy('cullFace');
    defineNoReturnSpy('depthMask');
    defineNoReturnSpy('depthFunc');
    defineNoReturnSpy('blendFunc');
    defineNoReturnSpy('blendEquation');
    defineNoReturnSpy('clearColor');
    defineNoReturnSpy('clearDepth');
    defineNoReturnSpy('clearStencil');
    defineNoReturnSpy('colorMask');
    defineNoReturnSpy('blendColor');
    defineNoReturnSpy('stencilFunc');
    defineNoReturnSpy('stencilOp');
    defineNoReturnSpy('stencilMask');
    defineNoReturnSpy('activeTexture');
    defineNoReturnSpy('pixelStorei');
    defineNoReturnSpy('bufferData');
    defineNoReturnSpy('bindBuffer');
    defineNoReturnSpy('bindBufferBase');
    defineNoReturnSpy('bindVertexArray');
    defineNoReturnSpy('bindTransformFeedback');
    defineNoReturnSpy('bindFramebuffer');
    defineNoReturnSpy('beginTransformFeedback');
    defineNoReturnSpy('endTransformFeedback');
    defineNoReturnSpy('deleteTransformFeedback');

    defineStub('getContextAttributes', null);
    defineStub('getSupportedExtensions', []);
    defineStub('getParameter', undefined);
    defineStub('createBuffer', { __mockType: 'WebGLBuffer' });
    defineStub('createTransformFeedback', { __mockType: 'WebGLTransformFeedback' });

    gl.deleteBuffer = options.deleteBuffer || sandbox.spy();
    gl.createVertexArray = options.createVertexArray || sandbox.stub().returns({ __mockType: 'WebGLVertexArrayObject' });
    gl.deleteVertexArray = options.deleteVertexArray || sandbox.spy();
    gl.createFramebuffer = options.createFramebuffer || sandbox.stub().returns({ __mockType: 'WebGLFramebuffer' });
    gl.deleteFramebuffer = options.deleteFramebuffer || sandbox.spy();
    gl.createProgram = options.createProgram || sandbox.stub().returns({ __mockType: 'WebGLProgram' });
    gl.deleteProgram = options.deleteProgram || sandbox.spy();
    gl.createShader = options.createShader || sandbox.stub().returns({ __mockType: 'WebGLShader' });
    gl.shaderSource = options.shaderSource || sandbox.spy();
    gl.compileShader = options.compileShader || sandbox.spy();
    gl.getShaderParameter = options.getShaderParameter || sandbox.stub().returns(true);
    gl.getShaderInfoLog = options.getShaderInfoLog || sandbox.stub().returns('');
    gl.attachShader = options.attachShader || sandbox.spy();
    gl.linkProgram = options.linkProgram || sandbox.spy();
    gl.getProgramParameter = options.getProgramParameter || sandbox.stub().returns(true);
    gl.getProgramInfoLog = options.getProgramInfoLog || sandbox.stub().returns('');
    gl.useProgram = options.useProgram || sandbox.spy();
    gl.uniform1i = options.uniform1i || sandbox.spy();
    gl.uniform1f = options.uniform1f || sandbox.spy();
    gl.uniform2f = options.uniform2f || sandbox.spy();
    gl.uniform3f = options.uniform3f || sandbox.spy();
    gl.uniform4f = options.uniform4f || sandbox.spy();
    gl.uniformMatrix4fv = options.uniformMatrix4fv || sandbox.spy();
    gl.viewport = options.viewport || sandbox.spy();
    gl.scissor = options.scissor || sandbox.spy();
    gl.clear = options.clear || sandbox.spy();
    gl.drawArrays = options.drawArrays || sandbox.spy();
    gl.drawElements = options.drawElements || sandbox.spy();
    gl.drawBuffers = options.drawBuffers || sandbox.spy();
    gl.flush = options.flush || sandbox.spy();
    gl.finish = options.finish || sandbox.spy();
    gl.readPixels = options.readPixels || sandbox.spy();
    gl.getError = options.getError || sandbox.stub().returns(0);

    const constants = {
        ARRAY_BUFFER: 0x8892,
        ELEMENT_ARRAY_BUFFER: 0x8893,
        STATIC_DRAW: 0x88E4,
        DYNAMIC_DRAW: 0x88E8,
        STREAM_DRAW: 0x88E0,
        TRIANGLES: 0x0004,
        LINES: 0x0001,
        POINTS: 0x0000,
        TEXTURE_2D: 0x0DE1,
        TEXTURE_3D: 0x806F,
        TEXTURE_2D_ARRAY: 0x8C1A,
        TEXTURE0: 0x84C0,
        FRAMEBUFFER: 0x8D40,
        RENDERBUFFER: 0x8D41,
        COLOR_ATTACHMENT0: 0x8CE0,
        DEPTH_ATTACHMENT: 0x8D00,
        STENCIL_ATTACHMENT: 0x8D20,
        DEPTH_STENCIL_ATTACHMENT: 0x821A,
        VERTEX_ARRAY_BINDING: 0x85B5,
        TRANSFORM_FEEDBACK: 0x8E22,
        TRANSFORM_FEEDBACK_BUFFER: 0x8C8E,
        RASTERIZER_DISCARD: 0x8C89,
        DEPTH_TEST: 0x0B71,
        BLEND: 0x0BE2,
        CULL_FACE: 0x0B44,
        FRONT: 0x0404,
        BACK: 0x0405,
        FRONT_AND_BACK: 0x0408,
        FUNC_ADD: 0x8006,
        ONE: 1,
        ZERO: 0,
        SRC_ALPHA: 0x0302,
        ONE_MINUS_SRC_ALPHA: 0x0303,
        DST_ALPHA: 0x0304,
        ONE_MINUS_DST_ALPHA: 0x0305,
        NEAREST: 0x2600,
        LINEAR: 0x2601,
        CLAMP_TO_EDGE: 0x812F,
        REPEAT: 0x2901,
        MIRRORED_REPEAT: 0x8370,
        RGBA: 0x1908,
        RGB: 0x1907,
        UNSIGNED_BYTE: 0x1401,
        FLOAT: 0x1406,
        COLOR_BUFFER_BIT: 0x4000,
        DEPTH_BUFFER_BIT: 0x0100,
        STENCIL_BUFFER_BIT: 0x0400
    };

    Object.assign(gl, constants);

    gl.__sandbox = sandbox;
    gl.__spies = spies;
    gl.__stubs = stubs;
    gl.restore = () => sandbox.restore();
    gl.resetHistory = () => sandbox.resetHistory();
    gl.resetBehavior = () => sandbox.resetBehavior();

    return gl;
}

export function mockWebgl2Canvas(options = {}, canvasOptions = {}) {
    const gl = createMockWebGL2Context(options);
    const sandbox = gl.__sandbox;

    const canvas = {
        width: canvasOptions.width ?? 800,
        height: canvasOptions.height ?? 600,
        style: {},
        clientWidth: canvasOptions.clientWidth ?? 800,
        clientHeight: canvasOptions.clientHeight ?? 600,

        getContext: canvasOptions.getContext || sandbox.stub().callsFake((type, contextOptions) => {
            if (type === 'webgl2') return gl;
            return null;
        }),

        addEventListener: canvasOptions.addEventListener || sandbox.spy(),
        removeEventListener: canvasOptions.removeEventListener || sandbox.spy(),
        requestFullscreen: canvasOptions.requestFullscreen || sandbox.spy(),
        getBoundingClientRect: canvasOptions.getBoundingClientRect || sandbox.stub().returns({
            width: canvasOptions.clientWidth ?? 800,
            height: canvasOptions.clientHeight ?? 600,
            top: 0,
            left: 0,
            right: canvasOptions.clientWidth ?? 800,
            bottom: canvasOptions.clientHeight ?? 600
        })
    };

    canvas._mockGL = gl;
    canvas.__sandbox = sandbox;
    canvas.restore = () => sandbox.restore();
    canvas.resetHistory = () => sandbox.resetHistory();
    canvas.resetBehavior = () => sandbox.resetBehavior();
    return canvas;
}
