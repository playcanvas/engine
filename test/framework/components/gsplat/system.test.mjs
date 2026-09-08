import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { AppBase } from '../../../../src/framework/app-base.js';
import { AppOptions } from '../../../../src/framework/app-options.js';
import { GSplatComponentSystem } from '../../../../src/framework/components/gsplat/system.js';
import { NullGraphicsDevice } from '../../../../src/platform/graphics/null/null-graphics-device.js';
import { GSplatParams } from '../../../../src/scene/gsplat-unified/gsplat-params.js';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('GSplatComponentSystem', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
        restore();
    });

    const createApp = (componentSystems) => {
        const canvas = document.createElement('canvas');
        const options = new AppOptions();
        options.graphicsDevice = new NullGraphicsDevice(canvas);
        options.resourceHandlers = [];
        options.componentSystems = componentSystems;

        app = new AppBase(canvas);
        app.init(options);
    };

    it('leaves scene GSplat parameters uninitialized when the system is omitted', function () {
        createApp([]);

        expect(app.scene.getGsplatParams()).to.equal(null);
    });

    it('asserts when public GSplat parameters are accessed without the system', function () {
        createApp([]);
        const errorSpy = stub(console, 'error');

        expect(app.scene.gsplat).to.equal(null);
        expect(errorSpy.calledWith(
            'ASSERT FAILED: ',
            'Scene#gsplat requires GSplatComponentSystem to be included in the app.'
        )).to.be.true;
    });

    it('owns the scene GSplat parameters for its lifetime', function () {
        createApp([GSplatComponentSystem]);

        expect(app.scene.gsplat).to.be.an.instanceof(GSplatParams);
        expect(app.renderer.gsplatDirector).not.to.equal(null);

        app.systems.gsplat.destroy();

        expect(app.scene.getGsplatParams()).to.equal(null);
        expect(app.renderer.gsplatDirector).to.equal(null);
    });
});
