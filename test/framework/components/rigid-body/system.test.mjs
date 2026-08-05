import { expect } from 'chai';

import { Entity } from '../../../../src/framework/entity.js';
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

});
