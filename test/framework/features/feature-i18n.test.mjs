import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Entity } from '../../../src/framework/entity.js';
import { FEATURE_I18N } from '../../../src/framework/features/constants.js';
import { featureI18n } from '../../../src/framework/features/feature-i18n.js';
import { I18n } from '../../../src/framework/i18n/i18n.js';
import { hasFeature } from '../../../src/scene/features/constants.js';
import { installFeatures } from '../../../src/scene/features/install-features.js';
import { createApp } from '../../app.mjs';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('I18n feature', function () {

    it('creates the localization of the host', function () {
        const device = createGraphicsDevice({ width: 1, height: 1 });
        const host = { graphicsDevice: device, i18n: null };
        try {
            installFeatures(host, [featureI18n]);

            expect(hasFeature(device, FEATURE_I18N)).to.equal(true);
            expect(host.i18n).to.be.an.instanceof(I18n);
        } finally {
            host.i18n.destroy();
            device.destroy();
        }
    });

    describe('application', function () {
        let app;

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
        });

        afterEach(function () {
            sinon.restore();
            app.destroy();
            jsdomTeardown();
        });

        it('is installed by the application', function () {
            expect(hasFeature(app.graphicsDevice, FEATURE_I18N)).to.equal(true);
            expect(app.i18n).to.be.an.instanceof(I18n);
        });

        it('keeps text elements working without the feature', function () {
            // as if the application did not install the i18n feature
            app.i18n.destroy();
            app.i18n = null;

            const text = new Entity('Text');
            text.addComponent('element', { type: 'text', text: 'Hello' });
            app.root.addChild(text);

            expect(text.element.text).to.equal('Hello');
            expect(() => text.destroy()).to.not.throw();
        });

        it('asserts when a text element is localized without the feature', function () {
            app.graphicsDevice.featureNames.delete(FEATURE_I18N);
            const assert = sinon.stub(Debug, 'assert');

            const text = new Entity('Text');
            text.addComponent('element', { type: 'text' });
            text.element.key = 'greeting';

            const failed = assert.getCalls().filter(call => !call.args[0]).map(call => call.args[1]);
            expect(failed).to.include('A localized text element needs the i18n feature to be installed.');
        });

        it('asserts when the application properties list localization assets without the feature', function () {
            app.graphicsDevice.featureNames.delete(FEATURE_I18N);
            const assert = sinon.stub(Debug, 'assert');

            app._parseApplicationProperties({ i18nAssets: [1], libraries: [] }, () => {});

            const failed = assert.getCalls().filter(call => !call.args[0]).map(call => call.args[1]);
            expect(failed).to.include('Localization assets need the i18n feature to be installed.');
        });
    });
});
