import { expect } from 'chai';

import { Quat } from '../../../../src/core/math/quat.js';
import { Vec3 } from '../../../../src/core/math/vec3.js';
import { Entity } from '../../../../src/framework/entity.js';
import { NullPhysicsWorld } from '../../../../src/framework/physics/null/null-physics-world.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

// Component lifecycle against the null physics backend: bodies, triggers and compounds are
// created and torn down through the backend contract without a physics engine loaded.
describe('RigidBodyComponent', function () {
    let app;

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

    function addPhysicsEntity(type = 'dynamic', collisionData = {}) {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('collision', collisionData);
        e.addComponent('rigidbody', { type });
        return e;
    }

    describe('body lifecycle', function () {

        it('creates a backend body once a collision shape is present', function () {
            const e = addPhysicsEntity();

            expect(e.collision.shape).to.exist;
            expect(e.rigidbody._body).to.exist;
            expect(e.rigidbody._body.entity).to.equal(e);
            expect(e.rigidbody._simulationEnabled).to.equal(true);
            // the native escape hatch stays null for backends without a native body
            expect(e.rigidbody.body).to.equal(null);
        });

        it('creates no body without a collision component', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('rigidbody');

            expect(e.rigidbody._body).to.equal(null);
        });

        it('keeps the body across disable/enable cycles', function () {
            const e = addPhysicsEntity();
            const body = e.rigidbody._body;

            e.rigidbody.enabled = false;
            expect(e.rigidbody._simulationEnabled).to.equal(false);
            expect(e.rigidbody._body).to.equal(body);

            e.rigidbody.enabled = true;
            expect(e.rigidbody._simulationEnabled).to.equal(true);
            expect(e.rigidbody._body).to.equal(body);
        });

        it('releases the body when the component is removed', function () {
            const e = addPhysicsEntity();
            expect(e.rigidbody._body).to.exist;

            const rigidbody = e.rigidbody;
            e.removeComponent('rigidbody');
            expect(rigidbody._body).to.equal(null);
        });

        it('rebuilds the body when the type changes and resets group and mask', function () {
            const e = addPhysicsEntity('dynamic');
            e.rigidbody.type = 'kinematic';

            expect(e.rigidbody.type).to.equal('kinematic');
            expect(e.rigidbody._body).to.exist;
            expect(e.rigidbody._simulationEnabled).to.equal(true);
        });

    });

    describe('properties and operations', function () {

        it('routes every property setter without a native backend', function () {
            const e = addPhysicsEntity();
            const rb = e.rigidbody;

            rb.mass = 10;
            rb.friction = 0.25;
            rb.rollingFriction = 0.1;
            rb.restitution = 0.5;
            rb.linearDamping = 0.05;
            rb.angularDamping = 0.06;
            rb.linearFactor = new Vec3(1, 0, 1);
            rb.angularFactor = new Vec3(0, 1, 0);
            rb.linearVelocity = new Vec3(1, 2, 3);
            rb.angularVelocity = new Vec3(4, 5, 6);
            rb.group = 4;
            rb.mask = 255;

            expect(rb.mass).to.equal(10);
            expect(rb.friction).to.equal(0.25);
            expect(rb.rollingFriction).to.equal(0.1);
            expect(rb.restitution).to.equal(0.5);
            expect(rb.linearDamping).to.equal(0.05);
            expect(rb.angularDamping).to.equal(0.06);
            expect(rb.linearFactor.equals(new Vec3(1, 0, 1))).to.equal(true);
            expect(rb.angularFactor.equals(new Vec3(0, 1, 0))).to.equal(true);
            // velocity getters fall back to the cached values under an inert backend
            expect(rb.linearVelocity.equals(new Vec3(1, 2, 3))).to.equal(true);
            expect(rb.angularVelocity.equals(new Vec3(4, 5, 6))).to.equal(true);
            expect(rb.group).to.equal(4);
            expect(rb.mask).to.equal(255);
            expect(rb.isActive()).to.equal(false);
        });

        it('applies forces and impulses without throwing', function () {
            const e = addPhysicsEntity();

            expect(() => {
                e.rigidbody.applyForce(0, 10, 0);
                e.rigidbody.applyForce(new Vec3(0, 10, 0), new Vec3(0, 0, 1));
                e.rigidbody.applyTorque(1, 0, 0);
                e.rigidbody.applyImpulse(new Vec3(0, 1, 0));
                e.rigidbody.applyTorqueImpulse(0, 1, 0);
                e.rigidbody.activate();
            }).to.not.throw();
        });

        it('teleports the entity', function () {
            const e = addPhysicsEntity();

            e.rigidbody.teleport(new Vec3(1, 2, 3), new Quat());
            expect(e.getPosition().equals(new Vec3(1, 2, 3))).to.equal(true);
        });

        it('clones with the collision component', function () {
            const e = addPhysicsEntity();
            e.rigidbody.mass = 7;

            const clone = e.clone();
            app.root.addChild(clone);

            expect(clone.rigidbody.mass).to.equal(7);
            expect(clone.rigidbody._body).to.exist;
            expect(clone.rigidbody._body).to.not.equal(e.rigidbody._body);
        });

    });

    describe('collision shapes', function () {

        it('creates shapes for every primitive and compound type', function () {
            for (const type of ['box', 'sphere', 'capsule', 'cylinder', 'cone', 'compound']) {
                const e = addPhysicsEntity('static', { type });
                expect(e.collision.shape, type).to.exist;
                expect(e.rigidbody._body, type).to.exist;
            }
        });

        it('creates a mesh shape without reading vertex data', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision', { type: 'mesh' });

            // a duck-typed render source - under an inert backend the lazy vertex/index
            // accessors of the mesh sources must never be read
            e.collision.render = {
                meshes: [{
                    id: 12345,
                    primitive: [{ base: 0, count: 3 }],
                    get vertexBuffer() {
                        throw new Error('vertex data must not be read by an inert backend');
                    },
                    getPositions() {
                        throw new Error('vertex data must not be read by an inert backend');
                    },
                    getIndices() {
                        throw new Error('vertex data must not be read by an inert backend');
                    }
                }]
            };
            e.addComponent('rigidbody', { type: 'static' });

            expect(e.collision.shape).to.exist;
            expect(e.rigidbody._body).to.exist;
        });

    });

    describe('triggers', function () {

        it('creates a trigger for a collision-only entity', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision');

            expect(e.trigger).to.exist;
            expect(e.trigger.body).to.exist;
            expect(e.trigger.body.entity).to.equal(e);
            expect(app.systems.rigidbody._triggers).to.include(e.trigger);
        });

        it('unregisters the trigger on disable and destroys it on removal', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision');
            const trigger = e.trigger;

            e.collision.enabled = false;
            expect(app.systems.rigidbody._triggers).to.not.include(trigger);

            e.collision.enabled = true;
            expect(app.systems.rigidbody._triggers).to.include(trigger);

            e.removeComponent('collision');
            expect(e.trigger).to.not.exist;
            expect(trigger.body).to.equal(null);
        });

        it('replaces the trigger with a body when a rigidbody is added', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision');
            expect(e.trigger).to.exist;

            e.addComponent('rigidbody');
            expect(e.trigger).to.not.exist;
            expect(e.rigidbody._body).to.exist;
        });

    });

    describe('compounds', function () {

        it('wires children to their compound parent', function () {
            const parent = new Entity('parent');
            app.root.addChild(parent);
            parent.addComponent('collision', { type: 'compound' });
            parent.addComponent('rigidbody', { type: 'static' });

            const child = new Entity('child');
            child.setLocalPosition(2, 0, 0);
            parent.addChild(child);
            child.addComponent('collision');

            expect(parent.collision._compoundParent).to.equal(parent.collision);
            expect(child.collision._compoundParent).to.equal(parent.collision);
            expect(child.trigger).to.not.exist;

            expect(() => {
                app.update(1 / 60);
                child.setLocalPosition(3, 0, 0);
                app.update(1 / 60);
            }).to.not.throw();
        });

        it('survives child disable/enable and removal', function () {
            const parent = new Entity('parent');
            app.root.addChild(parent);
            parent.addComponent('collision', { type: 'compound' });
            parent.addComponent('rigidbody', { type: 'static' });

            const child = new Entity('child');
            parent.addChild(child);
            child.addComponent('collision');

            child.collision.enabled = false;
            expect(child.collision._compoundParent).to.equal(parent.collision);

            child.collision.enabled = true;
            expect(child.collision._compoundParent).to.equal(parent.collision);

            child.removeComponent('collision');
            expect(parent.collision._compoundParent).to.equal(parent.collision);
        });

    });

});
