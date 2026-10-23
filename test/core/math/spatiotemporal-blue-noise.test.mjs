import { expect } from 'chai';

import { spatiotemporalBlueNoiseData } from '../../../src/core/math/spatiotemporal-blue-noise.js';

describe('Spatiotemporal blue noise', function () {
    const size = 32;
    const frames = 64;
    const plane = size * size;
    const data = spatiotemporalBlueNoiseData();

    it('has uniformly distributed threshold ranks across its 32x32x64 volume', function () {
        expect(data).to.have.length(plane * frames);
        const counts = new Uint32Array(256);
        for (const value of data) counts[value]++;
        expect(Array.from(counts)).to.deep.equal(Array(256).fill(256));
    });

    it('reduces per-pixel coverage error when averaging a complete temporal cycle', function () {
        // A globally uniform mask can still over- or under-sample individual pixels for an
        // entire cycle. Measure the integrated coverage, independently of the frequency tests.
        const thresholds = [0.1, 0.5, 0.9];
        let error = 0;
        for (let pixel = 0; pixel < plane; pixel++) {
            for (const threshold of thresholds) {
                let accepted = 0;
                for (let t = 0; t < frames; t++) {
                    if ((data[t * plane + pixel] + 0.5) / 256 < threshold) accepted++;
                }
                error += (accepted / frames - threshold) ** 2;
            }
        }
        expect(Math.sqrt(error / (plane * thresholds.length))).to.be.below(0.01);
    });

    it('suppresses low spatial and temporal frequencies at several opacity thresholds', function () {
        // A white Bernoulli mask has expected power 1 under this normalization. Test both
        // frame slices and fixed-pixel time series; ordinary 2D blue noise fails the latter.
        for (const threshold of [0.1, 0.5, 0.9]) {
            const variance = threshold * (1 - threshold);
            let spatialPower = 0;
            let temporalPower = 0;
            for (let t = 0; t < frames; t++) {
                for (const [fx, fy] of [[1, 0], [0, 1], [1, 1], [2, 0], [0, 2]]) {
                    let re = 0;
                    let im = 0;
                    for (let y = 0; y < size; y++) {
                        for (let x = 0; x < size; x++) {
                            const sample = ((data[t * plane + y * size + x] + 0.5) / 256 < threshold ? 1 : 0) - threshold;
                            const angle = 2 * Math.PI * (fx * x + fy * y) / size;
                            re += sample * Math.cos(angle);
                            im += sample * Math.sin(angle);
                        }
                    }
                    spatialPower += (re * re + im * im) / (plane * variance);
                }
            }
            for (let pixel = 0; pixel < plane; pixel++) {
                for (let frequency = 1; frequency <= 3; frequency++) {
                    let re = 0;
                    let im = 0;
                    for (let t = 0; t < frames; t++) {
                        const sample = ((data[t * plane + pixel] + 0.5) / 256 < threshold ? 1 : 0) - threshold;
                        const angle = 2 * Math.PI * frequency * t / frames;
                        re += sample * Math.cos(angle);
                        im += sample * Math.sin(angle);
                    }
                    temporalPower += (re * re + im * im) / (frames * variance);
                }
            }
            expect(spatialPower / (frames * 5)).to.be.below(0.1);
            expect(temporalPower / (plane * 3)).to.be.below(0.5);
        }
    });
});
