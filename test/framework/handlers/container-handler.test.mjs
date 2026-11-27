import { expect } from 'chai';

import { AppBase } from '../../../src/framework/app-base.js';
import { AppOptions } from '../../../src/framework/app-options.js';
import { featureGsplat } from '../../../src/framework/features/feature-gsplat.js';
import { ContainerHandler } from '../../../src/framework/handlers/container.js';
import { GlbContainerParser } from '../../../src/framework/parsers/glb-container-parser.js';
import {
    getGlbResourceExtensions,
    registerGlbResourceExtension,
    unregisterGlbResourceExtension
} from '../../../src/framework/parsers/glb-resource-extension.js';
import { createApp } from '../../app.mjs';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('ContainerHandler (parser selection)', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const select = (handler, url) => handler._selectParser(handler._makeContext({ load: url, original: url }));

    it('registers the GLB container parser', function () {
        const handler = app.loader.getHandler('container');
        expect(handler.parsers).to.have.lengthOf(1);
        expect(handler.parsers[0]).to.be.an.instanceof(GlbContainerParser);
    });

    it('routes any extension to the GLB container parser (catch-all)', function () {
        const handler = app.loader.getHandler('container');
        expect(select(handler, 'model.glb')).to.be.an.instanceof(GlbContainerParser);
        expect(select(handler, 'model.gltf')).to.be.an.instanceof(GlbContainerParser);
        expect(select(handler, 'model.anything')).to.be.an.instanceof(GlbContainerParser);
    });

    it('registers and unregisters glTF resource extensions with the resource loader', function () {
        const initialExtensions = getGlbResourceExtensions(app.loader);
        const extension = {
            name: 'TEST_extension',
            resourceName: 'testResources',
            createResources: () => []
        };

        registerGlbResourceExtension(app.loader, extension);
        expect(getGlbResourceExtensions(app.loader)).to.deep.equal([...initialExtensions, extension]);

        unregisterGlbResourceExtension(app.loader, extension.name);
        expect(getGlbResourceExtensions(app.loader)).to.deep.equal(initialExtensions);
    });

    it('returns no glTF resource extensions for a handler not added to a loader', function () {
        expect(getGlbResourceExtensions(undefined)).to.deep.equal([]);
    });

    it('registers the Gaussian splatting extension when AppBase installs the gsplat feature', function () {
        const canvas = document.createElement('canvas');
        const options = new AppOptions();
        options.graphicsDevice = createGraphicsDevice(canvas);
        options.resourceHandlers = [ContainerHandler];
        options.features = [featureGsplat];

        const appBase = new AppBase(canvas);
        appBase.init(options);

        const loader = appBase.loader;
        try {
            expect(getGlbResourceExtensions(loader).map(extension => extension.name)).to.include('KHR_gaussian_splatting');
        } finally {
            appBase.destroy();
        }
        expect(getGlbResourceExtensions(loader)).to.be.empty;
    });

    it('registers glTF resource extensions without the container handler, for one added later', function () {
        const canvas = document.createElement('canvas');
        const options = new AppOptions();
        options.graphicsDevice = createGraphicsDevice(canvas);
        options.features = [featureGsplat];

        const appBase = new AppBase(canvas);
        appBase.init(options);

        try {
            const handler = new ContainerHandler(appBase);
            appBase.loader.addHandler('container', handler);
            const parser = new GlbContainerParser(appBase.graphicsDevice, appBase.assets);
            handler.addParser(parser);

            expect(getGlbResourceExtensions(parser.handler._loader).map(extension => extension.name)).to.include('KHR_gaussian_splatting');
        } finally {
            appBase.destroy();
        }
    });
});
