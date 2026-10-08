import { expect } from 'chai';

import { FramePass } from '../../src/platform/graphics/frame-pass.js';
import { FrameGraph } from '../../src/scene/frame-graph.js';
import { FramePassMultiView } from '../../src/scene/renderer/frame-pass-multi-view.js';
import { RenderPassShadowDirectional } from '../../src/scene/renderer/render-pass-shadow-directional.js';
import { createApp } from '../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

/**
 * @import { Application } from '../../src/framework/application.js'
 */

class CountingPass extends FramePass {
    executeCount = 0;

    constructor(device, name, perView = true) {
        super(device);
        this.name = name;
        this.perView = perView;
    }

    execute() {
        this.executeCount++;
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
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#beginMultiView', function () {

        it('captures the passes which render per view', function () {
            const frameGraph = new FrameGraph();
            const first = new CountingPass(device, 'First');
            const second = new CountingPass(device, 'Second');

            frameGraph.beginMultiView(device);
            frameGraph.addRenderPass(first);
            frameGraph.addRenderPass(second);
            frameGraph.endMultiView();

            expect(frameGraph.renderPasses).to.have.lengthOf(1);
            const wrapper = frameGraph.renderPasses[0];
            expect(wrapper).to.be.an.instanceOf(FramePassMultiView);
            expect(wrapper.children).to.deep.equal([first, second]);
        });

        it('adds a pass which does not render per view ahead of the captured passes', function () {
            const frameGraph = new FrameGraph();
            const earlier = new CountingPass(device, 'Earlier');
            const view = new CountingPass(device, 'View');
            const once = new CountingPass(device, 'Once', false);

            frameGraph.addRenderPass(earlier);
            frameGraph.beginMultiView(device);
            frameGraph.addRenderPass(view);
            frameGraph.addRenderPass(once);
            frameGraph.endMultiView();

            const [first, second, wrapper] = frameGraph.renderPasses;
            expect(frameGraph.renderPasses).to.have.lengthOf(3);
            expect(first).to.equal(earlier);
            expect(second).to.equal(once);
            expect(wrapper.children).to.deep.equal([view]);
        });

        it('adds a before-pass which does not render per view ahead of the pass it precedes', function () {
            // a forward pass with the shadow pass of a directional light before it
            const frameGraph = new FrameGraph();
            const forward = new CountingPass(device, 'Forward');
            const shadow = new CountingPass(device, 'Shadow', false);
            const cameraBefore = new CountingPass(device, 'CameraBefore');
            forward.beforePasses.push(shadow, cameraBefore);

            frameGraph.beginMultiView(device);
            frameGraph.addRenderPass(forward);
            frameGraph.endMultiView();

            const [first, wrapper] = frameGraph.renderPasses;
            expect(frameGraph.renderPasses).to.have.lengthOf(2);
            expect(first).to.equal(shadow);
            expect(wrapper.children).to.deep.equal([cameraBefore, forward]);
        });

        it('renders a pass which does not render per view once for all the views', function () {
            const frameGraph = new FrameGraph();
            const forward = new CountingPass(device, 'Forward');
            const shadow = new CountingPass(device, 'Shadow', false);
            forward.beforePasses.push(shadow);

            // the wrapper iterates the XR views of its device - a stand-in with two views, which
            // leaves the device the passes render with untouched
            const view = { colorTexture: null, viewDescriptor: null, viewFormat: null };
            const xrDevice = { xrSubImages: [view, view], backBuffer: null };

            frameGraph.beginMultiView(xrDevice);
            frameGraph.addRenderPass(forward);
            frameGraph.endMultiView();
            frameGraph.render(device);

            expect(shadow.executeCount).to.equal(1);
            expect(forward.executeCount).to.equal(2);
        });
    });
});

describe('RenderPassShadowDirectional', function () {

    beforeEach(function () {
        jsdomSetup();
    });

    afterEach(function () {
        jsdomTeardown();
    });

    it('renders once for all the views', function () {
        const app = createApp();
        const light = { _node: { name: 'Light' }, numShadowFaces: 1 };
        const pass = new RenderPassShadowDirectional(app.graphicsDevice, {}, light, {}, 1);
        expect(pass.perView).to.equal(false);
        app.destroy();
    });
});
