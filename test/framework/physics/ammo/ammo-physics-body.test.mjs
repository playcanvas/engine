import { expect } from 'chai';

import { Mat4 } from '../../../../src/core/math/mat4.js';
import { Quat } from '../../../../src/core/math/quat.js';
import { Vec3 } from '../../../../src/core/math/vec3.js';
import { Entity } from '../../../../src/framework/entity.js';
import { AmmoPhysicsWorld } from '../../../../src/framework/physics/ammo/ammo-physics-world.js';
import { hasAmmo, loadAmmo } from '../../../ammo.mjs';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('AmmoPhysicsBody', function () {
    let app;

    // Loaded once per file - the module takes ~100 ms to initialize
    before(async function () {
        this.timeout(20000);

        if (!hasAmmo()) {
            this.skip();
        }

        globalThis.Ammo = await loadAmmo();

        // the transform sync under test needs the interpolation accessors from kripken/ammo.js#446;
        // the engine feature-detects them, so an older build is a skip here, not a failure
        if (typeof Ammo.btRigidBody.prototype.setInterpolationWorldTransform !== 'function') {
            delete globalThis.Ammo;
            this.skip();
        }
    });

    after(function () {
        delete globalThis.Ammo;
    });

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        app.systems.rigidbody.setPhysicsWorld(new AmmoPhysicsWorld());
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    /**
     * Creates a disabled dynamic box at the given height, so its body is built there but is not
     * yet simulating.
     *
     * @param {number} y - The world Y position.
     * @returns {Entity} The entity.
     */
    function createDisabledBox(y) {
        const box = new Entity('box');
        box.enabled = false;
        box.setPosition(0, y, 0);
        box.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.15, 0.15, 0.15) });
        box.addComponent('rigidbody', { type: 'dynamic', mass: 1 });
        app.root.addChild(box);
        return box;
    }

    describe('transform sync', function () {

        // Regression tests for https://github.com/playcanvas/engine/issues/2182. On a frame with no
        // fixed substep, Bullet fills the motion state from the body's interpolation transform.
        // Before #8915 that transform was left behind when the entity was moved and enabled, so the
        // pre-move pose was read back into the entity for that frame. A trigger parented to the
        // entity followed it back into whatever it had overlapped and fired.

        it('keeps the pose a dynamic body was enabled at across a zero-length first frame', function () {
            const box = createDisabledBox(1);
            box.setPosition(0, 2.5, 0);
            box.enabled = true;

            app.update(0);

            expect(box.getPosition().y).to.be.closeTo(2.5, 1e-6);

            // the fixed-step accumulator may need more than one frame before the first substep runs
            for (let i = 0; i < 5; i++) {
                app.update(1 / 60);
            }

            expect(box.getPosition().y).to.be.below(2.5).and.above(2.4);
        });

        it('does not fire a child trigger against what the parent overlapped before it was moved', function () {
            // a kinematic block spanning y 0..1
            const block = new Entity('block');
            block.setPosition(0, 0.5, 0);
            block.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.5, 0.5, 0.5) });
            block.addComponent('rigidbody', { type: 'kinematic' });
            app.root.addChild(block);

            // the box starts inside the block with a child trigger volume, then is moved clear and
            // enabled before the first frame, as a script's initialize would do
            const box = createDisabledBox(1);
            const trigger = new Entity('trigger');
            trigger.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.3, 0.3, 0.3) });
            box.addChild(trigger);

            const events = [];
            let currentFrame = 0;
            trigger.collision.on('triggerenter', (other) => {
                events.push({ frame: currentFrame, other: other.name });
            });

            box.setPosition(0, 2.5, 0);
            box.enabled = true;

            // the first frame of an application always has a delta of zero (see AppBase#tick), so
            // the backend runs no fixed substep on it
            for (let frame = 1; frame <= 60; frame++) {
                currentFrame = frame;
                app.update(frame === 1 ? 0 : 1 / 60);
            }

            // the trigger legitimately reaches the block after about half a second of free fall,
            // but must never report it on the way in
            const frames = events.filter(e => e.other === 'block').map(e => e.frame);
            expect(frames).to.not.be.empty;
            expect(frames.filter(f => f < 20)).to.deep.equal([]);
        });
    });

    describe('raycasts before the first step', function () {

        // Regression tests for https://github.com/playcanvas/engine/issues/4231. Bullet refreshes
        // broadphase bounds only inside a fixed substep, and the first frame of an application
        // runs none, so a body placed or teleported before it was missed by raycasts that frame.

        /**
         * Creates a unit box at the origin, not yet in the scene.
         *
         * @param {string} [type] - The rigid body type, or undefined for a trigger volume.
         * @returns {Entity} The entity.
         */
        function createBox(type) {
            const box = new Entity('box');
            box.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.5, 0.5, 0.5) });
            if (type) {
                box.addComponent('rigidbody', { type });
            }
            return box;
        }

        /**
         * Casts a vertical ray through x = 3 and returns the entity it hits first.
         *
         * @returns {Entity|null} The entity hit, or null.
         */
        function raycastAtX3() {
            const hit = app.systems.rigidbody.raycastFirst(new Vec3(3, 5, 0), new Vec3(3, -5, 0));
            return hit?.entity ?? null;
        }

        ['static', 'kinematic', 'dynamic'].forEach((type) => {
            it(`finds a ${type} body positioned before it joins the scene`, function () {
                const box = createBox(type);
                box.setPosition(3, 0.5, 0);
                app.root.addChild(box);

                expect(raycastAtX3()).to.equal(box);
            });

            it(`finds a ${type} body at the pose it is teleported to`, function () {
                const box = createBox(type);
                app.root.addChild(box);
                box.rigidbody.teleport(3, 0.5, 0);

                expect(raycastAtX3()).to.equal(box);
            });
        });

        it('finds a trigger volume positioned before it joins the scene', function () {
            const box = createBox();
            box.setPosition(3, 0.5, 0);
            app.root.addChild(box);

            expect(raycastAtX3()).to.equal(box);
        });

        it('does not refresh the bounds of a body outside the world', function () {
            const box = createBox('dynamic');
            app.root.addChild(box);
            box.enabled = false;

            const nativeWorld = app.systems.rigidbody.physicsWorld.nativeWorld;
            const updateSingleAabb = nativeWorld.updateSingleAabb;
            let calls = 0;
            nativeWorld.updateSingleAabb = function (body) {
                calls++;
                return updateSingleAabb.call(this, body);
            };

            box.rigidbody.teleport(3, 0.5, 0);
            expect(calls).to.equal(0);

            box.enabled = true;
            expect(calls).to.equal(1);
            expect(raycastAtX3()).to.equal(box);
        });

        it('teleports without the binding on older Ammo builds', function () {
            const nativeWorld = app.systems.rigidbody.physicsWorld.nativeWorld;
            nativeWorld.updateSingleAabb = undefined;

            const box = createBox('dynamic');
            app.root.addChild(box);
            box.rigidbody.teleport(3, 0.5, 0);

            // found once a fixed substep has run
            app.update(1 / 60);
            expect(raycastAtX3()).to.equal(box);
        });
    });

    describe('gravity scale', function () {

        /**
         * Creates an enabled dynamic box at the given height.
         *
         * @param {number} y - The world Y position.
         * @param {object} [data] - Extra rigid body component data.
         * @returns {Entity} The entity.
         */
        function createBox(y, data = {}) {
            const box = createDisabledBox(y);
            Object.assign(box.rigidbody, data);
            box.enabled = true;
            return box;
        }

        /**
         * Runs the application for a number of frames at 60 Hz.
         *
         * @param {number} frames - The number of frames to run.
         */
        function run(frames) {
            for (let i = 0; i < frames; i++) {
                app.update(1 / 60);
            }
        }

        it('does not fall with a gravity scale of 0', function () {
            const box = createBox(5, { gravityScale: 0 });

            run(30);

            expect(box.getPosition().y).to.be.closeTo(5, 1e-6);
            expect(box.rigidbody.linearVelocity.y).to.equal(0);
        });

        it('scales the acceleration of the body', function () {
            const unscaled = createBox(5);
            const doubled = createBox(15, { gravityScale: 2 });
            const rising = createBox(25, { gravityScale: -0.5 });

            run(30);

            const vy = unscaled.rigidbody.linearVelocity.y;
            expect(vy).to.be.below(-1);
            expect(doubled.rigidbody.linearVelocity.y).to.be.closeTo(2 * vy, 1e-4);
            expect(rising.rigidbody.linearVelocity.y).to.be.closeTo(-0.5 * vy, 1e-4);
        });

        it('applies a scale set while the body is disabled', function () {
            const box = createDisabledBox(5);
            box.rigidbody.gravityScale = 0;
            run(5);

            box.enabled = true;
            run(30);

            expect(box.getPosition().y).to.be.closeTo(5, 1e-6);
        });

        it('keeps the scale across disable/enable cycles', function () {
            const box = createBox(5, { gravityScale: 0 });
            run(10);

            box.enabled = false;
            run(5);
            box.enabled = true;
            run(30);

            expect(box.getPosition().y).to.be.closeTo(5, 1e-6);
        });

        it('keeps the scale when the body is rebuilt on a type change', function () {
            const box = createBox(5, { gravityScale: 0 });
            run(10);

            box.rigidbody.type = 'kinematic';
            run(5);
            box.rigidbody.type = 'dynamic';
            run(30);

            expect(box.getPosition().y).to.be.closeTo(5, 1e-6);
        });

        it('keeps the scale when the mass changes', function () {
            const box = createBox(5, { gravityScale: 0 });
            run(10);

            box.rigidbody.mass = 5;
            run(30);

            expect(box.getPosition().y).to.be.closeTo(5, 1e-6);
        });

        it('follows a world gravity change', function () {
            const unscaled = createBox(5);
            const doubled = createBox(15, { gravityScale: 2 });
            const floating = createBox(25, { gravityScale: 0 });
            run(10);

            app.systems.rigidbody.gravity = new Vec3(0, -1, 0);
            unscaled.rigidbody.linearVelocity = Vec3.ZERO;
            doubled.rigidbody.linearVelocity = Vec3.ZERO;
            run(30);

            const vy = unscaled.rigidbody.linearVelocity.y;
            expect(vy).to.be.below(-0.1).and.above(-1);
            expect(doubled.rigidbody.linearVelocity.y).to.be.closeTo(2 * vy, 1e-4);
            expect(floating.getPosition().y).to.be.closeTo(25, 1e-6);
        });

        it('returns to the world gravity when the scale is reset to 1', function () {
            const unscaled = createBox(5);
            const box = createBox(15, { gravityScale: 0 });
            run(10);

            box.rigidbody.gravityScale = 1;
            unscaled.rigidbody.linearVelocity = Vec3.ZERO;
            run(30);

            expect(box.rigidbody.linearVelocity.y).to.be.closeTo(unscaled.rigidbody.linearVelocity.y, 1e-4);
        });

        it('works without the rigid body flag bindings of newer ammo builds', function () {
            // without BT_DISABLE_WORLD_GRAVITY, Bullet hands the body the world gravity when it
            // is added to the world and when the world gravity changes; the system re-applies the
            // scale at both points
            const proto = Ammo.btRigidBody.prototype;
            const { setFlags, getFlags } = proto;
            expect(setFlags).to.be.a('function');
            delete proto.setFlags;
            delete proto.getFlags;

            try {
                const box = createBox(5, { gravityScale: 0 });
                run(10);

                box.enabled = false;
                box.enabled = true;
                run(10);

                app.systems.rigidbody.gravity = new Vec3(0, -1, 0);
                run(30);

                expect(box.getPosition().y).to.be.closeTo(5, 1e-6);
            } finally {
                proto.setFlags = setFlags;
                proto.getFlags = getFlags;
            }
        });

        it('treats a build that binds only one of the flag methods as having neither', function () {
            const proto = Ammo.btRigidBody.prototype;
            const { getFlags } = proto;
            delete proto.getFlags;

            try {
                const box = createBox(5, { gravityScale: 0 });
                run(30);

                expect(box.getPosition().y).to.be.closeTo(5, 1e-6);
            } finally {
                proto.getFlags = getFlags;
            }
        });
    });

    describe('negative scale', function () {

        // Quat#setFromMat4 negates the X axis of a mirrored basis to make it a rotation, and a
        // pair of negative scale factors reads as a 180 degree turn, so the rotation read from
        // such an entity is not its rotation. Writing the body rotation back as the world rotation
        // baked that correction into the local rotation, turning the entity on its first step.

        beforeEach(function () {
            // keep the body in place, so the first step checks the position as well as the basis
            app.systems.rigidbody.gravity = Vec3.ZERO;
        });

        /**
         * Creates a dynamic box at a height of 3 with the given local scale.
         *
         * @param {number[]} scale - The local scale.
         * @param {object} [options] - Options.
         * @param {Entity} [options.parent] - The parent entity. Defaults to the application root.
         * @param {number[]} [options.angles] - The local Euler angles.
         * @param {boolean} [options.offset] - Whether the collision has a linear and angular
         * offset.
         * @returns {Entity} The entity.
         */
        function createScaledBox(scale, { parent = app.root, angles = [0, 0, 0], offset } = {}) {
            const box = new Entity('box');
            box.setLocalPosition(0, 3, 0);
            box.setLocalScale(...scale);
            box.setLocalEulerAngles(...angles);
            parent.addChild(box);
            box.addComponent('collision', offset ? {
                type: 'box',
                linearOffset: new Vec3(0.3, -0.2, 0.5),
                angularOffset: new Quat().setFromEulerAngles(15, 25, 35)
            } : { type: 'box' });
            box.addComponent('rigidbody', { type: 'dynamic' });
            return box;
        }

        /**
         * Returns the largest difference between the axes of two world matrices.
         *
         * @param {Mat4} a - The first matrix.
         * @param {Mat4} b - The second matrix.
         * @returns {number} The largest difference of any basis element.
         */
        function basisDifference(a, b) {
            let max = 0;
            for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) {
                max = Math.max(max, Math.abs(a.data[i] - b.data[i]));
            }
            return max;
        }

        /**
         * Returns the world space pose of an entity's body.
         *
         * @param {Entity} entity - The entity.
         * @returns {{ position: Vec3, rotation: Quat }} The body pose.
         */
        function getBodyPose(entity) {
            const position = new Vec3();
            const rotation = new Quat();
            entity.rigidbody._body.getTransform(position, rotation);
            return { position, rotation };
        }

        /**
         * Checks that an entity's collision shape is posed where its body is.
         *
         * @param {Entity} entity - The entity.
         */
        function expectShapeAtBody(entity) {
            const { position, rotation } = getBodyPose(entity);
            const shapeRotation = entity.collision.getShapeRotation().clone();
            expect(entity.collision.getShapePosition().distance(position)).to.be.below(1e-5);
            expect(Math.abs(shapeRotation.dot(rotation))).to.be.closeTo(1, 1e-6);
        }

        /**
         * Creates a mirrored parent with a rotation, for the child's mirroring to come from.
         *
         * @returns {Entity} The parent entity.
         */
        function createMirroredParent() {
            const parent = new Entity('parent');
            parent.setLocalScale(1, -1, 1);
            parent.setLocalEulerAngles(10, 50, -30);
            app.root.addChild(parent);
            return parent;
        }

        const angles = [20, 30, 40];

        const cases = [
            ['a scale of (1, -1, 1)', () => createScaledBox([1, -1, 1])],
            ['a scale of (1, 1, -1)', () => createScaledBox([1, 1, -1])],
            ['a scale of (-1, -1, 1)', () => createScaledBox([-1, -1, 1])],
            ['a mirrored parent', () => {
                return createScaledBox([1, 1, 1], { parent: createMirroredParent(), angles });
            }],
            ['a scale of (1, -1, 1) and a collision offset', () => {
                return createScaledBox([1, -1, 1], { angles, offset: true });
            }],
            ['a mirrored parent and a collision offset', () => {
                const parent = createMirroredParent();
                return createScaledBox([1, 1, 1], { parent, angles, offset: true });
            }]
        ];

        cases.forEach(([name, create]) => {
            it(`keeps the world basis of a body with ${name} on the first step`, function () {
                const box = create();
                const before = box.getWorldTransform().clone();
                const position = box.getPosition().clone();

                app.update(0);
                app.update(1 / 60);

                expect(basisDifference(box.getWorldTransform(), before)).to.be.below(1e-5);
                expect(box.getPosition().distance(position)).to.be.below(1e-5);
                expectShapeAtBody(box);
            });

            it(`turns a body with ${name} with its body under a torque`, function () {
                const box = create();
                const before = box.getWorldTransform().clone();

                app.update(0);
                app.update(1 / 60);
                const start = getBodyPose(box).rotation;

                for (let i = 0; i < 30; i++) {
                    box.rigidbody.applyTorque(3, 5, -2);
                    app.update(1 / 60);
                }

                // the entity's world basis is turned through the body's rotation since the start
                const turn = getBodyPose(box).rotation.mul(start.invert());
                const expected = new Mat4().setTRS(Vec3.ZERO, turn, Vec3.ONE).mul(before);
                expect(basisDifference(box.getWorldTransform(), expected)).to.be.below(1e-4);
                expect(basisDifference(box.getWorldTransform(), before)).to.be.above(0.5);
                expectShapeAtBody(box);
            });
        });
    });
});
