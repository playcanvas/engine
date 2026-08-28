import { expect } from 'chai';

import { SoundSlot } from '../../../../src/framework/components/sound/slot.js';
import { Sound } from '../../../../src/platform/sound/sound.js';

function createSlot(duration) {
    const asset = { resource: new Sound({ duration: 4 }) };
    const component = {
        system: {
            app: {
                assets: {
                    get: () => asset
                }
            },
            manager: {}
        }
    };

    return new SoundSlot(component, 'Test', { asset: 1, duration });
}

describe('SoundSlot', function () {
    describe('#duration', function () {
        it('returns the asset duration when no duration is specified', function () {
            expect(createSlot().duration).to.equal(4);
        });

        it('returns a duration shorter than the asset', function () {
            expect(createSlot(2).duration).to.equal(2);
        });

        it('returns the asset duration when the durations match', function () {
            expect(createSlot(4).duration).to.equal(4);
        });

        it('clamps a duration longer than the asset', function () {
            expect(createSlot(6).duration).to.equal(4);
        });
    });
});
