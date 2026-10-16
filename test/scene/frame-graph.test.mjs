import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Debug } from '../../src/core/debug.js';
import { Color } from '../../src/core/math/color.js';
import { PIXELFORMAT_RGBA8 } from '../../src/platform/graphics/constants.js';
import { FramePass } from '../../src/platform/graphics/frame-pass.js';
import { RenderPass } from '../../src/platform/graphics/render-pass.js';
import { RenderTarget } from '../../src/platform/graphics/render-target.js';
import { Texture } from '../../src/platform/graphics/texture.js';
import { FrameGraph } from '../../src/scene/frame-graph.js';
import { createApp } from '../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

/**
 * @import { Application } from '../../src/framework/application.js'
 */

class TestPass extends FramePass {
    frameUpdateCount = 0;

    /**
     * Called from frameUpdate, to change the passes the way a container does.
     *
     * @type {Function|null}
     */
    onFrameUpdate = null;

    constructor(device, name, { enabled = true, internalBefore = [], before = [], after = [] } = {}) {
        super(device);
        this.name = name;
        this.enabled = enabled;
        this.internalBeforePasses = internalBefore;
        this.beforePasses = before;
        this.afterPasses = after;
    }

    frameUpdate() {
        this.frameUpdateCount++;
        this.onFrameUpdate?.();
    }
}

describe('FrameGraph', function () {
    /** @type {Application} */
    let app;

    /** @type {import('../../src/platform/graphics/graphics-device.js').GraphicsDevice} */
    let device;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        device = app.graphicsDevice;
    });

    afterEach(function () {
        restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#addRenderPass', function () {

        it('schedules the before-passes, the pass and the after-passes in order', function () {
            const frameGraph = new FrameGraph();
            const before = new TestPass(device, 'Before');
            const after = new TestPass(device, 'After');
            const pass = new TestPass(device, 'Pass', { before: [before], after: [after] });

            frameGraph.addRenderPass(pass);

            expect(frameGraph.renderPasses).to.deep.equal([before, pass, after]);
            expect([before, pass, after].map(p => p.frameUpdateCount)).to.deep.equal([1, 1, 1]);
        });

        it('skips a disabled pass together with its before and after passes', function () {
            const frameGraph = new FrameGraph();
            const before = new TestPass(device, 'Before');
            const after = new TestPass(device, 'After');
            const pass = new TestPass(device, 'Pass', { enabled: false, before: [before], after: [after] });

            frameGraph.addRenderPass(pass);

            expect(frameGraph.renderPasses).to.be.empty;
            expect([before, pass, after].map(p => p.frameUpdateCount)).to.deep.equal([0, 0, 0]);
        });

        it('schedules the internal before-passes ahead of the before-passes', function () {
            const frameGraph = new FrameGraph();
            const internal = new TestPass(device, 'Internal');
            const before = new TestPass(device, 'Before');
            const pass = new TestPass(device, 'Pass', { internalBefore: [internal], before: [before] });

            frameGraph.addRenderPass(pass);

            expect(frameGraph.renderPasses).to.deep.equal([internal, before, pass]);
        });

        it('skips the internal before-passes of a disabled pass', function () {
            const frameGraph = new FrameGraph();
            const internal = new TestPass(device, 'Internal');
            const pass = new TestPass(device, 'Pass', { enabled: false, internalBefore: [internal] });

            frameGraph.addRenderPass(pass);

            expect(frameGraph.renderPasses).to.be.empty;
            expect(internal.frameUpdateCount).to.equal(0);
        });

        it('skips a disabled child together with its own before and after passes', function () {
            const frameGraph = new FrameGraph();
            const nestedBefore = new TestPass(device, 'NestedBefore');
            const nestedAfter = new TestPass(device, 'NestedAfter');
            const child = new TestPass(device, 'Child', { enabled: false, before: [nestedBefore], after: [nestedAfter] });
            const sibling = new TestPass(device, 'Sibling');
            const pass = new TestPass(device, 'Pass', { before: [child, sibling] });

            frameGraph.addRenderPass(pass);

            expect(frameGraph.renderPasses).to.deep.equal([sibling, pass]);
            expect([nestedBefore, child, nestedAfter].map(p => p.frameUpdateCount)).to.deep.equal([0, 0, 0]);
        });

        it('schedules a child the pass enables in its frameUpdate', function () {
            const frameGraph = new FrameGraph();
            const child = new TestPass(device, 'Child', { enabled: false });
            const pass = new TestPass(device, 'Pass', { before: [child] });
            pass.onFrameUpdate = () => {
                child.enabled = true;
            };

            frameGraph.addRenderPass(pass);

            expect(frameGraph.renderPasses).to.deep.equal([child, pass]);
        });

        it('skips a child the pass disables in its frameUpdate', function () {
            const frameGraph = new FrameGraph();
            const child = new TestPass(device, 'Child');
            const pass = new TestPass(device, 'Pass', { after: [child] });
            pass.onFrameUpdate = () => {
                child.enabled = false;
            };

            frameGraph.addRenderPass(pass);

            expect(frameGraph.renderPasses).to.deep.equal([pass]);
            expect(child.frameUpdateCount).to.equal(0);
        });

        it('asserts a pass which disables itself in its frameUpdate, and does not schedule it', function () {
            const frameGraph = new FrameGraph();
            const pass = new TestPass(device, 'Pass');
            pass.onFrameUpdate = () => {
                pass.enabled = false;
            };

            const assertion = stub(Debug, 'assert');
            frameGraph.addRenderPass(pass);

            expect(assertion.getCalls().some(call => !call.args[0])).to.equal(true);
            expect(frameGraph.renderPasses).to.be.empty;
            expect(pass.frameUpdateCount).to.equal(1);
        });

        it('asserts a pass disabled by its before-passes while it is scheduled', function () {
            const frameGraph = new FrameGraph();
            const before = new TestPass(device, 'Before');
            const pass = new TestPass(device, 'Pass', { before: [before] });
            before.onFrameUpdate = () => {
                pass.enabled = false;
            };

            const assertion = stub(Debug, 'assert');
            frameGraph.addRenderPass(pass);

            expect(assertion.getCalls().some(call => !call.args[0])).to.equal(true);
            expect(frameGraph.renderPasses).to.deep.equal([before]);
        });

        it('does not assert a pass whose frameUpdate disables its before-passes', function () {
            const frameGraph = new FrameGraph();
            const before = new TestPass(device, 'Before');
            const pass = new TestPass(device, 'Pass', { before: [before] });
            pass.onFrameUpdate = () => {
                before.enabled = false;
            };

            const assertion = stub(Debug, 'assert');
            frameGraph.addRenderPass(pass);

            expect(assertion.getCalls().some(call => !call.args[0])).to.equal(false);
            expect(frameGraph.renderPasses).to.deep.equal([pass]);
        });
    });

    describe('#compile', function () {
        /** @type {RenderTarget} */
        let renderTarget;

        // a pass rendering to the shared render target, clearing its color and depth if requested
        const createPass = (name, clears = false) => {
            const pass = new RenderPass(device);
            pass.name = name;
            pass.init(renderTarget);
            if (clears) {
                pass.setClearColor(Color.BLACK);
                pass.setClearDepth(1);
            }
            return pass;
        };

        const compile = (...passes) => {
            const frameGraph = new FrameGraph();
            passes.forEach(pass => frameGraph.addRenderPass(pass));
            frameGraph.compile();
            return frameGraph;
        };

        beforeEach(function () {
            renderTarget = new RenderTarget({
                colorBuffer: new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_RGBA8, mipmaps: false }),
                depth: true
            });
        });

        afterEach(function () {
            renderTarget.destroyTextureBuffers();
            renderTarget.destroy();
        });

        it('merges two passes on the same target when the second does not clear', function () {
            const first = createPass('First', true);
            const second = createPass('Second');
            compile(first, second);

            expect([first._skipEnd, second._skipStart]).to.deep.equal([true, true]);
            expect(first.depthStencilOps.storeDepth).to.equal(true);
        });

        it('does not merge a pass which does not execute with its neighbour', function () {
            for (const skipped of ['first', 'second']) {
                const first = createPass('First', true);
                const second = createPass('Second');
                (skipped === 'first' ? first : second).executeEnabled = false;
                compile(first, second);

                expect([first._skipEnd, second._skipStart], skipped).to.deep.equal([false, false]);
            }
        });

        it('requests the store from the last pass writing the target, past a pass which does not execute', function () {
            const first = createPass('First', true);
            const skipped = createPass('Skipped', true);
            skipped.executeEnabled = false;
            const last = createPass('Last');
            compile(first, skipped, last);

            // the last pass loads the depth the first one rendered, as the skipped one does not clear it
            expect(first.depthStencilOps.storeDepth).to.equal(true);
            expect(skipped.depthStencilOps.storeDepth).to.equal(false);
            expect([first._skipEnd, skipped._skipStart, skipped._skipEnd, last._skipStart]).to.deep.equal([false, false, false, false]);
        });

        it('asserts a merged pass whose execution is disabled after the compile', function () {
            const first = createPass('First', true);
            const second = createPass('Second');
            second.before = () => {
                second.executeEnabled = false;
            };
            const frameGraph = compile(first, second);

            const assertion = stub(Debug, 'assert');
            frameGraph.render(device);

            expect(assertion.getCalls().some(call => !call.args[0])).to.equal(true);
        });
    });
});
