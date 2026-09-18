import { expect } from 'chai';
import sinon from 'sinon';

import { BLEND_NONE, BLEND_PREMULTIPLIED } from '../../../src/scene/constants.js';
import { GSplatHybridRenderer } from '../../../src/scene/gsplat-unified/gsplat-hybrid-renderer.js';
import { ShaderMaterial } from '../../../src/scene/materials/shader-material.js';

// Exercise the real view pipeline without a GPU. Projection and indirect argument generation
// must still run when sorting is bypassed, and picking must retain its sorted depth semantics.
describe('GSplat stochastic rendering', function () {
    const pipeline = () => {
        const renderer = Object.create(GSplatHybridRenderer.prototype);
        Object.assign(renderer, {
            _ensureGpuPipeline() {},
            allocateAndWriteIntervalIndirectArgs() {},
            computeDistanceRange: sinon.stub().returns({ minDist: 0, maxDist: 10 }),
            fisheyeProj: { enabled: false },
            gpuSorter: {
                radixBits: 4,
                prepareIndirect: sinon.stub().returns([1, 1, 1, 1]),
                sortIndirect: sinon.stub().returns({ sorted: true })
            },
            projector: {
                dispatch: sinon.spy(),
                writeIndirectArgs: sinon.spy(),
                sortKeys: { stableIds: true }
            },
            intervalCompaction: {
                uploadIntervals() {},
                dispatchCompact() {},
                compactedSplatIds: {},
                sortElementCountBuffer: {},
                numSplatsBuffer: {}
            },
            device: { submit: sinon.spy() },
            indirectDrawSlot: 0,
            indirectDispatchSlot: 0
        });
        return renderer;
    };

    const render = (renderer, stochastic, pickMode = false) => renderer.sortAndProjectForCamera(
        { hasBounds: false, workBuffer: { frustumCuller: {} } },
        { totalActiveSplats: 1000, totalIntervals: 1 },
        {}, 960, 540, 1 / 255, pickMode, false,
        { stochastic, radialSorting: true, minPixelSize: 0, varyings: { words: 0 } }
    );

    it('projects and draws compacted splats without any radix sort', function () {
        const renderer = pipeline();
        expect(render(renderer, true)).to.equal(renderer.projector.sortKeys);
        expect(renderer.gpuSorter.sortIndirect.called).to.equal(false);
        expect(renderer.computeDistanceRange.called).to.equal(false);
        expect(renderer.projector.dispatch.firstCall.args[0].stochastic).to.equal(true);
        expect(renderer.projector.writeIndirectArgs.calledOnce).to.equal(true);
    });

    it('sorts normal rendering and picking even when stochastic is requested', function () {
        for (const [stochastic, pickMode] of [[false, false], [true, true]]) {
            const renderer = pipeline();
            expect(render(renderer, stochastic, pickMode)).to.deep.equal({ sorted: true });
            expect(renderer.gpuSorter.sortIndirect.calledOnce).to.equal(true);
            expect(renderer.projector.dispatch.firstCall.args[0].stochastic).to.equal(false);
            expect(renderer.device.submit.called).to.equal(pickMode);
        }
    });

    it('switches depth writes, blend state and shader defines together', function () {
        const renderer = Object.create(GSplatHybridRenderer.prototype);
        renderer._material = new ShaderMaterial();
        renderer._updateIdDefines = () => {};
        for (const stochastic of [false, true, false]) {
            renderer.stochastic = stochastic;
            renderer.configureMaterial();
            expect(renderer.material.depthWrite).to.equal(stochastic);
            expect(renderer.material.blendType).to.equal(stochastic ? BLEND_NONE : BLEND_PREMULTIPLIED);
            expect(renderer.material.defines.has('DITHER_NONE')).to.equal(!stochastic);
            expect(renderer.material.defines.has('DITHER_BLUENOISE')).to.equal(stochastic);
        }
        renderer._material.destroy();
    });
});
