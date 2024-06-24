import { GSplatData } from '../../scene/gsplat/gsplat-data.js';
import { GSplatCompressedData } from '../../scene/gsplat/gsplat-compressed-data.js';
import { GSplatResource } from './gsplat-resource.js';
import { Mat4 } from '../../core/math/mat4.js';

/**
 * @typedef {Int8Array|Uint8Array|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array|Float64Array} DataType
 */

/**
 * @typedef {object} PlyProperty
 * @property {string} type - E.g. 'float'.
 * @property {string} name - E.g. 'x', 'y', 'z', 'f_dc_0' etc.
 * @property {DataType} storage - Data type, e.g. instance of Float32Array.
 * @property {number} byteSize - BYTES_PER_ELEMENT of given data type.
 */

/**
 * @typedef {object} PlyElement
 * @property {string} name - E.g. 'vertex'.
 * @property {number} count - Given count.
 * @property {PlyProperty[]} properties - The properties.
 */

const magicBytes = new Uint8Array([112, 108, 121, 10]);                                                 // ply\n
const endHeaderBytes = new Uint8Array([10, 101, 110, 100, 95, 104, 101, 97, 100, 101, 114, 10]);        // \nend_header\n

const dataTypeMap = new Map([
    ['char', Int8Array],
    ['uchar', Uint8Array],
    ['short', Int16Array],
    ['ushort', Uint16Array],
    ['int', Int32Array],
    ['uint', Uint32Array],
    ['float', Float32Array],
    ['double', Float64Array]
]);

// helper for streaming in chunks of data in a memory efficient way
class StreamBuf {
    reader;

    data;

    view;

    head = 0;

    tail = 0;

    constructor(reader) {
        this.reader = reader;
    }

    // read the next chunk of data
    async read() {
        const { value, done } = await this.reader.read();

        if (done) {
            throw new Error('Stream finished before end of header');
        }

        this.push(value);
    }

    // append data to the buffer
    push(data) {
        if (!this.data) {
            // first buffer
            this.data = data;
            this.view = new DataView(this.data.buffer);
            this.tail = data.length;
        } else {
            const remaining = this.tail - this.head;
            const newSize = remaining + data.length;

            if (this.data.length >= newSize) {
                // buffer is large enough to contain combined data
                if (this.head > 0) {
                    // shuffle existing data to index 0 and append the new data
                    this.data.copyWithin(0, this.head, this.tail);
                    this.data.set(data, remaining);
                    this.head = 0;
                    this.tail = newSize;
                } else {
                    // no shuffle needed, just append new data
                    this.data.set(data, this.tail);
                    this.tail += data.length;
                }
            } else {
                // buffer is too small and must grow
                const tmp = new Uint8Array(newSize);
                if (this.head > 0 || this.tail < this.data.length) {
                    // shuffle existing data to index 0 and append the new data
                    tmp.set(this.data.subarray(this.head, this.tail), 0);
                } else {
                    tmp.set(this.data, 0);
                }
                tmp.set(data, remaining);
                this.data = tmp;
                this.view = new DataView(this.data.buffer);
                this.head = 0;
                this.tail = newSize;
            }
        }
    }

    // remove the read data from the head of the buffer
    compact() {
        if (this.head > 0) {
            this.data.copyWithin(0, this.head, this.tail);
            this.tail -= this.head;
            this.head = 0;
        }
    }

    get remaining() {
        return this.tail - this.head;
    }

    // helpers for extracting data from head
    getInt8() {
        const result = this.view.getInt8(this.head); this.head++; return result;
    }

    getUint8() {
        const result = this.view.getUint8(this.head); this.head++; return result;
    }

    getInt16() {
        const result = this.view.getInt16(this.head, true); this.head += 2; return result;
    }

    getUint16() {
        const result = this.view.getUint16(this.head, true); this.head += 2; return result;
    }

    getInt32() {
        const result = this.view.getInt32(this.head, true); this.head += 4; return result;
    }

    getUint32() {
        const result = this.view.getUint32(this.head, true); this.head += 4; return result;
    }

    getFloat32() {
        const result = this.view.getFloat32(this.head, true); this.head += 4; return result;
    }

    getFloat64() {
        const result = this.view.getFloat64(this.head, true); this.head += 8; return result;
    }
}

// parse the ply header text and return an array of Element structures and a
// string containing the ply format
const parseHeader = (lines) => {
    const elements = [];
    let format;

    for (let i = 1; i < lines.length; ++i) {
        const words = lines[i].split(' ');

        switch (words[0]) {
            case 'format':
                format = words[1];
                break;
            case 'element':
                elements.push({
                    name: words[1],
                    count: parseInt(words[2], 10),
                    properties: []
                });
                break;
            case 'property': {
                if (!dataTypeMap.has(words[1])) {
                    throw new Error(`Unrecognized property data type '${words[1]}' in ply header`);
                }
                const element = elements[elements.length - 1];
                element.properties.push({
                    type: words[1],
                    name: words[2],
                    storage: null,
                    byteSize: dataTypeMap.get(words[1]).BYTES_PER_ELEMENT
                });
                break;
            }
            default:
                throw new Error(`Unrecognized header value '${words[0]}' in ply header`);
        }
    }

    return { elements, format };
};

// return true if the array of elements references a compressed ply file
const isCompressedPly = (elements) => {
    const chunkProperties = [
        'min_x', 'min_y', 'min_z',
        'max_x', 'max_y', 'max_z',
        'min_scale_x', 'min_scale_y', 'min_scale_z',
        'max_scale_x', 'max_scale_y', 'max_scale_z'
    ];

    const vertexProperties = [
        'packed_position', 'packed_rotation', 'packed_scale', 'packed_color'
    ];

    return elements.length === 2 &&
           elements[0].name === 'chunk' &&
           elements[0].properties.every((p, i) => p.name === chunkProperties[i] && p.type === 'float') &&
           elements[1].name === 'vertex' &&
           elements[1].properties.every((p, i) => p.name === vertexProperties[i] && p.type === 'uint');
};

// read the data of a compressed ply file
const readCompressedPly = async (streamBuf, elements, littleEndian) => {
    const result = new GSplatCompressedData();

    const numChunks = elements[0].count;
    const chunkSize = 12 * 4;

    const numVertices = elements[1].count;
    const vertexSize = 4 * 4;

    // evaluate the storage size for the given count (this must match the
    // texture size calculation in GSplatCompressed).
    const evalStorageSize = (count) => {
        const width = Math.ceil(Math.sqrt(count));
        const height = Math.ceil(count / width);
        return width * height;
    };

    // allocate result
    result.numSplats = elements[1].count;
    result.chunkData = new Float32Array(evalStorageSize(numChunks) * 12);
    result.vertexData = new Uint32Array(evalStorageSize(numVertices) * 4);

    let uint32StreamData;
    const uint32ChunkData = new Uint32Array(result.chunkData.buffer);
    const uint32VertexData = result.vertexData;

    // read chunks
    let chunks = 0;
    while (chunks < numChunks) {
        while (streamBuf.remaining < chunkSize) {
            /* eslint-disable no-await-in-loop */
            await streamBuf.read();
        }

        // ensure the uint32 view is still valid
        if (uint32StreamData?.buffer !== streamBuf.data.buffer) {
            uint32StreamData = new Uint32Array(streamBuf.data.buffer, 0, Math.floor(streamBuf.data.buffer.byteLength / 4));
        }

        // read the next chunk of data
        const toRead = Math.min(numChunks - chunks, Math.floor(streamBuf.remaining / chunkSize));

        const dstOffset = chunks * 12;
        const srcOffset = streamBuf.head / 4;
        for (let i = 0; i < toRead * 12; ++i) {
            uint32ChunkData[dstOffset + i] = uint32StreamData[srcOffset + i];
        }

        streamBuf.head += toRead * chunkSize;
        chunks += toRead;
    }

    // read vertices
    let vertices = 0;
    while (vertices < numVertices) {
        while (streamBuf.remaining < vertexSize) {
            /* eslint-disable no-await-in-loop */
            await streamBuf.read();
        }

        // ensure the uint32 view is still valid
        if (uint32StreamData?.buffer !== streamBuf.data.buffer) {
            uint32StreamData = new Uint32Array(streamBuf.data.buffer, 0, Math.floor(streamBuf.data.buffer.byteLength / 4));
        }

        // read the next chunk of data
        const toRead = Math.min(numVertices - vertices, Math.floor(streamBuf.remaining / vertexSize));

        const dstOffset = vertices * 4;
        const srcOffset = streamBuf.head / 4;
        for (let i = 0; i < toRead * 4; ++i) {
            uint32VertexData[dstOffset + i] = uint32StreamData[srcOffset + i];
        }

        streamBuf.head += toRead * vertexSize;
        vertices += toRead;
    }

    return result;
};

/**
 * asynchronously read a ply file data
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader - The reader.
 * @param {Function|null} propertyFilter - Function to filter properties with.
 * @returns {Promise<GSplatData | GSplatCompressedData>} The ply file data.
 */
const readPly = async (reader, propertyFilter = null) => {
    /**
     * Searches for the first occurrence of a sequence within a buffer.
     * @example
     * find(new Uint8Array([1, 2, 3, 4]), new Uint8Array([3, 4])); // 2
     * @param {Uint8Array} buf - The buffer in which to search.
     * @param {Uint8Array} search - The sequence to search for.
     * @returns {number} The index of the first occurrence of the search sequence in the buffer, or -1 if not found.
     */
    const find = (buf, search) => {
        const endIndex = buf.length - search.length;
        let i, j;
        for (i = 0; i <= endIndex; ++i) {
            for (j = 0; j < search.length; ++j) {
                if (buf[i + j] !== search[j]) {
                    break;
                }
            }
            if (j === search.length) {
                return i;
            }
        }
        return -1;
    };

    /**
     * Checks if array 'a' starts with the same elements as array 'b'.
     * @example
     * startsWith(new Uint8Array([1, 2, 3, 4]), new Uint8Array([1, 2])); // true
     * @param {Uint8Array} a - The array to check against.
     * @param {Uint8Array} b - The array of elements to look for at the start of 'a'.
     * @returns {boolean} - True if 'a' starts with all elements of 'b', otherwise false.
     */
    const startsWith = (a, b) => {
        if (a.length < b.length) {
            return false;
        }

        for (let i = 0; i < b.length; ++i) {
            if (a[i] !== b[i]) {
                return false;
            }
        }

        return true;
    };

    const streamBuf = new StreamBuf(reader);
    let headerLength;

    while (true) {
        // get the next chunk of data
        /* eslint-disable no-await-in-loop */
        await streamBuf.read();

        // check magic bytes
        if (streamBuf.tail >= magicBytes.length && !startsWith(streamBuf.data, magicBytes)) {
            throw new Error('Invalid ply header');
        }

        // search for end-of-header marker
        headerLength = find(streamBuf.data, endHeaderBytes);

        if (headerLength !== -1) {
            break;
        }
    }

    // decode buffer header text and split into lines and remove comments
    const lines = new TextDecoder('ascii')
        .decode(streamBuf.data.subarray(0, headerLength))
        .split('\n')
        .filter(line => !line.startsWith('comment '));

    // decode header and build element and property list
    const { elements, format } = parseHeader(lines);

    // check format is supported
    if (format !== 'binary_little_endian' && format !== 'binary_big_endian') {
        throw new Error('Unsupported ply format');
    }

    // skip past header and compact the chunk data so the read operations
    // fall nicely on aligned data boundaries
    streamBuf.head = headerLength + endHeaderBytes.length;
    streamBuf.compact();

    // load compressed PLY with fast path
    if (isCompressedPly(elements)) {
        return await readCompressedPly(streamBuf, elements, format === 'binary_little_endian');
    }

    // allocate element storage
    elements.forEach((e) => {
        e.properties.forEach((p) => {
            const storageType = dataTypeMap.get(p.type);
            if (storageType) {
                const storage = (!propertyFilter || propertyFilter(p.name)) ? new storageType(e.count) : null;
                p.storage = storage;
            }
        });
    });

    // read and un-interleave the data
    for (let i = 0; i < elements.length; ++i) {
        const element = elements[i];

        // calculate the size of an input element record
        const inputSize = element.properties.reduce((a, p) => a + p.byteSize, 0);
        let c = 0;

        while (c < element.count) {
            while (streamBuf.remaining < inputSize) {
                /* eslint-disable no-await-in-loop */
                await streamBuf.read();
            }

            const toRead = Math.min(element.count - c, Math.floor(streamBuf.remaining / inputSize));

            for (let n = 0; n < toRead; ++n) {
                for (let j = 0; j < element.properties.length; ++j) {
                    const property = element.properties[j];

                    if (property.storage) {
                        switch (property.type) {
                            case 'char':   property.storage[c] = streamBuf.getInt8(); break;
                            case 'uchar':  property.storage[c] = streamBuf.getUint8(); break;
                            case 'short':  property.storage[c] = streamBuf.getInt16(); break;
                            case 'ushort': property.storage[c] = streamBuf.getUint16(); break;
                            case 'int':    property.storage[c] = streamBuf.getInt32(); break;
                            case 'uint':   property.storage[c] = streamBuf.getUint32(); break;
                            case 'float':  property.storage[c] = streamBuf.getFloat32(); break;
                            case 'double': property.storage[c] = streamBuf.getFloat64(); break;
                        }
                    } else {
                        streamBuf.head += property.byteSize;
                    }
                }
                c++;
            }
        }
    }

    // console.log(elements);

    return new GSplatData(elements);
};

// filter out element data we're not going to use
const defaultElements = [
    'x', 'y', 'z',
    'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity',
    'rot_0', 'rot_1', 'rot_2', 'rot_3',
    'scale_0', 'scale_1', 'scale_2',
    // compressed format elements
    'min_x', 'min_y', 'min_z',
    'max_x', 'max_y', 'max_z',
    'min_scale_x', 'min_scale_y', 'min_scale_z',
    'max_scale_x', 'max_scale_y', 'max_scale_z',
    'packed_position', 'packed_rotation', 'packed_scale', 'packed_color'
];

const defaultElementsSet = new Set(defaultElements);
const defaultElementFilter = val => defaultElementsSet.has(val);

const mat4 = new Mat4();

class PlyParser {
    /** @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice} */
    device;

    /** @type {import('../asset/asset-registry.js').AssetRegistry} */
    assets;

    /** @type {number} */
    maxRetries;

    /**
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {import('../asset/asset-registry.js').AssetRegistry} assets - The asset registry.
     * @param {number} maxRetries - Maximum amount of retries.
     */
    constructor(device, assets, maxRetries) {
        this.device = device;
        this.assets = assets;
        this.maxRetries = maxRetries;
    }

    /**
     * @param {object} url - The URL of the resource to load.
     * @param {string} url.load - The URL to use for loading the resource.
     * @param {string} url.original - The original URL useful for identifying the resource type.
     * @param {import('../handlers/handler.js').ResourceHandlerCallback} callback - The callback used when
     * the resource is loaded or an error occurs.
     * @param {import('../asset/asset.js').Asset} asset - Container asset.
     */
    async load(url, callback, asset) {
        const response = await fetch(url.load);
        if (!response || !response.body) {
            callback("Error loading resource", null);
        } else {
            readPly(response.body.getReader(), asset.data.elementFilter ?? defaultElementFilter)
                .then((gsplatData) => {
                    if (!gsplatData.isCompressed) {

                        // perform Z scale
                        if (asset.data.performZScale ?? true) {
                            mat4.setScale(-1, -1, 1);
                            gsplatData.transform(mat4);
                        }

                        // reorder data
                        if (asset.data.reorder ?? true) {
                            gsplatData.reorderData();
                        }
                    }

                    // construct the resource
                    const resource = new GSplatResource(
                        this.device,
                        gsplatData.isCompressed && asset.data.decompress ? gsplatData.decompress() : gsplatData
                    );

                    callback(null, resource);
                })
                .catch((err) => {
                    callback(err, null);
                });
        }
    }

    /**
     * @param {string} url - The URL.
     * @param {GSplatResource} data - The data.
     * @returns {GSplatResource} Return the data.
     */
    open(url, data) {
        return data;
    }
}

export { PlyParser };
