import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { Entity } from '../../../src/framework/entity.js';
import { NullPhysicsWorld } from '../../../src/framework/physics/null/null-physics-world.js';
import { PhysicsBody } from '../../../src/framework/physics/physics-body.js';
import { PhysicsJoint } from '../../../src/framework/physics/physics-joint.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('NullPhysicsWorld', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('installation', function () {

        it('is not installed by default', function () {
            expect(app.systems.rigidbody.physicsWorld).to.equal(null);
            expect(app.systems.rigidbody.dynamicsWorld).to.equal(null);
        });

        it('installs via setPhysicsWorld', function () {
            const world = new NullPhysicsWorld();
            app.systems.rigidbody.setPhysicsWorld(world);

            expect(app.systems.rigidbody.physicsWorld).to.equal(world);
            // the native escape hatch stays null for backends without a native world
            expect(app.systems.rigidbody.dynamicsWorld).to.equal(null);
        });

        it('steps the update loop without a native backend', function () {
            app.systems.rigidbody.setPhysicsWorld(new NullPhysicsWorld());

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision');
            e.addComponent('rigidbody', { type: 'dynamic' });

            expect(() => {
                app.update(1 / 60);
                app.update(1 / 60);
            }).to.not.throw();
        });

    });

    describe('inert operations', function () {

        let world;

        beforeEach(function () {
            world = new NullPhysicsWorld();
            app.systems.rigidbody.setPhysicsWorld(world);
        });

        it('misses all raycasts', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision');
            e.addComponent('rigidbody');

            const start = new Vec3(0, 10, 0);
            const end = new Vec3(0, -10, 0);
            expect(app.systems.rigidbody.raycastFirst(start, end)).to.equal(null);
            expect(app.systems.rigidbody.raycastAll(start, end)).to.deep.equal([]);
            expect(app.systems.rigidbody.raycastFirst(start, end, { filterCallback: () => true })).to.equal(null);
        });

        it('creates identity-distinct opaque shape handles', function () {
            const a = world.createShape({ type: 'box', halfExtents: new Vec3(1, 1, 1) });
            const b = world.createShape({ type: 'box', halfExtents: new Vec3(1, 1, 1) });

            expect(a).to.exist;
            expect(b).to.exist;
            expect(a).to.not.equal(b);
            expect(world.getCompoundChildCount(a)).to.equal(0);
        });

        it('creates inert bodies carrying their entity', function () {
            const entity = new Entity();
            const body = world.createBody({
                type: 'dynamic',
                mass: 1,
                shape: world.createShape({ type: 'sphere', radius: 1 }),
                position: new Vec3(),
                rotation: app.root.getRotation(),
                entity: entity
            });

            expect(body).to.be.an.instanceof(PhysicsBody);
            expect(body.entity).to.equal(entity);
            expect(body.nativeBody).to.equal(null);
            expect(body.isActive()).to.equal(false);
        });

        it('creates inert joints', function () {
            const joint = world.createJoint({});

            expect(joint).to.be.an.instanceof(PhysicsJoint);
            expect(joint.nativeJoint).to.equal(null);
            expect(joint.isBroken()).to.equal(false);
            expect(joint.updateLimits({})).to.equal(false);
        });

    });

    describe('joint component lifecycle', function () {

        let bodyA, bodyB, jointEntity;

        beforeEach(function () {
            app.systems.rigidbody.setPhysicsWorld(new NullPhysicsWorld());

            const addBody = (name) => {
                const e = new Entity(name);
                app.root.addChild(e);
                e.addComponent('collision');
                e.addComponent('rigidbody', { type: 'dynamic' });
                return e;
            };
            bodyA = addBody('a');
            bodyB = addBody('b');

            jointEntity = new Entity('joint');
            app.root.addChild(jointEntity);
        });

        it('creates the joint once both bodies are in the simulation', function () {
            jointEntity.addComponent('joint', { type: 'hinge', entityA: bodyA, entityB: bodyB });

            expect(jointEntity.joint._joint).to.exist;
            // the native escape hatch stays null for backends without native constraints
            expect(jointEntity.joint.constraint).to.equal(null);
            expect(app.systems.joint._pending.has(jointEntity.joint)).to.equal(false);
        });

        it('tears the joint down on simulationdisabled and recreates it from the pending set', function () {
            jointEntity.addComponent('joint', { type: 'ball', entityA: bodyA, entityB: bodyB });
            const component = jointEntity.joint;

            bodyA.rigidbody.enabled = false;
            expect(component._joint).to.equal(null);
            expect(app.systems.joint._pending.has(component)).to.equal(true);

            bodyA.rigidbody.enabled = true;
            app.update(1 / 60); // pending joints are retried before the physics step
            expect(component._joint).to.exist;
            expect(app.systems.joint._pending.has(component)).to.equal(false);
        });

        it('never breaks a breakable joint', function () {
            jointEntity.addComponent('joint', { type: 'fixed', entityA: bodyA, entityB: bodyB, breakImpulse: 0.001 });
            const component = jointEntity.joint;

            expect(app.systems.joint._breakable.has(component)).to.equal(true);
            app.update(1 / 60);
            expect(component.isBroken).to.equal(false);
            expect(component._joint).to.exist;
        });

    });

});
