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
