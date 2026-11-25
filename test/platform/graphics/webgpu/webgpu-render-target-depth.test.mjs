import { expect } from 'chai';

import { Entity } from '../../../../src/framework/entity.js';
import { PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_R32F, PIXELFORMAT_RGBA8 } from '../../../../src/platform/graphics/constants.js';
import { RenderTarget } from '../../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../../src/platform/graphics/texture.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

/**
 * @import { Application } from '../../../../src/framework/application.js'
 */

// Runs on the WebGPU device of `npm run test:webgpu`, where Dawn validates the render passes, the
// depth copies and the shader resolves, and any error it reports fails the test.
describe('WebgpuRenderTarget depth', function () {
    /** @type {Application} */
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        if (!app.graphicsDevice.isWebGPU) {
            this.skip();
        }
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const createColorBuffer = () => new Texture(app.graphicsDevice, {
        width: 32, height: 32, format: PIXELFORMAT_RGBA8, mipmaps: false
    });

    // renders a frame with a camera rendering into the render target, and grabbing its depth
    const renderWithDepthGrab = (renderTarget) => {
        const entity = new Entity('Camera');
        entity.addComponent('camera', { renderTarget });
        app.root.addChild(entity);
        entity.camera.requestSceneDepthMap(true);
        app.render();
        return entity.camera.camera.renderPassDepthGrab.depthRenderTarget;
    };

    [
        { stencil: false, gpuFormat: 'depth32float', format: PIXELFORMAT_DEPTH },
        { stencil: true, gpuFormat: 'depth24plus-stencil8', format: PIXELFORMAT_DEPTHSTENCIL }
    ].forEach(({ stencil, gpuFormat, format }) => {
        it(`allocates the depth of a render target with stencil ${stencil} as ${gpuFormat}, and grabs it`, function () {
            const colorBuffer = createColorBuffer();
            const renderTarget = new RenderTarget({ colorBuffer, depth: true, stencil });
            const grab = renderWithDepthGrab(renderTarget);

            expect(renderTarget.impl.depthAttachment.format).to.equal(gpuFormat);
            expect(renderTarget.impl.depthAttachment.hasStencil).to.equal(stencil);

            // the grab copies the depth into the format the stencil flag implies, as on WebGL2
            expect(grab.depthBuffer.format).to.equal(format);

            renderTarget.destroy();
            colorBuffer.destroy();
        });
    });

    [
        { name: 'DEPTH', format: PIXELFORMAT_DEPTH, gpuFormat: 'depth32float' },
        { name: 'DEPTHSTENCIL', format: PIXELFORMAT_DEPTHSTENCIL, gpuFormat: 'depth24plus-stencil8' }
    ].forEach(({ name, format, gpuFormat }) => {
        it(`grabs the multisampled depth of a render target with a provided ${name} buffer`, function () {
            const colorBuffer = createColorBuffer();
            const depthBuffer = new Texture(app.graphicsDevice, {
                width: 32, height: 32, format, mipmaps: false
            });
            const renderTarget = new RenderTarget({ colorBuffer, depthBuffer, samples: 4 });
            expect(renderTarget.samples).to.equal(4);
            const grab = renderWithDepthGrab(renderTarget);

            // rendered into a multisampled depth with the stencil of the provided buffer, which the
            // grab binds as a texture to resolve it into R32F
            expect(renderTarget.impl.depthAttachment.format).to.equal(gpuFormat);
            expect(grab.colorBuffer.format).to.equal(PIXELFORMAT_R32F);

            renderTarget.destroy();
            depthBuffer.destroy();
            colorBuffer.destroy();
        });
    });
});
