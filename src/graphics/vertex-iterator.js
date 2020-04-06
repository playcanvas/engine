Object.assign(pc, function () {
    'use strict';

    /**
     * @class
     * @name pc.VertexIteratorAccessor
     * @classdesc Helps with accessing a specific vertex attribute.
     * @description Returns a new pc.VertexIteratorAccessor object.
     * @param {ArrayBuffer} buffer - The vertex buffer containing the attribute to be accessed.
     * @param {object} vertexElement - The vertex attribute to be accessed.
     * @param {string} vertexElement.name - The meaning of the vertex element. This is used to link
     * the vertex data to a shader input. Can be:
     *
     * * {@link pc.SEMANTIC_POSITION}
     * * {@link pc.SEMANTIC_NORMAL}
     * * {@link pc.SEMANTIC_TANGENT}
     * * {@link pc.SEMANTIC_BLENDWEIGHT}
     * * {@link pc.SEMANTIC_BLENDINDICES}
     * * {@link pc.SEMANTIC_COLOR}
     * * {@link pc.SEMANTIC_TEXCOORD0}
     * * {@link pc.SEMANTIC_TEXCOORD1}
     * * {@link pc.SEMANTIC_TEXCOORD2}
     * * {@link pc.SEMANTIC_TEXCOORD3}
     * * {@link pc.SEMANTIC_TEXCOORD4}
     * * {@link pc.SEMANTIC_TEXCOORD5}
     * * {@link pc.SEMANTIC_TEXCOORD6}
     * * {@link pc.SEMANTIC_TEXCOORD7}
     *
     * If vertex data has a meaning other that one of those listed above, use the user-defined
     * semantics: pc.SEMANTIC_ATTR0 to pc.SEMANTIC_ATTR15.
     * @param {number} vertexElement.numComponents - The number of components of the vertex attribute.
     * Can be 1, 2, 3 or 4.
     * @param {number} vertexElement.dataType - The data type of the attribute. Can be:
     *
     * * {@link pc.TYPE_INT8}
     * * {@link pc.TYPE_UINT8}
     * * {@link pc.TYPE_INT16}
     * * {@link pc.TYPE_UINT16}
     * * {@link pc.TYPE_INT32}
     * * {@link pc.TYPE_UINT32}
     * * {@link pc.TYPE_FLOAT32}
     * @param {boolean} vertexElement.normalize - If true, vertex attribute data will be mapped from a
     * 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data is left
     * unchanged. If this property is unspecified, false is assumed.
     * @param {number} vertexElement.offset - The number of initial bytes at the start of a vertex that are not relevant to this attribute.
     * @param {number} vertexElement.stride - The number of total bytes that are between the start of one vertex, and the start of the next.
     * @param {pc.ScopeId} vertexElement.scopeId - The shader input variable corresponding to the attribute.
     * @param {number} vertexElement.size - The size of the attribute in bytes.
     */
    function VertexIteratorAccessor(buffer, vertexElement) {
        this.index = 0;

        switch (vertexElement.dataType) {
            case pc.TYPE_INT8:
                this.array = new Int8Array(buffer, vertexElement.offset);
                break;
            case pc.TYPE_UINT8:
                this.array = new Uint8Array(buffer, vertexElement.offset);
                break;
            case pc.TYPE_INT16:
                this.array = new Int16Array(buffer, vertexElement.offset);
                break;
            case pc.TYPE_UINT16:
                this.array = new Uint16Array(buffer, vertexElement.offset);
                break;
            case pc.TYPE_INT32:
                this.array = new Int32Array(buffer, vertexElement.offset);
                break;
            case pc.TYPE_UINT32:
                this.array = new Uint32Array(buffer, vertexElement.offset);
                break;
            case pc.TYPE_FLOAT32:
                this.array = new Float32Array(buffer, vertexElement.offset);
                break;
        }

        // Methods
        switch (vertexElement.numComponents) {
            case 1: this.set = VertexIteratorAccessor_set1; break;
            case 2: this.set = VertexIteratorAccessor_set2; break;
            case 3: this.set = VertexIteratorAccessor_set3; break;
            case 4: this.set = VertexIteratorAccessor_set4; break;
        }
    }

    /**
     * @function
     * @name pc.VertexIteratorAccessor#get
     * @description Get a attribute component at the current index.
     * @param {number} offset - The component offset. Should be either 0, 1, 2, or 3.
     * @returns {number} The value of a attribute component.
     */
    VertexIteratorAccessor.prototype.get = function (offset) {
        return this.array[this.index + offset];
    };

    /**
     * @function
     * @name pc.VertexIteratorAccessor#set
     * @description Set all the attribute components at the current index.
     * @param {number} a - The first component value.
     * @param {number} [b] - The second component value (if applicable).
     * @param {number} [c] - The third component value (if applicable).
     * @param {number} [d] - The fourth component value (if applicable).
     */
    VertexIteratorAccessor.prototype.set = function (a, b, c, d) {
        // Will be replaced with specialized implementation based on number of components
    };

    function VertexIteratorAccessor_set1(a) {
        this.array[this.index] = a;
    }

    function VertexIteratorAccessor_set2(a, b) {
        this.array[this.index] = a;
        this.array[this.index + 1] = b;
    }

    function VertexIteratorAccessor_set3(a, b, c) {
        this.array[this.index] = a;
        this.array[this.index + 1] = b;
        this.array[this.index + 2] = c;
    }

    function VertexIteratorAccessor_set4(a, b, c, d) {
        this.array[this.index] = a;
        this.array[this.index + 1] = b;
        this.array[this.index + 2] = c;
        this.array[this.index + 3] = d;
    }

    /**
     * @class
     * @name pc.VertexIterator
     * @classdesc A vertex iterator simplifies the process of writing vertex data to a vertex buffer.
     * @description Returns a new pc.VertexIterator object.
     * @param {pc.VertexBuffer} vertexBuffer - The vertex buffer to be iterated.
     * @property {object<string, pc.VertexIteratorAccessor>} element The vertex buffer elements.
     */
    function VertexIterator(vertexBuffer) {
        // Store the vertex buffer
        this.vertexBuffer = vertexBuffer;

        // Lock the vertex buffer
        this.buffer = this.vertexBuffer.lock();

        // Create an empty list
        this.accessors = [];
        this.element = {};

        // Add a new 'setter' function for each element
        var vertexFormat = this.vertexBuffer.getFormat();
        for (var i = 0; i < vertexFormat.elements.length; i++) {
            var vertexElement = vertexFormat.elements[i];
            this.accessors[i] = new VertexIteratorAccessor(this.buffer, vertexElement);
            this.element[vertexElement.name] = this.accessors[i];
        }
    }

    Object.assign(VertexIterator.prototype, {
        /**
         * @function
         * @name pc.VertexIterator#next
         * @description Moves the vertex iterator on to the next vertex.
         * @param {number} [count] - Optional number of steps to move on when calling next, defaults to 1.
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
        next: function (count) {
            if (count === undefined) count = 1;

            var i = 0;
            var accessors = this.accessors;
            var numAccessors = this.accessors.length;
            var vertexFormat = this.vertexBuffer.getFormat();
            while (i < numAccessors) {
                var accessor = accessors[i++];
                // BYTES_PER_ELEMENT is on the instance and constructor for Chrome, Safari and Firefox
                // but just the constructor for Opera
                accessor.index += (count * vertexFormat.size / accessor.array.constructor.BYTES_PER_ELEMENT);
            }
        },

        /**
         * @function
         * @name pc.VertexIterator#end
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
        end: function () {
            // Unlock the vertex buffer
            this.vertexBuffer.unlock();
        }
    });

    return {
        VertexIteratorAccessor: VertexIteratorAccessor,
        VertexIterator: VertexIterator
    };
}());
