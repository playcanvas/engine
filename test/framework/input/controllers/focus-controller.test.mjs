import { expect } from 'chai';

import { Vec3 } from '../../../../src/core/math/vec3.js';
import { FocusController } from '../../../../src/framework/input/controllers/focus-controller.js';
import { Pose } from '../../../../src/framework/input/pose.js';

describe('FocusController', function () {

    it('has no input fields', function () {
        expect(FocusController.fields).to.deep.equal({});
    });

    it('reports complete once the display reaches the target', function () {
        const controller = new FocusController();
        controller.attach(new Pose(new Vec3(0, 0, 10), Vec3.ZERO, 10), false);
        controller.attach(new Pose(new Vec3(5, 0, 10), Vec3.ZERO, 10));
        expect(controller.complete()).to.equal(false);

        controller.step({ isn: 1, dt: 1 / 60, ts: 0, input: {} });
        for (let i = 0; i < 10 && !controller.complete(); i++) {
            controller.update(1);
        }

        expect(controller.complete()).to.equal(true);
        expect(controller.update(1).position.x).to.be.closeTo(5, 1e-3);
    });

});
