import { expect } from 'chai';

import { EventHandler } from '../../../src/core/event-handler.js';
import { SoundInstance } from '../../../src/platform/sound/instance.js';
import { Sound } from '../../../src/platform/sound/sound.js';

function createInstance(options = {}, manager = { context: null }) {
    const sound = new Sound({ duration: 4 });

    return new SoundInstance(manager, sound, options);
}

function createManager() {
    const manager = new EventHandler();
    const sources = [];

    manager.volume = 1;
    manager.suspended = false;
    manager.sources = sources;
    manager.context = {
        currentTime: 0,
        destination: {},
        createGain: () => ({
            gain: { value: 1 },
            connect: () => {},
            disconnect: () => {}
        }),
        createBufferSource: () => {
            const source = {
                playbackRate: { value: 1 },
                loopStart: 0,
                loopEnd: 0,
                connect: () => {},
                start: (...args) => {
                    source.startArgs = args;
                },
                stop: () => {}
            };
            sources.push(source);
            return source;
        }
    };

    return manager;
}

describe('SoundInstance', function () {
    describe('#duration', function () {
        it('returns the sound duration when no duration is specified', function () {
            expect(createInstance().duration).to.equal(4);
        });

        it('returns a duration shorter than the sound', function () {
            expect(createInstance({ duration: 2 }).duration).to.equal(2);
        });

        it('returns the sound duration when the durations match', function () {
            expect(createInstance({ duration: 4 }).duration).to.equal(4);
        });

        it('clamps a duration longer than the sound', function () {
            expect(createInstance({ duration: 6 }).duration).to.equal(4);
        });

        it('clamps the duration to the time remaining after startTime', function () {
            expect(createInstance({ startTime: 2, duration: 6 }).duration).to.equal(2);
            expect(createInstance({ startTime: 2, duration: 3 }).duration).to.equal(2);
        });

        it('normalizes startTime before clamping the duration', function () {
            expect(createInstance({ startTime: 6, duration: 6 }).duration).to.equal(2);
            expect(createInstance({ startTime: 4, duration: 6 }).duration).to.equal(4);
        });
    });

    describe('#currentTime', function () {
        it('wraps an assigned time immediately', function () {
            const instance = createInstance({ duration: 3 });

            instance.currentTime = 5;

            expect(instance.currentTime).to.equal(2);
        });

        it('uses the clamped duration when tracking playback', function () {
            const manager = createManager();
            const instance = createInstance({ duration: 6 }, manager);

            instance.play();
            manager.context.currentTime = 3;

            expect(instance.currentTime).to.equal(3);

            instance.stop();
        });

        it('tracks playback relative to startTime', function () {
            const manager = createManager();
            const instance = createInstance({ startTime: 1, duration: 3, loop: true }, manager);

            instance.play();
            expect(manager.sources[0].startArgs).to.deep.equal([0, 1]);
            expect(instance.currentTime).to.equal(0);

            manager.context.currentTime = 2;
            expect(instance.currentTime).to.equal(2);

            manager.context.currentTime = 3.5;
            expect(instance.currentTime).to.equal(0.5);

            instance.stop();
        });

        it('seeks relative to startTime and limits the remaining playback duration', function () {
            const manager = createManager();
            const instance = createInstance({ startTime: 1, duration: 3 }, manager);

            instance.currentTime = 2;
            instance.play();

            expect(manager.sources[0].startArgs).to.deep.equal([0, 3, 1]);
            expect(instance.currentTime).to.equal(2);

            instance.stop();
        });

        it('resumes the paused position relative to startTime', function () {
            const manager = createManager();
            const instance = createInstance({ startTime: 1, duration: 2 }, manager);

            instance.play();
            expect(manager.sources[0].startArgs).to.deep.equal([0, 1, 2]);

            manager.context.currentTime = 0.75;
            instance.pause();
            expect(instance.currentTime).to.equal(0.75);

            instance.resume();

            expect(manager.sources[1].startArgs).to.deep.equal([0, 1.75, 1.25]);
            expect(instance.currentTime).to.equal(0.75);

            instance.stop();
        });

        it('resumes an assigned time relative to startTime', function () {
            const manager = createManager();
            const instance = createInstance({ startTime: 1, duration: 2 }, manager);

            instance.play();
            manager.context.currentTime = 0.75;
            instance.pause();

            instance.currentTime = 1.5;
            instance.resume();

            expect(manager.sources[1].startArgs).to.deep.equal([0, 2.5, 0.5]);
            expect(instance.currentTime).to.equal(1.5);

            instance.stop();
        });
    });
});
