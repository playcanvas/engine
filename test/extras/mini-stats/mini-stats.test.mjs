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

    it('groups custom counters under User above the CPU, GPU and VRAM groups', function () {
        const options = MiniStats.getDefaultOptions();
        options.stats.unshift({ name: 'Custom first', stats: ['user.first'] });
        options.stats.push({ name: 'Update', stats: ['frame.updateTime'] });
        options.stats.push({ name: 'FPS', stats: ['frame.fps'] });
        options.stats.push({ name: 'Custom second', stats: ['user.second'] });
        stats = new MiniStats(app, options);
        app.stats.gpu.set('Main pass', 2);
        for (let mode = 0; mode < 3; mode++) {
            stats.activeSizeIndex = mode;
            stats.postRender();
            expect(stats.graphs.filter(graph => !graph.parent).map(graph => graph.label)).to.deep.equal([
                'Engine', 'User', 'CPU', 'GPU', 'VRAM'
            ]);
            const user = stats.graphs.find(graph => graph.headerOnly && graph.name === 'User');
            const engine = stats.graphs.find(graph => graph.headerOnly && graph.name === 'Engine');
            expect(stats.graphs.filter(graph => graph.parent === engine).map(graph => graph.label)).to.deep.equal(['Draw calls', 'Frame', 'Update', 'FPS']);
            expect(stats.graphs.filter(graph => graph.parent === user).map(graph => graph.label)).to.deep.equal(['Custom first', 'Custom second']);
            expect(user.headerTop > user.headerBottom).to.equal(mode > 0);
            expect(stats._showPeak).to.equal(mode === 2);
            expect(stats._showGraphs).to.equal(mode === 2);
            expect(stats.cpuGraphs.size > 0).to.equal(mode > 0);
        }
    });

    it('omits User when no custom counters are configured and keeps headings unindented', function () {
        const options = MiniStats.getDefaultOptions(['gsplats']);
        options.stats.push({ name: 'Update', stats: ['frame.updateTime'] });
        options.stats.push({ name: 'FPS', stats: ['frame.fps'] });
        stats = new MiniStats(app, options);
        stats.activeSizeIndex = 2;
        const render = spy(stats.wordAtlas, 'render');
        stats.postRender();
        expect(stats.graphs.some(graph => graph.headerOnly && graph.name === 'User')).to.be.false;
        for (const label of ['Engine', 'CPU', 'GPU', 'VRAM']) {
            expect(render.getCalls().find(call => call.args[1] === label).args[2]).to.equal(18);
        }
        expect(render.getCalls().some(call => ['▸', '▾'].includes(call.args[1]))).to.be.false;
    });

    it('hides all engine counters, including draw calls and frame time, when Engine is collapsed', function () {
        const options = MiniStats.getDefaultOptions(['gsplats']);
        options.stats.push({ name: 'FPS', stats: ['frame.fps'] });
        options.startSizeIndex = 2;
        stats = new MiniStats(app, options);
        stats.postRender();
        const engine = stats.graphs.find(graph => graph.headerOnly && graph.name === 'Engine');
        const children = stats.graphs.filter(graph => graph.parent === engine);
        expect(children.map(graph => graph.name)).to.deep.equal(['DrawCalls', 'Frame', 'GSplats', 'FPS']);
        stats.div.dispatchEvent(new window.MouseEvent('click', {
            clientY: stats.div.getBoundingClientRect().bottom + 8 - (engine.headerTop + engine.headerBottom) / 2
        }));
        stats.postRender();
        expect(children.every(graph => graph.quad === -1)).to.be.true;
        expect(engine.headerTop).to.be.greaterThan(engine.headerBottom);
        stats.activeSizeIndex = 0;
        stats.activeSizeIndex = 2;
        stats.postRender();
        expect(stats.collapsedGroups.has(engine.group)).to.be.true;
        expect(children.every(graph => graph.quad === -1)).to.be.true;
    });

    it('collapses user counters without aggregating unlike units or hiding them in compact mode', function () {
        const options = MiniStats.getDefaultOptions();
        options.stats.push({ name: 'Custom', stats: ['user.duration'], unitsName: 'ms' });
        app.stats.user = new Map([['duration', 16.7]]);
        options.startSizeIndex = 2;
        stats = new MiniStats(app, options);
        const render = spy(stats.wordAtlas, 'render');
        stats.postRender();
        const user = stats.graphs.find(graph => graph.headerOnly && graph.name === 'User');
        const custom = stats.graphs.find(graph => graph.parent === user);
        const baseline = Math.round(user.headerBottom + (stats.height - 14) / 2 + 3);
        expect(render.getCalls().filter(call => call.args[3] === baseline).map(call => call.args[1])).to.deep.equal(['User']);
        expect(render.getCalls().some(call => call.args[1] === 'ms' && call.args[3] === baseline - stats.height)).to.be.true;
        expect(stats.graphRows.has(user)).to.be.false;
        stats.div.dispatchEvent(new window.MouseEvent('click', {
            clientY: stats.div.getBoundingClientRect().bottom + 8 - (user.headerTop + user.headerBottom) / 2
        }));
        stats.postRender();
        expect(custom.quad).to.equal(-1);
        const cursor = custom.cursor;
        stats.update(500);
        expect(custom.cursor).to.equal(cursor + 1);
        expect(custom.timingText).to.equal('17');
        stats.activeSizeIndex = 0;
        render.resetHistory();
        stats.postRender();
        expect(render.getCalls().some(call => call.args[1] === 'User')).to.be.false;
        expect(render.getCalls().some(call => call.args[1] === 'Custom')).to.be.true;
        stats.activeSizeIndex = 1;
        render.resetHistory();
        stats.postRender();
        expect(stats.collapsedGroups.has(user.group)).to.be.true;
        expect(render.getCalls().some(call => call.args[1] === 'User')).to.be.true;
        expect(render.getCalls().some(call => call.args[1] === 'Custom')).to.be.false;
    });

    it('does not modify caller-owned size options', function () {
        const options = MiniStats.getDefaultOptions();
        options.sizes[1].width = 192;
        stats = new MiniStats(app, options);
        expect(options.sizes[1].width).to.equal(192);
        expect(stats.sizes[1]).not.to.equal(options.sizes[1]);
        expect(stats.graphs.filter(graph => graph.headerOnly).map(graph => graph.name)).to.deep.equal(['Engine']);
    });

    it('supports collapse properties before sub-counters exist and keeps them synchronized with clicks', function () {
        const options = MiniStats.getDefaultOptions();
        options.stats.push({ name: 'Custom', stats: ['user.custom'] });
        stats = new MiniStats(app, options);
        const sections = [
            ['engineCollapsed', 'Engine'],
            ['userCollapsed', 'User'],
            ['cpuCollapsed', 'CPU'],
            ['gpuCollapsed', 'GPU'],
            ['vramCollapsed', 'VRAM']
        ];
        for (const [property] of sections) {
            expect(stats[property]).to.be.false;
            stats[property] = true;
        }
        app.stats.gpu.set('Main pass', 2);
        stats.activeSizeIndex = 2;
        stats.postRender();
        expect(stats.graphs.filter(graph => graph.parent).every(graph => graph.quad === -1)).to.be.true;
        for (const [property, name] of sections) {
            expect(stats[property]).to.be.true;
            const parent = stats.graphs.find(graph => !graph.parent && graph.name === name);
            stats.div.dispatchEvent(new window.MouseEvent('click', {
                clientY: stats.div.getBoundingClientRect().bottom + 8 - (parent.headerTop + parent.headerBottom) / 2
            }));
            stats.postRender();
            expect(stats[property]).to.be.false;
            expect(stats.graphs.filter(graph => graph.parent === parent).every(graph => graph.quad >= 0)).to.be.true;
            stats[property] = true;
            stats.postRender();
        }
        stats.activeSizeIndex = 0;
        stats.activeSizeIndex = 1;
        stats.postRender();
        for (const [property] of sections) expect(stats[property]).to.be.true;
    });

    it('collapses each category without changing size, sampling or history', function () {
        stats = new MiniStats(app);
        stats.activeSizeIndex = 2;
        app.stats.gpu.set('Main pass', 2);
        stats.postRender();
        const click = parent => stats.div.dispatchEvent(new window.MouseEvent('click', {
            clientY: stats.div.getBoundingClientRect().bottom + 8 - (parent.headerTop + parent.headerBottom) / 2
        }));
        for (const parent of [stats.cpuGraph, stats.gpuGraph, stats.vramGraph]) {
            const children = stats.graphs.filter(graph => graph.parent === parent);
            const height = stats.overallHeight;
            const cursor = children[0].cursor;
            click(parent);
            stats.postRender();
            expect(stats.activeSizeIndex).to.equal(2);
            expect(stats.overallHeight).to.equal(height - children.length * stats.height);
            expect(parent.quad).to.be.at.least(0);
            expect(children.every(graph => graph.quad === -1)).to.be.true;
            stats.update(stats.textRefreshRate);
            expect(children.every(graph => graph.cursor === cursor + 1)).to.be.true;
            expect(children.every(graph => graph.timingText !== '—')).to.be.true;
            click(parent);
            stats.postRender();
            expect(stats.overallHeight).to.equal(height);
            expect(children.every(graph => graph.quad >= 0)).to.be.true;
        }
    });

    it('remembers independent collapsed categories through size changes', function () {
        stats = new MiniStats(app);
        stats.activeSizeIndex = 1;
        stats.postRender();
        for (const parent of [stats.cpuGraph, stats.vramGraph]) {
            stats.div.dispatchEvent(new window.MouseEvent('click', {
                clientY: stats.div.getBoundingClientRect().bottom + 8 - (parent.headerTop + parent.headerBottom) / 2
            }));
            stats.postRender();
        }
        for (const mode of [0, 2, 1]) {
            stats.activeSizeIndex = mode;
            stats.postRender();
            expect([...stats.collapsedGroups]).to.deep.equal([1, 3]);
            expect(stats.graphs.filter(graph => graph.parent && (graph.group === 1 || graph.group === 3)).every(graph => graph.quad === -1)).to.be.true;
        }
        // The column heading still cycles sizes.
        stats.div.dispatchEvent(new window.MouseEvent('click', {
            clientY: stats.div.getBoundingClientRect().bottom - stats._panelHeight + 12
        }));
        expect(stats.activeSizeIndex).to.equal(2);
    });

    it('hit tests scrolled headings without toggling headings behind the column labels', function () {
        canvas.getBoundingClientRect.returns({ left: 0, bottom: 240, width: 400, height: 240 });
        stats = new MiniStats(app);
        stats.activeSizeIndex = 2;
        stats.postRender();
        stats.scroll(10000);
        stats.render();
        const parent = stats.vramGraph;
        stats.div.dispatchEvent(new window.MouseEvent('click', {
            clientY: stats.div.getBoundingClientRect().bottom + 8 - (parent.headerTop + parent.headerBottom) / 2
        }));
        expect(stats.collapsedGroups.has(3)).to.be.true;
        stats.postRender();
        expect(stats._scroll).to.be.at.most(stats._maxScroll);
        stats.div.dispatchEvent(new window.MouseEvent('click', {
            clientY: stats.div.getBoundingClientRect().bottom - stats._panelHeight + 12
        }));
        expect(stats.activeSizeIndex).to.equal(0);
        expect([...stats.collapsedGroups]).to.deep.equal([3]);
    });

    it('does not interpret dragging or scrolling as a category click', function () {
        canvas.getBoundingClientRect.returns({ left: 0, bottom: 240, width: 400, height: 240 });
        stats = new MiniStats(app);
        stats.activeSizeIndex = 2;
        stats.postRender();
        stats.div.setPointerCapture = spy();
        stats.div.dispatchEvent(new window.MouseEvent('pointerdown', { clientY: 100 }));
        stats.div.dispatchEvent(new window.MouseEvent('pointermove', { clientY: 120, buttons: 1 }));
        stats.div.dispatchEvent(new window.MouseEvent('click'));
        expect(stats.activeSizeIndex).to.equal(2);
        stats.div.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 100 }));
        stats.div.dispatchEvent(new window.MouseEvent('click'));
        expect(stats.activeSizeIndex).to.equal(2);
        expect(stats.collapsedGroups.size).to.equal(0);
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
        expect(stats.graphs.filter(graph => !graph.headerOnly).every(graph => graph.cursor === 10)).to.be.true;
    });

    it('preserves existing history when new GPU passes grow the texture', function () {
        stats = new MiniStats(app);
        stats.activeSizeIndex = 2;
        stats.postRender();
        stats.update(16);
        const graph = stats.graphs.find(graph => !graph.headerOnly);
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
        expect(stats.graphs.every(graph => !graph.parent || graph.parent.headerOnly)).to.be.true;
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
        expect(stats.graphs).to.have.length(3);
    });

    it('keeps the panel inside a short viewport and clamps scrolling', function () {
        canvas.getBoundingClientRect.returns({ left: 0, bottom: 180, width: 200, height: 180 });
        stats = new MiniStats(app);
        stats.activeSizeIndex = 2;
        stats.postRender();
        const engine = stats.graphs[0];
        expect(engine.headerTop).to.be.greaterThan(engine.headerBottom);
        stats.scroll(10000);
        stats.render();
        expect(engine.headerTop).to.be.at.most(engine.headerBottom);
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
