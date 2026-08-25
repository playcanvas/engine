import { expect } from 'chai';

import { Curve } from '../../../src/core/math/curve.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { Entity } from '../../../src/framework/entity.js';
import { EMITTERSHAPE_SPHERE } from '../../../src/scene/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

describe('ParticleEmitter', function () {
    /** @type {Application} */
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // the null device skips particle systems by default - enable them so the emitter is created
        app.graphicsDevice.disableParticleSystem = false;
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    /**
     * @param {object} [options] - Particle system component options.
     * @param {boolean} [gpu] - Whether the emitter simulates on the GPU.
     * @returns {import('../../../src/scene/particle-system/particle-emitter.js').ParticleEmitter} The emitter.
     */
    const createEmitter = (options = {}, gpu = true) => {
        app.graphicsDevice.supportsGpuParticles = gpu;
        const entity = new Entity();
        entity.addComponent('particlesystem', { numParticles: 10, ...options });
        app.root.addChild(entity);
        return entity.particlesystem.emitter;
    };

    describe('#localBounds', function () {

        it('grows when emitterExtents is replaced', function () {
            const emitter = createEmitter({ emitterExtents: new Vec3(1, 1, 1) });
            const before = emitter.localBounds.halfExtents.x;

            emitter.node.particlesystem.emitterExtents = new Vec3(100, 100, 100);
            emitter.addTime(0.1, false);

            expect(emitter.localBounds.halfExtents.x).to.be.above(before + 40);
        });

        it('grows when emitterExtents is modified in place', function () {
            const emitter = createEmitter({ emitterExtents: new Vec3(1, 1, 1) });
            const before = emitter.localBounds.halfExtents.x;

            // the extents are handed to the emitter by reference, so an in place change must be
            // detected as well
            emitter.node.particlesystem.emitterExtents.set(100, 100, 100);
            emitter.addTime(0.1, false);

            expect(emitter.localBounds.halfExtents.x).to.be.above(before + 40);
        });

        it('grows when emitterRadius changes on a sphere emitter', function () {
            const emitter = createEmitter({ emitterShape: EMITTERSHAPE_SPHERE, emitterRadius: 1 });
            const before = emitter.localBounds.halfExtents.x;

            emitter.node.particlesystem.emitterRadius = 100;
            emitter.addTime(0.1, false);

            expect(emitter.localBounds.halfExtents.x).to.be.above(before + 40);
        });

        it('grows when emitterExtents changes on a CPU emitter', function () {
            const emitter = createEmitter({ emitterExtents: new Vec3(1, 1, 1) }, false);
            expect(emitter.useCpu).to.be.true;
            const before = emitter.localBounds.halfExtents.x;

            emitter.node.particlesystem.emitterExtents = new Vec3(100, 100, 100);
            emitter.addTime(0.1, false);

            expect(emitter.localBounds.halfExtents.x).to.be.above(before + 40);
            expect(emitter.meshInstance.aabb.halfExtents.x).to.be.above(before + 40);
        });

        it('is not recalculated while the spawn volume is unchanged', function () {
            const emitter = createEmitter({ emitterExtents: new Vec3(1, 1, 1) });

            emitter.node.particlesystem.emitterExtents = new Vec3(100, 100, 100);
            emitter.addTime(0.1, false);

            let calls = 0;
            const calculateLocalBounds = emitter.calculateLocalBounds.bind(emitter);
            emitter.calculateLocalBounds = () => {
                calls++;
                calculateLocalBounds();
            };

            for (let i = 0; i < 5; i++) {
                emitter.addTime(0.1, false);
            }

            expect(calls).to.equal(0);
        });

        it('grows when the scale curve changes', function () {
            const emitter = createEmitter();
            const before = emitter.localBounds.halfExtents.x;

            emitter.node.particlesystem.scaleGraph = new Curve([0, 100, 1, 100]);

            expect(emitter.localBounds.halfExtents.x).to.be.above(before + 40);
        });

        it('grows when only the secondary scale curve changes', function () {
            const emitter = createEmitter();
            const before = emitter.localBounds.halfExtents.x;

            // the rendered size is interpolated between both scale curves
            emitter.node.particlesystem.scaleGraph2 = new Curve([0, 100, 1, 100]);

            expect(emitter.localBounds.halfExtents.x).to.be.above(before + 40);
        });

        it('covers the magnitude of a negative scale curve', function () {
            const emitter = createEmitter();

            // a negative scale mirrors the particle without shrinking it
            emitter.node.particlesystem.scaleGraph = new Curve([0, -100, 1, -100]);

            expect(emitter.localBounds.halfExtents.x).to.be.above(40);
        });
    });
});
