import { expect } from 'chai';

import { XrJoint } from '../../../src/framework/xr/xr-joint.js';

describe('XrJoint', function () {

    const hand = {};
    const finger = {};

    describe('#isWrist', function () {

        it('is true only for the wrist joint', function () {
            expect(new XrJoint(0, 'wrist', hand).isWrist).to.equal(true);
            expect(new XrJoint(1, 'index-finger-phalanx-distal', hand, finger).isWrist).to.equal(false);
        });

        it('forwards the deprecated wrist to isWrist', function () {
            expect(new XrJoint(0, 'wrist', hand).wrist).to.equal(true);
            expect(new XrJoint(1, 'index-finger-phalanx-distal', hand, finger).wrist).to.equal(false);
        });

    });

    describe('#isTip', function () {

        it('forwards the deprecated tip to isTip', function () {
            const joint = new XrJoint(4, 'index-finger-tip', hand, finger);
            expect(joint.tip).to.equal(joint.isTip);
        });

    });

});
