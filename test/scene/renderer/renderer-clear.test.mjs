import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { Vec4 } from '../../../src/core/math/vec4.js';
import { Entity } from '../../../src/framework/entity.js';
import {
    CLEARFLAG_COLOR,
    PIXELFORMAT_RGBA8,
    PIXELFORMAT_SRGBA8
} from '../../../src/platform/graphics/constants.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// A camera that doesn't cover its whole render target clears its part inside the render pass,
// using Renderer#clear. The clear color is in sRGB space, and a color buffer of an sRGB format
// encodes the value it is cleared to, so it is cleared to the linear value.
describe('Renderer#clear', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    /**
     * Renders a frame with a camera clearing the left half of a render target to a mid gray.
     *
     * @param {number} format - The format of the color buffer of the render target.
     * @returns {number[][]} The colors passed to the color clears of the device.
     */
    const clearHalf = (format) => {
        const device = app.graphicsDevice;
        const colorBuffer = new Texture(device, { width: 4, height: 4, format, mipmaps: false });
        const renderTarget = new RenderTarget({ colorBuffer, depth: false });

        const camera = new Entity('camera');
        camera.addComponent('camera', {
            clearColor: new Color(0.2, 0.2, 0.2, 1),
            rect: new Vec4(0, 0, 0.5, 1),
            renderTarget
        });
        app.root.addChild(camera);

        // the WebGL and WebGPU devices make the target of a render pass the current one
        const startRenderPass = device.startRenderPass.bind(device);
        device.startRenderPass = (renderPass) => {
            device.renderTarget = renderPass.renderTarget ?? device.backBuffer;
            startRenderPass(renderPass);
        };

        const clears = [];
        device.clear = (options) => {
            if (options.flags & CLEARFLAG_COLOR) {
                clears.push(Array.from(options.color));
            }
        };

        app.render();
        return clears;
    };

    it('clears part of an sRGB color buffer to the linear value of the clear color', function () {
        const clears = clearHalf(PIXELFORMAT_SRGBA8);

        expect(clears).to.have.lengthOf(1);
        const [r, g, b, a] = clears[0];
        for (const channel of [r, g, b]) {
            expect(channel).to.be.closeTo(0.2 ** 2.2, 1e-6);
        }
        expect(a).to.equal(1);
    });

    it('clears part of a color buffer of another format to the clear color as given', function () {
        const clears = clearHalf(PIXELFORMAT_RGBA8);

        expect(clears).to.have.lengthOf(1);
        for (const channel of clears[0].slice(0, 3)) {
            expect(channel).to.be.closeTo(0.2, 1e-6);
        }
    });
});
