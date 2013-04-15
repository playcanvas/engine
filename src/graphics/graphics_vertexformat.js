pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.VertexFormat
     * @class A vertex format is a descriptor that defines the layout of vertex element data inside
     * a pc.gfx.VertexBuffer object.
     * @description Returns a new pc.gfx.VertexFormat object.
     * @author Will Eastcott
     */
    var VertexFormat = function () {
        this.size = 0;
        this.elements = [];
    };

    VertexFormat.prototype = {
        /**
         * @function
         * @name pc.gfx.VertexFormat#begin
         * @description Marks the start of a definition block that builds the vertex format structure.
         * @example
         * var format = new pc.gfx.VertexFormat();
         * format.begin();
         * vertexFormat.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32, false));
         * vertexFormat.end();
         * var vertexBuffer = new pc.gfx.VertexBuffer(vertexFormat, numVertices);
         * @author Will Eastcott
         */
        begin: function () {
            this.size = 0;
            this.elements = [];
        },

        /**
         * @function
         * @name pc.gfx.VertexFormat#end
         * @description Marks the end of a definition block that builds the vertex format structure.
         * @example
         * var format = new pc.gfx.VertexFormat();
         * format.begin();
         * vertexFormat.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32, false));
         * vertexFormat.end();
         * var vertexBuffer = new pc.gfx.VertexBuffer(vertexFormat, numVertices);
         * @author Will Eastcott
         */
        end: function () {
            var offset = 0;

            // Now we have the complete format, update the
            // offset and stride of each vertex element
            var i = 0;
            var elements = this.elements;
            var numElements = elements.length;
            while (i < numElements) {
                var vertexElement = elements[i++];

                vertexElement.offset = offset;
                vertexElement.stride = this.size;

                offset += vertexElement.size;
            }
        },

        /**
         * @function
         * @name pc.gfx.VertexFormat#addElement
         * @description Adds a new vertex element defintion to the vertex format.
         * @example
         * var format = new pc.gfx.VertexFormat();
         * format.begin();
         * vertexFormat.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32, false));
         * vertexFormat.addElement(new pc.gfx.VertexElement("vertex_texCoord0", 2, pc.gfx.VertexElementType.FLOAT32, false));
         * vertexFormat.addElement(new pc.gfx.VertexElement("vertex_color", 4, pc.gfx.VertexElementType.UINT8, true));
         * vertexFormat.end();
         * var vertexBuffer = new pc.gfx.VertexBuffer(vertexFormat, numVertices);
         * @author Will Eastcott
         */
        addElement: function (vertexElement) {
            this.size += vertexElement.size;
            this.elements.push(vertexElement);
        }
    };

    return {
        VertexFormat: VertexFormat
    }; 
}());