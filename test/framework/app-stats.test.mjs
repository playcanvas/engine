import { expect } from 'chai';
import { stub } from 'sinon';

import { StatsTimer } from '../../src/extras/mini-stats/stats-timer.js';
import { AppStats } from '../../src/framework/app-stats.js';
import { INDEXFORMAT_UINT16, SEMANTIC_POSITION, TYPE_FLOAT32 } from '../../src/platform/graphics/constants.js';
import { IndexBuffer } from '../../src/platform/graphics/index-buffer.js';
import { VertexBuffer } from '../../src/platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../src/platform/graphics/vertex-format.js';
import { createApp } from '../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

describe('AppStats', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    it('exposes one stable stats instance with getter-only public measurements', function () {
        const stats = app.stats;
        expect(stats).to.be.instanceOf(AppStats);
        expect(app.stats).to.equal(stats);
        expect(() => {
            app.stats = null;
        }).to.throw(TypeError);
        for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(AppStats.prototype))) {
            if (descriptor.get) {
                expect(descriptor.set, name).to.equal(undefined);
            }
        }
    });

    it('preserves application-owned counters across frames and samples map changes in MiniStats', function () {
        const user = app.stats.user;
        const otherApp = createApp();
        try {
            expect(otherApp.stats.user).not.to.equal(user);
            expect(otherApp.stats.user.size).to.equal(0);
        } finally {
            otherApp.destroy();
        }
        const timer = new StatsTimer(app, ['user.ai']);
        user.set('ai', 2.5);

        app.stats.updateBasic(1000, 0.016, 16, app.renderer, app.graphicsDevice);
        app.stats.updateDetailed(app.renderer, app.graphicsDevice);
        app.stats.frameEnd();

        expect(app.stats.user).to.equal(user);
        expect(timer.timings[0]).to.equal(2.5);

        user.set('ai', 4);
        expect(timer.timings[0]).to.equal(4);
        user.delete('ai');
        expect(timer.timings[0]).to.equal(0);
        user.set('ai', 1);
        user.clear();
        expect(timer.timings[0]).to.equal(0);
        expect(() => {
            app.stats.user = new Map();
        }).to.throw(TypeError);
    });

    it('publishes frame cadence independently of scaled simulation time and consumes draw counts once', function () {
        app.graphicsDevice._drawCallsPerFrame = 12;
        app.stats.updateBasic(1000, 0.008, 16, app.renderer, app.graphicsDevice);
        expect(app.stats.frameTime).to.equal(16);
        expect(app.stats.drawCallCount).to.equal(12);
        expect(app.stats.frame.ms).to.equal(16);
        expect(app.stats.drawCalls.total).to.equal(12);
        app.stats.updateBasic(1016, 0.008, 16, app.renderer, app.graphicsDevice);
        expect(app.stats.drawCallCount).to.equal(0);
    });

    it('tracks allocation and destruction in bytes while preserving legacy memory paths', function () {
        const stats = app.stats;
        const total = stats.vramTotalBytes;
        const vertexBytes = stats.vramVertexBufferBytes;
        const indexBytes = stats.vramIndexBufferBytes;
        // Model allocated GPU buffers: the null backend never initializes native buffer storage.
        stub(app.graphicsDevice, 'createVertexBufferImpl').returns({ initialized: true, destroy() {} });
        stub(app.graphicsDevice, 'createIndexBufferImpl').returns({ initialized: true, destroy() {} });
        const format = new VertexFormat(app.graphicsDevice, [
            { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
        ]);
        const vertices = new VertexBuffer(app.graphicsDevice, format, 4);
        const indices = new IndexBuffer(app.graphicsDevice, INDEXFORMAT_UINT16, 6);
        expect(stats.vramVertexBufferBytes - vertexBytes).to.equal(48);
        expect(stats.vramIndexBufferBytes - indexBytes).to.equal(12);
        expect(stats.vramTotalBytes - total).to.equal(60);
        expect(stats.vramTotalBytes).to.equal(stats.vram.totalUsed);
        expect(stats.vram.geom).to.equal(stats.vramVertexBufferBytes + stats.vramIndexBufferBytes);
        expect(stats.vram.buffers).to.equal(stats.vramUniformBufferBytes + stats.vramStorageBufferBytes);
        vertices.destroy();
        indices.destroy();
        expect(stats.vramTotalBytes).to.equal(total);
    });

    it('returns undefined for GPU timing with the null device', function () {
        expect(app.stats.gpuFrameTime).to.equal(undefined);
    });

    it('publishes and resets one primitive counter at the frame boundary', function () {
        const device = app.graphicsDevice;
        device._primitiveCount = 42;
        app.stats.updateDetailed(app.renderer, device);
        expect(app.stats.primitiveCount).to.equal(42);
        expect(device._primitiveCount).to.equal(0);
        expect(app.stats.frame).not.to.have.property('triangles');
        expect(app.stats.frame).not.to.have.property('otherPrimitives');
        app.stats.updateDetailed(app.renderer, device);
        expect(app.stats.primitiveCount).to.equal(0);
    });
});
