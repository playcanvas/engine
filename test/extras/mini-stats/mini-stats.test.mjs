import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { EventHandler } from '../../../src/core/event-handler.js';
import { CpuTimer } from '../../../src/extras/mini-stats/cpu-timer.js';
import { Graph } from '../../../src/extras/mini-stats/graph.js';
import { MiniStats } from '../../../src/extras/mini-stats/mini-stats.js';
import { StatsTimer } from '../../../src/extras/mini-stats/stats-timer.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('MiniStats', function () {
    let app;
    let stats;
    let device;
    let canvas;

    beforeEach(function () {
        jsdomSetup();
        canvas = document.createElement('canvas');
        stub(canvas, 'getBoundingClientRect').returns({ left: 0, bottom: 720, width: 1280, height: 720 });
        device = new NullGraphicsDevice(canvas);
        app = new EventHandler();
        app.graphicsDevice = device;
        app.scene = { layers: { getLayerById: () => ({ id: 4 }) } };
        app.drawMeshInstance = spy();
        app.stats = {
            drawCalls: { total: 123 },
            frame: { ms: 16.7, renderTime: 3, scriptUpdate: 1, scriptPostUpdate: 0.2, animUpdate: 0, physicsTime: 0, gsplatSort: 0 },
            gpu: new Map(),
            vram: { totalUsed: 3000000, tex: 2000000, geom: 1000000 }
        };
    });

    afterEach(function () {
        stats?.destroy();
        stats = null;
        device.destroy();
        restore();
        jsdomTeardown();
    });

    it('keeps draw calls, frame and custom counters above the CPU, GPU and VRAM groups in all modes', function () {
        const options = MiniStats.getDefaultOptions();
        options.stats.unshift({ name: 'Custom first', stats: ['frame.ms'] });
        options.stats.push({ name: 'Custom second', stats: ['frame.ms'] });
        stats = new MiniStats(app, options);
        app.stats.gpu.set('Main pass', 2);
        for (let mode = 0; mode < 3; mode++) {
            stats.activeSizeIndex = mode;
            stats.postRender();
            expect(stats.graphs.filter(graph => !graph.parent).map(graph => graph.label)).to.deep.equal([
                'Draw calls', 'Frame', 'Custom first', 'Custom second', 'CPU', 'GPU', 'VRAM'
            ]);
            for (let i = 1; i < stats.graphs.length; i++) {
                expect(stats.graphs[i].group).to.be.at.least(stats.graphs[i - 1].group);
            }
            expect(stats._showPeak).to.equal(mode === 2);
            expect(stats._showGraphs).to.equal(mode === 2);
            expect(stats.cpuGraphs.size > 0).to.equal(mode > 0);
        }
    });

    it('does not modify caller-owned size options', function () {
        const options = MiniStats.getDefaultOptions();
        options.sizes[1].width = 192;
        stats = new MiniStats(app, options);
        expect(options.sizes[1].width).to.equal(192);
        expect(stats.sizes[1]).not.to.equal(options.sizes[1]);
    });

    it('reuses cached geometry without uploads, text work or history writes in text modes', function () {
        stats = new MiniStats(app);
        for (let mode = 0; mode < 2; mode++) {
            stats.activeSizeIndex = mode;
            stats.postRender();
            stats.update(stats.textRefreshRate);
            stats.postRender();
            const data = stats.render2d.data;
            const upload = spy(stats.render2d.buffer, 'setData');
            const unlock = spy(stats.texture, 'unlock');
            const measure = spy(stats.wordAtlas, 'measure');
            app.drawMeshInstance.resetHistory();
            for (let i = 0; i < 10; i++) {
                stats.update(16);
                stats.postRender();
            }
            expect(stats.render2d.data).to.equal(data);
            expect(upload.callCount).to.equal(0);
            expect(unlock.callCount).to.equal(0);
            expect(measure.callCount).to.equal(0);
            expect(app.drawMeshInstance.callCount).to.equal(10);
            upload.restore();
            unlock.restore();
            measure.restore();
        }
    });

    it('updates all histories with one texture unlock and preserves text geometry between refreshes', function () {
        stats = new MiniStats(app);
        stats.activeSizeIndex = 2;
        stats.postRender();
        const data = stats.render2d.data;
        const unlock = spy(stats.texture, 'unlock');
        const measure = spy(stats.wordAtlas, 'measure');
        const upload = spy(stats.render2d.buffer, 'setData');
        for (let i = 0; i < 10; i++) {
            stats.update(16);
            stats.postRender();
        }
        expect(unlock.callCount).to.equal(10);
        expect(upload.callCount).to.equal(10);
        expect(measure.callCount).to.equal(0);
        expect(stats.render2d.data).to.equal(data);
        expect(stats.graphs.every(graph => graph.cursor === 10)).to.be.true;
    });

    it('preserves existing history when new GPU passes grow the texture', function () {
        stats = new MiniStats(app);
        stats.activeSizeIndex = 2;
        stats.postRender();
        stats.update(16);
        const graph = stats.graphs[0];
        const offset = graph.yOffset * stats.texture.width * 4;
        const before = stats.texture.lock().slice(offset, offset + 4);
        stats.texture.unlock();
        const oldHeight = stats.texture.height;
        for (let i = 0; i < 20; i++) app.stats.gpu.set(`Pass.${i}`, 1);
        stats.postRender();
        expect(stats.texture.height).to.be.greaterThan(oldHeight);
        expect(stats.texture.lock().slice(offset, offset + 4)).to.deep.equal(before);
        stats.texture.unlock();
        stats.update(16);
        expect(stats.gpuPassGraphs.get('Pass.0').timer.timings[0]).to.equal(1);
    });

    it('clears reused rows and removes inactive GPU passes without orphan counters', function () {
        stats = new MiniStats(app);
        stats.activeSizeIndex = 2;
        app.stats.gpu.set('Old pass', 12);
        stats.postRender();
        stats.update(16);
        const oldRow = stats.gpuPassGraphs.get('Old pass').yOffset;
        app.stats.gpu.clear();
        stats.frameIndex += 241;
        stats.postRender();
        expect(stats.gpuPassGraphs.size).to.equal(0);
        app.stats.gpu.set('New pass', 2);
        stats.postRender();
        expect(stats.gpuPassGraphs.get('New pass').yOffset).to.equal(oldRow);
        stats.update(16);
        const row = stats.texture.lock().slice(oldRow * stats.texture.width * 4, (oldRow + 1) * stats.texture.width * 4);
        stats.texture.unlock();
        expect(row[3]).to.equal(170);
        expect(row.subarray(4).every(value => value === 0)).to.be.true;
        stats.activeSizeIndex = 0;
        expect(stats.graphs.every(graph => graph.parent === null)).to.be.true;
    });

    it('does not create sub-counters when their category is disabled', function () {
        const options = MiniStats.getDefaultOptions();
        options.cpu.enabled = false;
        options.gpu.enabled = false;
        options.stats = options.stats.filter(stat => stat.name !== 'VRAM');
        options.startSizeIndex = 2;
        stats = new MiniStats(app, options);
        app.stats.gpu.set('Pass', 2);
        stats.postRender();
        expect(stats.graphs).to.have.length(2);
    });

    it('keeps the panel inside a short viewport and clamps scrolling', function () {
        canvas.getBoundingClientRect.returns({ left: 0, bottom: 180, width: 200, height: 180 });
        stats = new MiniStats(app);
        stats.activeSizeIndex = 2;
        stats.postRender();
        const firstRowY = stats.render2d.data[stats.graphs[0].quad * 32 + 1];
        stats.scroll(10000);
        stats.render();
        expect(stats.render2d.data[stats.graphs[0].quad * 32 + 1]).to.equal(firstRowY);
        expect(stats._panelWidth).to.equal(184);
        expect(stats._panelHeight).to.equal(164);
        expect(stats._scroll).to.equal(stats._maxScroll);
        for (let i = 0; i < stats.render2d.quads * 32; i += 8) {
            expect(stats.render2d.data[i]).to.be.within(0, 1);
            expect(stats.render2d.data[i + 1]).to.be.within(0, 1);
        }
        stats.activeSizeIndex = 0;
        expect(stats._scroll).to.equal(0);
    });

    it('stops sampling and hit testing while disabled, and keeps history off on re-enable', function () {
        stats = new MiniStats(app);
        stats.activeSizeIndex = 1;
        stats.postRender();
        stats.enabled = false;
        const timer = spy(stats.graphs[0], 'update');
        stats.update(16);
        stats.postRender();
        expect(timer.called).to.be.false;
        expect(stats.div.style.display).to.equal('none');
        stats.enabled = true;
        expect(stats.graphs.every(graph => !graph.enabled)).to.be.true;
    });

    it('releases event listeners and GPU resources when the application is destroyed', function () {
        stats = new MiniStats(app);
        const queued = [stats.render2d.meshInstance];
        app.scene.immediate = { layerMeshInstances: new Map([[stats.drawLayer, queued]]) };
        const texture = spy(stats.texture, 'destroy');
        const buffer = spy(stats.render2d.buffer, 'destroy');
        app.fire('destroy');
        expect(app.hasEvent('frameupdate')).to.be.false;
        expect(app.hasEvent('framerender')).to.be.false;
        expect(app.hasEvent('frameend')).to.be.false;
        expect(app.hasEvent('postrender')).to.be.false;
        expect(texture.calledOnce).to.be.true;
        expect(buffer.calledOnce).to.be.true;
        expect(queued).to.have.length(0);
        expect(document.getElementById('mini-stats')).to.equal(null);
        stats.destroy();
        expect(texture.calledOnce).to.be.true;
    });

    it('reuses timer storage and resolves counters after the stats object is replaced', function () {
        const timer = new StatsTimer(app, ['frame.ms', 'drawCalls.total']);
        const values = timer.timings;
        app.stats = { frame: { ms: 20 }, drawCalls: { total: 8 } };
        expect(timer.timings).to.equal(values);
        expect(Array.from(values)).to.deep.equal([20, 8]);
        const cpu = new CpuTimer(app);
        const timings = cpu.timings;
        app.fire('frameupdate');
        app.fire('framerender');
        app.fire('frameend');
        app.fire('frameupdate');
        expect(cpu.timings).to.equal(timings);
        cpu.destroy();
    });

    it('publishes averages and peaks over separate 500 ms windows while history advances every frame', function () {
        stats = new MiniStats(app);
        stats.activeSizeIndex = 2;
        const graph = stats.graphs.find(graph => graph.name === 'Frame');
        app.stats.frame.ms = 10;
        stats.update(200);
        app.stats.frame.ms = 20;
        stats.update(299);
        expect(graph.timingText).to.equal('—');
        expect(graph.cursor).to.equal(2);
        app.stats.frame.ms = 30;
        stats.update(1);
        expect(graph.timingText).to.equal('20.0');
        expect(graph.maxText).to.equal('30.0');
        expect(graph.cursor).to.equal(3);
        app.stats.frame.ms = 5;
        stats.update(500);
        expect(graph.timingText).to.equal('5.0');
        expect(graph.maxText).to.equal('5.0');
        expect(graph.cursor).to.equal(4);
    });

    it('distinguishes average changes from peak-only changes', function () {
        const timer = { timings: [2], decimalPlaces: 0 };
        const graph = new Graph('Test', app, 10, 32, timer);
        graph.update(16, null);
        graph.update(16, null);
        timer.timings[0] = 1;
        graph.update(16, null);
        timer.timings[0] = 3;
        expect(graph.update(16, null)).to.equal(2);
        expect(graph.timingText).to.equal('2');
        expect(graph.maxText).to.equal('3');
    });
});
