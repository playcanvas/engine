import { expect } from 'chai';

import { AppBase } from '../../../src/framework/app-base.js';
import { AppOptions } from '../../../src/framework/app-options.js';
import { GSplatComponentSystem } from '../../../src/framework/components/gsplat/system.js';
import { ContainerHandler } from '../../../src/framework/handlers/container.js';
import { GlbContainerParser } from '../../../src/framework/parsers/glb-container-parser.js';
import {
    getGlbResourceExtensions,
    registerGlbResourceExtension,
    unregisterGlbResourceExtension
} from '../../../src/framework/parsers/glb-resource-extension.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { createApp } from '../../app.mjs';
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

    it('registers and unregisters glTF resource extensions', function () {
        const handler = app.loader.getHandler('container');
        const initialExtensions = getGlbResourceExtensions(handler);
        const extension = {
            name: 'TEST_extension',
            resourceName: 'testResources',
            handlesPrimitive: () => false,
            createResources: () => []
        };

        expect(registerGlbResourceExtension(handler, extension)).to.equal(true);
        expect(getGlbResourceExtensions(handler)).to.deep.equal([...initialExtensions, extension]);

        unregisterGlbResourceExtension(handler, extension.name);
        expect(getGlbResourceExtensions(handler)).to.deep.equal(initialExtensions);
    });

    it('registers the Gaussian splatting extension when AppBase initializes its component system', function () {
        const canvas = document.createElement('canvas');
        const options = new AppOptions();
        options.graphicsDevice = new NullGraphicsDevice(canvas);
        options.resourceHandlers = [ContainerHandler];
        options.componentSystems = [GSplatComponentSystem];

        const appBase = new AppBase(canvas);
        appBase.init(options);

        const handler = appBase.loader.getHandler('container');
        try {
            expect(getGlbResourceExtensions(handler).map(extension => extension.name)).to.include('KHR_gaussian_splatting');
        } finally {
            appBase.destroy();
        }
        expect(getGlbResourceExtensions(handler)).to.be.empty;
    });

    it('makes registered glTF resource extensions available to parsers added later', function () {
        const canvas = document.createElement('canvas');
        const options = new AppOptions();
        options.graphicsDevice = new NullGraphicsDevice(canvas);
        options.resourceHandlers = [ContainerHandler];
        options.componentSystems = [GSplatComponentSystem];

        const appBase = new AppBase(canvas);
        appBase.init(options);

        const handler = appBase.loader.getHandler('container');
        const parser = new GlbContainerParser(appBase.graphicsDevice, appBase.assets);
        handler.addParser(parser);

        try {
            expect(getGlbResourceExtensions(parser.handler).map(extension => extension.name)).to.include('KHR_gaussian_splatting');
        } finally {
            appBase.destroy();
        }
    });
});
