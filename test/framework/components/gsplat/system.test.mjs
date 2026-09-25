import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { AppBase } from '../../../../src/framework/app-base.js';
import { AppOptions } from '../../../../src/framework/app-options.js';
import { CameraComponentSystem } from '../../../../src/framework/components/camera/system.js';
import { GSplatComponentSystem } from '../../../../src/framework/components/gsplat/system.js';
import { Entity } from '../../../../src/framework/entity.js';
import { LayerComposition } from '../../../../src/scene/composition/layer-composition.js';
import { LAYERID_WORLD } from '../../../../src/scene/constants.js';
import { GSplatParams } from '../../../../src/scene/gsplat-unified/gsplat-params.js';
import { createGraphicsDevice } from '../../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('GSplatComponentSystem', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
        restore();
    });

    const createApp = (componentSystems) => {
        const canvas = document.createElement('canvas');
        const options = new AppOptions();
        options.graphicsDevice = createGraphicsDevice(canvas);
        options.resourceHandlers = [];
        options.componentSystems = componentSystems;

        app = new AppBase(canvas);
        app.init(options);
    };

    it('leaves scene GSplat parameters uninitialized when the system is omitted', function () {
        createApp([]);

        expect(app.scene.getGsplatParams()).to.equal(null);
    });

    it('asserts when public GSplat parameters are accessed without the system', function () {
        createApp([]);
        const errorSpy = stub(console, 'error');

        expect(app.scene.gsplat).to.equal(null);
        expect(errorSpy.calledWith(
            'ASSERT FAILED: ',
            'Scene#gsplat requires GSplatComponentSystem to be included in the app.'
        )).to.be.true;
    });

    it('owns the scene GSplat parameters for its lifetime', function () {
        createApp([GSplatComponentSystem]);

        expect(app.scene.gsplat).to.be.an.instanceof(GSplatParams);
        expect(app.renderer.gsplatDirector).not.to.equal(null);

        app.systems.gsplat.destroy();

        expect(app.scene.getGsplatParams()).to.equal(null);
        expect(app.renderer.gsplatDirector).to.equal(null);
    });

    it('defaults to a behind-camera LOD penalty that re-evaluates on rotation', function () {
        createApp([GSplatComponentSystem]);

        expect(app.scene.gsplat.lodBehindPenalty).to.equal(1.5);
        expect(app.scene.gsplat.lodUpdateAngle).to.equal(90);
    });

    describe('streaming tick', function () {

        beforeEach(function () {
            createApp([CameraComponentSystem, GSplatComponentSystem]);
        });

        const createCamera = () => {
            const entity = new Entity();
            entity.addComponent('camera');
            app.root.addChild(entity);
            return entity;
        };

        // Registers a stub manager for the camera on the world layer, as the last render would
        // have, recording the gsplat params dirty flag each time the tick streams it.
        const addManager = (entity) => {
            const manager = {
                hasPendingSort: false,
                dirtySeen: [],
                updateStreaming() {
                    this.dirtySeen.push(app.scene.gsplat.dirty);
                    return false;
                }
            };
            const layer = app.scene.layers.getLayerById(LAYERID_WORLD);
            app.renderer.gsplatDirector.camerasMap.set(entity.camera.camera, {
                layersMap: new Map([[layer, { gsplatManager: manager, gsplatManagerShadow: null }]]),
                destroy() {}
            });
            return manager;
        };

        it('streams the managers of a camera', function () {
            const manager = addManager(createCamera());

            app.fire('framerender');

            expect(manager.dirtySeen).to.have.lengthOf(1);
        });

        it('skips a camera whose entity was destroyed after the last render', function () {
            const entity = createCamera();
            const manager = addManager(entity);

            entity.destroy();
            app.fire('framerender');

            expect(manager.dirtySeen).to.have.lengthOf(0);
        });

        it('skips a camera whose camera component was removed after the last render', function () {
            const entity = createCamera();
            const manager = addManager(entity);

            entity.removeComponent('camera');
            app.fire('framerender');

            expect(manager.dirtySeen).to.have.lengthOf(0);
        });

        it('skips a destroyed camera after the layer composition is replaced', function () {
            const entity = createCamera();
            const manager = addManager(entity);

            // the layers of the replaced composition still list the camera
            app.scene.layers = new LayerComposition();
            entity.destroy();
            app.fire('framerender');

            expect(manager.dirtySeen).to.have.lengthOf(0);
        });

        it('streams a disabled camera, so it sees gsplat parameter changes', function () {
            const disabled = createCamera();
            const disabledManager = addManager(disabled);
            const enabledManager = addManager(createCamera());

            disabled.enabled = false;
            app.scene.gsplat.splatBudget += 1000;
            app.fire('framerender');

            expect(disabledManager.dirtySeen).to.deep.equal([true]);
            expect(enabledManager.dirtySeen).to.deep.equal([true]);
            expect(app.scene.gsplat.dirty).to.equal(false);
        });
    });
});
