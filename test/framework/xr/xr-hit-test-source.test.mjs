import { expect } from 'chai';

import { EventHandler } from '../../../src/core/event-handler.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { XrHitTestSource } from '../../../src/framework/xr/xr-hit-test-source.js';

/**
 * Creates a stand-in for an XRHitTestResult.
 *
 * @param {number|null} z - The z coordinate of the hit, down the ray from the origin, or null if
 * the result has no pose.
 * @returns {object} The result.
 */
const createResult = z => ({
    getPose: () => (z === null ? null : {
        transform: {
            position: { x: 0, y: 0, z },
            orientation: { x: 0, y: 0, z: 0, w: 1 }
        }
    })
});

describe('XrHitTestSource', function () {

    /**
     * Creates a hit test source whose frames report the given results.
     *
     * @param {object[]} results - The results, sorted by their distance along the ray.
     * @returns {{ source: XrHitTestSource, frame: object }} The source and a frame with the
     * results.
     */
    const createSource = (results) => {
        const manager = {
            // the camera rig has been moved 10 units down the ray
            camera: { getPosition: () => new Vec3(0, 0, -10) },
            hitTest: new EventHandler(),
            _referenceSpace: {}
        };
        const source = new XrHitTestSource(manager, {}, false);
        const frame = { getHitTestResults: () => results };
        return { source, frame };
    };

    describe('#update', function () {

        it('reports the nearest result along the ray', function () {
            const results = [createResult(-1), createResult(-8)];
            const { source, frame } = createSource(results);

            const reported = [];
            source.on('result', (position, rotation, inputSource, hitTestResult) => {
                reported.push({ position: position.clone(), hitTestResult });
            });
            source.update(frame);

            expect(reported).to.have.lengthOf(1);
            expect(reported[0].position).to.deep.equal(new Vec3(0, 0, -1));
            expect(reported[0].hitTestResult).to.equal(results[0]);
        });

        it('skips results without a pose, and reports nothing when none has one', function () {
            const results = [createResult(null), createResult(-3)];
            const { source, frame } = createSource(results);

            const reported = [];
            source.on('result', (position, rotation, inputSource, hitTestResult) => {
                reported.push({ position: position.clone(), hitTestResult });
            });
            source.update(frame);

            expect(reported).to.have.lengthOf(1);
            expect(reported[0].position).to.deep.equal(new Vec3(0, 0, -3));
            expect(reported[0].hitTestResult).to.equal(results[1]);

            results[1] = createResult(null);
            source.update(frame);
            expect(reported).to.have.lengthOf(1);
        });

    });

});
