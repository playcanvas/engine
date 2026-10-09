import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { ComputePass } from '../../../src/platform/graphics/compute-pass.js';
import { Compute } from '../../../src/platform/graphics/compute.js';
import { BUFFERUSAGE_COPY_SRC, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { FramePass } from '../../../src/platform/graphics/frame-pass.js';
import { Shader } from '../../../src/platform/graphics/shader.js';
import { StorageBuffer } from '../../../src/platform/graphics/storage-buffer.js';
import { FrameGraph } from '../../../src/scene/frame-graph.js';
import { RenderPassForward } from '../../../src/scene/renderer/render-pass-forward.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

// Dawn's null backend validates the API and compiles the shaders, but executes no GPU work, so the
// values the shaders compute are only checked on a backend which runs them
const executesGpuWork = !!process.env.PC_WEBGPU_BACKEND && process.env.PC_WEBGPU_BACKEND !== 'null';

// stands in for a compute instance in the tests which do not dispatch it on the GPU
const createCompute = name => ({ name });

// stands in for a render pass rendering to a target, without clearing it
class TargetPass extends FramePass {
    colorArrayOps = [{ clear: false, store: false }];

    depthStencilOps = { clearDepth: false, clearStencil: false, storeDepth: false, storeStencil: false };

    constructor(device, renderTarget) {
        super(device);
        this.renderTarget = renderTarget;
    }
}

describe('ComputePass', function () {
    /** @type {Application} */
    let app;

    /** @type {import('../../../src/platform/graphics/graphics-device.js').GraphicsDevice} */
    let device;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        device = app.graphicsDevice;
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#execute', function () {

        it('dispatches its computes in order, in a single compute pass', function () {
            const computes = [createCompute('First'), createCompute('Second')];
            const pass = new ComputePass(device, computes);
            pass.name = 'TestPass';
            const dispatch = sinon.stub(device, 'computeDispatch');

            pass.render();

            expect(dispatch.calledOnce).to.equal(true);
            expect(dispatch.firstCall.args[0]).to.equal(computes);
            expect(dispatch.firstCall.args[1]).to.equal('TestPass');
        });

        it('does not dispatch without computes', function () {
            const pass = new ComputePass(device);
            const dispatch = sinon.stub(device, 'computeDispatch');

            pass.render();

            expect(dispatch.called).to.equal(false);
        });

        it('runs the computes on the GPU', async function () {
            if (!device.supportsCompute) {
                this.skip();
            }

            const shader = new Shader(device, {
                name: 'ComputePassTest',
                shaderLanguage: SHADERLANGUAGE_WGSL,
                cshader: /* wgsl */`
                    uniform value: f32;
                    var<storage, read_write> result: array<f32>;

                    @compute @workgroup_size(1)
                    fn main() {
                        result[0] = uniform.value;
                    }
                `
            });
            const results = new StorageBuffer(device, 16, BUFFERUSAGE_COPY_SRC);
            const compute = new Compute(device, shader, 'ComputePassTest');
            compute.setParameter('result', results);
            compute.setParameter('value', 5);
            compute.setupDispatch(1, 1, 1);

            new ComputePass(device, [compute]).render();
            const data = await results.read(0, 4, new Float32Array(1), true);
            if (executesGpuWork) {
                expect(data[0]).to.equal(5);
            }

            compute.destroy();
            shader.destroy();
            results.destroy();
        });
    });

    describe('in the frame graph', function () {

        it('keeps the render passes around it apart', function () {
            const renderTarget = {};
            const addPasses = (between) => {
                const frameGraph = new FrameGraph();
                const before = new TargetPass(device, renderTarget);
                const after = new TargetPass(device, renderTarget);
                frameGraph.addRenderPass(before);
                if (between) frameGraph.addRenderPass(between);
                frameGraph.addRenderPass(after);
                frameGraph.compile();
                return { before, after };
            };

            // the two passes render to the same target, and merge when next to each other
            const merged = addPasses(null);
            expect(merged.before._skipEnd).to.equal(true);
            expect(merged.after._skipStart).to.equal(true);

            // a compute pass between them ends the first one, and starts the second one anew
            const apart = addPasses(new ComputePass(device, [createCompute('Between')]));
            expect(apart.before._skipEnd).to.equal(false);
            expect(apart.after._skipStart).to.equal(false);
        });

        it('executes after the camera renders, in its after passes', function () {
            const entity = new Entity('Camera');
            entity.addComponent('camera');
            app.root.addChild(entity);

            const compute = createCompute('After');
            const pass = new ComputePass(device, [compute]);
            entity.camera.afterPasses.push(pass);
            const dispatch = sinon.stub(device, 'computeDispatch');
            app.render();
            expect(dispatch.calledWith([compute])).to.equal(true);

            const passes = app.frameGraph.renderPasses;
            const lastForward = passes.findLastIndex(p => p instanceof RenderPassForward);
            expect(lastForward).to.be.at.least(0);
            expect(passes.indexOf(pass)).to.be.greaterThan(lastForward);
        });
    });

    describe('#destroy', function () {

        it('releases the computes', function () {
            const pass = new ComputePass(device, [createCompute('Released')]);
            pass.destroy();
            expect(pass.computes).to.have.lengthOf(0);
        });
    });
});
