import { expect } from 'chai';

import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { GSPLAT_FORWARD } from '../../../src/scene/constants.js';
import { GSplatManager } from '../../../src/scene/gsplat-unified/gsplat-manager.js';
import { GSplatOctree } from '../../../src/scene/gsplat-unified/gsplat-octree.js';
import { GSplatOctreeResource } from '../../../src/scene/gsplat-unified/gsplat-octree.resource.js';
import { GSplatParams } from '../../../src/scene/gsplat-unified/gsplat-params.js';
import { GSplatPlacementStateTracker } from '../../../src/scene/gsplat-unified/gsplat-placement-state-tracker.js';

// A two-file octree with a single leaf, the root carrying the bound GSplatOctreeResource reads.
const makeOctreeData = (model) => {
    const data = {
        lodLevels: 2,
        filenames: ['fine.json', 'coarse.json'],
        tree: {
            bound: { min: [-1, -1, -1], max: [1, 1, 1] },
            children: [{
                bound: { min: [-1, -1, -1], max: [1, 1, 1] },
                lods: {
                    0: { file: 0, offset: 0, count: 100 },
                    1: { file: 1, offset: 0, count: 10 }
                }
            }]
        }
    };
    if (model !== undefined) {
        data.model = model;
    }
    return data;
};

const makeResource = (antiAlias = false) => ({
    antiAlias,
    numSplats: 10,
    centersVersion: 0,
    format: { extraStreamsVersion: 0 }
});

describe('GSplat anti-aliasing', function () {

    describe('GSplatParams#antiAlias', function () {
        let device;

        beforeEach(function () {
            device = new NullGraphicsDevice({ width: 1, height: 1 });
        });

        afterEach(function () {
            device.destroy();
        });

        it('defaults to undefined, so each splat follows its resource', function () {
            const params = new GSplatParams(device);
            expect(params.antiAlias).to.equal(undefined);
        });

        it('keeps true, false and undefined', function () {
            const params = new GSplatParams(device);
            params.antiAlias = true;
            expect(params.antiAlias).to.equal(true);
            params.antiAlias = false;
            expect(params.antiAlias).to.equal(false);
            params.antiAlias = undefined;
            expect(params.antiAlias).to.equal(undefined);
        });

        it('defaults the anti-aliasing filter size to 0.3 and keeps a new value', function () {
            const params = new GSplatParams(device);
            expect(params.antiAliasFilterSize).to.equal(0.1);
            params.antiAliasFilterSize = 0.3;
            expect(params.antiAliasFilterSize).to.equal(0.3);
            expect(params.material.getParameter('antiAliasFilterSize').data).to.equal(0.3);
        });

        it('takes the value from the render settings only when they set it', function () {
            const params = new GSplatParams(device);
            params.applySettings({});
            expect(params.antiAlias).to.equal(undefined);
            params.applySettings({ gsplatAntiAlias: false });
            expect(params.antiAlias).to.equal(false);
        });
    });

    describe('GSplatPlacementStateTracker', function () {

        it('reports a changed anti-aliasing flag of a tracked placement', function () {
            const tracker = new GSplatPlacementStateTracker();
            const placement = { resource: makeResource(false) };

            expect(tracker.hasChanges([placement])).to.equal(true);
            expect(tracker.antiAliasChanged).to.equal(false);

            placement.resource.antiAlias = true;
            expect(tracker.hasChanges([placement])).to.equal(true);
            expect(tracker.antiAliasChanged).to.equal(true);
        });

        it('does not report the flag of a placement seen for the first time', function () {
            const tracker = new GSplatPlacementStateTracker();
            expect(tracker.hasChanges([{ resource: makeResource(true) }])).to.equal(true);
            expect(tracker.antiAliasChanged).to.equal(false);
        });
    });

    describe('GSplatOctree#antiAlias', function () {

        it('applies to file resources as they load, and to loaded ones when changed', function () {
            const octree = new GSplatOctree('/scene/lod-meta.json', makeOctreeData());
            const resources = new Map([
                ['/scene/fine.json', { antiAlias: false }],
                ['/scene/coarse.json', { antiAlias: true }]
            ]);
            octree.assetLoader = { getResource: url => resources.get(url), load() {}, unload() {} };

            octree.antiAlias = true;
            octree.pollFileResource(0);
            expect(octree.fileResources.get(0).antiAlias).to.equal(true);

            octree.antiAlias = false;
            expect(octree.fileResources.get(0).antiAlias).to.equal(false);

            // the file's own value is replaced by the octree's
            octree.pollFileResource(1);
            expect(octree.fileResources.get(1).antiAlias).to.equal(false);
        });

        it('applies to the environment resource', function () {
            const octree = new GSplatOctree('/scene/lod-meta.json', { ...makeOctreeData(), environment: 'env.json' });
            const env = { antiAlias: false };
            octree.assetLoader = { getResource: () => env, load() {}, unload() {} };
            octree.environmentRefCount = 1;

            octree.antiAlias = true;
            octree.ensureEnvironmentResource();
            expect(env.antiAlias).to.equal(true);

            octree.antiAlias = false;
            expect(env.antiAlias).to.equal(false);
        });
    });

    describe('GSplatOctreeResource#antiAlias', function () {

        it('is read from the model field of lod-meta.json', function () {
            const tagged = new GSplatOctreeResource('/scene/lod-meta.json', makeOctreeData('antialiased'), null);
            expect(tagged.antiAlias).to.equal(true);
            expect(tagged.octree.antiAlias).to.equal(true);

            const untagged = new GSplatOctreeResource('/scene/lod-meta.json', makeOctreeData(), null);
            expect(untagged.antiAlias).to.equal(false);
        });

        it('passes a change to the octree', function () {
            const resource = new GSplatOctreeResource('/scene/lod-meta.json', makeOctreeData(), null);
            resource.antiAlias = true;
            expect(resource.octree.antiAlias).to.equal(true);
        });
    });

    describe('GSplatManager anti-aliasing resolution', function () {

        const resolve = (paramsAntiAlias, flags) => {
            const manager = Object.create(GSplatManager.prototype);
            manager.world = {
                lastWorldStateVersion: 1,
                getState: () => ({ splats: flags.map(antiAlias => ({ resource: { antiAlias } })) })
            };
            manager.gsplat = { antiAlias: paramsAntiAlias };
            manager._updateResourcesAntiAlias();
            manager._resolveAntiAlias();
            return { antiAlias: manager._antiAlias, mixed: manager._antiAliasMixed };
        };

        it('follows the resources when GSplatParams#antiAlias is undefined', function () {
            expect(resolve(undefined, [false, false])).to.deep.equal({ antiAlias: false, mixed: false });
            expect(resolve(undefined, [true, true])).to.deep.equal({ antiAlias: true, mixed: false });
            expect(resolve(undefined, [true, false])).to.deep.equal({ antiAlias: true, mixed: true });
            expect(resolve(undefined, [])).to.deep.equal({ antiAlias: false, mixed: false });
        });

        it('applies GSplatParams#antiAlias to every splat when it is set', function () {
            expect(resolve(true, [true, false])).to.deep.equal({ antiAlias: true, mixed: false });
            expect(resolve(false, [true, false])).to.deep.equal({ antiAlias: false, mixed: false });
        });

        // A GPU-sort manager whose update() records the anti-aliasing each forward view is
        // dispatched with. Everything update() calls besides the parameter resolution is stubbed.
        const makeGpuManager = (flags) => {
            const state = { splats: flags.map(antiAlias => ({ resource: { antiAlias } })) };
            const dispatched = [];
            const manager = Object.create(GSplatManager.prototype);
            Object.assign(manager, {
                gsplat: { antiAlias: undefined, dirty: false },
                renderMode: GSPLAT_FORWARD,
                sortNeeded: false,
                cpuSorter: null,
                director: { _streamToken: 0 },
                _renderViewParams: {},
                _bakeResult: {},
                _resourcesAntiAlias: false,
                _resourcesAntiAliasMixed: false,
                _antiAlias: false,
                _antiAliasMixed: false,
                world: {
                    lastWorldStateVersion: 1,
                    currentVersion: 1,
                    getState: () => state,
                    resetFrameStats() {},
                    bake(version, camera, updateBounds, result) {
                        result.rebuilt = false;
                        result.sortNeeded = false;
                    },
                    computeAggregateAabb: () => null,
                    markInstancesNeedLodUpdate() {}
                },
                renderer: {
                    usesGpuSort: true,
                    requiresBounds: false,
                    prepareRenderView: (world, lastState, p) => dispatched.push({ antiAlias: p.antiAlias, mixed: p.antiAliasMixed }),
                    setAntiAlias() {},
                    frameUpdate() {}
                },
                // the streaming pass records the resources of a new world state, as it does on
                // the first frame
                updateStreaming() {
                    this._updateResourcesAntiAlias();
                },
                testCameraMovedForSort: () => false,
                _markSortedIfNeeded() {},
                fireFrameReadyEvent() {}
            });
            return { manager, dispatched };
        };

        it('dispatches the GPU view with the anti-aliasing of the same frame', function () {
            const { manager, dispatched } = makeGpuManager([true]);

            // the first frame of a flagged resource is already compensated
            manager.update();
            expect(dispatched[0]).to.deep.equal({ antiAlias: true, mixed: false });

            // an override takes effect on the next frame rendered
            manager.gsplat.antiAlias = false;
            manager.update();
            expect(dispatched[1]).to.deep.equal({ antiAlias: false, mixed: false });
        });

        it('dispatches the GPU view in the mixed mode from the first frame', function () {
            const { manager, dispatched } = makeGpuManager([true, false]);
            manager.update();
            expect(dispatched[0]).to.deep.equal({ antiAlias: true, mixed: true });
        });
    });
});
