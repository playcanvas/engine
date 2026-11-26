import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { SceneParser } from '../../../src/framework/parsers/scene.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// minimal uncompressed entity data
const entityData = (id, name, parent, children, components) => ({
    resource_id: id,
    name,
    parent,
    children,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    components
});

// a root entity and one child with the given components
const sceneData = childComponents => ({
    entities: {
        root: entityData('root', 'Root', null, ['child'], {}),
        child: entityData('child', 'Child', 'root', [], childComponents)
    }
});

describe('SceneParser', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        // Debug.removed dedupes globally - clear so these assertions are order-independent
        Debug._loggedMessages.clear();
    });

    afterEach(function () {
        restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#parse', function () {

        it('creates the components of every entity', function () {
            const root = new SceneParser(app, false).parse(sceneData({ camera: { fov: 30 } }));

            expect(root.name).to.equal('Root');
            expect(root.children[0].camera.fov).to.equal(30);
        });

        it('reports removed animation components once and creates the rest', function () {
            const errorStub = stub(console, 'error');
            const data = sceneData({ animation: { speed: 2 }, camera: { fov: 30 } });
            data.entities.root.components = { animation: { speed: 1 } };

            const root = new SceneParser(app, false).parse(data);

            const child = root.children[0];
            expect(child.c.animation).to.be.undefined;
            expect(child.camera.fov).to.equal(30);
            expect(errorStub.calledOnce).to.be.true;
            expect(errorStub.firstCall.args[0]).to.match(/^REMOVED: The scene contains animation components/);
        });

        it('reports nothing for a scene without animation components', function () {
            const errorStub = stub(console, 'error');

            new SceneParser(app, false).parse(sceneData({ camera: {} }));

            expect(errorStub.called).to.be.false;
        });
    });
});
