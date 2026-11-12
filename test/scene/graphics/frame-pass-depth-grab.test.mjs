import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_RGBA8 } from '../../../src/platform/graphics/constants.js';
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

    const createColorBuffer = () => new Texture(app.graphicsDevice, {
        width: 32, height: 32, format: PIXELFORMAT_RGBA8, mipmaps: false
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

    it('grabs the depth of a render target with a provided depth buffer in its format', function () {
        const device = app.graphicsDevice;
        const colorBuffer = createColorBuffer();
        const depthBuffer = new Texture(device, {
            width: 32, height: 32, format: PIXELFORMAT_DEPTH, mipmaps: false
        });
        const renderTarget = new RenderTarget({ colorBuffer, depthBuffer });
        const camera = createGrabbingCamera(renderTarget);

        app.render();

        const grabbed = camera.camera.renderPassDepthGrab.depthRenderTarget.depthBuffer;
        expect(grabbed.format).to.equal(PIXELFORMAT_DEPTH);

        renderTarget.destroy();
        depthBuffer.destroy();
        colorBuffer.destroy();
    });
});
