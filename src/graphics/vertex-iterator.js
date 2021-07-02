import { typedArrayTypes } from './constants.js';

function set1(a) {
    this.array[this.index] = a;
}

function set2(a, b) {
    this.array[this.index] = a;
    this.array[this.index + 1] = b;
}

function set3(a, b, c) {
    this.array[this.index] = a;
    this.array[this.index + 1] = b;
    this.array[this.index + 2] = c;
}

function set4(a, b, c, d) {
    this.array[this.index] = a;
    this.array[this.index + 1] = b;
    this.array[this.index + 2] = c;
    this.array[this.index + 3] = d;
}

function arraySet1(index, inputArray, inputIndex) {
    this.array[index] = inputArray[inputIndex];
}

function arraySet2(index, inputArray, inputIndex) {
    this.array[index] = inputArray[inputIndex];
    this.array[index + 1] = inputArray[inputIndex + 1];
}

function arraySet3(index, inputArray, inputIndex) {
    this.array[index] = inputArray[inputIndex];
    this.array[index + 1] = inputArray[inputIndex + 1];
    this.array[index + 2] = inputArray[inputIndex + 2];
}

function arraySet4(index, inputArray, inputIndex) {
    this.array[index] = inputArray[inputIndex];
    this.array[index + 1] = inputArray[inputIndex + 1];
    this.array[index + 2] = inputArray[inputIndex + 2];
    this.array[index + 3] = inputArray[inputIndex + 3];
}

function arrayGet1(offset, outputArray, outputIndex) {
    outputArray[outputIndex] = this.array[offset];
}

function arrayGet2(offset, outputArray, outputIndex) {
    outputArray[outputIndex] = this.array[offset];
    outputArray[outputIndex + 1] = this.array[offset + 1];
}

function arrayGet3(offset, outputArray, outputIndex) {
    outputArray[outputIndex] = this.array[offset];
    outputArray[outputIndex + 1] = this.array[offset + 1];
    outputArray[outputIndex + 2] = this.array[offset + 2];
}

function arrayGet4(offset, outputArray, outputIndex) {
    outputArray[outputIndex] = this.array[offset];
    outputArray[outputIndex + 1] = this.array[offset + 1];
    outputArray[outputIndex + 2] = this.array[offset + 2];
    outputArray[outputIndex + 3] = this.array[offset + 3];
}

/**
 * @class
 * @name VertexIteratorAccessor
 * @classdesc Helps with accessing a specific vertex attribute.
 * @description Returns a new VertexIteratorAccessor object.
 * @param {ArrayBuffer} buffer - The vertex buffer containing the attribute to be accessed.
 * @param {object} vertexElement - The vertex attribute to be accessed.
 * @param {string} vertexElement.name - The meaning of the vertex element. This is used to link
 * the vertex data to a shader input. Can be:
 *
 * * {@link SEMANTIC_POSITION}
 * * {@link SEMANTIC_NORMAL}
 * * {@link SEMANTIC_TANGENT}
 * * {@link SEMANTIC_BLENDWEIGHT}
 * * {@link SEMANTIC_BLENDINDICES}
 * * {@link SEMANTIC_COLOR}
 * * {@link SEMANTIC_TEXCOORD0}
 * * {@link SEMANTIC_TEXCOORD1}
 * * {@link SEMANTIC_TEXCOORD2}
 * * {@link SEMANTIC_TEXCOORD3}
 * * {@link SEMANTIC_TEXCOORD4}
 * * {@link SEMANTIC_TEXCOORD5}
 * * {@link SEMANTIC_TEXCOORD6}
 * * {@link SEMANTIC_TEXCOORD7}
 *
 * If vertex data has a meaning other that one of those listed above, use the user-defined
 * semantics: {@link SEMANTIC_ATTR0} to {@link SEMANTIC_ATTR15}.
 * @param {number} vertexElement.numComponents - The number of components of the vertex attribute.
 * Can be 1, 2, 3 or 4.
 * @param {number} vertexElement.dataType - The data type of the attribute. Can be:
 *
 * * {@link TYPE_INT8}
 * * {@link TYPE_UINT8}
 * * {@link TYPE_INT16}
 * * {@link TYPE_UINT16}
 * * {@link TYPE_INT32}
 * * {@link TYPE_UINT32}
 * * {@link TYPE_FLOAT32}
 * @param {boolean} vertexElement.normalize - If true, vertex attribute data will be mapped from a
 * 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data is left
 * unchanged. If this property is unspecified, false is assumed.
 * @param {number} vertexElement.offset - The number of initial bytes at the start of a vertex that are not relevant to this attribute.
 * @param {number} vertexElement.stride - The number of total bytes that are between the start of one vertex, and the start of the next.
 * @param {ScopeId} vertexElement.scopeId - The shader input variable corresponding to the attribute.
 * @param {number} vertexElement.size - The size of the attribute in bytes.
 * @param {VertexFormat} vertexFormat - A vertex format that defines the layout of vertex data inside the buffer.
 */
class VertexIteratorAccessor {
    constructor(buffer, vertexElement, vertexFormat) {
        this.index = 0;
        this.numComponents = vertexElement.numComponents;

        // create the typed array based on the element data type
        if (vertexFormat.interleaved) {
            this.array = new typedArrayTypes[vertexElement.dataType](buffer, vertexElement.offset);
        } else {
            this.array = new typedArrayTypes[vertexElement.dataType](buffer, vertexElement.offset, vertexFormat.vertexCount * vertexElement.numComponents);
        }

        // BYTES_PER_ELEMENT is on the instance and constructor for Chrome, Safari and Firefox, but just the constructor for Opera
        this.stride = vertexElement.stride / this.array.constructor.BYTES_PER_ELEMENT;

        // Methods
        switch (vertexElement.numComponents) {
            case 1:
                this.set = set1;
                this.getToArray = arrayGet1;
                this.setFromArray = arraySet1;
                break;

            case 2:
                this.set = set2;
                this.getToArray = arrayGet2;
                this.setFromArray = arraySet2;
                break;

            case 3:
                this.set = set3;
                this.getToArray = arrayGet3;
                this.setFromArray = arraySet3;
                break;

            case 4:
                this.set = set4;
                this.getToArray = arrayGet4;
                this.setFromArray = arraySet4;
                break;
        }
    }

    /**
     * @function
     * @name VertexIteratorAccessor#get
     * @description Get a attribute component at the iterator's current index.
     * @param {number} offset - The component offset. Should be either 0, 1, 2, or 3.
     * @returns {number} The value of a attribute component.
     */
    get(offset) {
        return this.array[this.index + offset];
    }

    /**
     * @function
     * @name VertexIteratorAccessor#set
     * @description Set all the attribute components at the iterator's current index.
     * @param {number} a - The first component value.
     * @param {number} [b] - The second component value (if applicable).
     * @param {number} [c] - The third component value (if applicable).
     * @param {number} [d] - The fourth component value (if applicable).
     */
    set(a, b, c, d) {
        // Will be replaced with specialized implementation based on number of components
    }

    /**
     * @function
     * @name VertexIteratorAccessor#getToArray
     * @description Read attribute components to an output array.
     * @param {number} offset - The component offset at which to read data from the buffer. Will be used instead of the iterator's current index.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} outputArray - The output array to write data into.
     * @param {number} outputIndex - The output index at which to write into the output array.
     */
    getToArray(offset, outputArray, outputIndex) {
        // Will be replaced with specialized implementation based on number of components
    }

    /**
     * @function
     * @name VertexIteratorAccessor#setFromArray
     * @description Write attribute components from an input array.
     * @param {number} index - The starting index at which to write data into the buffer. Will be used instead of the iterator's current index.
     * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} inputArray - The input array to read data from.
     * @param {number} inputIndex - The input index at which to read from the input array.
     */
    setFromArray(index, inputArray, inputIndex) {
        // Will be replaced with specialized implementation based on number of components
    }
}

/**
 * @class
 * @name VertexIterator
 * @classdesc A vertex iterator simplifies the process of writing vertex data to a vertex buffer.
 * @description Returns a new VertexIterator object.
 * @param {VertexBuffer} vertexBuffer - The vertex buffer to be iterated.
 * @property {object<string, VertexIteratorAccessor>} element The vertex buffer elements.
 */
class VertexIterator {
    constructor(vertexBuffer) {
        // Store the vertex buffer
        this.vertexBuffer = vertexBuffer;
        this.vertexFormatSize = vertexBuffer.getFormat().size;

        // Lock the vertex buffer
        this.buffer = this.vertexBuffer.lock();

        // Create an empty list
        this.accessors = [];
        this.element = {};

        // Add a new 'setter' function for each element
        const vertexFormat = this.vertexBuffer.getFormat();
        for (let i = 0; i < vertexFormat.elements.length; i++) {
            const vertexElement = vertexFormat.elements[i];
            this.accessors[i] = new VertexIteratorAccessor(this.buffer, vertexElement, vertexFormat);
            this.element[vertexElement.name] = this.accessors[i];
        }
    }

    /**
     * @function
     * @name VertexIterator#next
     * @description Moves the vertex iterator on to the next vertex.
     * @param {number} [count] - Optional number of steps to move on when calling next. Defaults to 1.
     * @example
     * var iterator = new pc.VertexIterator(vertexBuffer);
     * iterator.element[pc.SEMANTIC_POSTIION].set(-0.9, -0.9, 0.0);
     * iterator.element[pc.SEMANTIC_COLOR].set(255, 0, 0, 255);
     * iterator.next();
     * iterator.element[pc.SEMANTIC_POSTIION].set(0.9, -0.9, 0.0);
     * iterator.element[pc.SEMANTIC_COLOR].set(0, 255, 0, 255);
     * iterator.next();
     * iterator.element[pc.SEMANTIC_POSTIION].set(0.0, 0.9, 0.0);
     * iterator.element[pc.SEMANTIC_COLOR].set(0, 0, 255, 255);
     * iterator.end();
     */
    next(count = 1) {
        let i = 0;
        const accessors = this.accessors;
        const numAccessors = this.accessors.length;
        while (i < numAccessors) {
            const accessor = accessors[i++];
            accessor.index += count * accessor.stride;
        }
    }

    /**
     * @function
     * @name VertexIterator#end
     * @description Notifies the vertex buffer being iterated that writes are complete. Internally
     * the vertex buffer is unlocked and vertex data is uploaded to video memory.
     * @example
     * var iterator = new pc.VertexIterator(vertexBuffer);
     * iterator.element[pc.SEMANTIC_POSTIION].set(-0.9, -0.9, 0.0);
     * iterator.element[pc.SEMANTIC_COLOR].set(255, 0, 0, 255);
     * iterator.next();
     * iterator.element[pc.SEMANTIC_POSTIION].set(0.9, -0.9, 0.0);
     * iterator.element[pc.SEMANTIC_COLOR].set(0, 255, 0, 255);
     * iterator.next();
     * iterator.element[pc.SEMANTIC_POSTIION].set(0.0, 0.9, 0.0);
     * iterator.element[pc.SEMANTIC_COLOR].set(0, 0, 255, 255);
     * iterator.end();
     */
    end() {
        // Unlock the vertex buffer
        this.vertexBuffer.unlock();
    }

    // Copies data for specified semantic into vertex buffer.
    // Works with both interleaved (slower) and non-interleaved (fast) vertex buffer
    writeData(semantic, data, numVertices) {
        const element = this.element[semantic];
        if (element) {

            if (numVertices > this.vertexBuffer.numVertices) {
                // #if _DEBUG
                console.error(`NumVertices provided to setData: ${numVertices} is larger than space in VertexBuffer: ${this.vertexBuffer.numVertices}`);
                // #endif

                // avoid overwrite
                numVertices = this.vertexBuffer.numVertices;
            }

            const numComponents = element.numComponents;

            // copy data to interleaved buffer by looping over vertices and copying them manually
            if (this.vertexBuffer.getFormat().interleaved) {
                let index = 0;
                for (let i = 0; i < numVertices; i++) {
                    element.setFromArray(index, data, i * numComponents);
                    index += element.stride;
                }
            } else {    // non-interleaved copy

                // if data contains more  data than needed, copy from its subarray
                if (data.length > numVertices * numComponents) {
                    const copyCount = numVertices * numComponents;

                    // if data is typed array
                    if (ArrayBuffer.isView(data)) {
                        data = data.subarray(0, copyCount);
                        element.array.set(data);
                    } else {
                        // data is array, copy right amount manually
                        for (let i = 0; i < copyCount; i++)
                            element.array[i] = data[i];
                    }
                } else {
                    // copy whole data
                    element.array.set(data);
                }
            }
        }
    }

    // Function to extract elements of a specified semantic from vertex buffer into flat array (data).
    // Works with both interleaved (slower) and non-interleaved (fast) vertex buffer
    // returns number of verticies
    // Note: when data is typed array and is smaller than needed, only part of data gets copied out (typed arrays ignore read/write out of range)
    readData(semantic, data) {
        const element = this.element[semantic];
        let count = 0;
        if (element) {
            count = this.vertexBuffer.numVertices;
            let i;
            const numComponents = element.numComponents;

            if (this.vertexBuffer.getFormat().interleaved) {

                // extract data from interleaved buffer by looping over vertices and copying them manually
                if (Array.isArray(data))
                    data.length = 0;

                element.index = 0;
                let offset = 0;
                for (i = 0; i < count; i++) {
                    element.getToArray(offset, data, i * numComponents);
                    offset += element.stride;
                }
            } else {
                if (ArrayBuffer.isView(data)) {
                    // destination data is typed array
                    data.set(element.array);
                } else {
                    // destination data is array
                    data.length = 0;
                    const copyCount = count * numComponents;
                    for (i = 0; i < copyCount; i++)
                        data[i] = element.array[i];
                }
            }
        }

        return count;
    }
}

export { VertexIterator, VertexIteratorAccessor };
