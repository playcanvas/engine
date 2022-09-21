import { Application } from '../../src/framework/application.js';
import { SceneRegistry } from '../../src/framework/scene-registry.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';

describe('SceneRegistry', function () {

    let app;

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);
    });

    afterEach(function () {
        app.destroy();
    });

    describe('#constructor', function () {

        it('creates a new scene registry', function () {
            const registry = new SceneRegistry(app);

            expect(registry.list().length).to.equal(0);
        });

    });

    describe('#add', function () {

        it('adds a single scene to the registry', function () {
            const registry = new SceneRegistry(app);

            registry.add('New Scene', '/test.json');

            expect(registry.list().length).to.equal(1);
        });

        it('adds multiple scenes to the registry', function () {
            const registry = new SceneRegistry(app);
            registry.add('New Scene 1', '/test1.json');
            registry.add('New Scene 2', '/test2.json');
            registry.add('New Scene 3', '/test3.json');

            expect(registry.list().length).to.equal(3);
            expect(registry.list()[0].url).to.equal('/test1.json');
            expect(registry.list()[1].url).to.equal('/test2.json');
            expect(registry.list()[2].url).to.equal('/test3.json');

            expect(registry.find('New Scene 1').url).to.equal('/test1.json');
            expect(registry.find('New Scene 2').url).to.equal('/test2.json');
            expect(registry.find('New Scene 3').url).to.equal('/test3.json');
        });

    });

    describe('#find', function () {

        it('find', function () {
            const registry = new SceneRegistry(app);
            registry.add('New Scene', '/test.json');

            const result = registry.find('New Scene');

            expect(result.name).to.equal('New Scene');
            expect(result.url).to.equal('/test.json');
        });

    });

    describe('#findByUrl', function () {

        it('url index', function () {
            const registry = new SceneRegistry(app);
            registry.add('New Scene 1', '/test1.json');

            const result = registry.findByUrl('/test1.json');
            expect(result.name).to.equal('New Scene 1');
            expect(result.url).to.equal('/test1.json');
        });

    });

    describe('#list', function () {

        it('lists the scenes in the registry', function () {
            const registry = new SceneRegistry(app);
            registry.add('New Scene 1', '/test1.json');
            registry.add('New Scene 2', '/test2.json');
            registry.add('New Scene 3', '/test3.json');

            expect(registry.list().length).to.equal(3);
            expect(registry.list()[0].url).to.equal('/test1.json');
            expect(registry.list()[1].url).to.equal('/test2.json');
            expect(registry.list()[2].url).to.equal('/test3.json');
        });

    });

    const promisedLoadSceneData = function (registry, sceneItemOrNameOrUrl) {
        return new Promise(function (resolve, reject) {
            registry.loadSceneData(sceneItemOrNameOrUrl, function (err, sceneItem) {
                if (err) {
                    resolve(err);
                }

                resolve(sceneItem);
            });
        });
    };

    describe('#loadSceneData', function () {

        const assetPath = 'http://localhost:3000/test/test-assets/';

        it('load and cache, check data is valid, unload data, check data is removed with SceneItem', async function () {
            const registry = new SceneRegistry(app);
            registry.add('New Scene 1', `${assetPath}scene.json`);

            const sceneItem = registry.find('New Scene 1');
            await promisedLoadSceneData(registry, sceneItem);

            expect(sceneItem).to.exist;
            expect(sceneItem.data).to.exist;
            expect(sceneItem._loading).to.equal(false);

            registry.unloadSceneData(sceneItem);
            expect(sceneItem.data).to.null;
            expect(sceneItem._loading).to.equal(false);
        });

        it('load and cache, check data is valid, unload data, check data is removed with Urls', async function () {
            const registry = new SceneRegistry(app);
            const sceneUrl = `${assetPath}scene.json`;
            registry.add('New Scene 1', sceneUrl);

            const sceneItem = await promisedLoadSceneData(registry, sceneUrl);
            expect(sceneItem).to.exist;
            expect(sceneItem.data).to.exist;
            expect(sceneItem._loading).to.equal(false);

            registry.unloadSceneData(sceneUrl);
            expect(sceneItem.data).to.null;
            expect(sceneItem._loading).to.equal(false);
        });

        it('try to load scene data that by name', async function () {
            const registry = new SceneRegistry(app);
            registry.add('New Scene 1', `${assetPath}scene.json`);

            const sceneItem = await promisedLoadSceneData(registry, 'New Scene 1');

            expect(sceneItem).to.exist;
            expect(sceneItem.data).to.exist;
            expect(sceneItem._loading).to.equal(false);
        });

        it('try to load scene data that by URL', async function () {
            const registry = new SceneRegistry(app);
            registry.add('New Scene 1', `${assetPath}scene.json`);

            const sceneItem = await promisedLoadSceneData(registry, `${assetPath}scene.json`);

            expect(sceneItem).to.exist;
            expect(sceneItem.data).to.exist;
            expect(sceneItem._loading).to.equal(false);
        });
    });

    describe('#remove', function () {

        it('remove', function () {
            const registry = new SceneRegistry(app);
            registry.add('New Scene', '/test.json');

            registry.remove('New Scene');

            expect(registry.list().length).to.equal(0);
            expect(registry.find('New Scene')).to.equal(null);
        });

        it('remove middle value', function () {
            const registry = new SceneRegistry(app);
            registry.add('New Scene 1', '/test1.json');
            registry.add('New Scene 2', '/test2.json');
            registry.add('New Scene 3', '/test3.json');

            registry.remove('New Scene 2');

            expect(registry.list().length).to.equal(2);
            expect(registry.list()[0].url).to.equal('/test1.json');
            expect(registry.list()[1].url).to.equal('/test3.json');

            expect(registry.find('New Scene 1').url).to.equal('/test1.json');
            expect(registry.find('New Scene 3').url).to.equal('/test3.json');
        });

        it('remove middle, url index', function () {
            const registry = new SceneRegistry(app);
            registry.add('New Scene 1', '/test1.json');
            registry.add('New Scene 2', '/test2.json');
            registry.add('New Scene 3', '/test3.json');

            registry.remove('New Scene 2');

            expect(registry.findByUrl('/test1.json').name).to.equal('New Scene 1');
            expect(registry.findByUrl('/test2.json')).to.equal(null);
            expect(registry.findByUrl('/test3.json').name).to.equal('New Scene 3');
        });

    });

});
