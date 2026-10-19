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

        it('reports a destroyed pass added to the frame, once', function () {
            const pass = new TestPass(device, 'DestroyedPassAddedToFrame');
            pass.destroy();

            const error = stub(console, 'error');
            new FrameGraph().addRenderPass(pass);
            new FrameGraph().addRenderPass(pass);

            expect(error.callCount).to.equal(1);
            expect(error.firstCall.args.join(' ')).to.include('DestroyedPassAddedToFrame');
        });

        it('does not report a pass which is not destroyed, nor a destroyed pass which is disabled', function () {
            const live = new TestPass(device, 'LivePassAddedToFrame');
            const disabled = new TestPass(device, 'DisabledDestroyedPass', { enabled: false });
            disabled.destroy();

            const error = stub(console, 'error');
            const frameGraph = new FrameGraph();
            frameGraph.addRenderPass(live);
            frameGraph.addRenderPass(disabled);

            expect(error.called).to.equal(false);
            expect(frameGraph.renderPasses).to.deep.equal([live]);
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

        it('does not merge passes on different targets, nor passes without a target', function () {
            const otherTarget = new RenderTarget({
                colorBuffer: new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_RGBA8, mipmaps: false }),
                depth: true
            });
            const first = createPass('First', true);
            const other = new RenderPass(device);
            other.init(otherTarget);
            const noTarget = new FramePass(device);
            const noTargetNext = new FramePass(device);
            compile(first, other, noTarget, noTargetNext);

            expect([first._skipEnd, other._skipStart, other._skipEnd, noTarget._skipStart, noTarget._skipEnd, noTargetNext._skipStart])
            .to.deep.equal([false, false, false, false, false, false]);

            otherTarget.destroyTextureBuffers();
            otherTarget.destroy();
        });

        it('does not merge a pass into one which clears an attachment', function () {
            const clears = {
                color: pass => pass.setClearColor(Color.BLACK),
                depth: pass => pass.setClearDepth(1),
                stencil: pass => pass.setClearStencil(0)
            };
            for (const [attachment, clear] of Object.entries(clears)) {
                const first = createPass('First', true);
                const second = createPass('Second');
                clear(second);
                compile(first, second);

                expect([first._skipEnd, second._skipStart], attachment).to.deep.equal([false, false]);
            }
        });

        it('does not merge a pass with its own after-pass, nor with its own before-pass', function () {
            const first = createPass('First', true);
            const after = createPass('After');
            first.afterPasses = [after];
            const before = createPass('Before');
            const second = createPass('Second');
            second.beforePasses = [before];

            // the passes execute as first, after, before, second, all on the same target and only the
            // first clearing - the after-pass and the before-pass merge, as neither owns the other
            compile(first, second);

            expect([first._skipEnd, after._skipStart]).to.deep.equal([false, false]);
            expect([after._skipEnd, before._skipStart]).to.deep.equal([true, true]);
            expect([before._skipEnd, second._skipStart]).to.deep.equal([false, false]);
        });

        it('does not merge a pass with its own internal before-pass', function () {
            const first = createPass('First', true);
            const internal = createPass('Internal');
            const second = createPass('Second');
            second.internalBeforePasses = [internal];

            // the passes execute as first, internal, second - the internal before-pass merges with the
            // pass before it, which does not own it
            compile(first, second);

            expect([first._skipEnd, internal._skipStart]).to.deep.equal([true, true]);
            expect([internal._skipEnd, second._skipStart]).to.deep.equal([false, false]);
        });

        it('does not merge passes with a callback running between them', function () {
            for (const callback of ['onAfter', 'onBefore']) {
                const first = createPass('First', true);
                const second = createPass('Second');
                (callback === 'onAfter' ? first : second)[callback] = () => {};
                compile(first, second);

                expect([first._skipEnd, second._skipStart], callback).to.deep.equal([false, false]);
            }

            // the callbacks which do not run between them do not prevent the merge
            const first = createPass('First', true);
            first.onBefore = () => {};
            const second = createPass('Second');
            second.onAfter = () => {};
            compile(first, second);

            expect([first._skipEnd, second._skipStart]).to.deep.equal([true, true]);
        });

        it('requests the store of each attachment the next pass on the target loads', function () {
            // multisampled, so that its color attachments are not stored by default, with two of them
            const target = new RenderTarget({
                colorBuffers: [0, 1].map(() => new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_RGBA8, mipmaps: false })),
                depth: true,
                stencil: true,
                samples: 4
            });
            const first = new RenderPass(device);
            first.init(target);
            first.setClearColor(Color.BLACK);
            first.setClearDepth(1);
            first.setClearStencil(0);

            // the second pass clears the color attachment 0 and the stencil, and loads the color
            // attachment 1 and the depth
            const second = new RenderPass(device);
            second.init(target);
            second.setClearColor(Color.BLACK, 0);
            second.setClearStencil(0);

            expect(first.colorArrayOps.map(ops => ops.store)).to.deep.equal([false, false]);
            expect([first.depthStencilOps.storeDepth, first.depthStencilOps.storeStencil]).to.deep.equal([false, false]);

            compile(first, second);

            expect(first.colorArrayOps.map(ops => ops.store)).to.deep.equal([false, true]);
            expect([first.depthStencilOps.storeDepth, first.depthStencilOps.storeStencil]).to.deep.equal([true, false]);

            target.destroyTextureBuffers();
            target.destroy();
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
