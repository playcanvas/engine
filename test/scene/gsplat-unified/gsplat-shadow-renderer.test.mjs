import { expect } from 'chai';
import sinon from 'sinon';

import { SHADOWUPDATE_NONE, SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME } from '../../../src/scene/constants.js';
import { GSplatShadowRenderer } from '../../../src/scene/gsplat-unified/gsplat-shadow-renderer.js';

describe('GSplatShadowRenderer#cull', function () {
    let renderer;
    let worldState;

    beforeEach(function () {
        // Exercise scheduling without requiring a WebGPU device or allocating compute resources.
        renderer = Object.create(GSplatShadowRenderer.prototype);
        renderer.entries = new Map();
        renderer.cameraNode = { camera: { camera: {} } };
        worldState = { sortedBefore: true, totalActiveSplats: 128, totalIntervals: 2, boundsGroups: [] };
        renderer.world = {
            currentVersion: 1,
            getState: () => worldState,
            workBuffer: {
                textureSize: 16,
                frustumCuller: { updateTransformsData: sinon.spy() }
            }
        };
        renderer._compaction = { uploadIntervals: sinon.spy() };
        renderer._syncUserModify = sinon.spy();
        renderer._ensureCullShader = sinon.spy();
        renderer._cullEntry = sinon.spy();
    });

    const addLight = (renderer, mode, override) => {
        const renderData = {
            shadowCullRequested: true,
            shadowCascadeMask: override === SHADOWUPDATE_NONE ? 0 : 1
        };
        const light = {
            getRenderData: () => renderData,
            enabled: true,
            castShadows: true,
            visibleThisFrame: true,
            shadowUpdateMode: mode,
            shadowUpdateOverrides: override === undefined ? null : [override]
        };
        const entry = { light, meshInstance: { visible: true } };
        renderer.entries.set(light, entry);
        return entry;
    };

    const expectNoPreparation = (renderer) => {
        expect(renderer._compaction.uploadIntervals.called).to.equal(false);
        expect(renderer.world.workBuffer.frustumCuller.updateTransformsData.called).to.equal(false);
        expect(renderer._syncUserModify.called).to.equal(false);
        expect(renderer._ensureCullShader.called).to.equal(false);
        expect(renderer._cullEntry.called).to.equal(false);
    };

    it('does no shadow preparation or dispatch when all lights are cached', function () {
        const entry = addLight(renderer, SHADOWUPDATE_NONE);
        renderer.cull({});
        expectNoPreparation(renderer);
        expect(renderer.entries.size).to.equal(1);
        expect(entry.meshInstance.visible).to.equal(true);
    });

    it('does no shadow preparation when there are no lights', function () {
        renderer.cull({});
        expectNoPreparation(renderer);
    });

    ['enabled', 'castShadows', 'visibleThisFrame'].forEach((property) => {
        it(`skips a pending shadow update while ${property} is false`, function () {
            const entry = addLight(renderer, SHADOWUPDATE_THISFRAME);
            entry.light[property] = false;
            renderer.cull({});
            expectNoPreparation(renderer);
            expect(entry.light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);

            entry.light[property] = true;
            renderer.cull({});
            expect(renderer._cullEntry.calledOnce).to.equal(true);
            expect(renderer._cullEntry.firstCall.args[0]).to.equal(entry);
        });
    });

    it('prepares once and dispatches only updating lights in a mixed set', function () {
        addLight(renderer, SHADOWUPDATE_NONE);
        const realtime = addLight(renderer, SHADOWUPDATE_REALTIME);
        const once = addLight(renderer, SHADOWUPDATE_THISFRAME);
        const params = {};
        renderer.cull(params);
        expect(renderer._compaction.uploadIntervals.calledOnceWithExactly(worldState)).to.equal(true);
        expect(renderer.world.workBuffer.frustumCuller.updateTransformsData.calledOnceWithExactly(worldState.boundsGroups)).to.equal(true);
        expect(renderer._syncUserModify.calledOnceWithExactly(params)).to.equal(true);
        expect(renderer._ensureCullShader.calledOnce).to.equal(true);
        expect(renderer._cullEntry.callCount).to.equal(2);
        expect(renderer._cullEntry.firstCall.args).to.deep.equal([realtime, 2, 128, 16, params]);
        expect(renderer._cullEntry.secondCall.args).to.deep.equal([once, 2, 128, 16, params]);
        // The renderer consumes this request later, after all cameras have prepared shadows.
        expect(once.light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
    });

    it('resumes a cached light for a one-shot refresh and stops after it is consumed', function () {
        const entry = addLight(renderer, SHADOWUPDATE_NONE);
        renderer.cull({});
        entry.light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        renderer.cull({});
        entry.light.shadowUpdateMode = SHADOWUPDATE_NONE;
        renderer.cull({});
        expect(renderer._cullEntry.calledOnce).to.equal(true);
        expect(renderer._cullEntry.firstCall.args[0]).to.equal(entry);
        expect(renderer._compaction.uploadIntervals.calledOnce).to.equal(true);
    });

    it('honors the single-cascade override without consuming a one-shot override', function () {
        const entry = addLight(renderer, SHADOWUPDATE_REALTIME, SHADOWUPDATE_NONE);
        renderer.cull({});
        expectNoPreparation(renderer);
        entry.light.shadowUpdateOverrides[0] = SHADOWUPDATE_THISFRAME;
        entry.light.getRenderData().shadowCascadeMask = 1;
        renderer.cull({});
        expect(renderer._cullEntry.calledOnce).to.equal(true);
        expect(entry.light.shadowUpdateOverrides[0]).to.equal(SHADOWUPDATE_THISFRAME);
    });

    it('dispatches a scheduled map refresh even when the cascade override is NONE', function () {
        const entry = addLight(renderer, SHADOWUPDATE_THISFRAME, SHADOWUPDATE_NONE);
        entry.light.getRenderData().shadowCascadeMask = 1;
        renderer.cull({});
        expect(renderer._cullEntry.calledOnce).to.equal(true);
        expect(entry.light.shadowUpdateOverrides[0]).to.equal(SHADOWUPDATE_NONE);
        expect(entry.light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
    });

    it('does not let a cascade override bypass a disabled light-wide update mode', function () {
        addLight(renderer, SHADOWUPDATE_NONE, SHADOWUPDATE_REALTIME);
        renderer.cull({});
        expectNoPreparation(renderer);
    });

    it('skips compute when the camera has no scheduled directional shadow pass', function () {
        const entry = addLight(renderer, SHADOWUPDATE_THISFRAME);
        const renderData = entry.light.getRenderData();
        renderData.shadowCullRequested = false;
        renderer.cull({});
        expectNoPreparation(renderer);
        expect(entry.light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);

        renderData.shadowCullRequested = true;
        renderer.cull({});
        expect(renderer._cullEntry.calledOnce).to.equal(true);
    });

    it('hides casters while the splat data is not ready without dispatching work', function () {
        const entry = addLight(renderer, SHADOWUPDATE_REALTIME);
        worldState.sortedBefore = false;
        renderer.cull({});
        expectNoPreparation(renderer);
        expect(entry.meshInstance.visible).to.equal(false);
    });
});
