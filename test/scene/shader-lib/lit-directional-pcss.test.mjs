import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTSHAPE_RECT, SHADOW_PCSS_32F } from '../../../src/scene/constants.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Lit shader directional PCSS', function () {

    let app;
    let consoleError;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // PCSS needs filterable float render targets, which the null device does not report
        app.graphicsDevice.textureFloatFilterable = true;
        consoleError = sinon.spy(console, 'error');

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 8);
        app.root.addChild(camera);
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    const forwardShader = () => {
        const material = new StandardMaterial();
        material.update();
        const box = new Entity('box');
        box.addComponent('render', { type: 'box', material });
        app.root.addChild(box);
        app.render();

        const meshInstance = box.render.meshInstances[0];
        const shaders = Array.from(meshInstance._shaderCache.values(), entry => entry.shader);
        const shader = shaders.find(s => s.definition.fshader.includes('combineColor'));
        expect(shader).to.exist;
        expect(shader.failed).to.equal(false);
        expect(consoleError.called, consoleError.args.join('\n')).to.equal(false);
        return shader.definition.fshader;
    };

    // the area shape used to pass a search area, which the directional PCSS function does not take
    const expectSoftShadowParams = (shape) => {
        const light = new Entity('light');
        light.addComponent('light', { type: 'directional', shape, castShadows: true, shadowType: SHADOW_PCSS_32F });
        app.root.addChild(light);

        const source = forwardShader();
        expect(source).to.match(/getShadowPCSS\([^;]*softShadowParams/);
        expect(source).to.not.match(/getShadowPCSS\([^;]*shadowSearchArea/);
    };

    it('samples the shadow of a punctual light with the soft shadow parameters', function () {
        expectSoftShadowParams(LIGHTSHAPE_PUNCTUAL);
    });

    it('samples the shadow of an area light with the soft shadow parameters', function () {
        expectSoftShadowParams(LIGHTSHAPE_RECT);
    });
});
