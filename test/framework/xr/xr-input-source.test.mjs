import { expect } from 'chai';

import { createController, createFrame } from './fake-webxr.mjs';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { XrInputSource } from '../../../src/framework/xr/xr-input-source.js';
import { GraphNode } from '../../../src/scene/graph-node.js';

/**
 * Waits about as long as a frame takes.
 *
 * @returns {Promise<void>} Resolves once the time has passed.
 */
const nextFrame = () => new Promise((resolve) => {
    setTimeout(resolve, 20);
});

describe('XrInputSource', function () {

    /**
     * Creates the input source of a tracked controller, for an XR camera on a rig.
     *
     * @param {object} [options] - Options.
     * @param {boolean} [options.velocitiesSupported] - Whether the browser reports velocities.
     * Defaults to true.
     * @returns {{ inputSource: XrInputSource, rig: GraphNode }} The input source and the rig.
     */
    const createInputSource = ({ velocitiesSupported = true } = {}) => {
        const rig = new GraphNode();
        const camera = new GraphNode();
        rig.addChild(camera);

        const manager = {
            camera,
            input: { velocitiesSupported },
            _referenceSpace: {}
        };

        return { inputSource: new XrInputSource(manager, createController()), rig };
    };

    describe('#getOrigin', function () {

        it('leaves the position and rotation returned before unchanged', function () {
            const { inputSource, rig } = createInputSource();
            rig.setLocalPosition(1, 2, 3);
            rig.setLocalEulerAngles(0, 90, 0);

            // the controller is tilted up by 90 degrees
            inputSource.update(createFrame({ x: 0, y: 0, z: -0.5 }, {
                orientation: { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }
            }));

            const position = inputSource.getPosition();
            const rotation = inputSource.getRotation();
            const expectedPosition = position.clone();
            const expectedRotation = rotation.clone();

            inputSource.getOrigin();
            inputSource.getDirection();

            expect(position.equals(expectedPosition)).to.be.true;
            expect(rotation.equals(expectedRotation)).to.be.true;
        });

        it('follows the scale of the camera parent, as the grip does', function () {
            const { inputSource, rig } = createInputSource();
            rig.setLocalEulerAngles(0, 90, 0);
            rig.setLocalScale(2, 2, 2);
            inputSource.update(createFrame({ x: 0, y: 0, z: -0.5 }));

            // the ray starts at the grip, and points down -x
            expect(inputSource.getOrigin().distance(inputSource.getPosition())).to.be.below(1e-6);
            expect(inputSource.getDirection().distance(new Vec3(-1, 0, 0))).to.be.below(1e-6);
        });

    });

    describe('#getLinearVelocity', function () {

        it('returns the velocity in world space', function () {
            const { inputSource, rig } = createInputSource();
            rig.setLocalEulerAngles(0, 90, 0);

            // the browser reports the controller moving down -z of the tracking space
            inputSource.update(createFrame({ x: 0, y: 1, z: -0.3 }, {
                linearVelocity: { x: 0, y: 0, z: -2 }
            }));

            expect(inputSource.getLinearVelocity().distance(new Vec3(-2, 0, 0))).to.be.below(1e-6);
        });

        it('estimates no velocity from the first pose, nor the first once tracking resumes', async function () {
            // without velocities from the browser, the velocity is estimated from the poses
            const { inputSource } = createInputSource({ velocitiesSupported: false });

            await nextFrame();
            inputSource.update(createFrame({ x: 0.2, y: 1.3, z: -0.3 }));
            expect(inputSource.getLinearVelocity()).to.deep.equal(new Vec3(0, 0, 0));

            // tracking is lost, and resumes elsewhere
            await nextFrame();
            inputSource.update({ getPose: () => null });
            expect(inputSource.getLinearVelocity()).to.be.null;

            await nextFrame();
            inputSource.update(createFrame({ x: -0.4, y: 1.1, z: 0.2 }));
            expect(inputSource.getLinearVelocity()).to.deep.equal(new Vec3(0, 0, 0));
        });

    });

});
