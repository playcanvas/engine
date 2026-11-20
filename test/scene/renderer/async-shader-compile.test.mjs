import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

// GraphicsDevice#asyncShaderCompile decides whether the forward render passes skip a draw whose
// shader is still compiling, or wait for it.
describe('GraphicsDevice#asyncShaderCompile', function () {
    /** @type {Application} */
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 10);
        app.root.addChild(camera);

        const box = new Entity('box');
        box.addComponent('render', { type: 'box', material: new StandardMaterial() });
        app.root.addChild(box);
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    // the async compile flag of every shader set by a forward render pass
    const forwardFlags = (setShader) => {
        return setShader.getCalls()
        .filter(call => !call.args[0]?.label?.includes('Shadow'))
        .map(call => call.args[1]);
    };

    it('defaults to false, and the forward passes wait for the shaders', function () {
        expect(app.graphicsDevice.asyncShaderCompile).to.equal(false);

        const setShader = sinon.spy(app.graphicsDevice, 'setShader');
        app.render();
        const flags = forwardFlags(setShader);
        expect(flags.length).to.be.greaterThan(0);
        expect(flags.every(flag => flag === false)).to.be.true;
    });

    it('makes the forward passes skip the draws of shaders still compiling when true', function () {
        app.graphicsDevice.asyncShaderCompile = true;

        const setShader = sinon.spy(app.graphicsDevice, 'setShader');
        app.render();
        const flags = forwardFlags(setShader);
        expect(flags.length).to.be.greaterThan(0);
        expect(flags.every(flag => flag === true)).to.be.true;
    });
});
