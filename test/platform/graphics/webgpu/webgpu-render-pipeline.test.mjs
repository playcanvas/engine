import { expect } from 'chai';
import sinon from 'sinon';

import { BlendState } from '../../../../src/platform/graphics/blend-state.js';
import {
    CULLFACE_BACK, FRONTFACE_CCW, FUNC_GREATER, FUNC_LESSEQUAL, PRIMITIVE_LINES, PRIMITIVE_POINTS,
    PRIMITIVE_TRIANGLES
} from '../../../../src/platform/graphics/constants.js';
import { DepthState } from '../../../../src/platform/graphics/depth-state.js';
import { StencilParameters } from '../../../../src/platform/graphics/stencil-parameters.js';
import { WebgpuRenderPipeline } from '../../../../src/platform/graphics/webgpu/webgpu-render-pipeline.js';

const createDepthState = (depthBias, depthBiasSlope = 0) => {
    const depthState = new DepthState();
    depthState.depthBias = depthBias;
    depthState.depthBiasSlope = depthBiasSlope;
    return depthState;
};

describe('WebgpuRenderPipeline', function () {

    const shader = { id: 1 };
    const renderTarget = {
        samples: 1,
        depth: true,
        stencil: false,
        impl: { key: 1, depthAttachment: { format: 'depth24plus' } }
    };
    const bindGroupFormats = [{ key: 1 }, { key: 2 }, { key: 3 }, { key: 4 }];
    const stencil = new StencilParameters();

    describe('#get', function () {

        let renderPipeline;

        // looks up the pipeline of a draw differing only in the depth state and the primitive type
        const get = (depthState, type = PRIMITIVE_TRIANGLES) => renderPipeline.get({ type }, undefined, undefined,
            undefined, shader, renderTarget, bindGroupFormats, BlendState.NOBLEND, depthState, CULLFACE_BACK,
            false, stencil, stencil, FRONTFACE_CCW, false);

        beforeEach(function () {
            renderPipeline = new WebgpuRenderPipeline({});
            sinon.stub(renderPipeline, 'getPipelineLayout');
            sinon.stub(renderPipeline.vertexBufferLayout, 'get');
            sinon.stub(renderPipeline, 'create').callsFake(() => ({}));
        });

        afterEach(function () {
            sinon.restore();
        });

        it('shares a pipeline between depth biases truncated to the same integer', function () {
            expect(get(createDepthState(0.5))).to.equal(get(createDepthState(0)));
            expect(get(createDepthState(-1.7))).to.equal(get(createDepthState(-1)));
            expect(get(createDepthState(-2))).to.not.equal(get(createDepthState(-1)));
        });

        it('creates a separate pipeline for a different slope depth bias', function () {
            expect(get(createDepthState(0, 0.5))).to.not.equal(get(createDepthState(0, 0.25)));
            expect(get(createDepthState(0, 0.5))).to.equal(get(createDepthState(0, 0.5)));
        });

        it('ignores the depth bias of points and lines', function () {
            for (const type of [PRIMITIVE_POINTS, PRIMITIVE_LINES]) {
                expect(get(createDepthState(4, 2), type)).to.equal(get(createDepthState(0), type));
            }
            expect(get(createDepthState(4, 2))).to.not.equal(get(createDepthState(0)));
        });

        it('creates a separate pipeline for a different depth function or write', function () {
            const depthStates = [
                DepthState.DEFAULT,
                DepthState.NODEPTH,
                DepthState.WRITEDEPTH,
                new DepthState(FUNC_GREATER),
                new DepthState(FUNC_LESSEQUAL, false)
            ];
            const pipelines = new Set(depthStates.map(depthState => get(depthState)));
            expect(pipelines.size).to.equal(depthStates.length);
        });

    });

    describe('#getDepthStencil', function () {

        const getDepthStencil = (depthState, topology) => new WebgpuRenderPipeline({}).getDepthStencil(
            depthState, renderTarget, false, stencil, stencil, topology);

        it('truncates the constant depth bias to an integer', function () {
            const depthStencil = getDepthStencil(createDepthState(-1.7, 0.5), 'triangle-list');
            expect(depthStencil.depthBias).to.equal(-1);
            expect(depthStencil.depthBiasSlopeScale).to.equal(0.5);
        });

        it('does not apply a depth bias to lines', function () {
            const depthStencil = getDepthStencil(createDepthState(-2, 0.5), 'line-list');
            expect(depthStencil.depthBias).to.equal(0);
            expect(depthStencil.depthBiasSlopeScale).to.equal(0);
        });

    });

});
