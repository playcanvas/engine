import { expect } from 'chai';

import { GSplatDirector } from '../../../src/scene/gsplat-unified/gsplat-director.js';
import { Layer } from '../../../src/scene/layer.js';

describe('GSplatDirector#update', function () {

    // A stand-in for the manager of one camera and layer. It records the placements it is reconciled
    // with, and runs a callback once from its update, where frame:ready listeners run.
    const makeManager = () => ({
        reconciled: [],
        onUpdate: null,
        bufferCopyUploaded: 0,
        bufferCopyTotal: 0,
        reconcile(placements) {
            this.reconciled.push([...placements]);
        },
        update() {
            const callback = this.onUpdate;
            this.onUpdate = null;
            callback?.();
            return 0;
        }
    });

    // A camera rendering the layer, with its manager already in place, so no graphics resources are
    // needed.
    const addCamera = (director, layer) => {
        const camera = { layers: [layer.id], layersSet: new Set([layer.id]) };
        const manager = makeManager();
        const layerData = {
            gsplatManager: manager,
            gsplatManagerShadow: null,
            updateConfiguration() {},
            destroy() {}
        };
        director.camerasMap.set(camera, {
            layersMap: new Map([[layer, layerData]]),
            getLayerData: () => layerData,
            removeLayerData() {},
            destroy() {}
        });
        return { camera, manager };
    };

    const makeScene = (numCameras) => {
        const director = new GSplatDirector(null, {}, null, null, { frameEnd() {} });
        const layer = new Layer({ name: 'World' });
        const cameras = [];
        for (let i = 0; i < numCameras; i++) {
            cameras.push(addCamera(director, layer));
        }
        const comp = {
            cameras: cameras.map(c => ({ camera: c.camera })),
            camerasSet: new Set(cameras.map(c => c.camera)),
            layerList: [layer],
            getLayerById: id => (id === layer.id ? layer : null)
        };
        return { director, layer, comp, managers: cameras.map(c => c.manager) };
    };

    it('reconciles a placement added while the managers update', function () {
        const { director, layer, comp, managers: [manager] } = makeScene(1);
        const first = {};
        const second = {};
        layer.addGSplatPlacement(first);
        manager.onUpdate = () => layer.addGSplatPlacement(second);

        director.update(comp);
        director.update(comp);
        expect(manager.reconciled.at(-1)).to.have.ordered.members([first, second]);
    });

    it('reconciles a placement removed while the managers update', function () {
        const { director, layer, comp, managers: [manager] } = makeScene(1);
        const first = {};
        const second = {};
        layer.addGSplatPlacement(first);
        layer.addGSplatPlacement(second);
        manager.onUpdate = () => layer.removeGSplatPlacement(second);

        director.update(comp);
        director.update(comp);
        expect(manager.reconciled.at(-1)).to.have.ordered.members([first]);
    });

    it('reconciles such a change for every camera', function () {
        const { director, layer, comp, managers } = makeScene(2);
        const first = {};
        const second = {};
        layer.addGSplatPlacement(first);
        managers[0].onUpdate = () => layer.addGSplatPlacement(second);

        // a camera updated later in the same frame can pick the change up a frame early, but no
        // camera misses it
        director.update(comp);
        director.update(comp);
        for (const manager of managers) {
            expect(manager.reconciled.at(-1)).to.have.ordered.members([first, second]);
        }
    });

    it('does not reconcile again when nothing changed', function () {
        const { director, layer, comp, managers: [manager] } = makeScene(1);
        layer.addGSplatPlacement({});

        director.update(comp);
        director.update(comp);
        expect(manager.reconciled).to.have.lengthOf(1);
    });
});

describe('GSplatDirector#updateStreaming', function () {

    // A stand-in for the manager of one camera and layer. It logs the calls the streaming tick makes
    // and records the placements it is reconciled with.
    const makeManager = calls => ({
        reconciled: [],
        hasPendingSort: false,
        reconcile(placements) {
            calls.push('reconcile');
            this.reconciled.push([...placements]);
        },
        updateStreaming() {
            calls.push('updateStreaming');
            return false;
        }
    });

    // A camera rendering the layer, with its managers in place from an earlier render, and the
    // layer's placement changes consumed by that render.
    const makeScene = ({ shadowManager = false } = {}) => {
        const director = new GSplatDirector({ on() {} }, {}, null, { fire() {} }, { frameUpdate() {} });
        const layer = new Layer({ name: 'World' });
        const calls = [];
        const layerData = {
            gsplatManager: makeManager(calls),
            gsplatManagerShadow: shadowManager ? makeManager(calls) : null
        };
        const camera = { node: {} };
        camera.node.camera = { camera };
        director.camerasMap.set(camera, { layersMap: new Map([[layer, layerData]]) });
        layer.gsplatPlacementsDirty = false;
        return { director, layer, layerData, calls };
    };

    it('reconciles a replaced placement before the world state is rebuilt', function () {
        const { director, layer, layerData, calls } = makeScene();
        const replaced = {};
        const replacement = {};

        // the last render reconciled this placement
        layer.addGSplatPlacement(replaced);
        layer.gsplatPlacementsDirty = false;

        // replacing a gsplat's asset removes its placement and adds a new one
        layer.removeGSplatPlacement(replaced);
        layer.addGSplatPlacement(replacement);

        director.updateStreaming();
        expect(calls).to.deep.equal(['reconcile', 'updateStreaming']);
        expect(layerData.gsplatManager.reconciled.at(-1)).to.have.ordered.members([replacement]);
    });

    it('reconciles the shadow manager with the shadow casters', function () {
        const { director, layer, layerData } = makeScene({ shadowManager: true });
        const placement = {};
        const caster = {};
        layer.addGSplatPlacement(placement);
        layer.addGSplatShadowCaster(caster);

        director.updateStreaming();
        expect(layerData.gsplatManager.reconciled.at(-1)).to.have.ordered.members([placement]);
        expect(layerData.gsplatManagerShadow.reconciled.at(-1)).to.have.ordered.members([caster]);
    });

    it('leaves the change for the render path to consume', function () {
        const { director, layer } = makeScene();
        layer.addGSplatPlacement({});

        director.updateStreaming();
        expect(layer.gsplatPlacementsDirty).to.equal(true);
    });

    it('does not reconcile when nothing changed', function () {
        const { director, calls } = makeScene();

        director.updateStreaming();
        expect(calls).to.deep.equal(['updateStreaming']);
    });
});
