import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { AppBase } from '../../../src/framework/app-base.js';
import { AppOptions } from '../../../src/framework/app-options.js';
import { CollisionComponentSystem } from '../../../src/framework/components/collision/system.js';
import { RigidBodyComponentSystem } from '../../../src/framework/components/rigid-body/system.js';
import { Entity } from '../../../src/framework/entity.js';
import { NullPhysicsWorld } from '../../../src/framework/physics/null/null-physics-world.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('AppOptions.physicsWorld', function () {
    let app;

    // Constructs an AppBase directly (rather than via the batteries-included Application) so
    // the test controls the AppOptions instance and its physicsWorld field.
    function createAppBase(physicsWorld) {
        const canvas = document.createElement('canvas');
        const appBase = new AppBase(canvas);
        const options = new AppOptions();
        options.graphicsDevice = new NullGraphicsDevice(canvas);
        options.componentSystems = [RigidBodyComponentSystem, CollisionComponentSystem];
        options.resourceHandlers = [];
        options.physicsWorld = physicsWorld;
        appBase.init(options);
        return appBase;
    }

    beforeEach(function () {
        jsdomSetup();
    });

    afterEach(function () {
        restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    it('installs the world during application init', function () {
        const world = new NullPhysicsWorld();
        app = createAppBase(world);

        expect(app.systems.rigidbody.physicsWorld).to.equal(world);
    });

    it('registers the rigid body system as the contact listener', function () {
        const world = new NullPhysicsWorld();
        app = createAppBase(world);

        expect(world.contactListener).to.equal(app.systems.rigidbody);
    });

    it('skips Ammo auto-detection when a world is injected', function () {
        const world = new NullPhysicsWorld();
        app = createAppBase(world);

        // any use of this stub by the Ammo backend would throw
        globalThis.Ammo = {};
        try {
            // start() fires onLibrariesLoaded, the trigger for Ammo auto-detection
            expect(() => app.start()).to.not.throw();
            expect(app.systems.rigidbody.physicsWorld).to.equal(world);
        } finally {
            delete globalThis.Ammo;
        }
    });

    it('creates component bodies through the injected world', function () {
        const world = new NullPhysicsWorld();
        app = createAppBase(world);

        const createBody = spy(world, 'createBody');
        const step = spy(world, 'step');

        const entity = new Entity();
        app.root.addChild(entity);
        entity.addComponent('rigidbody', { type: 'dynamic' });
        entity.addComponent('collision');

        expect(createBody.calledOnce).to.be.true;
        expect(createBody.firstCall.args[0].entity).to.equal(entity);

        app.update(1 / 60);
        expect(step.calledOnce).to.be.true;
    });

    it('asserts when a second world is installed', function () {
        const world = new NullPhysicsWorld();
        app = createAppBase(world);

        const assert = stub(Debug, 'assert');
        app.systems.rigidbody.setPhysicsWorld(new NullPhysicsWorld());

        expect(assert.called).to.be.true;
        expect(assert.firstCall.args[0]).to.not.be.ok;
    });

    it('destroys the world with the application', function () {
        const world = new NullPhysicsWorld();
        app = createAppBase(world);

        const destroy = spy(world, 'destroy');
        app.destroy();
        app = null;

        expect(destroy.calledOnce).to.be.true;
    });
});
