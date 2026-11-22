// Explicit browser entry point. Loading this module in the recursive Node suite does not run it.
// Single-sample WebGL2 only: the multisampled internalResolve path and a backbuffer grab are not covered.
export async function run(canvas, log) {
    const pc = await import('../../../build/playcanvas.dbg.mjs');
    const gl = canvas.getContext('webgl2', { depth: true, stencil: true, antialias: false });
    if (!gl) {
        throw new Error('WebGL2 context unavailable');
    }

    const info = gl.getExtension('WEBGL_debug_renderer_info');
    log(`${gl.getParameter(gl.VERSION)} ${gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)}`);
    const app = new pc.Application(canvas, { graphicsDeviceOptions: { gl, antialias: false } });
    const device = app.graphicsDevice;
    // Each diagnostic color channel carries a byte of the float.
    gl.disable(gl.DITHER);
    const size = 32;
    const texture = format => new pc.Texture(device, { width: size, height: size, format, mipmaps: false });
    const targets = [];
    const target = (name, options) => {
        const rt = new pc.RenderTarget({ name, colorBuffer: texture(pc.PIXELFORMAT_RGBA8), samples: 1, ...options });
        targets.push(rt);
        return rt;
    };

    const checkGl = (stage) => {
        const error = gl.getError();
        if (error !== gl.NO_ERROR) {
            throw new Error(`${stage}: GL error 0x${error.toString(16)}`);
        }
    };

    // Inspect the FBOs while the engine has them bound for its depth blit.
    const originalBlit = gl.blitFramebuffer;
    let blits = 0;
    gl.blitFramebuffer = function (...args) {
        const mask = args[8];
        if (mask & gl.DEPTH_BUFFER_BIT) {
            checkGl('before depth blit');
            for (const binding of [gl.READ_FRAMEBUFFER, gl.DRAW_FRAMEBUFFER]) {
                const status = gl.checkFramebufferStatus(binding);
                if (status !== gl.FRAMEBUFFER_COMPLETE) {
                    throw new Error(`FBO 0x${binding.toString(16)} incomplete: 0x${status.toString(16)}`);
                }
            }
            originalBlit.apply(gl, args);
            checkGl('depth blit');
            log('  blit: READ/DRAW complete, NO_ERROR');
            blits++;
        } else {
            originalBlit.apply(gl, args);
        }
    };

    try {
        const autoDepth = target('auto depth', { depth: true, stencil: false });
        const autoStencil = target('auto depth-stencil', { depth: true, stencil: true });
        const supplied16 = target('provided DEPTH16', { depthBuffer: texture(pc.PIXELFORMAT_DEPTH16) });
        const supplied24 = target('provided DEPTHSTENCIL', { depthBuffer: texture(pc.PIXELFORMAT_DEPTHSTENCIL) });
        const diagnostic = target('readback', { depth: false });

        const view = new pc.Entity('Camera');
        view.addComponent('camera', { projection: pc.PROJECTION_ORTHOGRAPHIC, orthoHeight: 1, nearClip: 1, farClip: 9 });
        app.root.addChild(view);
        view.camera.requestSceneDepthMap(true);

        const box = () => {
            const entity = new pc.Entity();
            entity.addComponent('render', { type: 'box' });
            entity.setLocalScale(0.5, 0.5, 1);
            app.root.addChild(entity);
            return entity;
        };
        const left = box();
        const right = box();

        // Copy the sampled float's bits to RGBA8; even a DEPTH16 quantum survives readPixels.
        const shader = pc.ShaderUtils.createShader(device, {
            uniqueName: 'ReadPublishedDepthBits',
            attributes: { aPosition: pc.SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentGLSL: `
                uniform highp sampler2D uSceneDepthMap;
                void main(void) {
                    highp float depth = texelFetch(uSceneDepthMap, ivec2(gl_FragCoord.xy), 0).r;
                    highp uint bits = floatBitsToUint(depth);
                    gl_FragColor = vec4((uvec4(bits) >> uvec4(0u, 8u, 16u, 24u)) & 255u) / 255.0;
                }
            `
        });

        const rgba = new Uint8Array(size * size * 4);
        const bytes = new DataView(rgba.buffer);
        const sample = (x, y) => bytes.getFloat32(4 * (y * size + x), true);

        const frames = [autoDepth, supplied24, supplied16, supplied24, autoStencil, autoDepth, autoStencil, autoStencil];
        for (const [frame, source] of frames.entries()) {
            log(`Frame ${frame + 1}: ${source.name}`);
            // Front face is half a unit nearer than the box center. Vary both depths even on reuse.
            const nearDistance = 2.25 + frame * 0.125;
            const farDistance = 7.25 - frame * 0.125;
            left.setLocalPosition(-0.5, -0.5, -nearDistance - 0.5);
            right.setLocalPosition(0.5, 0.5, -farDistance - 0.5);
            view.camera.renderTarget = source;
            blits = 0;
            app.render();
            checkGl('app.render');
            if (blits !== 1) {
                throw new Error(`Expected one depth blit, got ${blits}`);
            }
            const published = view.camera.camera.sceneDepthMapHandle.texture;
            if (!published || published === source.depthBuffer) {
                throw new Error('Expected the camera to publish a separate depth texture');
            }
            device.scope.resolve('uSceneDepthMap').setValue(published);

            device.setBlendState(pc.BlendState.NOBLEND);
            pc.drawQuadWithShader(device, diagnostic, shader);
            device.setRenderTarget(diagnostic);
            device.updateBegin();
            gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
            device.updateEnd();
            checkGl('diagnostic readback');

            const actual = [sample(8, 8), sample(24, 24), sample(8, 24)];
            // Raw orthographic depth = (distance - near) / (far - near). The third point sees the clear.
            const expected = [(nearDistance - 1) / 8, (farDistance - 1) / 8, 1];
            // Allow one UNORM16 quantum for D16; 2^-21 covers projection and D24/F32 rounding.
            const tolerance = 2 ** -21 + (source === supplied16 ? 1 / 65535 : 0);
            log(`  expected ${expected.join(', ')}  sampled ${actual.join(', ')}  tolerance ${tolerance}`);
            if (!actual.every((d, i) => Math.abs(d - expected[i]) <= tolerance)) {
                throw new Error(`Depth mismatch in frame ${frame + 1} (${source.name})`);
            }
        }
    } finally {
        gl.blitFramebuffer = originalBlit;
        for (const rt of targets) {
            rt.destroyTextureBuffers();
            rt.destroy();
        }
        app.destroy();
    }
}
