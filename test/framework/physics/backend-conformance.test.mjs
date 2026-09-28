import { expect } from 'chai';

import { Quat } from '../../../src/core/math/quat.js';
import { Vec2 } from '../../../src/core/math/vec2.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import {
    JOINTTYPE_6DOF, JOINTTYPE_BALL, JOINTTYPE_FIXED, JOINTTYPE_HINGE, JOINTTYPE_SLIDER,
    MOTION_FREE, MOTION_LIMITED
} from '../../../src/framework/components/joint/constants.js';
import { Entity } from '../../../src/framework/entity.js';
import { AmmoPhysicsWorld } from '../../../src/framework/physics/ammo/ammo-physics-world.js';
import { JoltPhysicsWorld } from '../../../src/framework/physics/jolt/jolt-physics-world.js';
import { BoxGeometry } from '../../../src/scene/geometry/box-geometry.js';
import { Mesh } from '../../../src/scene/mesh.js';
import { hasAmmo, loadAmmo } from '../../ammo.mjs';
import { createApp } from '../../app.mjs';
import { hasJolt, loadJolt } from '../../jolt.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The same scenes run against every physics backend, checking the behavior the physics
// components document rather than any one engine's numbers, so that an application can switch
// backends without its physics changing meaning.

const backends = [
    {
        name: 'Ammo',
        available: hasAmmo,
        async load() {
            globalThis.Ammo = await loadAmmo();
        },
        unload() {
            delete globalThis.Ammo;
        },
        create: () => new AmmoPhysicsWorld()
    },
    {
        name: 'Jolt',
        available: hasJolt,
        module: null,
        async load() {
            this.module = await loadJolt();
        },
        unload() {},
        create() {
            return new JoltPhysicsWorld(this.module);
        }
    }
];

for (const backend of backends) {
    describe(`Physics backend conformance: ${backend.name}`, function () {
        let app;

        before(async function () {
            this.timeout(20000);
            if (!backend.available()) {
                this.skip();
            }
            await backend.load();
        });

        after(function () {
            backend.unload();
        });

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
            app.systems.rigidbody.setPhysicsWorld(backend.create());
        });

        afterEach(function () {
            app?.destroy();
            app = null;
            jsdomTeardown();
        });

        /**
         * Creates an entity with a collision component and, unless type is null, a rigid body.
         *
         * @param {string} name - The entity name.
         * @param {string|null} type - The rigid body type, or null for a trigger.
         * @param {Vec3} position - The world position.
         * @param {object} collision - The collision component data.
         * @param {object} [rigidbody] - More rigid body component data.
         * @returns {Entity} The entity.
         */
        function body(name, type, position, collision, rigidbody = {}) {
            const e = new Entity(name);
            e.setPosition(position);
            app.root.addChild(e);
            e.addComponent('collision', collision);
            if (type) {
                e.addComponent('rigidbody', { type, ...rigidbody });
            }
            return e;
        }

        const box = (hx, hy = hx, hz = hx) => ({ type: 'box', halfExtents: new Vec3(hx, hy, hz) });
        const sphere = radius => ({ type: 'sphere', radius });

        /**
         * Creates a static floor whose top is at y = 0.
         *
         * @returns {Entity} The floor.
         */
        function floor() {
            return body('floor', 'static', new Vec3(0, -0.5, 0), box(20, 0.5, 20));
        }

        /**
         * Creates a dynamic body that ignores gravity.
         *
         * @param {string} name - The entity name.
         * @param {Vec3} position - The world position.
         * @param {object} collision - The collision component data.
         * @param {object} [rigidbody] - More rigid body component data.
         * @returns {Entity} The entity.
         */
        function floating(name, position, collision, rigidbody = {}) {
            const e = body(name, 'dynamic', position, collision, { mass: 1, ...rigidbody });
            e.rigidbody.gravityScale = 0;
            return e;
        }

        /**
         * Creates a joint entity at a world pose.
         *
         * @param {Vec3} position - The joint position.
         * @param {Vec3} angles - The joint rotation in Euler angles.
         * @param {object} data - The joint component data.
         * @returns {Entity} The joint entity.
         */
        function joint(position, angles, data) {
            const e = new Entity('joint');
            e.setPosition(position);
            e.setEulerAngles(angles);
            app.root.addChild(e);
            e.addComponent('joint', data);
            return e;
        }

        function steps(count, dt = 1 / 60) {
            for (let i = 0; i < count; i++) {
                app.systems.rigidbody.step(dt);
            }
        }

        /**
         * Steps while applying a torque about X to an entity every step.
         *
         * @param {Entity} e - The entity.
         * @param {number} torque - The torque about world X.
         * @param {number} count - The number of steps.
         */
        function twist(e, torque, count) {
            for (let i = 0; i < count; i++) {
                e.rigidbody.applyTorque(torque, 0, 0);
                app.systems.rigidbody.step(1 / 60);
            }
        }

        const down = (x, z, options) => app.systems.rigidbody.raycastAll(new Vec3(x, 10, z),
            new Vec3(x, -10, z), { sort: true, ...options });

        describe('joints', function () {
            it('limits a hinge by the rotation of entityA counter-clockwise about the joint X axis', function () {
                const door = floating('door', new Vec3(0, 5, 0), box(0.1, 0.5, 0.5));
                joint(new Vec3(0, 5, 0), Vec3.ZERO, {
                    type: JOINTTYPE_HINGE,
                    entityA: door,
                    enableLimits: true,
                    limits: new Vec2(0, 110)
                });
                steps(1);

                twist(door, 5, 120);
                expect(door.getEulerAngles().x).to.be.closeTo(110, 1);

                twist(door, -5, 240);
                expect(door.getEulerAngles().x).to.be.closeTo(0, 1);
            });

            it('turns entityA counter-clockwise with a positive hinge motor speed', function () {
                const wheel = floating('wheel', new Vec3(0, 5, 0), box(0.1, 0.5, 0.5));
                joint(new Vec3(0, 5, 0), Vec3.ZERO, {
                    type: JOINTTYPE_HINGE,
                    entityA: wheel,
                    motorSpeed: 90,
                    maxMotorForce: 100
                });
                steps(61);

                expect(wheel.getEulerAngles().x).to.be.closeTo(90, 2);
                expect(wheel.rigidbody.angularVelocity.x).to.be.closeTo(Math.PI / 2, 0.02);
            });

            it('limits a slider by the travel of entityB along the joint X axis', function () {
                // the motor drives entityA, so the world anchor (entityB) travels the other way
                const cart = floating('cart', new Vec3(0, 5, 0), box(0.5));
                joint(new Vec3(0, 5, 0), Vec3.ZERO, {
                    type: JOINTTYPE_SLIDER,
                    entityA: cart,
                    enableLimits: true,
                    limits: new Vec2(-1, 2),
                    motorSpeed: 1,
                    maxMotorForce: 100
                });
                steps(240);

                expect(cart.getPosition().x).to.be.closeTo(-2, 0.01);
            });

            it('moves entityB along the joint X axis with a positive slider motor speed', function () {
                const base = body('base', 'static', new Vec3(0, 5, 0), box(0.2));
                const cart = floating('cart', new Vec3(0, 5, 0), box(0.5));
                joint(new Vec3(0, 5, 0), Vec3.ZERO, {
                    type: JOINTTYPE_SLIDER,
                    entityA: base,
                    entityB: cart,
                    motorSpeed: 1,
                    maxMotorForce: 100
                });
                steps(61);

                expect(cart.getPosition().x).to.be.closeTo(1, 0.02);
            });

            it('limits 6dof rotation by the rotation of entityA', function () {
                const plate = floating('plate', new Vec3(0, 5, 0), box(0.5, 0.1, 0.5));
                joint(new Vec3(0, 5, 0), Vec3.ZERO, {
                    type: JOINTTYPE_6DOF,
                    entityA: plate,
                    angularMotionX: MOTION_LIMITED,
                    angularLimitsX: new Vec2(0, 45)
                });
                steps(1);

                twist(plate, 5, 120);
                expect(plate.getEulerAngles().x).to.be.closeTo(45, 1);

                twist(plate, -5, 240);
                expect(plate.getEulerAngles().x).to.be.closeTo(0, 1);
            });

            it('limits 6dof translation by the travel of entityB', function () {
                const anchor = body('anchor', 'static', new Vec3(0, 5, 0), box(0.1));
                const slider = floating('slider', new Vec3(0, 5, 0), box(0.3));
                joint(new Vec3(0, 5, 0), Vec3.ZERO, {
                    type: JOINTTYPE_6DOF,
                    entityA: anchor,
                    entityB: slider,
                    linearMotionX: MOTION_LIMITED,
                    linearLimitsX: new Vec2(0, 1)
                });
                steps(1);

                for (let i = 0; i < 120; i++) {
                    slider.rigidbody.applyForce(10, 0, 0);
                    steps(1);
                }
                expect(slider.getPosition().x).to.be.closeTo(1, 0.01);

                for (let i = 0; i < 180; i++) {
                    slider.rigidbody.applyForce(-10, 0, 0);
                    steps(1);
                }
                expect(slider.getPosition().x).to.be.closeTo(0, 0.01);
            });

            it('limits the swing of a ball joint towards its Y and Z axes separately', function () {
                // the joint's X (twist) axis points down the link, its Y axis along world X and
                // its Z axis along world Z; the bottom of the link is pushed along each
                const tilts = ['x', 'z'].map((axis) => {
                    const position = new Vec3(axis === 'x' ? 0 : 3, 4, 0);
                    const link = floating(`link-${axis}`, position, box(0.05, 0.5, 0.05));
                    const anchor = link.getPosition().clone().add(new Vec3(0, 0.5, 0));
                    joint(anchor, new Vec3(0, 0, -90), {
                        type: JOINTTYPE_BALL,
                        entityA: link,
                        enableLimits: true,
                        swingLimitY: 10,
                        swingLimitZ: 60,
                        twistLimit: 25
                    });
                    steps(1);

                    const force = axis === 'x' ? new Vec3(5, 0, 0) : new Vec3(0, 0, 5);
                    for (let i = 0; i < 180; i++) {
                        link.rigidbody.applyForce(force, new Vec3(0, -0.5, 0));
                        steps(1);
                    }
                    return Math.acos(Math.min(1, link.up.y)) * 180 / Math.PI;
                });

                expect(tilts[0]).to.be.closeTo(10, 1);
                expect(tilts[1]).to.be.closeTo(60, 1);
            });

            it('limits 6dof rotation about Y and Z by the rotation of entityA', function () {
                const angles = [['y', 1], ['y', -1], ['z', 1], ['z', -1]].map(([axis, sign], i) => {
                    const plate = floating(`plate-${i}`, new Vec3(i * 2, 5, 0), box(0.3));
                    joint(plate.getPosition(), Vec3.ZERO, {
                        type: JOINTTYPE_6DOF,
                        entityA: plate,
                        angularMotionY: MOTION_LIMITED,
                        angularLimitsY: new Vec2(0, 30),
                        angularMotionZ: MOTION_LIMITED,
                        angularLimitsZ: new Vec2(-45, 0)
                    });
                    steps(1);

                    const torque = new Vec3();
                    torque[axis] = sign * 3;
                    for (let j = 0; j < 180; j++) {
                        plate.rigidbody.applyTorque(torque);
                        steps(1);
                    }
                    const euler = plate.getEulerAngles();
                    return axis === 'y' ? euler.y : euler.z;
                });

                expect(angles[0]).to.be.closeTo(30, 1);
                expect(angles[1]).to.be.closeTo(0, 1);
                expect(angles[2]).to.be.closeTo(0, 1);
                expect(angles[3]).to.be.closeTo(-45, 1);
            });

            it('limits the swing of a ball joint', function () {
                const capsule = { type: 'capsule', radius: 0.1, height: 1 };
                const link = body('link', 'dynamic', new Vec3(0, 4, 0), capsule, { mass: 1 });
                joint(new Vec3(0, 4.5, 0), new Vec3(0, 0, -90), {
                    type: JOINTTYPE_BALL,
                    entityA: link,
                    enableLimits: true,
                    swingLimitY: 30,
                    swingLimitZ: 30,
                    twistLimit: 20
                });
                steps(1);

                for (let i = 0; i < 120; i++) {
                    link.rigidbody.applyForce(20, 0, 0);
                    steps(1);
                }
                const tilt = Math.acos(Math.min(1, link.up.y)) * 180 / Math.PI;
                expect(tilt).to.be.closeTo(30, 1);
            });

            it('holds a 6dof spring at its equilibrium', function () {
                // the joint entity is the anchor, and the crate hangs on a vertical spring below
                const crate = body('crate', 'dynamic', new Vec3(0, 4, 0), box(0.35), {
                    mass: 5,
                    linearDamping: 0.9
                });
                joint(new Vec3(0, 4, 0), Vec3.ZERO, {
                    type: JOINTTYPE_6DOF,
                    entityA: crate,
                    linearMotionY: MOTION_FREE,
                    linearStiffness: new Vec3(0, 80, 0),
                    linearEquilibrium: new Vec3(0, 1.2, 0)
                });
                steps(600);

                // 1.2 below the anchor, less the stretch of the crate's weight. The heavy damping,
                // which settles the crate, is applied before the spring and holds it a little
                // higher
                expect(crate.getPosition().y).to.be.closeTo(4 - 1.2 - 5 * 9.81 / 80, 0.04);
            });

            it('turns a 6dof angular spring to its equilibrium about several axes', function () {
                const plate = floating('plate', new Vec3(0, 5, 0), box(0.3), {
                    angularDamping: 0.9
                });
                joint(plate.getPosition(), Vec3.ZERO, {
                    type: JOINTTYPE_6DOF,
                    entityA: plate,
                    angularMotionX: MOTION_FREE,
                    angularMotionY: MOTION_FREE,
                    angularMotionZ: MOTION_FREE,
                    angularStiffness: new Vec3(20, 20, 20),
                    angularEquilibrium: new Vec3(30, 20, 0)
                });
                steps(600);

                // the equilibrium is the rotation of entityA in the joint frame, as Euler angles
                // applied about X, then the new Y, then the new Z
                const expected = new Quat().setFromEulerAngles(30, 0, 0);
                expected.mul(new Quat().setFromEulerAngles(0, 20, 0));
                const q = plate.getRotation();
                const dot = Math.abs(q.x * expected.x + q.y * expected.y + q.z * expected.z +
                    q.w * expected.w);
                expect(2 * Math.acos(Math.min(dot, 1)) * 180 / Math.PI).to.be.below(1);
            });

            it('breaks a joint whose break impulse is exceeded', function () {
                const crate = body('crate', 'dynamic', new Vec3(0, 5, 0), box(0.5), { mass: 1 });
                const weld = joint(new Vec3(0, 5.5, 0), Vec3.ZERO, {
                    type: JOINTTYPE_FIXED,
                    entityA: crate,
                    breakImpulse: 0.5
                });
                let broke = 0;
                weld.joint.on('break', () => broke++);

                // gravity alone stays below the threshold
                for (let i = 0; i < 30; i++) {
                    app.update(1 / 60);
                }
                expect(broke).to.equal(0);
                expect(crate.getPosition().y).to.be.closeTo(5, 0.01);

                crate.rigidbody.applyImpulse(0, -3, 0);
                for (let i = 0; i < 30; i++) {
                    app.update(1 / 60);
                }
                expect(broke).to.equal(1);
                expect(weld.joint.isBroken).to.be.true;
                expect(crate.getPosition().y).to.be.below(4.5);
            });

            it('keeps the bodies of a joint from colliding unless enableCollision is set', function () {
                floor();
                const pairs = [];
                for (const enableCollision of [false, true]) {
                    const z = enableCollision ? 3 : -3;
                    const a = body('a', 'dynamic', new Vec3(0, 3, z), box(0.5), { mass: 1 });
                    const b = body('b', 'dynamic', new Vec3(0.9, 3, z), box(0.5), { mass: 1 });
                    joint(new Vec3(0.45, 3, z), new Vec3(0, 90, 0), {
                        type: JOINTTYPE_HINGE,
                        entityA: a,
                        entityB: b,
                        enableCollision
                    });
                    pairs.push([a, b]);
                }
                steps(180);

                const gap = ([a, b]) => b.getPosition().x - a.getPosition().x;
                expect(gap(pairs[0])).to.be.closeTo(0.9, 0.01);
                expect(gap(pairs[1])).to.be.above(0.94);
            });
        });

        describe('contacts', function () {
            it('starts a collision once and keeps it while the body rests and sleeps', function () {
                floor();
                const crate = body('crate', 'dynamic', new Vec3(0, 3, 0), box(0.5), { mass: 1 });
                let starts = 0;
                let ends = 0;
                crate.rigidbody.on('collisionstart', () => starts++);
                crate.rigidbody.on('collisionend', () => ends++);

                steps(600);

                expect(crate.rigidbody.isActive()).to.be.false;
                expect(starts).to.equal(1);
                expect(ends).to.equal(0);
            });

            it('keeps the collision of a sleeping body that is woken while still touching', function () {
                floor();
                const crate = body('crate', 'dynamic', new Vec3(0, 0.5, 0), box(0.5), { mass: 1 });
                let starts = 0;
                let ends = 0;
                crate.rigidbody.on('collisionstart', () => starts++);
                crate.rigidbody.on('collisionend', () => ends++);
                steps(300);
                expect(crate.rigidbody.isActive()).to.be.false;
                expect(starts).to.equal(1);

                crate.rigidbody.activate();
                steps(60);

                expect(starts).to.equal(1);
                expect(ends).to.equal(0);
            });

            it('ends a collision when the bodies separate', function () {
                floor();
                const crate = body('crate', 'dynamic', new Vec3(0, 0.5, 0), box(0.5), { mass: 1 });
                let ended = null;
                crate.rigidbody.on('collisionend', (other) => {
                    ended = other;
                });
                steps(30);

                crate.rigidbody.applyImpulse(0, 10, 0);
                steps(30);

                expect(ended?.name).to.equal('floor');
            });

            it('gives each entity the normal of the other surface', function () {
                const ground = floor();
                const crate = body('crate', 'dynamic', new Vec3(0, 3, 0), box(0.5), { mass: 1 });
                let crateNormal = null;
                let groundNormal = null;
                crate.rigidbody.once('collisionstart', (result) => {
                    crateNormal = result.contacts[0].normal.clone();
                });
                ground.rigidbody.once('collisionstart', (result) => {
                    groundNormal = result.contacts[0].normal.clone();
                });
                steps(120);

                expect(crateNormal.y).to.be.closeTo(1, 1e-4);
                expect(groundNormal.y).to.be.closeTo(-1, 1e-4);
            });

            it('reports contact points on both bodies in world and local space', function () {
                floor();
                const crate = body('crate', 'dynamic', new Vec3(0, 0.5, 0), box(0.5), { mass: 1 });
                let result = null;
                crate.rigidbody.on('contact', (r) => {
                    result = r;
                });
                steps(30);

                expect(result.other.name).to.equal('floor');
                expect(result.contacts.length).to.be.at.least(3);
                for (const contact of result.contacts) {
                    // the bottom face of the crate, resting on the top face of the floor
                    expect(contact.point.y).to.be.closeTo(0, 0.02);
                    expect(contact.localPoint.y).to.be.closeTo(-0.5, 0.02);
                    expect(contact.pointOther.y).to.be.closeTo(0, 0.02);
                    expect(contact.localPointOther.y).to.be.closeTo(0.5, 0.02);
                    expect(Math.abs(contact.localPoint.x)).to.be.closeTo(0.5, 0.02);
                    expect(Math.abs(contact.localPoint.z)).to.be.closeTo(0.5, 0.02);
                }
            });

            it('reports the weight of a resting body over a substep as its contact impulse', function () {
                floor();
                const crate = body('crate', 'dynamic', new Vec3(0, 0.5, 0), box(0.5), { mass: 2 });
                let impulse = 0;
                steps(60);
                crate.rigidbody.once('contact', (result) => {
                    impulse = result.contacts.reduce((sum, c) => sum + c.impulse, 0);
                });
                steps(1);

                expect(impulse).to.be.closeTo(2 * 9.81 / 60, 0.005);
            });

            it('bounces with the product of the two restitutions', function () {
                const ground = floor();
                ground.rigidbody.restitution = 0.5;
                const ball = body('ball', 'dynamic', new Vec3(0, 4.5, 0), sphere(0.5), {
                    mass: 1,
                    restitution: 1
                });

                // fall 4 m, then find the top of the first bounce
                let peak = 0;
                let bounced = false;
                for (let i = 0; i < 240; i++) {
                    steps(1);
                    const vy = ball.rigidbody.linearVelocity.y;
                    bounced ||= vy > 0;
                    if (bounced) {
                        peak = Math.max(peak, ball.getPosition().y - 0.5);
                    }
                }

                // a combined restitution of 0.5 returns a quarter of the height
                expect(peak).to.be.closeTo(1, 0.15);
            });

            it('lets contact event handlers destroy and teleport bodies', function () {
                floor();
                const events = [];
                for (let i = 0; i < 4; i++) {
                    const position = new Vec3(i * 2, 2, 0);
                    const ball = body(`ball${i}`, 'dynamic', position, sphere(0.3), { mass: 1 });
                    ball.rigidbody.on('collisionstart', (result) => {
                        events.push(`${ball.name}:${result.other.name}`);
                        if (i % 2 === 0) {
                            ball.destroy();
                        } else {
                            ball.rigidbody.teleport(i * 2, 3, 0);
                        }
                    });
                }
                steps(120);

                // the destroyed balls land once, the teleported ones land again after each teleport
                expect(events.filter(e => e.startsWith('ball0'))).to.deep.equal(['ball0:floor']);
                expect(events.filter(e => e.startsWith('ball2'))).to.deep.equal(['ball2:floor']);
                expect(events.filter(e => e.startsWith('ball1')).length).to.be.at.least(2);
            });
        });

        describe('triggers', function () {
            /**
             * Creates a trigger volume and records its events.
             *
             * @param {Vec3} position - The world position.
             * @param {Vec3} halfExtents - The half extents.
             * @returns {string[]} The recorded events.
             */
            function trigger(position, halfExtents) {
                const events = [];
                const volume = body('volume', null, position, { type: 'box', halfExtents });
                volume.collision.on('triggerenter', e => events.push(`enter:${e.name}`));
                volume.collision.on('triggerleave', e => events.push(`leave:${e.name}`));
                return events;
            }

            it('reports a dynamic body passing through a trigger', function () {
                const events = trigger(new Vec3(0, 2, 0), new Vec3(3, 1, 3));
                const ball = body('ball', 'dynamic', new Vec3(0, 6, 0), sphere(0.25), { mass: 1 });
                const bodyEvents = [];
                ball.rigidbody.on('triggerenter', e => bodyEvents.push(`enter:${e.name}`));
                ball.rigidbody.on('triggerleave', e => bodyEvents.push(`leave:${e.name}`));
                steps(120);

                expect(events).to.deep.equal(['enter:ball', 'leave:ball']);
                expect(bodyEvents).to.deep.equal(['enter:volume', 'leave:volume']);
            });

            it('reports a kinematic body moving through a trigger', function () {
                const events = trigger(new Vec3(0, 2, 0), new Vec3(1, 1, 1));
                const mover = body('mover', 'kinematic', new Vec3(5, 2, 0), sphere(0.25));
                for (let i = 0; i < 60; i++) {
                    mover.setPosition(5 - i * 0.2, 2, 0);
                    steps(1);
                }

                expect(events).to.deep.equal(['enter:mover', 'leave:mover']);
            });

            it('keeps reporting a body that falls asleep inside a trigger', function () {
                floor();
                const events = trigger(new Vec3(0, 1, 0), new Vec3(2, 1, 2));
                const crate = body('crate', 'dynamic', new Vec3(0, 0.5, 0), box(0.25), { mass: 1 });
                steps(600);

                expect(crate.rigidbody.isActive()).to.be.false;
                expect(events).to.deep.equal(['enter:crate']);
            });

            it('ignores static bodies', function () {
                const events = trigger(new Vec3(0, 0, 0), new Vec3(2, 2, 2));
                body('wall', 'static', new Vec3(0, 0, 0), box(0.5));
                steps(30);

                expect(events).to.deep.equal([]);
            });
        });

        describe('raycasts', function () {
            let cube;

            beforeEach(function () {
                cube = Mesh.fromGeometry(app.graphicsDevice, new BoxGeometry());
            });

            const heights = hits => hits.map(hit => Math.round(hit.point.y * 1000) / 1000);

            it('hits the front and back faces of a mesh collider, or only the front faces', function () {
                body('mesh', 'static', Vec3.ZERO, { type: 'mesh', render: { meshes: [cube] } });

                const all = heights(down(0.1, 0.1));
                expect(all).to.include(0.5);
                expect(all).to.include(-0.5);
                const front = heights(down(0.1, 0.1, { hitBackFaces: false }));
                expect(front.every(y => y === 0.5)).to.be.true;
            });

            it('hits the back face in front of a ray starting inside a mesh collider, facing the ray', function () {
                body('mesh', 'static', Vec3.ZERO, { type: 'mesh', render: { meshes: [cube] } });

                const start = new Vec3(0.1, 0, 0.1);
                const hit = app.systems.rigidbody.raycastFirst(start, new Vec3(0.1, -10, 0.1));
                expect(hit.point.y).to.be.closeTo(-0.5, 1e-4);
                expect(hit.normal.y).to.be.closeTo(1, 1e-4);
            });

            it('misses a primitive collider the ray starts inside', function () {
                body('crate', 'static', Vec3.ZERO, box(0.5));

                const hit = app.systems.rigidbody.raycastFirst(Vec3.ZERO, new Vec3(0, -10, 0));
                expect(hit).to.be.null;
            });

            it('filters hits by collision group and mask', function () {
                body('ground', 'static', Vec3.ZERO, box(0.5));
                const user = floating('user', new Vec3(0, 3, 0), box(0.5));
                user.rigidbody.group = 128;

                const names = options => down(0, 0, options).map(hit => hit.entity.name);
                expect(names()).to.deep.equal(['user', 'ground']);
                expect(names({ filterCollisionMask: 128 })).to.deep.equal(['user']);
                expect(names({ filterCollisionMask: 2 })).to.deep.equal(['ground']);
                expect(names({ filterCollisionGroup: 0 })).to.deep.equal([]);
            });

            it('filters hits by tags and callback', function () {
                const ground = body('ground', 'static', Vec3.ZERO, box(0.5));
                ground.tags.add('ground');
                floating('user', new Vec3(0, 3, 0), box(0.5));

                const names = down(0, 0, { filterTags: ['ground'] }).map(hit => hit.entity.name);
                expect(names).to.deep.equal(['ground']);

                const system = app.systems.rigidbody;
                const start = new Vec3(0, 10, 0);
                const end = new Vec3(0, -10, 0);
                const filterCallback = e => e === ground;
                const byTag = system.raycastFirst(start, end, { filterTags: ['ground'] });
                const byCallback = system.raycastFirst(start, end, { filterCallback });
                expect(byTag.entity).to.equal(ground);
                expect(byCallback.entity).to.equal(ground);
            });

            it('hits trigger volumes', function () {
                body('volume', null, Vec3.ZERO, sphere(1));

                const system = app.systems.rigidbody;
                const hit = system.raycastFirst(new Vec3(0, 10, 0), new Vec3(0, -10, 0));
                expect(hit.entity.name).to.equal('volume');
                expect(hit.point.y).to.be.closeTo(1, 0.05);
                expect(hit.hitFraction).to.be.closeTo(0.45, 0.005);
            });

            for (const type of ['static', 'dynamic', 'kinematic']) {
                it(`finds a ${type} body at its pose before the first step`, function () {
                    body('target', type, new Vec3(4, 0, 0), box(0.5));

                    expect(down(4, 0).map(hit => hit.entity.name)).to.deep.equal(['target']);
                });
            }

            it('finds a body at the pose it is teleported to before the next step', function () {
                const target = body('target', 'dynamic', Vec3.ZERO, sphere(0.5), { mass: 1 });
                steps(1);
                target.rigidbody.teleport(5, 0, 0);

                const system = app.systems.rigidbody;
                const hit = system.raycastFirst(new Vec3(5, 10, 0), new Vec3(5, -10, 0));
                expect(hit.entity).to.equal(target);
                expect(hit.point.y).to.be.closeTo(0.5, 0.01);
            });
        });

        describe('bodies', function () {
            it('loses velocity at the damping rate per second', function () {
                const ball = floating('ball', new Vec3(0, 5, 0), sphere(0.5), {
                    linearDamping: 0.5,
                    angularDamping: 0.5
                });
                ball.rigidbody.linearVelocity = new Vec3(10, 0, 0);
                ball.rigidbody.angularVelocity = new Vec3(0, 10, 0);
                steps(60);

                expect(ball.rigidbody.linearVelocity.length()).to.be.closeTo(5, 0.1);
                expect(ball.rigidbody.angularVelocity.length()).to.be.closeTo(5, 0.1);
            });

            it('locks the axes whose linear or angular factor is 0', function () {
                const crate = body('crate', 'dynamic', new Vec3(0, 3, 0), box(0.5), {
                    mass: 1,
                    linearFactor: new Vec3(1, 0, 1),
                    angularFactor: Vec3.ZERO
                });
                crate.rigidbody.applyImpulse(1, 5, 0, 0, 0.5, 0);
                steps(60);

                const p = crate.getPosition();
                expect(p.y).to.equal(3);
                expect(p.x).to.be.closeTo(1, 0.02);
                expect(crate.getEulerAngles().length()).to.be.closeTo(0, 1e-3);
            });

            it('turns the offset of an impulse into an angular impulse about the body origin', function () {
                const ball = floating('ball', new Vec3(0, 5, 0), sphere(0.5));
                ball.rigidbody.applyImpulse(new Vec3(0, 0, 1), new Vec3(0.5, 0, 0));
                steps(1);

                // 0.5 x 1 about -Y, over the inertia of a unit sphere of radius 0.5 (0.1)
                expect(ball.rigidbody.linearVelocity.z).to.be.closeTo(1, 1e-4);
                expect(ball.rigidbody.angularVelocity.y).to.be.closeTo(-5, 1e-3);
            });

            it('applies a force for every substep of the step it is added before', function () {
                const ball = floating('ball', new Vec3(0, 5, 0), sphere(0.5));
                for (let i = 0; i < 30; i++) {
                    ball.rigidbody.applyForce(10, 0, 0);
                    app.systems.rigidbody.step(1 / 30);
                }

                expect(ball.rigidbody.linearVelocity.x).to.be.closeTo(10, 1e-3);
            });

            it('scales the gravity of a body', function () {
                const full = body('full', 'dynamic', new Vec3(0, 50, 0), sphere(0.5), { mass: 1 });
                const half = body('half', 'dynamic', new Vec3(5, 50, 0), sphere(0.5), {
                    mass: 1,
                    gravityScale: 0.5
                });
                steps(60);

                const fallen = 50 - full.getPosition().y;
                expect(50 - half.getPosition().y).to.be.closeTo(fallen / 2, 0.01);
            });

            it('presents a dynamic body between its last two substeps', function () {
                app.systems.rigidbody.gravity.set(0, 0, 0);
                const ball = body('ball', 'dynamic', Vec3.ZERO, sphere(0.5), { mass: 1 });
                ball.rigidbody.linearVelocity = new Vec3(6, 0, 0);

                const h = 1 / 60;
                const xs = [];
                for (const dt of [0, h / 2, h / 2, 1.5 * h, h / 4, h]) {
                    app.systems.rigidbody.step(dt);
                    xs.push(ball.getPosition().x);
                }

                // each substep moves the body 0.1, and the entity is shown a substep behind,
                // advanced by the time carried over
                const expected = [0, 0, 0, 0.15, 0.175, 0.275];
                xs.forEach((x, i) => expect(x).to.be.closeTo(expected[i], 1e-4));
            });

            it('pushes a dynamic body with a kinematic body', function () {
                floor();
                const pusher = body('pusher', 'kinematic', new Vec3(-2, 0.5, 0), box(0.5));
                const crate = body('crate', 'dynamic', new Vec3(0, 0.5, 0), box(0.5), {
                    mass: 1,
                    friction: 0.1
                });
                steps(30);
                for (let i = 0; i < 60; i++) {
                    pusher.translate(2 / 60, 0, 0);
                    steps(1);
                }

                expect(crate.getPosition().x).to.be.within(0.95, 1.2);
            });

            it('rests primitives on the floor', function () {
                floor();
                const shapes = [
                    box(0.5),
                    sphere(0.5),
                    { type: 'capsule', radius: 0.5, height: 2 },
                    { type: 'cylinder', radius: 0.5, height: 1 }
                ];
                const resting = shapes.map((collision, i) => {
                    const position = new Vec3(i * 3, 2, 0);
                    return body(`shape${i}`, 'dynamic', position, collision, { mass: 1 });
                });
                steps(300);

                const expected = [0.5, 0.5, 1, 0.5];
                resting.forEach((e, i) => {
                    expect(e.getPosition().y).to.be.closeTo(expected[i], 0.01);
                });
            });
        });

        describe('shapes', function () {
            const heights = hits => hits.map(hit => hit.point.y);

            it('aligns capsules, cylinders and cones with their axis, cones pointing along it', function () {
                const cone = { type: 'cone', axis: 0, radius: 0.5, height: 2 };
                const cylinder = { type: 'cylinder', axis: 2, radius: 0.5, height: 2 };
                const capsule = { type: 'capsule', axis: 0, radius: 0.5, height: 3 };
                body('coneX', 'static', new Vec3(0, 0, 0), cone);
                body('cylinderZ', 'static', new Vec3(5, 0, 0), cylinder);
                body('capsuleX', 'static', new Vec3(10, 0, 0), capsule);

                // the cone narrows towards +X
                const [apexSide] = heights(down(0.8, 0));
                const [baseSide] = heights(down(-0.8, 0));
                expect(apexSide).to.be.below(baseSide);
                expect(baseSide).to.be.closeTo(0.45, 0.05);

                // the cylinder extends 1 along Z and 0.5 along X
                expect(heights(down(5, 0.9))[0]).to.be.closeTo(0.5, 0.01);
                expect(down(5.6, 0)).to.be.empty;

                // the capsule extends 1.5 along X
                expect(heights(down(11.4, 0))[0]).to.be.above(0);
                expect(down(10, 0.6)).to.be.empty;
            });

            it('follows the scale of a mesh collider, mirrored or not', function () {
                const cube = Mesh.fromGeometry(app.graphicsDevice, new BoxGeometry());
                const create = (x, scale) => {
                    const e = new Entity();
                    e.setPosition(x, 0, 0);
                    e.setLocalScale(scale);
                    app.root.addChild(e);
                    e.addComponent('rigidbody', { type: 'static' });
                    e.addComponent('collision', { type: 'mesh', render: { meshes: [cube] } });
                    return e;
                };
                const plain = create(0, new Vec3(1, 1, 1));
                const scaled = create(3, new Vec3(2, 3, 2));
                const mirrored = create(6, new Vec3(-1, 2, 1));

                const top = x => Math.max(...heights(down(x, 0.1)));
                expect(top(0.1)).to.be.closeTo(0.5, 1e-4);
                expect(top(3.1)).to.be.closeTo(1.5, 1e-4);
                expect(top(6.1)).to.be.closeTo(1, 1e-4);

                scaled.setLocalScale(1, 1, 1);
                steps(1);
                expect(top(3.1)).to.be.closeTo(0.5, 1e-4);
                expect(plain.collision.shape).to.not.equal(null);
                expect(mirrored.collision.shape).to.not.equal(null);
            });

            it('moves a compound child with its entity', function () {
                const root = new Entity('root');
                root.setPosition(0, 0, 0);
                app.root.addChild(root);
                root.addComponent('collision', { type: 'compound' });
                root.addComponent('rigidbody', { type: 'kinematic' });
                const child = new Entity('child');
                child.setLocalPosition(2, 0, 0);
                root.addChild(child);
                child.addComponent('collision', box(0.5));
                steps(1);

                expect(down(2, 0).map(hit => hit.entity.name)).to.deep.equal(['root']);

                child.setLocalPosition(-2, 0, 0);
                steps(1);

                expect(down(2, 0)).to.be.empty;
                expect(down(-2, 0).map(hit => hit.entity.name)).to.deep.equal(['root']);
            });
        });
    });
}
