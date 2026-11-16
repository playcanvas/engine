import { expect } from 'chai';

import { Asset } from '../../../../src/framework/asset/asset.js';
import { SoundSlot } from '../../../../src/framework/components/sound/slot.js';
import { Entity } from '../../../../src/framework/entity.js';
import { Sound } from '../../../../src/platform/sound/sound.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('SoundComponent', function () {
    let app;
    let asset;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        asset = new Asset('shot', 'audio');
        asset.resource = new Sound({ duration: 4 });
        app.assets.add(asset);
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#slots', function () {
        it('names a slot of the component data by its key', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('sound', {
                slots: {
                    shot: { asset: asset.id, startTime: 0.1, duration: 0.2 },
                    music: { loop: true, volume: 0.5 }
                }
            });

            expect(Object.keys(e.sound.slots)).to.have.members(['shot', 'music']);

            const shot = e.sound.slot('shot');
            expect(shot).to.be.an.instanceof(SoundSlot);
            expect(shot.name).to.equal('shot');
            expect(shot.asset).to.equal(asset.id);
            expect(shot.startTime).to.equal(0.1);
            expect(shot.duration).to.equal(0.2);

            const music = e.sound.slot('music');
            expect(music.name).to.equal('music');
            expect(music.loop).to.equal(true);
            expect(music.volume).to.equal(0.5);
        });

        it('names a slot assigned as data by its key', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('sound');

            e.sound.slots = {
                shot: { asset: asset.id, pitch: 2 }
            };

            expect(Object.keys(e.sound.slots)).to.have.members(['shot']);

            const shot = e.sound.slot('shot');
            expect(shot).to.be.an.instanceof(SoundSlot);
            expect(shot.name).to.equal('shot');
            expect(shot.asset).to.equal(asset.id);
            expect(shot.pitch).to.equal(2);
        });

        it('keeps the name of a slot that has one', function () {
            // scene data keys its slots by index and names each one in its entry
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('sound', {
                slots: {
                    0: { name: 'shot', asset: asset.id },
                    1: { name: 'music', loop: true }
                }
            });

            expect(Object.keys(e.sound.slots)).to.have.members(['shot', 'music']);
            expect(e.sound.slot('shot').name).to.equal('shot');
            expect(e.sound.slot('shot').asset).to.equal(asset.id);
            expect(e.sound.slot('music').name).to.equal('music');
            expect(e.sound.slot('music').loop).to.equal(true);

            e.sound.slots = {
                0: { name: 'hit', asset: asset.id }
            };

            expect(Object.keys(e.sound.slots)).to.have.members(['hit']);
            expect(e.sound.slot('hit').name).to.equal('hit');
        });
    });

    describe('cloning', function () {
        it('keeps the slots of the component', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('sound', {
                slots: {
                    shot: { asset: asset.id, startTime: 0.1, duration: 0.2, overlap: true },
                    0: { name: 'music', loop: true, volume: 0.5, pitch: 2 }
                }
            });

            const clone = e.clone();
            app.root.addChild(clone);

            expect(Object.keys(clone.sound.slots)).to.have.members(['shot', 'music']);

            const shot = clone.sound.slot('shot');
            expect(shot).to.not.equal(e.sound.slot('shot'));
            expect(shot.name).to.equal('shot');
            expect(shot.asset).to.equal(asset.id);
            expect(shot.startTime).to.equal(0.1);
            expect(shot.duration).to.equal(0.2);
            expect(shot.overlap).to.equal(true);

            const music = clone.sound.slot('music');
            expect(music).to.not.equal(e.sound.slot('music'));
            expect(music.name).to.equal('music');
            expect(music.loop).to.equal(true);
            expect(music.volume).to.equal(0.5);
            expect(music.pitch).to.equal(2);
        });
    });
});
