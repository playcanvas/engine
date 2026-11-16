import { expect } from 'chai';

import { Asset } from '../../../../src/framework/asset/asset.js';
import { Entity } from '../../../../src/framework/entity.js';
import { Sound } from '../../../../src/platform/sound/sound.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('SoundComponentSystem', function () {
    let app;
    let asset;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // an audio asset that has not loaded yet
        asset = new Asset('shot', 'audio');
        app.assets.add(asset);
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const createEntity = (slotOptions) => {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('sound');
        e.sound.addSlot('shot', { asset: asset.id, ...slotOptions });
        return e;
    };

    const cloneEntity = (e) => {
        const clone = e.clone();
        app.root.addChild(clone);
        return clone;
    };

    describe('#cloneComponent', function () {
        it('keeps the duration of a slot cloned before its asset loads', function () {
            const e = createEntity({ startTime: 0.1, duration: 0.2 });
            const clone = cloneEntity(e);

            asset.resource = new Sound({ duration: 4 });

            expect(e.sound.slot('shot').duration).to.equal(0.2);
            expect(clone.sound.slot('shot').startTime).to.equal(0.1);
            expect(clone.sound.slot('shot').duration).to.equal(0.2);
        });

        it('keeps the configured duration of a slot cloned after its asset loads', function () {
            asset.resource = new Sound({ duration: 4 });

            // the slot asks for more than the 3 seconds that follow its start time
            const e = createEntity({ startTime: 1, duration: 6 });
            const clone = cloneEntity(e);

            expect(e.sound.slot('shot').duration).to.equal(3);
            expect(clone.sound.slot('shot').duration).to.equal(3);

            // a longer sound shows the duration that each slot holds
            asset.resource = new Sound({ duration: 10 });

            expect(e.sound.slot('shot').duration).to.equal(6);
            expect(clone.sound.slot('shot').duration).to.equal(6);
        });

        it('keeps a slot with no duration playing to the end of its sound', function () {
            asset.resource = new Sound({ duration: 4 });

            const e = createEntity({ startTime: 1 });
            const clone = cloneEntity(e);

            expect(e.sound.slot('shot').duration).to.equal(4);
            expect(clone.sound.slot('shot').duration).to.equal(4);

            // a slot with no duration follows the length of its sound
            asset.resource = new Sound({ duration: 10 });

            expect(e.sound.slot('shot').duration).to.equal(10);
            expect(clone.sound.slot('shot').duration).to.equal(10);
        });

        it('keeps a slot with no duration when cloned before its asset loads', function () {
            const e = createEntity();
            const clone = cloneEntity(e);

            asset.resource = new Sound({ duration: 4 });

            expect(e.sound.slot('shot').duration).to.equal(4);
            expect(clone.sound.slot('shot').duration).to.equal(4);
        });
    });
});
