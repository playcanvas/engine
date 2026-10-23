import { expect } from 'chai';
import sinon from 'sinon';

import { SoundManager } from '../../../src/platform/sound/manager.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('SoundManager', function () {

    /** @type {SoundManager} */
    let manager;

    beforeEach(function () {
        jsdomSetup();

        // jsdom has no Web Audio, and browsers start the context suspended until a user gesture
        global.AudioContext = class {
            state = 'suspended';

            close() {}
        };
        manager = new SoundManager();
        sinon.stub(manager, '_resume');
    });

    afterEach(function () {
        manager.destroy();
        sinon.restore();
        delete global.AudioContext;
        jsdomTeardown();
    });

    describe('#context', function () {

        it('resumes the suspended context on the first pointerup', function () {
            expect(manager.context).to.be.an.instanceOf(global.AudioContext);

            window.dispatchEvent(new window.Event('pointerdown'));
            window.dispatchEvent(new window.Event('pointerup'));
            window.dispatchEvent(new window.Event('pointerup'));
            expect(manager._resume.calledOnce).to.equal(true);
        });

        it('does not listen for mouse or touch events', function () {
            const add = sinon.spy(window, 'addEventListener');
            expect(manager.context).to.not.equal(null);

            const names = add.getCalls().map(call => call.args[0]);
            expect(names).to.include('pointerup');
            expect(names.filter(name => /^(?:mouse|touch)/.test(name))).to.deep.equal([]);
        });

    });

});
