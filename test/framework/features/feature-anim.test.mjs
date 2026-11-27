import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { AppBase } from '../../../src/framework/app-base.js';
import { AppOptions } from '../../../src/framework/app-options.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { AnimComponentSystem } from '../../../src/framework/components/anim/system.js';
import { Entity } from '../../../src/framework/entity.js';
import { FEATURE_ANIM } from '../../../src/framework/features/constants.js';
import { featureAnim } from '../../../src/framework/features/feature-anim.js';
import { AnimClipHandler } from '../../../src/framework/handlers/anim-clip.js';
import { AnimStateGraphHandler } from '../../../src/framework/handlers/anim-state-graph.js';
import { AnimationHandler } from '../../../src/framework/handlers/animation.js';
import { ContainerHandler } from '../../../src/framework/handlers/container.js';
import { glbAnimations } from '../../../src/framework/parsers/glb/animations.js';
import { getGlbResourceExtensions } from '../../../src/framework/parsers/glb-resource-extension.js';
import { hasFeature } from '../../../src/scene/features/constants.js';
import { createApp } from '../../app.mjs';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Anim feature', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    // an application with only the given options, rather than everything the test app registers
    const createMinimalApp = (options) => {
        const canvas = document.createElement('canvas');
        const appOptions = new AppOptions();
        appOptions.graphicsDevice = createGraphicsDevice(canvas);
        Object.assign(appOptions, options);

        const minimal = new AppBase(canvas);
        minimal.init(appOptions);
        return minimal;
    };

    it('installs the anim component system and the anim asset handlers', function () {
        app = createMinimalApp({ features: [featureAnim] });

        expect(hasFeature(app.graphicsDevice, FEATURE_ANIM)).to.equal(true);
        expect(app.systems.anim).to.be.an.instanceof(AnimComponentSystem);
        expect(app.loader.getHandler('animclip')).to.be.an.instanceof(AnimClipHandler);
        expect(app.loader.getHandler('animstategraph')).to.be.an.instanceof(AnimStateGraphHandler);
        expect(app.loader.getHandler('animation')).to.be.an.instanceof(AnimationHandler);
        expect(getGlbResourceExtensions(app.loader)).to.include(glbAnimations);

        const entity = new Entity('Animated', app);
        entity.addComponent('anim');
        expect(entity.anim).to.exist;
    });

    it('is installed by the test application', function () {
        app = createApp();

        expect(hasFeature(app.graphicsDevice, FEATURE_ANIM)).to.equal(true);
        expect(app.systems.anim).to.be.an.instanceof(AnimComponentSystem);
    });

    it('leaves the application without anim components when not listed', function () {
        app = createMinimalApp({});

        expect(hasFeature(app.graphicsDevice, FEATURE_ANIM)).to.equal(false);
        expect(app.systems.anim).to.be.undefined;
        expect(app.loader.getHandler('animclip')).to.be.undefined;
        expect(app.loader.getHandler('animstategraph')).to.be.undefined;
        expect(app.loader.getHandler('animation')).to.be.undefined;
        expect(getGlbResourceExtensions(app.loader)).to.not.include(glbAnimations);
    });

    describe('glTF animations', function () {

        // a glTF file with one node, rotated by one animation of two keys
        const createAnimatedGltf = () => {
            const times = new Float32Array([0, 1]);
            const rotations = new Float32Array([0, 0, 0, 1, 0, 0.7071068, 0, 0.7071068]);
            const bytes = new Uint8Array(times.byteLength + rotations.byteLength);
            bytes.set(new Uint8Array(times.buffer), 0);
            bytes.set(new Uint8Array(rotations.buffer), times.byteLength);

            const gltf = {
                asset: { version: '2.0' },
                scene: 0,
                scenes: [{ nodes: [0] }],
                nodes: [{ name: 'node' }],
                animations: [{
                    name: 'turn',
                    channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }],
                    samplers: [{ input: 0, output: 1 }]
                }],
                accessors: [
                    { bufferView: 0, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
                    { bufferView: 1, componentType: 5126, count: 2, type: 'VEC4' }
                ],
                bufferViews: [
                    { buffer: 0, byteOffset: 0, byteLength: times.byteLength },
                    { buffer: 0, byteOffset: times.byteLength, byteLength: rotations.byteLength }
                ],
                buffers: [{ byteLength: bytes.length, uri: `data:application/octet-stream;base64,${Buffer.from(bytes).toString('base64')}` }]
            };
            return new TextEncoder().encode(JSON.stringify(gltf)).buffer;
        };

        // loads the animated glTF file as a container asset of the application
        const loadContainer = () => new Promise((resolve, reject) => {
            const asset = new Asset('animated', 'container', { url: 'animated.gltf', contents: createAnimatedGltf() });
            asset.once('load', () => resolve(asset.resource));
            asset.once('error', reject);
            app.assets.add(asset);
            app.assets.load(asset);
        });

        it('loads the animations of a container with the feature', async function () {
            app = createMinimalApp({ features: [featureAnim], resourceHandlers: [ContainerHandler] });

            const container = await loadContainer();

            expect(container.animations).to.have.lengthOf(1);
            const track = container.animations[0].resource;
            expect(track.name).to.equal('turn');
            expect(track.duration).to.equal(1);
            expect(track.curves[0].paths[0].propertyPath).to.deep.equal(['localRotation']);
        });

        it('loads a container without its animations, and reports them, without the feature', async function () {
            const warn = sinon.stub(Debug, 'warnOnce');
            app = createMinimalApp({ resourceHandlers: [ContainerHandler] });

            const container = await loadContainer();

            expect(container.animations).to.deep.equal([]);
            const messages = warn.getCalls().map(call => String(call.args[0]));
            expect(messages.some(message => message.includes('animated.gltf') && message.includes('featureAnim'))).to.equal(true);
        });
    });
});
