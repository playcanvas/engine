import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTH16, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_R32F, PIXELFORMAT_RGBA8 } from '../../../src/platform/graphics/constants.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

describe('FramePassDepthGrab', function () {
    /** @type {Application} */
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    // a camera rendering into its own render target, with the scene depth map requested
    const createGrabbingCamera = (renderTarget) => {
        const entity = new Entity('Camera');
        entity.addComponent('camera', { renderTarget });
        app.root.addChild(entity);
        entity.camera.requestSceneDepthMap(true);
        return entity.camera;
    };

    const createColorBuffer = (size = 32) => new Texture(app.graphicsDevice, {
        width: size, height: size, format: PIXELFORMAT_RGBA8, mipmaps: false
    });

    it('grabs the depth of a render target created with depth but without stencil', function () {
        const device = app.graphicsDevice;
        const colorBuffer = createColorBuffer();
        const renderTarget = new RenderTarget({ colorBuffer, depth: true, stencil: false });
        const camera = createGrabbingCamera(renderTarget);

        app.render();

        // the grab copies the depth, so its format must be the one the render target's depth was
        // allocated with: WebGPU allocates depth24plus-stencil8 whether stencil was requested or not
        const grabbed = camera.camera.renderPassDepthGrab.depthRenderTarget.depthBuffer;
        expect(grabbed.format).to.equal(device.isWebGPU ? PIXELFORMAT_DEPTHSTENCIL : PIXELFORMAT_DEPTH);

        renderTarget.destroy();
        colorBuffer.destroy();
    });

    // a render target with a provided depth buffer, which the grab copies in that buffer's format
    const createRenderTargetWithDepth = (colorBuffer, format) => {
        const depthBuffer = new Texture(app.graphicsDevice, {
            width: 32, height: 32, format, mipmaps: false
        });
        return { renderTarget: new RenderTarget({ colorBuffer, depthBuffer }), depthBuffer };
    };

    it('grabs the depth of a render target with a provided depth buffer in its format', function () {
        const colorBuffer = createColorBuffer();
        const { renderTarget, depthBuffer } = createRenderTargetWithDepth(colorBuffer, PIXELFORMAT_DEPTH16);
        const camera = createGrabbingCamera(renderTarget);

        app.render();

        // DEPTH16 has no stencil, so the grab used to choose PIXELFORMAT_DEPTH for it, which a
        // depth16unorm buffer cannot be copied to on WebGPU, nor blitted to on WebGL2
        const grabbed = camera.camera.renderPassDepthGrab.depthRenderTarget.depthBuffer;
        expect(grabbed.format).to.equal(PIXELFORMAT_DEPTH16);

        renderTarget.destroy();
        depthBuffer.destroy();
        colorBuffer.destroy();
    });

    it('grabs into a new render target when the depth format changes at the same size, and keeps it on the next frame', function () {
        const colorBuffer = createColorBuffer();
        const first = new RenderTarget({ colorBuffer, depth: true, stencil: false });
        const camera = createGrabbingCamera(first);

        app.render();
        const grab = camera.camera.renderPassDepthGrab;
        const firstGrab = grab.depthRenderTarget;

        // the same size, the depth now provided in another format
        const { renderTarget: second, depthBuffer } = createRenderTargetWithDepth(colorBuffer, PIXELFORMAT_DEPTH16);
        camera.renderTarget = second;

        app.render();

        const secondGrab = grab.depthRenderTarget;
        expect(secondGrab).to.not.equal(firstGrab);
        const grabbed = secondGrab.depthBuffer;
        expect(grabbed.format).to.equal(PIXELFORMAT_DEPTH16);

        app.render();
        expect(grab.depthRenderTarget).to.equal(secondGrab);
        expect(grab.depthRenderTarget.depthBuffer).to.equal(grabbed);

        first.destroy();
        second.destroy();
        depthBuffer.destroy();
        colorBuffer.destroy();
    });

    it('follows the stencil of the render target switched off and on at the same size', function () {
        const device = app.graphicsDevice;
        const colorBuffer = createColorBuffer();
        const first = new RenderTarget({ colorBuffer, depth: true, stencil: true });
        const camera = createGrabbingCamera(first);

        app.render();
        const grab = camera.camera.renderPassDepthGrab;
        const firstGrab = grab.depthRenderTarget;
        expect(grab.depthRenderTarget.depthBuffer.format).to.equal(PIXELFORMAT_DEPTHSTENCIL);

        const second = new RenderTarget({ colorBuffer, depth: true, stencil: false });
        camera.renderTarget = second;

        app.render();

        // WebGL2 allocates a depth without stencil as depth32float, WebGPU as depth24plus-stencil8.
        // The flags of the render target grabbed into follow its new depth buffer.
        const format = device.isWebGPU ? PIXELFORMAT_DEPTHSTENCIL : PIXELFORMAT_DEPTH;
        const rt = grab.depthRenderTarget;
        expect(rt.depthBuffer.format).to.equal(format);
        expect(rt.depth).to.equal(true);
        expect(rt.stencil).to.equal(format === PIXELFORMAT_DEPTHSTENCIL);
        expect(rt === firstGrab).to.equal(device.isWebGPU);

        camera.renderTarget = first;
        app.render();
        expect(grab.depthRenderTarget.depthBuffer.format).to.equal(PIXELFORMAT_DEPTHSTENCIL);
        expect(grab.depthRenderTarget.stencil).to.equal(true);
        expect(grab.depthRenderTarget === rt).to.equal(device.isWebGPU);

        first.destroy();
        second.destroy();
        colorBuffer.destroy();
    });

    it('switches between the copied and the resolved grab at the same size on WebGPU', function () {
        if (!app.graphicsDevice.isWebGPU) {
            this.skip();
        }

        const colorBuffer = createColorBuffer();
        const single = new RenderTarget({ colorBuffer, depth: true });
        const multi = new RenderTarget({ colorBuffer, depth: true, samples: 4 });
        expect(multi.samples).to.be.greaterThan(1);
        const camera = createGrabbingCamera(multi);
        const grab = camera.camera.renderPassDepthGrab;

        // a multi-sampled depth is resolved by a shader into a color buffer, a single-sampled one
        // copied into a depth buffer: each kind gets a render target of its own
        const expectResolved = () => {
            const rt = grab.depthRenderTarget;
            expect(rt.colorBuffer.format).to.equal(PIXELFORMAT_R32F);
            expect(rt.depthBuffer).to.not.be.ok;
            expect(rt.depth).to.equal(true);
        };
        const expectCopied = () => {
            const rt = grab.depthRenderTarget;
            expect(rt.depthBuffer.format).to.equal(PIXELFORMAT_DEPTHSTENCIL);
            expect(rt.colorBuffer).to.not.be.ok;
        };

        app.render();
        expectResolved();
        const resolved = grab.depthRenderTarget;

        camera.renderTarget = single;
        app.render();
        expectCopied();
        const copied = grab.depthRenderTarget;
        expect(copied).to.not.equal(resolved);

        camera.renderTarget = multi;
        app.render();
        expectResolved();
        expect(grab.depthRenderTarget).to.not.equal(copied);

        single.destroy();
        multi.destroy();
        colorBuffer.destroy();
    });

    it('grabs into a new render target when a provided depth buffer switches between DEPTHSTENCIL and DEPTH16', function () {
        const colorBuffer = createColorBuffer();
        const first = createRenderTargetWithDepth(colorBuffer, PIXELFORMAT_DEPTHSTENCIL);
        const second = createRenderTargetWithDepth(colorBuffer, PIXELFORMAT_DEPTH16);
        const camera = createGrabbingCamera(first.renderTarget);
        const grab = camera.camera.renderPassDepthGrab;

        app.render();
        const firstGrab = grab.depthRenderTarget;
        camera.renderTarget = second.renderTarget;
        app.render();
        const secondGrab = grab.depthRenderTarget;
        expect(secondGrab).to.not.equal(firstGrab);
        expect(secondGrab.depthBuffer.format).to.equal(PIXELFORMAT_DEPTH16);
        expect(secondGrab.depth).to.equal(true);
        expect(secondGrab.stencil).to.equal(false);

        camera.renderTarget = first.renderTarget;
        app.render();
        expect(grab.depthRenderTarget).to.not.equal(secondGrab);
        expect(grab.depthRenderTarget.depthBuffer.format).to.equal(PIXELFORMAT_DEPTHSTENCIL);
        expect(grab.depthRenderTarget.depth).to.equal(true);
        expect(grab.depthRenderTarget.stencil).to.equal(true);

        first.renderTarget.destroy();
        second.renderTarget.destroy();
        first.depthBuffer.destroy();
        second.depthBuffer.destroy();
        colorBuffer.destroy();
    });

    it('resolves a multi-sampled depth on WebGPU when a DEPTH16 buffer is provided', function () {
        const device = app.graphicsDevice;
        if (!device.isWebGPU) {
            this.skip();
        }
        const colorBuffer = createColorBuffer();
        const depthBuffer = new Texture(device, {
            width: 32, height: 32, format: PIXELFORMAT_DEPTH16, mipmaps: false
        });
        // the grab reads the multi-sampled depth the target renders to, not the provided
        // single-sampled buffer, which is only resolved to
        const renderTarget = new RenderTarget({ colorBuffer, depthBuffer, samples: 4, autoResolve: false });
        expect(renderTarget.samples).to.be.greaterThan(1);
        const camera = createGrabbingCamera(renderTarget);
        app.render();

        const grabbed = camera.camera.renderPassDepthGrab.depthRenderTarget;
        expect(grabbed.colorBuffer.format).to.equal(PIXELFORMAT_R32F);

        renderTarget.destroy();
        depthBuffer.destroy();
        colorBuffer.destroy();
    });

    it('grabs into a new render target when the size changes in the same format', function () {
        const firstColor = createColorBuffer();
        const secondColor = createColorBuffer(16);
        const first = new RenderTarget({ colorBuffer: firstColor, depth: true, stencil: false });
        const second = new RenderTarget({ colorBuffer: secondColor, depth: true, stencil: false });
        const camera = createGrabbingCamera(first);
        app.render();
        const grab = camera.camera.renderPassDepthGrab;
        const firstGrab = grab.depthRenderTarget;

        camera.renderTarget = second;
        app.render();
        expect(grab.depthRenderTarget).to.not.equal(firstGrab);
        expect(grab.depthRenderTarget.width).to.equal(16);
        expect(grab.depthRenderTarget.height).to.equal(16);

        first.destroy();
        second.destroy();
        firstColor.destroy();
        secondColor.destroy();
    });
});
