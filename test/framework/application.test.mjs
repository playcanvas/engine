import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Debug } from '../../src/core/debug.js';
import { Application } from '../../src/framework/application.js';
import { createApp } from '../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

describe('Application', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
    });

    afterEach(function () {
        restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    it('throws when constructed, pointing to AppBase', function () {
        expect(() => new Application()).to.throw('Application is removed. Use AppBase instead');
    });

    it('forwards getApplication to AppBase with a deprecation message', function () {
        const deprecated = stub(Debug, 'deprecated');
        app = createApp();

        expect(Application.getApplication()).to.equal(app);
        expect(deprecated.calledOnce).to.equal(true);
        expect(deprecated.firstCall.args[0]).to.include('Use AppBase.getApplication instead');
    });

});
