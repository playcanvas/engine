import { WebglBuffer } from './webgl-buffer.js';

/**
 * @import { VertexBuffer } from '../vertex-buffer.js'
 */

/**
 * An entry in the cache of vertex array objects for draws using more than one vertex buffer.
 *
 * The vertex array object of such a draw is cached on its first vertex buffer, in a tree of entries
 * keyed by each further buffer: the entries keyed by the second buffer are stored on the first
 * buffer, the entries keyed by the third buffer on the entry of the second, and so on. A lookup
 * compares buffer objects only, so it allocates nothing, and each vertex array object has exactly
 * one entry. The buffers keying entries record the maps holding them, so that a vertex array object
 * is deleted as soon as any of its buffers is destroyed, and no buffer is left referencing it.
 *
 * @ignore
 */
class WebglVertexArrayEntry {
    /**
     * The vertex array object for the vertex buffers leading to this entry, or null if not created.
     *
     * @type {WebGLVertexArrayObject|null}
     */
    vao = null;

    /**
     * The entries for draws with further vertex buffers, keyed by the next buffer.
     *
     * @type {Map<WebglVertexBuffer, WebglVertexArrayEntry>|null}
     */
    next = null;
}

/**
 * Deletes the vertex array objects of the entries in a map, and of all entries after them, and
 * removes the map from the buffers keying its entries.
 *
 * @param {WebGL2RenderingContext} gl - The WebGL context.
 * @param {Map<WebglVertexBuffer, WebglVertexArrayEntry>} map - The map of entries.
 */
const deleteEntries = (gl, map) => {
    for (const [buffer, entry] of map) {
        buffer.vaoEntryMaps?.delete(map);
        if (entry.vao) {
            gl.deleteVertexArray(entry.vao);
        }
        if (entry.next) {
            deleteEntries(gl, entry.next);
        }
    }
    map.clear();
};

/**
 * A WebGL implementation of the VertexBuffer.
 *
 * @ignore
 */
class WebglVertexBuffer extends WebglBuffer {
    // vertex array object for draws using only this vertex buffer
    vao = null;

    /**
     * The cache entries of draws which use this vertex buffer first, followed by further buffers,
     * keyed by the second buffer. See {@link WebglVertexArrayEntry}.
     *
     * @type {Map<WebglVertexBuffer, WebglVertexArrayEntry>|null}
     */
    vaoEntries = null;

    /**
     * The maps of cache entries, stored on other buffers or entries, in which this buffer is a key.
     *
     * @type {Set<Map<WebglVertexBuffer, WebglVertexArrayEntry>>|null}
     */
    vaoEntryMaps = null;

    destroy(device) {

        // clear up bound vertex buffers, so the device does not keep a deleted vertex array bound
        device.unbindVertexArray();

        this.deleteVertexArrays(device.gl);

        super.destroy(device);
    }

    loseContext() {
        super.loseContext();
        this.vao = null;
        this.vaoEntries = null;
        this.vaoEntryMaps = null;
    }

    unlock(vertexBuffer, byteOffset, byteLength) {

        const device = vertexBuffer.device;
        super.unlock(device, vertexBuffer.usage, device.gl.ARRAY_BUFFER, vertexBuffer.storage, byteOffset, byteLength);
    }

    /**
     * Returns the cache entry for a draw using more than one vertex buffer, this one first. The
     * entry, and the entries leading to it, are created when missing.
     *
     * @param {VertexBuffer[]} vertexBuffers - The vertex buffers of the draw, this one first.
     * @returns {WebglVertexArrayEntry} The cache entry.
     */
    getVertexArrayEntry(vertexBuffers) {
        let map = this.vaoEntries ??= new Map();
        let entry = null;
        for (let i = 1; i < vertexBuffers.length; i++) {
            if (entry) {
                map = entry.next ??= new Map();
            }
            const buffer = vertexBuffers[i].impl;
            entry = map.get(buffer);
            if (!entry) {
                entry = new WebglVertexArrayEntry();
                map.set(buffer, entry);
                (buffer.vaoEntryMaps ??= new Set()).add(map);
            }
        }
        return entry;
    }

    /**
     * Deletes the vertex array objects using this vertex buffer: the one for draws using only this
     * buffer, and the cached ones for draws using it together with other buffers, whether stored on
     * this buffer or on others.
     *
     * The vertex array objects are deleted explicitly. Left to garbage collection, a vertex array
     * object keeps the buffers it references alive, the index buffer last drawn with it included, and
     * in Chrome its delayed release can leave a stale index buffer binding behind, which sends a
     * later index buffer upload to a deleted buffer.
     *
     * @param {WebGL2RenderingContext} gl - The WebGL context.
     */
    deleteVertexArrays(gl) {
        if (this.vao) {
            gl.deleteVertexArray(this.vao);
            this.vao = null;
        }

        // draws using this buffer first
        if (this.vaoEntries) {
            deleteEntries(gl, this.vaoEntries);
            this.vaoEntries = null;
        }

        // draws using this buffer after others, cached on those
        if (this.vaoEntryMaps) {
            for (const map of this.vaoEntryMaps) {
                const entry = map.get(this);
                if (entry) {
                    map.delete(this);
                    if (entry.vao) {
                        gl.deleteVertexArray(entry.vao);
                    }
                    if (entry.next) {
                        deleteEntries(gl, entry.next);
                    }
                }
            }
            this.vaoEntryMaps = null;
        }
    }
}

export { WebglVertexBuffer };
