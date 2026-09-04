import { expect } from 'chai';
import { restore, spy } from 'sinon';

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

            expect(system.paused).to.be.false;

            app.update(1 / 60);

            expect(step.calledOnce).to.be.true;
            expect(step.firstCall.args).to.deep.equal([1 / 60, system.maxSubSteps, system.fixedTimeStep]);
        });

        it('skips the whole simulation update while paused', function () {
            const setGravity = spy(world, 'setGravity');
            const step = spy(world, 'step');
            const flushContacts = spy(world, 'flushContacts');

            app.systems.rigidbody.paused = true;
            app.update(1 / 60);
            app.update(1 / 60);

            expect(setGravity.called).to.be.false;
            expect(step.called).to.be.false;
            expect(flushContacts.called).to.be.false;
        });

        it('resumes automatic stepping when unpaused', function () {
            const step = spy(world, 'step');

            app.systems.rigidbody.paused = true;
            app.update(1 / 60);
            app.systems.rigidbody.paused = false;
            app.update(1 / 60);

            expect(step.calledOnce).to.be.true;
        });

        it('advances the world through step() while paused', function () {
            const system = app.systems.rigidbody;
            const setGravity = spy(world, 'setGravity');
            const step = spy(world, 'step');
            const flushContacts = spy(world, 'flushContacts');

            system.paused = true;
            system.step(0.01);

            expect(setGravity.calledOnce).to.be.true;
            expect(step.calledOnce).to.be.true;
            expect(step.firstCall.args).to.deep.equal([0.01, system.maxSubSteps, system.fixedTimeStep]);
            expect(flushContacts.calledOnce).to.be.true;
        });
    });

    it('ignores step() when no physics backend is installed', function () {
        expect(app.systems.rigidbody.physicsWorld).to.be.null;
        expect(() => app.systems.rigidbody.step(1 / 60)).to.not.throw();
    });

});
