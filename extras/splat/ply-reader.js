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

class PlyProperty {
    type;

    name;

    storage;

    byteSize;
}

class PlyElement {
    name;

    count;

    properties;
}

// asynchronously read a ply file data
const readPly = async (reader, propertyFilter = null) => {
    const concat = (a, b) => {
        const c = new Uint8Array(a.byteLength + b.byteLength);
        c.set(a);
        c.set(b, a.byteLength);
        return c;
    };

    const find = (buf, search) => {
        const endIndex = buf.length - search.length;
        let i, j;
        for (i = 0; i < endIndex; ++i) {
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

    let buf;
    let endHeaderIndex;

    while (true) {
        // get the next chunk
        /* eslint-disable no-await-in-loop */
        const { value, done } = await reader.read();

        if (done) {
            throw new Error('Stream finished before end of header');
        }

        // combine new chunk with the previous
        buf = buf ? concat(buf, value) : value;

        // check magic bytes
        if (buf.length >= magicBytes.length && !startsWith(buf, magicBytes)) {
            throw new Error('Invalid ply header');
        }

        // check if we can find the end-of-header marker
        endHeaderIndex = find(buf, endHeaderBytes);

        if (endHeaderIndex !== -1) {
            break;
        }
    }

    // decode buffer header text
    const headerText = new TextDecoder('ascii').decode(buf.slice(0, endHeaderIndex));

    // split into lines and remove comments
    const headerLines = headerText.split('\n')
        .filter(line => !line.startsWith('comment '));

    // decode header and allocate data storage
    const elements = [];
    for (let i = 1; i < headerLines.length; ++i) {
        const words = headerLines[i].split(' ');

        switch (words[0]) {
            case 'format':
                if (words[1] !== 'binary_little_endian') {
                    throw new Error('Unsupported ply format');
                }
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
                const storageType = dataTypeMap.get(words[1]);
                const storage = (!propertyFilter || propertyFilter(words[2])) ? new storageType(element.count) : null;
                element.properties.push({
                    type: words[1],
                    name: words[2],
                    storage: storage,
                    byteSize: storageType.BYTES_PER_ELEMENT
                });
                break;
            }
            default:
                throw new Error(`Unrecognized header value '${words[0]}' in ply header`);
        }
    }

    // read data
    let readIndex = endHeaderIndex + endHeaderBytes.length;
    let remaining = buf.length - readIndex;
    let dataView = new DataView(buf.buffer);

    for (let i = 0; i < elements.length; ++i) {
        const element = elements[i];

        for (let e = 0; e < element.count; ++e) {
            for (let j = 0; j < element.properties.length; ++j) {
                const property = element.properties[j];

                // if we've run out of data, load the next chunk
                while (remaining < property.byteSize) {
                    const { value, done } = await reader.read();

                    if (done) {
                        throw new Error('Stream finished before end of data');
                    }

                    // create buffer with left-over data from previous chunk and the new data
                    const tmp = new Uint8Array(remaining + value.byteLength);
                    tmp.set(buf.slice(readIndex));
                    tmp.set(value, remaining);

                    buf = tmp;
                    dataView = new DataView(buf.buffer);
                    readIndex = 0;
                    remaining = buf.length;
                }

                if (property.storage) {
                    switch (property.type) {
                        case 'char':
                            property.storage[e] = dataView.getInt8(readIndex);
                            break;
                        case 'uchar':
                            property.storage[e] = dataView.getUint8(readIndex);
                            break;
                        case 'short':
                            property.storage[e] = dataView.getInt16(readIndex, true);
                            break;
                        case 'ushort':
                            property.storage[e] = dataView.getUint16(readIndex, true);
                            break;
                        case 'int':
                            property.storage[e] = dataView.getInt32(readIndex, true);
                            break;
                        case 'uint':
                            property.storage[e] = dataView.getUint32(readIndex, true);
                            break;
                        case 'float':
                            property.storage[e] = dataView.getFloat32(readIndex, true);
                            break;
                        case 'double':
                            property.storage[e] = dataView.getFloat64(readIndex, true);
                            break;
                    }
                }

                readIndex += property.byteSize;
                remaining -= property.byteSize;
            }
        }
    }

    // console.log(elements);

    return elements;
};

export { readPly, PlyProperty, PlyElement };
