import { expect } from 'chai';

import { EventHandler } from '../../../src/core/event-handler.js';
import { SoundInstance } from '../../../src/platform/sound/instance.js';
import { Sound } from '../../../src/platform/sound/sound.js';

function createInstance(duration, manager = { context: null }) {
    const sound = new Sound({ duration: 4 });

    return new SoundInstance(manager, sound, { duration });
}

function createManager() {
    const manager = new EventHandler();
    manager.suspended = false;
    manager.context = {
        currentTime: 0,
        destination: {},
        createGain: () => ({
            gain: { value: 1 },
            connect: () => {},
            disconnect: () => {}
        }),
        createBufferSource: () => ({
            playbackRate: { value: 1 },
            loopStart: 0,
            loopEnd: 0,
            connect: () => {},
            start: () => {},
            stop: () => {}
        })
    };

    return manager;
}

describe('SoundInstance', function () {
    describe('#duration', function () {
        it('returns the sound duration when no duration is specified', function () {
            expect(createInstance().duration).to.equal(4);
        });

        it('returns a duration shorter than the sound', function () {
            expect(createInstance(2).duration).to.equal(2);
        });

        it('returns the sound duration when the durations match', function () {
            expect(createInstance(4).duration).to.equal(4);
        });

        it('clamps a duration longer than the sound', function () {
            expect(createInstance(6).duration).to.equal(4);
        });
    });

    describe('#currentTime', function () {
        it('uses the clamped duration when tracking playback', function () {
            const manager = createManager();
            const instance = createInstance(6, manager);

            instance.play();
            manager.context.currentTime = 3;

            expect(instance.currentTime).to.equal(3);

            instance.stop();
        });
    });
});
