import { expect } from 'chai';
import sinon from 'sinon';

import { Vec3 } from '../../../../src/core/math/vec3.js';
import { Entity } from '../../../../src/framework/entity.js';
import { CHARACTER_GROUP, CharacterController } from '../../../../src/framework/input/controllers/character-controller.js';
import { Pose } from '../../../../src/framework/input/pose.js';
import { AmmoPhysicsWorld } from '../../../../src/framework/physics/ammo/ammo-physics-world.js';
import { NullPhysicsWorld } from '../../../../src/framework/physics/null/null-physics-world.js';
import { hasAmmo, loadAmmo } from '../../../ammo.mjs';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

const snap = (input, dt = 1 / 60, isn = 1) => ({ isn, dt, ts: 0, input: { move: [0, 0], look: [0, 0], jump: false, sprint: false, ...input } });

const expectStateClose = (actual, expected) => {
    for (const key of Object.keys(expected)) {
        if (Array.isArray(expected[key])) {
            for (let i = 0; i < expected[key].length; i++) {
                expect(actual[key][i], `${key}[${i}]`).to.be.closeTo(expected[key][i], 1e-6);
            }
        } else {
            expect(actual[key], key).to.equal(expected[key]);
        }
    }
};

/**
 * Builds a varied, deterministic input sequence: walking, strafing, turning, sprinting and jumping.
 *
 * @param {number} count - The number of snapshots.
 * @returns {object[]} The snapshots.
 */
const sequence = (count) => {
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(snap({
            move: [Math.sin(i * 0.3), i % 20 < 15 ? 1 : -0.5],
            look: [Math.sin(i * 0.1) * 30, i * 2],
            jump: i % 25 > 20,
            sprint: i % 30 < 10
        }, 1 / 60 + (i % 3) * 0.004, i + 1));
    }
    return result;
};

describe('CharacterController', function () {
    let app;

    /**
     * @param {Vec3} position - The box centre.
     * @param {Vec3} halfExtents - The box half extents.
     * @returns {Entity} The static box.
     */
    const createBox = (position, halfExtents) => {
        const box = new Entity('box');
        box.setPosition(position);
        app.root.addChild(box);
        box.addComponent('rigidbody', { type: 'static' });
        box.addComponent('collision', { type: 'box', halfExtents });
        return box;
    };

    /**
     * @returns {CharacterController} A controller on a kinematic capsule at (0, 1, 0).
     */
    const createCharacter = () => {
        const entity = new Entity('character');
        entity.setPosition(0, 1, 0);
        app.root.addChild(entity);
        entity.addComponent('rigidbody', { type: 'kinematic', group: CHARACTER_GROUP });
        entity.addComponent('collision', { type: 'capsule', radius: 0.5, height: 2 });
        return new CharacterController(entity);
    };

    describe('on Ammo', function () {

        /** @type {CharacterController} */
        let controller;

        before(async function () {
            this.timeout(20000);

            if (!hasAmmo()) {
                this.skip();
            }

            globalThis.Ammo = await loadAmmo();
        });

        after(function () {
            delete globalThis.Ammo;
        });

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
            app.systems.rigidbody.setPhysicsWorld(new AmmoPhysicsWorld());
            createBox(new Vec3(0, -0.5, 0), new Vec3(10, 0.5, 10));
            controller = createCharacter();
        });

        afterEach(function () {
            app?.destroy();
            app = null;
            jsdomTeardown();
        });

        const addWall = () => createBox(new Vec3(0, 2, -2.5), new Vec3(2, 2, 0.5));

        it('stands on the floor', function () {
            for (let i = 0; i < 60; i++) {
                controller.step(snap({}));
            }
            const { position, grounded } = controller.state;
            expect(position[1]).to.be.closeTo(1, 0.02);
            expect(grounded).to.equal(true);
            expect(controller.entity.getPosition().y).to.be.closeTo(position[1], 1e-6);
        });

        it('walks forward relative to yaw', function () {
            for (let i = 0; i < 60; i++) {
                controller.step(snap({ move: [0, 1], look: [0, 90] }));
            }
            const { position, look } = controller.state;
            expect(position[0]).to.be.lessThan(-0.5);
            expect(Math.abs(position[2])).to.be.lessThan(0.05);
            expect(look).to.deep.equal([0, 90]);
        });

        it('stops at a wall', function () {
            addWall();
            for (let i = 0; i < 180; i++) {
                controller.step(snap({ move: [0, 1] }));
            }
            expect(controller.state.position[2]).to.be.at.least(-1.52);
            expect(controller.state.position[2]).to.be.lessThan(-1.4);
        });

        it('does not tunnel through a wall on a 1 s snapshot', function () {
            addWall();
            controller.state = { ...controller.state, velocity: [0, 0, -50] };
            controller.step(snap({}, 1));
            expect(controller.state.position[2]).to.be.at.least(-1.52);
            expect(controller.state.position[2]).to.be.lessThan(-1.4);
        });

        it('jumps once per press', function () {
            // ground the character before pressing
            controller.step(snap({}));
            expect(controller.state.grounded).to.equal(true);

            controller.step(snap({ jump: true }));
            expect(controller.state.velocity[1]).to.be.greaterThan(0);
            expect(controller.state.jumping).to.equal(true);

            // hold jump well past landing (about 73 steps at 6 m/s)
            let falling = false;
            let landed = false;
            for (let i = 0; i < 150; i++) {
                controller.step(snap({ jump: true }));
                const { velocity, position, grounded } = controller.state;
                falling ||= velocity[1] < 0;
                if (falling) {
                    expect(velocity[1]).to.be.at.most(1e-9);
                }
                if (landed) {
                    expect(position[1]).to.be.closeTo(1, 0.02);
                }
                landed ||= falling && grounded;
            }
            expect(landed).to.equal(true);
            const { position, grounded, jumping } = controller.state;
            expect(position[1]).to.be.closeTo(1, 0.02);
            expect(grounded).to.equal(true);
            expect(jumping).to.equal(false);

            // releasing and pressing again jumps
            controller.step(snap({ jump: false }));
            controller.step(snap({ jump: true }));
            expect(controller.state.velocity[1]).to.be.greaterThan(0);
        });

        it('sanitizes snapshot values', function () {
            const { speedGround, sprintMult } = controller;
            const dt = 1 / 60;
            controller.step(snap({ move: [5, NaN], look: [Infinity, 0], sprint: true }, dt));
            const state = controller.state;
            for (const key of ['position', 'velocity', 'look']) {
                for (const value of state[key]) {
                    expect(Number.isFinite(value), key).to.equal(true);
                }
            }
            expect(Math.hypot(state.velocity[0], state.velocity[2])).to.be.at.most(speedGround * sprintMult * dt);
            expect(Math.hypot(state.velocity[0], state.velocity[2])).to.be.greaterThan(0);

            controller.step({ isn: 2, dt: NaN, ts: 0 });
            controller.step(snap({ move: 'x', look: null, jump: 1 }, -1));
            for (const value of controller.state.position) {
                expect(Number.isFinite(value)).to.equal(true);
            }
        });

        it('clamps pitch to the vertical', function () {
            controller.step(snap({ look: [120, 10] }));
            expect(controller.state.look).to.deep.equal([90, 10]);
            controller.step(snap({ look: [-120, 10] }));
            expect(controller.state.look).to.deep.equal([-90, 10]);
        });

        it('replays to the same state without stepping the world', function () {
            addWall();
            const snapshots = sequence(90);
            let saved;
            for (let i = 0; i < 90; i++) {
                controller.step(snapshots[i]);
                if (i === 29) {
                    saved = controller.state;
                }
            }
            const a = controller.state;

            const spy = sinon.spy(app.systems.rigidbody.physicsWorld, 'step');
            controller.state = saved;
            for (let i = 30; i < 90; i++) {
                controller.step(snapshots[i]);
            }
            expectStateClose(controller.state, a);
            expect(spy.callCount).to.equal(0);
            spy.restore();
        });

        it('returns copies from state', function () {
            const state = controller.state;
            state.position[1] = 100;
            expect(controller.state.position[1]).to.equal(1);
        });

        it('places the display pose at the eye without smoothing', function () {
            controller.attach(new Pose(new Vec3(5, 5, 5)), false);
            controller.step(snap({ look: [-10, 45] }));
            const pose = controller.update(1 / 60);
            const { position } = controller.state;
            expect(pose.position.x).to.equal(position[0]);
            expect(pose.position.y).to.be.closeTo(position[1] + 0.5, 1e-9);
            expect(pose.position.z).to.equal(position[2]);
            expect(pose.angles.x).to.equal(-10);
            expect(pose.angles.y).to.equal(45);
        });

        it('smooths the display pose when attached with smoothing', function () {
            controller.attach(new Pose(new Vec3(0, 10, 0)));
            const pose = controller.update(1 / 60);
            expect(pose.position.y).to.be.lessThan(10);
            expect(pose.position.y).to.be.greaterThan(1.5);
        });

    });

    describe('on the null backend', function () {

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
            app.systems.rigidbody.setPhysicsWorld(new NullPhysicsWorld());
        });

        afterEach(function () {
            app?.destroy();
            app = null;
            jsdomTeardown();
        });

        it('falls and replays identically on the null backend', function () {
            const controller = createCharacter();
            const snapshots = sequence(30);
            let saved;
            for (let i = 0; i < 30; i++) {
                controller.step(snapshots[i]);
                if (i === 9) {
                    saved = controller.state;
                }
            }
            const a = controller.state;
            expect(a.position[1]).to.be.lessThan(1);
            expect(a.grounded).to.equal(false);

            controller.state = saved;
            for (let i = 10; i < 30; i++) {
                controller.step(snapshots[i]);
            }
            expectStateClose(controller.state, a);
        });

    });

});
