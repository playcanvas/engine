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

// stands in for a pass which renders to a target once for all the views, such as the shadow pass of
// a directional light rendering its shadow map
class CountingTargetPass extends CountingPass {
    colorArrayOps = [];

    depthStencilOps = { clearDepth: true, clearStencil: true, storeDepth: false, storeStencil: false };

    constructor(device, name, renderTarget) {
        super(device, name, false);
        this.renderTarget = renderTarget;
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

        it('adds several passes without a target, which do not render per view, ahead of the captured passes', function () {
            const frameGraph = new FrameGraph();
            const view = new CountingPass(device, 'View');
            const first = new CountingPass(device, 'First', false);
            const second = new CountingPass(device, 'Second', false);

            frameGraph.beginMultiView(device);
            frameGraph.addRenderPass(view);
            frameGraph.addRenderPass(first);
            frameGraph.addRenderPass(second);
            frameGraph.endMultiView();

            const [movedFirst, movedSecond, wrapper] = frameGraph.renderPasses;
            expect(frameGraph.renderPasses).to.have.lengthOf(3);
            expect(movedFirst).to.equal(first);
            expect(movedSecond).to.equal(second);
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

        describe('with two cameras rendering in the scope', function () {

            // the forward passes of two cameras, each with the shadow pass of a directional light,
            // rendering to the given shadow maps
            const addCameras = (frameGraph, shadowMapA, shadowMapB) => {
                const forwardA = new CountingPass(device, 'ForwardA');
                const shadowA = new CountingTargetPass(device, 'ShadowA', shadowMapA);
                forwardA.beforePasses.push(shadowA);

                const forwardB = new CountingPass(device, 'ForwardB');
                const shadowB = new CountingTargetPass(device, 'ShadowB', shadowMapB);
                forwardB.beforePasses.push(shadowB);

                frameGraph.addRenderPass(forwardA);
                frameGraph.addRenderPass(forwardB);
                return { forwardA, shadowA, forwardB, shadowB };
            };

            it('keeps the shadow passes of a light the cameras share in place', function () {
                // the light renders its shadow map for each camera, before the camera uses it
                const frameGraph = new FrameGraph();
                const shadowMap = {};

                frameGraph.beginMultiView(device);
                const { forwardA, shadowA, forwardB, shadowB } = addCameras(frameGraph, shadowMap, shadowMap);
                frameGraph.endMultiView();

                expect(frameGraph.renderPasses).to.have.lengthOf(1);
                expect(frameGraph.renderPasses[0].children).to.deep.equal([shadowA, forwardA, shadowB, forwardB]);
            });

            it('moves the shadow passes of different lights ahead of the captured passes', function () {
                const frameGraph = new FrameGraph();

                frameGraph.beginMultiView(device);
                const { forwardA, shadowA, forwardB, shadowB } = addCameras(frameGraph, {}, {});
                frameGraph.endMultiView();

                const [first, second, wrapper] = frameGraph.renderPasses;
                expect(frameGraph.renderPasses).to.have.lengthOf(3);
                expect(first).to.equal(shadowA);
                expect(second).to.equal(shadowB);
                expect(wrapper.children).to.deep.equal([forwardA, forwardB]);
            });

            it('renders the shadow passes of a light the cameras share once per view', function () {
                const frameGraph = new FrameGraph();
                const shadowMap = {};
                const view = { colorTexture: null, viewDescriptor: null, viewFormat: null };
                const xrDevice = { xrSubImages: [view, view], backBuffer: null };

                frameGraph.beginMultiView(xrDevice);
                const passes = addCameras(frameGraph, shadowMap, shadowMap);
                frameGraph.endMultiView();
                frameGraph.render(device);

                Object.values(passes).forEach((pass) => {
                    expect(pass.executeCount).to.equal(2);
                });
            });
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
