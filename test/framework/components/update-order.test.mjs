import { expect } from 'chai';
import sinon from 'sinon';

import { AppBase } from '../../../src/framework/app-base.js';
import { AppOptions } from '../../../src/framework/app-options.js';
import { AnimComponentSystem } from '../../../src/framework/components/anim/system.js';
import { AudioListenerComponentSystem } from '../../../src/framework/components/audio-listener/system.js';
import { ButtonComponentSystem } from '../../../src/framework/components/button/system.js';
import { CameraComponentSystem } from '../../../src/framework/components/camera/system.js';
import { CollisionComponentSystem } from '../../../src/framework/components/collision/system.js';
import { ElementComponentSystem } from '../../../src/framework/components/element/system.js';
import { GSplatComponentSystem } from '../../../src/framework/components/gsplat/system.js';
import { JointComponentSystem } from '../../../src/framework/components/joint/system.js';
import { LayoutChildComponentSystem } from '../../../src/framework/components/layout-child/system.js';
import { LayoutGroupComponentSystem } from '../../../src/framework/components/layout-group/system.js';
import { LightComponentSystem } from '../../../src/framework/components/light/system.js';
import { ModelComponentSystem } from '../../../src/framework/components/model/system.js';
import { ParticleSystemComponentSystem } from '../../../src/framework/components/particle-system/system.js';
import { RenderComponentSystem } from '../../../src/framework/components/render/system.js';
import { RigidBodyComponentSystem } from '../../../src/framework/components/rigid-body/system.js';
import { ScreenComponentSystem } from '../../../src/framework/components/screen/system.js';
import { ScriptComponentSystem } from '../../../src/framework/components/script/system.js';
import { ScrollViewComponentSystem } from '../../../src/framework/components/scroll-view/system.js';
import { ScrollbarComponentSystem } from '../../../src/framework/components/scrollbar/system.js';
import { SoundComponentSystem } from '../../../src/framework/components/sound/system.js';
import { SpriteComponentSystem } from '../../../src/framework/components/sprite/system.js';
import { ComponentSystem } from '../../../src/framework/components/system.js';
import { ZoneComponentSystem } from '../../../src/framework/components/zone/system.js';
import { Entity } from '../../../src/framework/entity.js';
import { featureAnim } from '../../../src/framework/features/feature-anim.js';
import { featureParticles } from '../../../src/framework/features/feature-particles.js';
import { Script } from '../../../src/framework/script/script.js';
import { SoundManager } from '../../../src/platform/sound/manager.js';
import { createApp } from '../../app.mjs';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// every component system of the engine, in the order they handle the per-frame events: the order
// the application used to list them in
const engineOrder = [
    RigidBodyComponentSystem,
    CollisionComponentSystem,
    JointComponentSystem,
    AnimComponentSystem,
    ModelComponentSystem,
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    SoundComponentSystem,
    AudioListenerComponentSystem,
    ParticleSystemComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem,
    ButtonComponentSystem,
    ScrollViewComponentSystem,
    ScrollbarComponentSystem,
    SpriteComponentSystem,
    LayoutGroupComponentSystem,
    LayoutChildComponentSystem,
    ZoneComponentSystem,
    GSplatComponentSystem
];

describe('Component system order', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    // an application with only the given options, rather than everything the test app registers
    const createMinimalApp = (options) => {
        const canvas = document.createElement('canvas');
        const appOptions = new AppOptions();
        appOptions.graphicsDevice = createGraphicsDevice(canvas);
        appOptions.soundManager = new SoundManager();
        Object.assign(appOptions, options);

        const minimal = new AppBase(canvas);
        minimal.init(appOptions);
        return minimal;
    };

    const systemTypes = () => app.systems.list.map(system => system.constructor);

    it('gives every engine system a distinct order, in the order they used to be listed', function () {
        const orders = engineOrder.map(system => system.updateOrder);
        expect(orders).to.deep.equal([...orders].sort((a, b) => a - b));
        expect(new Set(orders).size).to.equal(orders.length);
    });

    it('creates the listed systems in their order, whatever order they are listed in', function () {
        const listed = engineOrder.filter(system => system !== AnimComponentSystem && system !== ParticleSystemComponentSystem);
        app = createMinimalApp({ componentSystems: [...listed].reverse() });

        expect(systemTypes()).to.deep.equal(listed);
    });

    it('creates the systems of features in their order among the listed systems', function () {
        app = createMinimalApp({
            features: [featureParticles, featureAnim],
            componentSystems: [SoundComponentSystem, ScriptComponentSystem, RigidBodyComponentSystem]
        });

        expect(systemTypes()).to.deep.equal([
            RigidBodyComponentSystem,
            AnimComponentSystem,
            ScriptComponentSystem,
            SoundComponentSystem,
            ParticleSystemComponentSystem
        ]);
    });

    it('creates the systems of the test application in the engine order', function () {
        app = createApp();

        expect(systemTypes()).to.deep.equal(engineOrder);
    });

    it('creates a system installed by a feature and also listed once', function () {
        app = createMinimalApp({
            features: [featureParticles],
            componentSystems: [ParticleSystemComponentSystem, ScriptComponentSystem]
        });

        expect(systemTypes()).to.deep.equal([ScriptComponentSystem, ParticleSystemComponentSystem]);
    });

    describe('custom systems', function () {

        class FirstComponentSystem extends ComponentSystem {
            constructor(app) {
                super(app);
                this.id = 'first';
            }
        }

        class SecondComponentSystem extends ComponentSystem {
            constructor(app) {
                super(app);
                this.id = 'second';
            }
        }

        class EarlyComponentSystem extends ComponentSystem {
            static updateOrder = ScriptComponentSystem.updateOrder - 50;

            constructor(app) {
                super(app);
                this.id = 'early';
            }
        }

        it('run after the script system by default, in the order they are listed', function () {
            app = createMinimalApp({
                features: [featureParticles],
                componentSystems: [SecondComponentSystem, FirstComponentSystem, ScriptComponentSystem]
            });

            expect(systemTypes()).to.deep.equal([
                ScriptComponentSystem,
                SecondComponentSystem,
                FirstComponentSystem,
                ParticleSystemComponentSystem
            ]);
        });

        it('run in the order they set', function () {
            app = createMinimalApp({
                componentSystems: [ScriptComponentSystem, EarlyComponentSystem, LightComponentSystem]
            });

            expect(systemTypes()).to.deep.equal([LightComponentSystem, EarlyComponentSystem, ScriptComponentSystem]);
        });
    });

    // particles are emitted from the transform of their entity, so they must be simulated after the
    // scripts which move it, in the same frame, also when a feature installs their system
    it('updates particle systems after scripts, with the transforms scripts set in the frame', function () {
        // the null device creates no emitters, so the update of the particle system records the
        // position of the entity it would emit from
        const positions = [];
        let entity = null;
        sinon.stub(ParticleSystemComponentSystem.prototype, 'onUpdate').callsFake(() => {
            positions.push(entity.getPosition().x);
        });

        app = createMinimalApp({
            features: [featureParticles],
            componentSystems: [ScriptComponentSystem]
        });

        class Mover extends Script {
            static scriptName = 'mover';

            update() {
                this.entity.setPosition(10, 0, 0);
            }
        }

        entity = new Entity('Emitter', app);
        app.root.addChild(entity);
        entity.addComponent('script');
        entity.script.create(Mover);
        entity.addComponent('particlesystem');

        app.start();
        app.update(1 / 60);

        expect(positions).to.deep.equal([10]);
    });
});
