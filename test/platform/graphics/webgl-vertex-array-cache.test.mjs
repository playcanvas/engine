import { expect } from 'chai';
import { spy } from 'sinon';

import { SEMANTIC_POSITION, TYPE_FLOAT32 } from '../../../src/platform/graphics/constants.js';
import { VertexBuffer } from '../../../src/platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { WebglGraphicsDevice } from '../../../src/platform/graphics/webgl/webgl-graphics-device.js';
import { WebglVertexBuffer } from '../../../src/platform/graphics/webgl/webgl-vertex-buffer.js';

// Exercises the vertex array objects the WebGL device creates for draws, and the cache of those for
// draws using more than one vertex buffer. The device methods run against a fake context, as the
// real path needs a WebGL2 context.
describe('WebGL vertex array objects', function () {

    let device;
    let gl;

    // vertex array objects created and not yet deleted
    let live;

    const proto = WebglGraphicsDevice.prototype;

    beforeEach(function () {
        live = new Set();
        let nextId = 1;
        gl = {
            ARRAY_BUFFER: 0x8892,
            ELEMENT_ARRAY_BUFFER: 0x8893,
            createBuffer: () => ({}),
            deleteBuffer: () => {},
            bindBuffer: () => {},
            bufferData: () => {},
            bufferSubData: () => {},
            createVertexArray: spy(() => {
                const vao = { id: nextId++ };
                live.add(vao);
                return vao;
            }),
            deleteVertexArray: spy((vao) => {
                expect(live.has(vao), 'deletes a live vertex array object').to.be.true;
                live.delete(vao);
            }),
            bindVertexArray: spy(),
            vertexAttribPointer: () => {},
            vertexAttribIPointer: () => {},
            enableVertexAttribArray: () => {},
            vertexAttribDivisor: () => {}
        };
        device = {
            gl,
            _vram: { vb: 0, ib: 0 },
            buffers: new Set(),
            vertexBuffers: [],
            boundVao: null,
            glType: [],
            createVertexBufferImpl: () => new WebglVertexBuffer(),
            setBuffers: proto.setBuffers,
            createVertexArray: proto.createVertexArray,
            unbindVertexArray: proto.unbindVertexArray,
            removeVertexArrayFromCache: proto.removeVertexArrayFromCache,
            clearVertexArrayObjectCache: proto.clearVertexArrayObjectCache
        };
    });

    const createBuffer = () => new VertexBuffer(device, new VertexFormat(device, [
        { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
    ]), 4, { data: new Float32Array(12) });

    const createBuffers = count => Array.from({ length: count }, createBuffer);

    // binds the vertex buffers for a draw, and returns the vertex array object bound for it
    const draw = (...vertexBuffers) => {
        vertexBuffers.forEach(vertexBuffer => device.vertexBuffers.push(vertexBuffer));
        device.setBuffers(null);
        device.vertexBuffers.length = 0;
        return device.boundVao;
    };

    it('creates the vertex array object of a single buffer once, and deletes it with the buffer', function () {
        const [a] = createBuffers(1);
        const vao = draw(a);

        expect(draw(a)).to.equal(vao);
        expect(gl.createVertexArray.callCount).to.equal(1);

        a.destroy();
        expect(gl.deleteVertexArray.calledWith(vao)).to.be.true;
        expect(live.size).to.equal(0);
    });

    it('reuses the vertex array object of a list of buffers', function () {
        const [a, b] = createBuffers(2);
        const vao = draw(a, b);

        expect(draw(a, b)).to.equal(vao);
        expect(gl.createVertexArray.callCount).to.equal(1);
    });

    it('gives each distinct list of buffers its own vertex array object', function () {
        const [a, b, c] = createBuffers(3);
        const lists = [[a], [a, b], [b, a], [a, c], [a, b, c], [a, c, b], [b, c]];

        const vaos = lists.map(list => draw(...list));
        expect(new Set(vaos).size).to.equal(lists.length);

        // and each list finds its own again
        lists.forEach((list, i) => expect(draw(...list)).to.equal(vaos[i]));
        expect(gl.createVertexArray.callCount).to.equal(lists.length);
    });

    it('deletes the vertex array object of a list when its first buffer is destroyed, leaving no reference on the other', function () {
        const [a, b] = createBuffers(2);
        const vao = draw(a, b);

        a.destroy();
        expect(gl.deleteVertexArray.calledWith(vao)).to.be.true;
        expect(live.size).to.equal(0);
        expect([...(b.impl.vaoEntryMaps ?? [])]).to.be.empty;

        // the other buffer has nothing left to delete
        b.destroy();
        expect(gl.deleteVertexArray.callCount).to.equal(1);
    });

    it('deletes the vertex array object of a list when a later buffer is destroyed, and removes its entry from the first', function () {
        const [a, b, c] = createBuffers(3);
        const vaoAB = draw(a, b);
        const vaoAC = draw(a, c);

        b.destroy();
        expect(gl.deleteVertexArray.calledWith(vaoAB)).to.be.true;
        expect(gl.deleteVertexArray.calledWith(vaoAC)).to.be.false;
        expect(a.impl.vaoEntries.has(b.impl)).to.be.false;
        expect(draw(a, c)).to.equal(vaoAC);

        a.destroy();
        expect(live.size).to.equal(0);
    });

    it('deletes only the vertex array objects of the lists containing the destroyed buffer', function () {
        const [a, b, c] = createBuffers(3);
        const vaoAB = draw(a, b);
        const vaoABC = draw(a, b, c);
        const vaoCA = draw(c, a);

        c.destroy();
        expect(gl.deleteVertexArray.calledWith(vaoABC)).to.be.true;
        expect(gl.deleteVertexArray.calledWith(vaoCA)).to.be.true;
        expect([...live]).to.deep.equal([vaoAB]);
        expect(draw(a, b)).to.equal(vaoAB);
    });

    it('unbinds a bound vertex array object before deleting it', function () {
        const [a, b] = createBuffers(2);
        const vao = draw(a, b);
        expect(device.boundVao).to.equal(vao);

        b.destroy();
        expect(device.boundVao).to.equal(null);
        expect(gl.bindVertexArray.lastCall.args).to.deep.equal([null]);
        expect(gl.bindVertexArray.lastCall.calledBefore(gl.deleteVertexArray.lastCall)).to.be.true;
    });

    it('removes the vertex array object of a list from the cache on request', function () {
        const [a, b, c] = createBuffers(3);
        const vaoAB = draw(a, b);
        const vaoAC = draw(a, c);

        device.removeVertexArrayFromCache([a, b]);
        expect(gl.deleteVertexArray.calledWith(vaoAB)).to.be.true;
        expect(draw(a, b)).to.not.equal(vaoAB);
        expect(draw(a, c)).to.equal(vaoAC);
    });

    it('deletes the vertex array objects of all buffers when the cache is cleared', function () {
        const [a, b, c] = createBuffers(3);
        draw(a);
        draw(a, b);
        draw(b, c, a);

        device.clearVertexArrayObjectCache();
        expect(live.size).to.equal(0);
        expect(device.boundVao).to.equal(null);
    });

    it('uses the default vertex array object for a draw without vertex buffers', function () {
        const [a] = createBuffers(1);
        draw(a);

        expect(draw()).to.equal(null);
        expect(gl.bindVertexArray.lastCall.args).to.deep.equal([null]);
        expect(gl.createVertexArray.callCount).to.equal(1);
    });

    it('drops its vertex array objects without deleting them when the context is lost', function () {
        const [a, b] = createBuffers(2);
        const vao = draw(a, b);

        a.loseContext();
        b.loseContext();
        device.boundVao = null;

        expect(draw(a, b)).to.not.equal(vao);
        expect(gl.deleteVertexArray.called).to.be.false;
    });
});
