import { expect } from 'chai';

import { SEMANTIC_POSITION, TYPE_FLOAT32 } from '../../../src/platform/graphics/constants.js';
import { VertexBuffer } from '../../../src/platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { WebglGraphicsDevice } from '../../../src/platform/graphics/webgl/webgl-graphics-device.js';
import { WebglIndexBuffer } from '../../../src/platform/graphics/webgl/webgl-index-buffer.js';
import { WebglVertexBuffer } from '../../../src/platform/graphics/webgl/webgl-vertex-buffer.js';

// Checks that the index buffer bound for a draw is the one the draw asks for, while the device only
// binds it when the bound vertex array object holds another one. The fake context keeps the index
// buffer binding per vertex array object, as WebGL does.
describe('WebGL index buffer binding', function () {

    const DEFAULT_VAO = 'default';

    let device;
    let gl;

    // index buffer bound in each vertex array object, and the number of index buffer binds
    let indexBinding;
    let indexBinds;
    let contextVao;

    const proto = WebglGraphicsDevice.prototype;

    beforeEach(function () {
        indexBinding = new Map([[DEFAULT_VAO, null]]);
        indexBinds = 0;
        contextVao = null;
        let nextId = 1;
        gl = {
            ARRAY_BUFFER: 0x8892,
            ELEMENT_ARRAY_BUFFER: 0x8893,
            STATIC_DRAW: 0x88E4,
            createBuffer: () => ({ id: nextId++ }),
            deleteBuffer: () => {},
            bindBuffer: (target, buffer) => {
                if (target === gl.ELEMENT_ARRAY_BUFFER) {
                    indexBinding.set(contextVao ?? DEFAULT_VAO, buffer);
                    indexBinds++;
                }
            },
            bufferData: () => {},
            bufferSubData: () => {},
            createVertexArray: () => {
                const vao = { id: nextId++ };
                indexBinding.set(vao, null);
                return vao;
            },
            deleteVertexArray: () => {},
            bindVertexArray: (vao) => {
                contextVao = vao;
            },
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
            _contextVao: null,
            _vaoIndexBuffers: new WeakMap(),
            glType: [],
            createVertexBufferImpl: () => new WebglVertexBuffer(),
            setBuffers: proto.setBuffers,
            createVertexArray: proto.createVertexArray,
            unbindVertexArray: proto.unbindVertexArray,
            indexBufferBound: proto.indexBufferBound
        };
    });

    const createVertexBuffer = () => new VertexBuffer(device, new VertexFormat(device, [
        { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
    ]), 4, { data: new Float32Array(12) });

    // an index buffer as setBuffers sees it, with a buffer created in the fake context
    const createIndexBuffer = () => {
        const impl = new WebglIndexBuffer({ device, format: 0 });
        impl.bufferId = gl.createBuffer();
        return { impl };
    };

    // binds the buffers of a draw, and checks the bound vertex array object holds its index buffer
    const draw = (vertexBuffers, indexBuffer) => {
        vertexBuffers.forEach(vertexBuffer => device.vertexBuffers.push(vertexBuffer));
        device.setBuffers(indexBuffer);
        device.vertexBuffers.length = 0;
        expect(indexBinding.get(contextVao ?? DEFAULT_VAO)).to.equal(indexBuffer ? indexBuffer.impl.bufferId : null);
    };

    it('binds the index buffer once for repeated draws with the same buffers', function () {
        const vb = createVertexBuffer();
        const ib = createIndexBuffer();

        draw([vb], ib);
        const binds = indexBinds;
        draw([vb], ib);
        draw([vb], ib);
        expect(indexBinds).to.equal(binds);
    });

    it('keeps the index buffer of each vertex array object when switching between them', function () {
        const [vbA, vbB] = [createVertexBuffer(), createVertexBuffer()];
        const [ibA, ibB] = [createIndexBuffer(), createIndexBuffer()];

        draw([vbA], ibA);
        draw([vbB], ibB);
        const binds = indexBinds;
        for (let i = 0; i < 3; i++) {
            draw([vbA], ibA);
            draw([vbB], ibB);
        }
        expect(indexBinds).to.equal(binds);
    });

    it('binds the index buffer when a vertex array object is drawn with another one', function () {
        const vb = createVertexBuffer();
        const [ibA, ibB] = [createIndexBuffer(), createIndexBuffer()];

        draw([vb], ibA);
        draw([vb], ibB);
        draw([vb], ibA);
        draw([vb], null);
        draw([vb], ibA);
    });

    it('binds the index buffer again after an index buffer upload changed the binding', function () {
        const vb = createVertexBuffer();
        const [ibA, ibB] = [createIndexBuffer(), createIndexBuffer()];
        draw([vb], ibA);

        // an upload binds its buffer to the vertex array object bound in the context
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibB.impl.bufferId);
        device.indexBufferBound(ibB.impl.bufferId);

        draw([vb], ibA);
    });

    it('tracks the binding of the bound vertex array object after the device forgot it', function () {
        const [vbA, vbB] = [createVertexBuffer(), createVertexBuffer()];
        const [ibA, ibB] = [createIndexBuffer(), createIndexBuffer()];
        draw([vbA], ibA);

        // updateBegin clears boundVao, while the context keeps the vertex array object bound
        device.boundVao = null;
        draw([], ibB);
        draw([vbA], ibA);
        draw([vbB], ibB);
        device.boundVao = null;
        draw([vbB], ibB);
    });

    it('tracks the default vertex array object on its own', function () {
        const vb = createVertexBuffer();
        const [ibA, ibB] = [createIndexBuffer(), createIndexBuffer()];

        draw([vb], ibA);
        device.unbindVertexArray();
        draw([], ibB);
        draw([vb], ibA);
        device.unbindVertexArray();
        draw([], ibB);
        draw([], ibA);
    });

    it('binds the index buffer of a newly created vertex array object', function () {
        const [vbA, vbB] = [createVertexBuffer(), createVertexBuffer()];
        const ib = createIndexBuffer();

        draw([vbA], ib);
        draw([vbB], ib);
        draw([vbA, vbB], ib);
    });
});
