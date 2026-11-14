import { expect } from 'chai';
import sinon from 'sinon';

import { BindGroupFormat, BindStorageBufferFormat } from '../../../src/platform/graphics/bind-group-format.js';
import { BindGroup } from '../../../src/platform/graphics/bind-group.js';
import { Compute } from '../../../src/platform/graphics/compute.js';
import {
    BUFFERUSAGE_COPY_DST, BUFFERUSAGE_COPY_SRC, BUFFERUSAGE_INDIRECT, SEMANTIC_POSITION, SHADERSTAGE_COMPUTE, TYPE_FLOAT32
} from '../../../src/platform/graphics/constants.js';
import { StorageBuffer } from '../../../src/platform/graphics/storage-buffer.js';
import { VertexBuffer } from '../../../src/platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

// The usage checks report an operation the buffer was not created for, before the operation is
// recorded. The operations are stubbed, so that the invalid commands never reach the GPU.
describe('Buffer usage checks', function () {
    /** @type {Application} */
    let app;

    /** @type {any} */
    let device;

    /** @type {string[]} */
    let errors;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        device = app.graphicsDevice;
        if (!device.isWebGPU) {
            this.skip();
        }
        errors = [];
        sinon.stub(console, 'error').callsFake((...args) => {
            errors.push(args.map(String).join(' '));
        });
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const usageErrors = () => errors.filter(e => /requires (?:it|the buffer) to be created|without storage usage/.test(e));

    /**
     * @param {number} usage - The usage of the buffer.
     * @returns {StorageBuffer} A storage buffer, with its GPU operations stubbed.
     */
    const createStorageBuffer = (usage) => {
        const buffer = new StorageBuffer(device, 64, usage);
        sinon.stub(buffer.impl, 'read').resolves(new Uint8Array(64));
        sinon.stub(buffer.impl, 'write');
        sinon.stub(buffer.impl, 'clear');
        return buffer;
    };

    describe('StorageBuffer', function () {

        it('reports reading a buffer created without BUFFERUSAGE_COPY_SRC', function () {
            const buffer = createStorageBuffer(BUFFERUSAGE_COPY_DST);
            buffer.read();
            expect(usageErrors()).to.have.lengthOf(1);
            expect(usageErrors()[0]).to.include('reading the buffer').and.include('BUFFERUSAGE_COPY_SRC');
            buffer.destroy();
        });

        it('reports writing to and clearing a buffer created without BUFFERUSAGE_COPY_DST', function () {
            const buffer = createStorageBuffer(BUFFERUSAGE_COPY_SRC);
            buffer.name = 'Results';
            buffer.write(0, new Uint8Array(4));
            buffer.clear();
            expect(usageErrors()).to.have.lengthOf(2);
            expect(usageErrors()[0]).to.include('StorageBuffer Results').and.include('writing to the buffer').and.include('BUFFERUSAGE_COPY_DST');
            expect(usageErrors()[1]).to.include('clearing the buffer');
            buffer.destroy();
        });

        it('reports copying between buffers created without the copy usages', function () {
            const source = createStorageBuffer(0);
            const destination = createStorageBuffer(0);
            const copyBufferToBuffer = sinon.spy();
            sinon.stub(device, 'getCommandEncoder').returns({ copyBufferToBuffer });

            destination.copy(source);

            expect(usageErrors()).to.have.lengthOf(2);
            expect(usageErrors()[0]).to.include('copying from the buffer').and.include('BUFFERUSAGE_COPY_SRC');
            expect(usageErrors()[1]).to.include('copying to the buffer').and.include('BUFFERUSAGE_COPY_DST');
            source.destroy();
            destination.destroy();
        });

        it('reports an operation once for each buffer', function () {
            const buffer = createStorageBuffer(0);
            buffer.clear();
            buffer.clear();
            expect(usageErrors()).to.have.lengthOf(1);
            buffer.destroy();
        });

        it('does not report operations the buffer was created for', function () {
            const source = createStorageBuffer(BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
            const destination = createStorageBuffer(BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
            sinon.stub(device, 'getCommandEncoder').returns({ copyBufferToBuffer: sinon.spy() });

            source.read();
            source.write(0, new Uint8Array(4));
            source.clear();
            destination.copy(source);

            expect(usageErrors()).to.have.lengthOf(0);
            source.destroy();
            destination.destroy();
        });
    });

    describe('Compute#setupIndirectDispatch', function () {

        // the indirect dispatch only stores its parameters, and does not need a shader
        const setupIndirectDispatch = (buffer) => {
            Compute.prototype.setupIndirectDispatch.call({ name: 'Test', device }, 0, buffer);
        };

        it('reports a buffer created without BUFFERUSAGE_INDIRECT', function () {
            const buffer = createStorageBuffer(BUFFERUSAGE_COPY_DST);
            setupIndirectDispatch(buffer);
            expect(usageErrors()).to.have.lengthOf(1);
            expect(usageErrors()[0]).to.include('Compute Test').and.include('BUFFERUSAGE_INDIRECT');
            buffer.destroy();
        });

        it('does not report a buffer created with BUFFERUSAGE_INDIRECT, or the built-in buffer', function () {
            const buffer = createStorageBuffer(BUFFERUSAGE_INDIRECT);
            setupIndirectDispatch(buffer);
            setupIndirectDispatch(null);
            expect(usageErrors()).to.have.lengthOf(0);
            buffer.destroy();
        });
    });

    describe('bind group', function () {

        /**
         * @param {any} buffer - The buffer to bind to a storage buffer slot.
         */
        const bindAsStorage = (buffer) => {
            // the bind group of an invalid buffer is not created on the GPU
            sinon.stub(device.wgpu, 'createBindGroup').returns({});
            const format = new BindGroupFormat(device, [new BindStorageBufferFormat('data', SHADERSTAGE_COMPUTE)]);
            const bindGroup = new BindGroup(device, format);
            bindGroup.setStorageBuffer('data', buffer);
            bindGroup.commit();
            bindGroup.destroy();
            format.destroy();
        };

        const createVertexBuffer = (options) => {
            const vertexFormat = new VertexFormat(device, [{ semantic: SEMANTIC_POSITION, components: 4, type: TYPE_FLOAT32 }]);
            return new VertexBuffer(device, vertexFormat, 4, options);
        };

        it('reports a vertex buffer created without the storage option', function () {
            const vertexBuffer = createVertexBuffer();
            bindAsStorage(vertexBuffer);
            expect(usageErrors()).to.have.lengthOf(1);
            expect(usageErrors()[0]).to.include('VertexBuffer').and.include('[data]').and.include('storage option');
            vertexBuffer.destroy();
        });

        it('does not report a vertex buffer created with the storage option, or a storage buffer', function () {
            const vertexBuffer = createVertexBuffer({ storage: true });
            bindAsStorage(vertexBuffer);
            sinon.restore();
            sinon.stub(console, 'error').callsFake((...args) => {
                errors.push(args.map(String).join(' '));
            });
            const storageBuffer = new StorageBuffer(device, 64);
            bindAsStorage(storageBuffer);
            expect(usageErrors()).to.have.lengthOf(0);
            vertexBuffer.destroy();
            storageBuffer.destroy();
        });
    });
});
