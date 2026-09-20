import { expect } from 'chai';
import { restore, spy } from 'sinon';

import { Vec3 } from '../../../../src/core/math/vec3.js';
import { Entity } from '../../../../src/framework/entity.js';
import { NullPhysicsWorld } from '../../../../src/framework/physics/null/null-physics-world.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('RigidBodyComponentSystem', function () {
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

    describe('stored collisions', function () {

        // Regression test for https://github.com/playcanvas/engine/issues/5797 - the persistent
        // collisions map is keyed by entity GUID. Reloading the same scene recreates entities with
        // the same GUIDs, so a stale entry referencing a destroyed entity must not survive removal,
        // otherwise its triggerleave / collisionend events would never fire again.
        it('discards stored collisions when the collision component is removed', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision');

            app.systems.rigidbody.collisions[e.guid] = { entity: e, others: [new Entity()] };

            e.removeComponent('collision');

            expect(app.systems.rigidbody.collisions[e.guid]).to.be.undefined;
        });

        it('discards stored collisions when the entity is destroyed', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision');

            const guid = e.guid;
            app.systems.rigidbody.collisions[guid] = { entity: e, others: [] };

            e.destroy();

            expect(app.systems.rigidbody.collisions[guid]).to.be.undefined;
        });

        it('leaves collisions keyed to other entities untouched', function () {
            const a = new Entity();
            const b = new Entity();
            app.root.addChild(a);
            app.root.addChild(b);
            a.addComponent('collision');
            b.addComponent('collision');

            app.systems.rigidbody.collisions[a.guid] = { entity: a, others: [b] };
            app.systems.rigidbody.collisions[b.guid] = { entity: b, others: [a] };

            a.removeComponent('collision');

            expect(app.systems.rigidbody.collisions[a.guid]).to.be.undefined;
            expect(app.systems.rigidbody.collisions[b.guid]).to.exist;
        });

    });


    describe('contact points', function () {

        it('reverses a contact by swapping sides and flipping the normal', function () {
            const system = app.systems.rigidbody;
            system.setPhysicsWorld(new NullPhysicsWorld());

            const forward = system.contactPointPool.allocate();
            forward.localPoint.set(1, 2, 3);
            forward.localPointOther.set(4, 5, 6);
            forward.point.set(7, 8, 9);
            forward.pointOther.set(10, 11, 12);
            forward.normal.set(0, 1, 0);
            forward.impulse = 0.5;

            const reverse = system._createReverseContactPoint(forward);

            expect(reverse.localPoint.equals(new Vec3(4, 5, 6))).to.be.true;
            expect(reverse.localPointOther.equals(new Vec3(1, 2, 3))).to.be.true;
            expect(reverse.point.equals(new Vec3(10, 11, 12))).to.be.true;
            expect(reverse.pointOther.equals(new Vec3(7, 8, 9))).to.be.true;
            expect(reverse.normal.equals(new Vec3(0, -1, 0))).to.be.true;
            expect(reverse.impulse).to.equal(0.5);

            // the forward contact is left untouched
            expect(forward.normal.equals(new Vec3(0, 1, 0))).to.be.true;
        });
    });

    describe('stepping', function () {
        let world;

        beforeEach(function () {
            // createApp() installs no backend (Ammo is not loaded in tests), so install the
            // no-op world by hand to hook the system up to the per-frame update
            world = new NullPhysicsWorld();
            app.systems.rigidbody.setPhysicsWorld(world);
        });

        afterEach(function () {
            restore();
        });

        it('steps the world once per update by default', function () {
            const system = app.systems.rigidbody;
            const step = spy(world, 'step');

            expect(system.timeScale).to.equal(1);

            app.update(1 / 60);

            expect(step.calledOnce).to.be.true;
            expect(step.firstCall.args).to.deep.equal([1 / 60, system.maxSubSteps, system.fixedTimeStep]);
        });

        it('scales the delta passed to the world by the time scale', function () {
            const system = app.systems.rigidbody;
            const step = spy(world, 'step');

            system.timeScale = 0.5;
            app.update(1 / 60);

            expect(step.calledOnce).to.be.true;
            expect(step.firstCall.args[0]).to.be.closeTo(1 / 120, 1e-12);
        });

        it('skips the whole simulation update when the time scale is 0', function () {
            const setGravity = spy(world, 'setGravity');
            const step = spy(world, 'step');
            const flushContacts = spy(world, 'flushContacts');

            app.systems.rigidbody.timeScale = 0;
            app.update(1 / 60);
            app.update(1 / 60);

            expect(setGravity.called).to.be.false;
            expect(step.called).to.be.false;
            expect(flushContacts.called).to.be.false;
        });

        it('resumes automatic stepping when the time scale is restored', function () {
            const step = spy(world, 'step');

            app.systems.rigidbody.timeScale = 0;
            app.update(1 / 60);
            app.systems.rigidbody.timeScale = 1;
            app.update(1 / 60);

            expect(step.calledOnce).to.be.true;
        });

        it('treats a negative time scale as paused', function () {
            const step = spy(world, 'step');

            app.systems.rigidbody.timeScale = -1;
            app.update(1 / 60);

            expect(step.called).to.be.false;
        });

        it('advances the world through step() while paused, without scaling the delta', function () {
            const system = app.systems.rigidbody;
            const step = spy(world, 'step');
            const flushContacts = spy(world, 'flushContacts');

            system.timeScale = 0;
            system.step(0.01);

            expect(step.calledOnce).to.be.true;
            expect(step.firstCall.args).to.deep.equal([0.01, system.maxSubSteps, system.fixedTimeStep]);
            expect(flushContacts.calledOnce).to.be.true;
        });
    });

    describe('gravity', function () {

        afterEach(function () {
            restore();
        });

        it('applies the current gravity to the backend when it is installed', function () {
            const world = new NullPhysicsWorld();
            const setGravity = spy(world, 'setGravity');

            app.systems.rigidbody.gravity.set(0, -3.7, 0);
            app.systems.rigidbody.setPhysicsWorld(world);

            expect(setGravity.calledOnce).to.be.true;
            expect(setGravity.firstCall.args[0].equals(new Vec3(0, -3.7, 0))).to.be.true;
        });

        it('leaves the backend alone on steps where gravity is unchanged', function () {
            const world = new NullPhysicsWorld();
            app.systems.rigidbody.setPhysicsWorld(world);
            const setGravity = spy(world, 'setGravity');

            app.update(1 / 60);
            app.update(1 / 60);

            expect(setGravity.called).to.be.false;
        });

        it('applies a gravity vector modified in place at the start of the next step', function () {
            const world = new NullPhysicsWorld();
            const system = app.systems.rigidbody;
            system.setPhysicsWorld(world);
            const setGravity = spy(world, 'setGravity');
            const step = spy(world, 'step');

            system.gravity.set(0, -1, 0);
            app.update(1 / 60);

            expect(setGravity.calledOnce).to.be.true;
            expect(setGravity.firstCall.args[0].equals(new Vec3(0, -1, 0))).to.be.true;
            expect(setGravity.calledBefore(step)).to.be.true;

            // unchanged since it was applied, so the following step does not repeat the call
            app.update(1 / 60);

            expect(setGravity.calledOnce).to.be.true;
        });

        it('applies a gravity vector replaced by assignment', function () {
            const world = new NullPhysicsWorld();
            const system = app.systems.rigidbody;
            system.setPhysicsWorld(world);
            const setGravity = spy(world, 'setGravity');

            system.gravity = new Vec3(1, 2, 3);
            app.update(1 / 60);

            expect(setGravity.calledOnce).to.be.true;
            expect(setGravity.firstCall.args[0].equals(new Vec3(1, 2, 3))).to.be.true;
        });

        it('applies gravity changed while paused on the next manual step', function () {
            const world = new NullPhysicsWorld();
            const system = app.systems.rigidbody;
            system.setPhysicsWorld(world);
            const setGravity = spy(world, 'setGravity');

            system.timeScale = 0;
            system.gravity.set(0, 0, 0);
            app.update(1 / 60);

            expect(setGravity.called).to.be.false;

            system.step(1 / 60);

            expect(setGravity.calledOnce).to.be.true;
            expect(setGravity.firstCall.args[0].equals(Vec3.ZERO)).to.be.true;
        });
    });

    describe('rigid body removal', function () {

        // Regression tests for https://github.com/playcanvas/engine/issues/2195. Removing the
        // rigid body left the collision component with a shape and no body, so it neither
        // reported contacts nor acted as a trigger until the entity was toggled.

        let world;

        beforeEach(function () {
            world = new NullPhysicsWorld();
            app.systems.rigidbody.setPhysicsWorld(world);
        });

        function createBody(name, parent = app.root, rigidbodyFirst = false) {
            const entity = new Entity(name);
            if (rigidbodyFirst) {
                entity.addComponent('rigidbody', { type: 'dynamic', mass: 1 });
            }
            entity.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.5, 0.5, 0.5) });
            if (!rigidbodyFirst) {
                entity.addComponent('rigidbody', { type: 'dynamic', mass: 1 });
            }
            parent.addChild(entity);
            return entity;
        }

        it('turns the collision component into a trigger', function () {
            const entity = createBody('body');
            expect(entity.trigger).to.be.undefined;

            entity.removeComponent('rigidbody');

            expect(entity.rigidbody).to.be.undefined;
            expect(entity.trigger).to.exist;
            expect(entity.collision.shape).to.exist;
            expect(app.systems.rigidbody._triggers).to.include(entity.trigger);
        });

        it('joins an enclosing compound instead when there is one', function () {
            const root = new Entity('root');
            root.addComponent('collision', { type: 'compound' });
            root.addComponent('rigidbody', { type: 'dynamic', mass: 1 });
            app.root.addChild(root);

            // a body of its own inside the compound's hierarchy is not a compound child...
            const part = createBody('part', root);
            expect(part.collision._compoundParent).to.be.null;

            // ...until it stops being a body
            part.removeComponent('rigidbody');

            expect(part.collision._compoundParent).to.equal(root.collision);
            expect(part.trigger).to.be.undefined;
        });

        it('forgets the pairs the body was touching', function () {
            const entity = createBody('body');
            const other = createBody('other');
            app.systems.rigidbody.collisions[entity.guid] = { entity: entity, others: [other] };

            entity.removeComponent('rigidbody');

            expect(app.systems.rigidbody.collisions[entity.guid]).to.be.undefined;
        });

        it('does not rebuild anything for an entity that is being destroyed', function () {
            // components are removed in the order they were added, so the collision component
            // is still attached when the rigid body's removal is processed
            const entity = createBody('doomed', app.root, true);
            const rebuild = spy(app.systems.collision, 'recreatePhysicalShapes');
            const triggers = app.systems.rigidbody._triggers.length;

            entity.destroy();

            expect(rebuild.called).to.be.false;
            expect(app.systems.rigidbody._triggers.length).to.equal(triggers);
            restore();
        });

        it('does nothing when no backend is installed', function () {
            // a second application without a world
            const bare = createApp();
            try {
                const entity = new Entity('bare', bare);
                entity.addComponent('collision', { type: 'box' });
                entity.addComponent('rigidbody', { type: 'dynamic' });
                bare.root.addChild(entity);

                expect(() => entity.removeComponent('rigidbody')).to.not.throw();
                expect(entity.trigger).to.be.undefined;
            } finally {
                bare.destroy();
            }
        });
    });

    it('ignores step() when no physics backend is installed', function () {
        expect(app.systems.rigidbody.physicsWorld).to.be.null;
        expect(() => app.systems.rigidbody.step(1 / 60)).to.not.throw();
    });

});
