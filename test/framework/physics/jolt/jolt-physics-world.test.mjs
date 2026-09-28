import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { Debug } from '../../../../src/core/debug.js';
import { Vec2 } from '../../../../src/core/math/vec2.js';
import { Vec3 } from '../../../../src/core/math/vec3.js';
import {
    JOINTTYPE_FIXED, JOINTTYPE_HINGE
} from '../../../../src/framework/components/joint/constants.js';
import { Entity } from '../../../../src/framework/entity.js';
import { JoltPhysicsWorld } from '../../../../src/framework/physics/jolt/jolt-physics-world.js';
import { BoxGeometry } from '../../../../src/scene/geometry/box-geometry.js';
import { TorusGeometry } from '../../../../src/scene/geometry/torus-geometry.js';
import { Mesh } from '../../../../src/scene/mesh.js';
import { createApp } from '../../../app.mjs';
import { hasJolt, loadJolt } from '../../../jolt.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('JoltPhysicsWorld', function () {
    let Jolt;
    let app;
    let world;

    // Loaded once per file - the module takes ~50 ms to initialize
    before(async function () {
        this.timeout(20000);

        if (!hasJolt()) {
            this.skip();
        }

        Jolt = await loadJolt();
    });

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        world = new JoltPhysicsWorld(Jolt);
        app.systems.rigidbody.setPhysicsWorld(world);
    });

    afterEach(function () {
        restore();
        app?.destroy();
        app = null;
        world = null;
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
     * @param {object} [application] - The application to create the entity in.
     * @returns {Entity} The entity.
     */
    function body(name, type, position, collision, rigidbody = {}, application = app) {
        const e = new Entity(name, application);
        e.setPosition(position);
        application.root.addChild(e);
        e.addComponent('collision', collision);
        if (type) {
            e.addComponent('rigidbody', { type, ...rigidbody });
        }
        return e;
    }

    const box = (hx, hy = hx, hz = hx) => ({ type: 'box', halfExtents: new Vec3(hx, hy, hz) });
    const sphere = radius => ({ type: 'sphere', radius });

    function floor(application = app) {
        return body('floor', 'static', new Vec3(0, -0.5, 0), box(20, 0.5, 20), {}, application);
    }

    function steps(count, dt = 1 / 60) {
        for (let i = 0; i < count; i++) {
            app.systems.rigidbody.step(dt);
        }
    }

    const nativeBody = e => e.rigidbody._body.nativeBody;

    describe('construction', function () {
        it('locates the Jolt data it reads through the module heap', function () {
            expect(world._layout).to.not.equal(null);
        });

        it('exposes the physics system as its native world', function () {
            expect(world.nativeWorld).to.equal(world._system);
            expect(app.systems.rigidbody.dynamicsWorld).to.equal(world._system);
        });

        it('applies the system gravity when installed and when it changes', function () {
            expect(world._system.GetGravity().GetY()).to.be.closeTo(-9.81, 1e-5);

            app.systems.rigidbody.gravity.set(1, 2, 3);
            steps(1);

            const gravity = world._system.GetGravity();
            expect([gravity.GetX(), gravity.GetY(), gravity.GetZ()]).to.deep.equal([1, 2, 3]);
        });
    });

    describe('stepping', function () {
        let stepSpy;

        beforeEach(function () {
            stepSpy = spy(world._joltInterface, 'Step');
        });

        const substeps = () => stepSpy.getCalls().map(call => call.args[0]);

        it('takes fixed substeps and carries the time left over', function () {
            const h = 1 / 60;
            app.systems.rigidbody.step(h * 2.5);
            expect(substeps()).to.deep.equal([h, h]);

            app.systems.rigidbody.step(h * 0.3);
            expect(substeps()).to.deep.equal([h, h]);

            app.systems.rigidbody.step(h * 0.3);
            expect(substeps()).to.deep.equal([h, h, h]);
        });

        it('drops the time beyond the maximum number of substeps', function () {
            app.systems.rigidbody.step(1);
            expect(substeps().length).to.equal(10);

            app.systems.rigidbody.step(1 / 120);
            expect(substeps().length).to.equal(10);
        });

        it('takes one substep of the whole time without a maximum', function () {
            app.systems.rigidbody.maxSubSteps = 0;
            app.systems.rigidbody.step(0.05);

            expect(substeps()).to.deep.equal([0.05]);
        });

        it('discards forces added before a step that runs no substep', function () {
            app.systems.rigidbody.gravity.set(0, 0, 0);
            const ball = body('ball', 'dynamic', Vec3.ZERO, sphere(0.5), { mass: 1 });

            ball.rigidbody.applyForce(100, 0, 0);
            app.systems.rigidbody.step(1 / 240);
            steps(1);

            // as in Bullet, which clears forces at the end of every step
            expect(ball.rigidbody.linearVelocity.x).to.equal(0);
        });

        it('moves a kinematic body to its target over the whole step', function () {
            const mover = body('mover', 'kinematic', Vec3.ZERO, box(0.5));
            steps(1);

            mover.setPosition(2, 0, 0);
            app.systems.rigidbody.step(2 / 60);

            // it moves at the speed that reaches the target at the end of the second substep
            const velocity = nativeBody(mover).GetLinearVelocity();
            expect(velocity.GetX()).to.be.closeTo(60, 1e-3);
            expect(nativeBody(mover).GetPosition().GetX()).to.be.closeTo(2, 1e-5);
        });
    });

    describe('bodies', function () {
        it('creates triggers as kinematic sensors that never sleep', function () {
            const volume = body('volume', null, Vec3.ZERO, box(1));
            const sensor = volume.trigger.body.nativeBody;

            expect(sensor.IsSensor()).to.be.true;
            expect(sensor.GetMotionType()).to.equal(Jolt.EMotionType_Kinematic);
            expect(sensor.GetAllowSleeping()).to.be.false;
        });

        it('never lets kinematic bodies sleep', function () {
            const mover = body('mover', 'kinematic', Vec3.ZERO, box(0.5));
            steps(120);

            expect(mover.rigidbody.isActive()).to.be.true;
        });

        it('reports static bodies and bodies out of the simulation as inactive', function () {
            const wall = body('wall', 'static', Vec3.ZERO, box(1));
            const ball = body('ball', 'dynamic', new Vec3(5, 0, 0), sphere(0.5), { mass: 1 });
            expect(wall.rigidbody.isActive()).to.be.false;
            expect(ball.rigidbody.isActive()).to.be.true;

            ball.rigidbody.enabled = false;
            ball.rigidbody.activate();
            steps(10);

            // a body out of the simulation is not woken, so it does not move either
            expect(ball.rigidbody.isActive()).to.be.false;
            expect(nativeBody(ball).GetPosition().GetY()).to.equal(0);
        });

        it('puts the center of mass of every shape at the body origin', function () {
            const torus = Mesh.fromGeometry(app.graphicsDevice, new TorusGeometry());
            const coneShape = { type: 'cone', radius: 0.5, height: 1 };
            const cone = body('cone', 'dynamic', new Vec3(0, 5, 0), coneShape, { mass: 1 });
            const hull = new Entity('hull');
            hull.setPosition(3, 5, 0);
            app.root.addChild(hull);
            hull.addComponent('rigidbody', { type: 'dynamic', mass: 1 });
            hull.addComponent('collision', {
                type: 'mesh',
                convexHull: true,
                render: { meshes: [torus] }
            });

            const compound = new Entity('compound');
            compound.setPosition(6, 5, 0);
            app.root.addChild(compound);
            compound.addComponent('collision', { type: 'compound' });
            compound.addComponent('rigidbody', { type: 'dynamic', mass: 1 });
            const part = new Entity('part');
            part.setLocalPosition(1, 0, 0);
            compound.addChild(part);
            part.addComponent('collision', box(0.25));

            for (const e of [cone, hull, compound]) {
                const com = e.collision.shape.GetCenterOfMass();
                expect([com.GetX(), com.GetY(), com.GetZ()], e.name).to.deep.equal([0, 0, 0]);
            }

            // like Ammo, a body turns about its origin
            app.systems.rigidbody.gravity.set(0, 0, 0);
            compound.rigidbody.angularVelocity = new Vec3(0, 3, 0);
            steps(30);
            expect(compound.getPosition().distance(new Vec3(6, 5, 0))).to.be.below(1e-4);
        });

        it('gives dynamic bodies with shapes that have no volume the inertia of their bounds', function () {
            floor();
            const geometry = new TorusGeometry({ tubeRadius: 0.2, ringRadius: 0.5 });
            const torus = Mesh.fromGeometry(app.graphicsDevice, geometry);
            const ring = new Entity('ring');
            ring.setPosition(0, 2, 0);
            ring.setEulerAngles(20, 0, 10);
            app.root.addChild(ring);
            ring.addComponent('rigidbody', { type: 'dynamic', mass: 1 });
            ring.addComponent('collision', { type: 'mesh', render: { meshes: [torus] } });

            const inertia = nativeBody(ring).GetMotionProperties().GetInverseInertiaDiagonal();
            expect(inertia.GetX()).to.be.above(0).and.below(Infinity);

            steps(300);
            expect(ring.getPosition().y).to.be.closeTo(0.2, 0.02);
            expect(ring.rigidbody.isActive()).to.be.false;
        });

        it('stops a fast dynamic body at a thin collider', function () {
            // 100 m/s crosses the 10 cm wall 17 times over in one substep
            app.systems.rigidbody.gravity.set(0, 0, 0);
            body('wall', 'static', new Vec3(5, 0, 0), box(0.05, 2, 2));
            const bullet = body('bullet', 'dynamic', Vec3.ZERO, sphere(0.1), { mass: 1 });
            bullet.rigidbody.linearVelocity = new Vec3(100, 0, 0);
            steps(30);

            expect(bullet.getPosition().x).to.be.below(5);
        });

        it('makes a dynamic body with no mass immovable', function () {
            const anvil = body('anvil', 'dynamic', new Vec3(0, 5, 0), box(0.5), { mass: 0 });
            anvil.rigidbody.applyImpulse(10, 10, 10, 0.5, 0, 0);
            steps(30);

            expect(anvil.getPosition().y).to.equal(5);
            expect(anvil.rigidbody.linearVelocity.length()).to.equal(0);
        });

        it('warns once that rolling friction and factors between 0 and 1 are unsupported', function () {
            const warn = stub(Debug, 'warnOnce');
            body('ball', 'dynamic', Vec3.ZERO, sphere(0.5), {
                mass: 1,
                rollingFriction: 0.1,
                linearFactor: new Vec3(1, 0.5, 1)
            });

            const messages = warn.getCalls().map(call => call.args[0]);
            expect(messages.some(m => /rolling friction/.test(m))).to.be.true;
            expect(messages.some(m => /can only lock axes/.test(m))).to.be.true;
        });
    });

    describe('contacts', function () {
        it('keeps the contacts of bodies that fall asleep and forgets them when a body leaves', function () {
            floor();
            const crate = body('crate', 'dynamic', new Vec3(0, 0.5, 0), box(0.5), { mass: 1 });
            let starts = 0;
            crate.rigidbody.on('collisionstart', () => starts++);
            steps(300);

            expect(crate.rigidbody.isActive()).to.be.false;
            expect(world._contacts._sleeping.length).to.be.above(0);

            crate.rigidbody.enabled = false;
            expect(world._contacts._sleeping.length).to.equal(0);

            // back in the simulation after a step without it, the contact is new again
            steps(1);
            crate.rigidbody.enabled = true;
            steps(2);
            expect(starts).to.equal(2);
        });

        it('multiplies the friction of two bodies', function () {
            // a 30 degree slope needs a friction above tan(30) = 0.577 to hold a box: the
            // product of 1 and 0.5 slides, where Jolt's default geometric mean (0.71) would hold
            const slope = body('slope', 'static', Vec3.ZERO, box(10, 0.5, 2), { friction: 1 });
            slope.rigidbody.teleport(0, 0, 0, 0, 0, -30);

            // resting on the slope, 0.75 along its normal from its center
            const normal = new Vec3(0.5, Math.sqrt(3) / 2, 0);
            const crates = [0.5, 1].map((friction, i) => {
                const position = normal.clone().mulScalar(0.75).add(new Vec3(0, 0, i * 1.5 - 0.75));
                const crate = body(`crate${i}`, 'dynamic', position, box(0.25), {
                    mass: 1,
                    friction
                });
                crate.rigidbody.teleport(position, new Vec3(0, 0, -30));
                return crate;
            });
            steps(30);
            const start = crates.map(crate => crate.getPosition().x);
            steps(60);

            // sliding at g (sin 30 - 0.5 cos 30) = 0.66 m/s^2
            expect(crates[0].getPosition().x - start[0]).to.be.above(0.2);
            expect(crates[1].getPosition().x - start[1]).to.be.below(0.01);
        });

        it('estimates the impulse of an impact from the speed of approach', function () {
            floor();
            const crate = body('crate', 'dynamic', new Vec3(0, 3, 0), box(0.5), { mass: 2 });
            let impulse = 0;
            let speed = 0;
            crate.rigidbody.once('collisionstart', (result) => {
                impulse = result.contacts.reduce((sum, c) => sum + c.impulse, 0);
            });
            for (let i = 0; i < 90; i++) {
                if (impulse > 0) {
                    break;
                }
                speed = -crate.rigidbody.linearVelocity.y;
                steps(1);
            }

            // stopping 2 kg at the speed it fell at, give or take the substep it hits in
            expect(impulse).to.be.closeTo(2 * speed, 2 * 9.81 / 60 * 2);
        });

        it('rejects contacts between the bodies of a joint that disables their collision', function () {
            const a = body('a', 'dynamic', new Vec3(0, 3, 0), box(0.5), { mass: 1 });
            const b = body('b', 'dynamic', new Vec3(0.9, 3, 0), box(0.5), { mass: 1 });
            const hinge = new Entity('hinge');
            hinge.setPosition(0.45, 3, 0);
            app.root.addChild(hinge);
            hinge.addComponent('joint', { type: JOINTTYPE_HINGE, entityA: a, entityB: b });
            expect(world._noCollisionPairs.size).to.equal(1);

            let contacts = 0;
            a.rigidbody.on('contact', () => contacts++);
            steps(30);
            expect(contacts).to.equal(0);

            hinge.destroy();
            expect(world._noCollisionPairs.size).to.equal(0);
            steps(2);
            expect(contacts).to.be.above(0);
        });
    });

    describe('shapes', function () {
        let cube;

        beforeEach(function () {
            cube = Mesh.fromGeometry(app.graphicsDevice, new BoxGeometry());
        });

        function meshEntity(x, scale) {
            const e = new Entity();
            e.setPosition(x, 0, 0);
            e.setLocalScale(scale, scale, scale);
            app.root.addChild(e);
            e.addComponent('rigidbody', { type: 'static' });
            e.addComponent('collision', { type: 'mesh', render: { meshes: [cube] } });
            return e;
        }

        it('shares one triangle mesh between colliders built from the same geometry', function () {
            meshEntity(0, 1);
            meshEntity(3, 2);
            meshEntity(6, 0.5);

            expect(world._meshCache.size).to.equal(1);
            const entry = [...world._meshCache.values()][0];
            expect(entry.refCount).to.equal(3);
        });

        it('gives every collider of a shared mesh a shape of its own', function () {
            const a = meshEntity(0, 1);
            const b = meshEntity(3, 1);
            expect(a.collision.shape).to.not.equal(b.collision.shape);

            a.destroy();
            b.destroy();
            steps(1);
            expect(world._meshCache.size).to.equal(0);
        });

        it('releases a cached triangle mesh at the end of the step once no collider uses it', function () {
            const e = meshEntity(0, 1);
            const entry = [...world._meshCache.values()][0];
            const release = spy(entry.shape, 'Release');

            e.destroy();
            expect(world._meshCache.size).to.equal(1);

            steps(1);
            expect(world._meshCache.size).to.equal(0);
            expect(release.callCount).to.equal(1);
        });

        it('keeps a cached mesh that a rebuilt collider uses again within the step', function () {
            const e = meshEntity(0, 1);
            const entry = [...world._meshCache.values()][0];

            e.setLocalScale(2, 2, 2);
            steps(1);

            expect([...world._meshCache.values()][0]).to.equal(entry);
            expect(entry.refCount).to.equal(1);
        });

        it('replaces a shape that cannot be built with an empty shape', function () {
            const warn = stub(Debug, 'warn');
            const e = body('point', 'dynamic', Vec3.ZERO, sphere(0), { mass: 1 });

            expect(warn.calledWithMatch(/cannot create a sphere collision shape/)).to.be.true;
            expect(e.collision.shape.GetSubType()).to.equal(Jolt.EShapeSubType_Empty);
            expect(() => steps(10)).to.not.throw();
        });
    });

    describe('compounds', function () {
        function compound(type) {
            const root = new Entity('root');
            app.root.addChild(root);
            root.addComponent('collision', { type: 'compound' });
            root.addComponent('rigidbody', { type, mass: 1 });
            return root;
        }

        function child(root, x) {
            const e = new Entity('child');
            e.setLocalPosition(x, 0, 0);
            root.addChild(e);
            e.addComponent('collision', box(0.5));
            return e;
        }

        const hits = (x) => {
            return app.systems.rigidbody.raycastAll(new Vec3(x, 10, 0), new Vec3(x, -10, 0)).length;
        };

        it('updates the bounds of its body for a query before the next step', function () {
            const root = compound('static');
            child(root, 0);
            steps(1);

            child(root, 5);
            expect(hits(5)).to.equal(1);
        });

        it('recomputes the inertia of a dynamic compound when its children change', function () {
            app.systems.rigidbody.gravity.set(0, 0, 0);
            const root = compound('dynamic');
            const inverseInertiaY = () => {
                return nativeBody(root).GetMotionProperties().GetInverseInertiaDiagonal().GetY();
            };
            child(root, 0);
            steps(1);
            const before = inverseInertiaY();

            child(root, 3);
            steps(1);
            const after = inverseInertiaY();

            // a part far from the origin makes the body much harder to turn about Y
            expect(after).to.be.below(before / 10);
        });
    });

    describe('joints', function () {
        it('disables a broken constraint within the step that breaks it', function () {
            const crate = body('crate', 'dynamic', new Vec3(0, 5, 0), box(0.5), { mass: 1 });
            const weld = new Entity('weld');
            weld.setPosition(0, 5.5, 0);
            app.root.addChild(weld);
            weld.addComponent('joint', { type: JOINTTYPE_FIXED, entityA: crate, breakImpulse: 1 });
            steps(1);

            const joint = weld.joint._joint;
            expect(joint.isBroken()).to.be.false;

            crate.rigidbody.applyImpulse(0, -5, 0);
            steps(1);

            expect(joint.isBroken()).to.be.true;
            expect(joint.nativeJoint.GetEnabled()).to.be.false;
            expect(world._breakableJoints.size).to.equal(0);
        });

        it('limits a hinge with limits that exclude its initial pose', function () {
            const door = body('door', 'dynamic', new Vec3(0, 5, 0), box(0.1, 0.5, 0.5), {
                mass: 1,
                gravityScale: 0
            });
            const hinge = new Entity('hinge');
            hinge.setPosition(0, 5, 0);
            app.root.addChild(hinge);
            hinge.addComponent('joint', {
                type: JOINTTYPE_HINGE,
                entityA: door,
                enableLimits: true,
                limits: new Vec2(20, 60)
            });
            steps(120);

            expect(door.getEulerAngles().x).to.be.closeTo(20, 1);
        });
    });

    describe('bindings fallback', function () {
        /**
         * Runs a scene of every shape type, a joint and contact reporting, and returns what it
         * produced.
         *
         * @param {boolean} heap - Whether the world may read the module heap.
         * @returns {string[]} The poses, contacts and ray hits of the scene.
         */
        function scene(heap) {
            const application = createApp();
            const w = new JoltPhysicsWorld(Jolt);
            if (!heap) {
                w._layout = null;
            }
            application.systems.rigidbody.setPhysicsWorld(w);
            floor(application);

            const geometry = new TorusGeometry({ tubeRadius: 0.2, ringRadius: 0.5 });
            const torus = Mesh.fromGeometry(application.graphicsDevice, geometry);
            const shapes = [
                box(0.3),
                { type: 'mesh', render: { meshes: [torus] } },
                { type: 'mesh', convexHull: true, render: { meshes: [torus] } },
                { type: 'cone', radius: 0.4, height: 0.8 }
            ];
            const out = [];
            const bodies = shapes.map((collision, i) => {
                const e = new Entity(`b${i}`, application);
                e.setPosition(i * 1.5, 2 + i * 0.5, 0);
                e.setEulerAngles(i * 13, i * 7, i * 3);
                application.root.addChild(e);
                e.addComponent('rigidbody', { type: 'dynamic', mass: 1 + i });
                e.addComponent('collision', collision);
                e.rigidbody.on('contact', (result) => {
                    const c = result.contacts[0];
                    out.push(`${e.name} ${c.point} ${c.localPoint} ${c.normal} ${c.impulse}`);
                });
                return e;
            });

            for (let i = 0; i < 120; i++) {
                application.systems.rigidbody.step(1 / 60);
            }

            bodies.forEach((e) => {
                out.push(`${e.getPosition()} ${e.getRotation()} ${e.rigidbody.linearVelocity}`);
            });
            const hits = application.systems.rigidbody.raycastAll(new Vec3(1.5, 10, 0),
                new Vec3(1.5, -10, 0), { sort: true });
            hits.forEach(hit => out.push(`${hit.entity.name} ${hit.point} ${hit.normal}`));

            application.destroy();
            return out;
        }

        it('gives the same results through the bindings as through the heap', function () {
            const heap = scene(true);
            expect(heap.length).to.be.above(100);
            expect(scene(false)).to.deep.equal(heap);
        });
    });

    describe('teardown', function () {
        const tick = () => new Promise((resolve) => {
            setTimeout(resolve, 0);
        });

        /**
         * Runs the garbage collector until the referent is gone or the attempts run out. A deref
         * keeps its target alive for the rest of the current job, so gc and deref must run in
         * different jobs.
         *
         * @param {WeakRef<object>} ref - The reference to watch.
         * @param {number} [attempts] - How many collections to try.
         * @returns {Promise<boolean>} True once the referent has been collected.
         */
        async function collected(ref, attempts = 10) {
            if (attempts === 0) {
                return false;
            }
            global.gc();
            await tick();
            const alive = ref.deref() !== undefined;
            await tick();
            return alive ? collected(ref, attempts - 1) : true;
        }

        /**
         * Builds, simulates and destroys an application with a Jolt world.
         *
         * @returns {WeakRef<object>} A weak reference to the application.
         */
        function destroyedApplication() {
            let candidate = createApp();
            candidate.systems.rigidbody.setPhysicsWorld(new JoltPhysicsWorld(Jolt));
            floor(candidate);
            body('crate', 'dynamic', new Vec3(0, 1, 0), box(0.5), { mass: 1 }, candidate)
            .rigidbody.on('contact', () => {});
            for (let i = 0; i < 30; i++) {
                candidate.update(1 / 60);
            }
            const ref = new WeakRef(candidate);
            candidate.destroy();
            candidate = null;
            return ref;
        }

        it('lets a destroyed application be garbage collected', async function () {
            if (typeof global.gc !== 'function') {
                this.skip();
            }
            this.timeout(20000);

            expect(await collected(destroyedApplication())).to.be.true;
        });

        it('returns the module memory it used when destroyed', function () {
            const free = () => Jolt.JoltInterface.prototype.sGetFreeMemory();
            destroyedApplication();
            const baseline = free();

            for (let i = 0; i < 5; i++) {
                destroyedApplication();
            }

            expect(baseline - free()).to.be.below(1024);
        });

        it('keeps another world working when one is destroyed', function () {
            floor();
            const crate = body('crate', 'dynamic', new Vec3(0, 3, 0), box(0.5), { mass: 1 });
            destroyedApplication();

            steps(120);
            expect(crate.getPosition().y).to.be.closeTo(0.5, 0.01);
            const hit = app.systems.rigidbody.raycastFirst(new Vec3(0, 10, 0), new Vec3(0, -10, 0));
            expect(hit.entity).to.equal(crate);
        });
    });
});
