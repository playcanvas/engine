import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { LAYERID_WORLD, SORTMODE_NONE } from '../../../src/scene/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('ForwardRenderer#debugDrawLimit', function () {
    let app;
    let world;
    let camera;
    let boxes;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        world = app.scene.layers.getLayerById(LAYERID_WORLD);
        // draws stay in the order the entities are added
        world.opaqueSortMode = SORTMODE_NONE;

        const cameraEntity = new Entity('Camera');
        cameraEntity.addComponent('camera');
        app.root.addChild(cameraEntity);
        camera = cameraEntity.camera.camera;

        boxes = [0, 1, 2, 3].map((x) => {
            const entity = new Entity(`box${x}`);
            entity.addComponent('render', { type: 'box' });
            entity.setLocalPosition(x - 1.5, 0, -6);
            app.root.addChild(entity);
            return entity.render.meshInstances[0];
        });

        // the first frame gives the device its back buffer, which a WebGPU device replaces then
        app.render();
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    /**
     * @param {object[]} meshInstances - Mesh instances.
     * @returns {string[]} Their node names, which chai reports readably when they differ.
     */
    const names = meshInstances => meshInstances.map(meshInstance => meshInstance.node?.name ?? '?');

    /**
     * @returns {string[][]} The names of the draw calls handed to each forward render of the world
     * layer's opaque list this frame.
     */
    const renderWorld = () => {
        const drawn = [];
        const renderForward = app.renderer.renderForward;
        sinon.stub(app.renderer, 'renderForward').callsFake(function (cam, rt, drawCalls, ...rest) {
            if (drawCalls.some(drawCall => boxes.includes(drawCall))) drawn.push(names(drawCalls));
            return renderForward.call(this, cam, rt, drawCalls, ...rest);
        });
        app.render();
        sinon.restore();
        return drawn;
    };

    it('is honored by the debug engine only', function () {
        // the tests run the source, where Debug calls are live
        expect(app.renderer.debugDrawLimitSupported).to.be.true;
    });

    it('draws everything without a limit', function () {
        expect(renderWorld()[0]).to.deep.equal(names(boxes));
    });

    it('cuts the matching layer to a count, or up to an instance found by identity', function () {
        const target = app.graphicsDevice.backBuffer;
        app.renderer.debugDrawLimit = { camera, renderTarget: target, layers: new Map([[world, [2, undefined]]]) };
        expect(renderWorld()[0]).to.deep.equal(names(boxes.slice(0, 2)));

        // an instance draws everything up to and including it, wherever the sort put it
        app.renderer.debugDrawLimit.layers.set(world, [{ instance: boxes[2], index: 0 }, undefined]);
        expect(renderWorld()[0]).to.deep.equal(names(boxes.slice(0, 3)));

        // one not in the list, such as culled away this frame, falls back to its last known index
        app.renderer.debugDrawLimit.layers.set(world, [{ instance: {}, index: 0 }, undefined]);
        expect(renderWorld()[0]).to.deep.equal(names(boxes.slice(0, 1)));

        // zero draws nothing from the layer, and the layer's own list keeps everything culled in
        app.renderer.debugDrawLimit.layers.set(world, [0, undefined]);
        expect(renderWorld()).to.deep.equal([]);
        expect(world._visibleInstances.get(camera).opaque.length).to.be.greaterThan(0);
    });

    it('leaves other cameras, render targets and sub-layers alone', function () {
        const target = app.graphicsDevice.backBuffer;
        const cut = new Map([[world, [1, undefined]]]);

        app.renderer.debugDrawLimit = { camera: {}, renderTarget: target, layers: cut };
        expect(renderWorld()[0]).to.deep.equal(names(boxes));
        app.renderer.debugDrawLimit = { camera, renderTarget: {}, layers: cut };
        expect(renderWorld()[0]).to.deep.equal(names(boxes));
        // the limit here is only on the transparent sub-layer
        app.renderer.debugDrawLimit = { camera, renderTarget: target, layers: new Map([[world, [undefined, 0]]]) };
        expect(renderWorld()[0]).to.deep.equal(names(boxes));
    });
});
