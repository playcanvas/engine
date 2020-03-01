Object.assign(pc, function () {
    'use strict';

    function VertexIteratorAccessor(buffer, vertexElement) {
        this.index = 0;

        switch (vertexElement.type) {
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
        switch (vertexElement.components) {
            case 1: this.set = VertexIteratorAccessor_set1; break;
            case 2: this.set = VertexIteratorAccessor_set2; break;
            case 3: this.set = VertexIteratorAccessor_set3; break;
            case 4: this.set = VertexIteratorAccessor_set4; break;
        }
    }

    VertexIteratorAccessor.prototype.get = function (offset) {
        return this.array[this.index + offset];
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
     * @property {object} element The vertex buffer elements.
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
            this.element[vertexElement.semantic] = this.accessors[i];
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
        VertexIterator: VertexIterator
    };
}());
