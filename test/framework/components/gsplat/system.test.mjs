import { expect } from 'chai';

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

        expect(app.scene.gsplat).to.equal(null);
    });

    it('owns the scene GSplat parameters for its lifetime', function () {
        createApp([GSplatComponentSystem]);

        expect(app.scene.gsplat).to.be.an.instanceof(GSplatParams);

        app.systems.gsplat.destroy();

        expect(app.scene.gsplat).to.equal(null);
    });
});
