import { expect } from 'chai';

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
});
