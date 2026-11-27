import { expect } from 'chai';
import sinon from 'sinon';

import { PIXELFORMAT_RGBA8, TEXTUREPROJECTION_EQUIRECT } from '../../../src/platform/graphics/constants.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { QuadRender } from '../../../src/scene/graphics/quad-render.js';
import { reprojectTexture } from '../../../src/scene/graphics/reproject-texture.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('reprojectTexture', function () {
    /** @type {import('../../../src/framework/application.js').Application} */
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const makeTexture = (device, options = {}) => new Texture(device, {
        width: 8,
        height: 8,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        projection: TEXTUREPROJECTION_EQUIRECT,
        ...options
    });

    it('reuses the render target across calls', function () {
        const device = app.graphicsDevice;
        const source = makeTexture(device);
        const target = makeTexture(device);
        const destroy = sinon.spy(RenderTarget.prototype, 'destroy');
        const quadDestroy = sinon.spy(QuadRender.prototype, 'destroy');

        expect(reprojectTexture(source, target)).to.equal(true);
        expect(reprojectTexture(source, target)).to.equal(true);

        expect(destroy.called).to.equal(false);
        expect(quadDestroy.called).to.equal(false);
    });

    it('reuses one render target per cubemap face', function () {
        const device = app.graphicsDevice;
        const source = makeTexture(device);
        const target = makeTexture(device, { cubemap: true });
        const destroy = sinon.spy(RenderTarget.prototype, 'destroy');

        expect(reprojectTexture(source, target)).to.equal(true);
        expect(reprojectTexture(source, target)).to.equal(true);

        expect(destroy.called).to.equal(false);
    });
});
