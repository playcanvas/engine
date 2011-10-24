pc.extend(pc.designer.graphics, function() {
    // Private members

    // Public Interface
    var Grid = function () {
        var library = pc.gfx.Device.getCurrent().getProgramLibrary();
        this._gridProgram = library.getProgram("basic", { vertexColors: true, diffuseMapping: false });

        // Create the vertex format
        var vertexFormat = new pc.gfx.VertexFormat();
        vertexFormat.begin();
        vertexFormat.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
        vertexFormat.addElement(new pc.gfx.VertexElement("vertex_color",    4, pc.gfx.VertexElementType.UINT8));
        vertexFormat.end();

        var size = 140;
        var divisions = 14;
        var interval = size / divisions;
        var numVerts = (divisions + 1) * 4;
        var gridColor = [136, 136, 136, 255];
        var axisColor = [0, 0, 0, 255];
        var color;
        
        // Create a vertex buffer
        this._gridVb = new pc.gfx.VertexBuffer(vertexFormat, numVerts);

        // Fill the vertex buffer
        var iterator = new pc.gfx.VertexIterator(this._gridVb);
        for (i = -(divisions / 2); i <= divisions / 2; i++) {
            color = (i === 0) ? axisColor : gridColor;
            iterator.element.vertex_position.set(-size/2, 0.0, i * interval);
            iterator.element.vertex_color.set(color[0], color[1], color[2], color[3]);
            iterator.next();
            iterator.element.vertex_position.set( size/2, 0.0, i * interval);
            iterator.element.vertex_color.set(color[0], color[1], color[2], color[3]);
            iterator.next();
            iterator.element.vertex_position.set(i * interval, 0.0, -size/2);
            iterator.element.vertex_color.set(color[0], color[1], color[2], color[3]);
            iterator.next();
            iterator.element.vertex_position.set(i * interval, 0.0,  size/2);
            iterator.element.vertex_color.set(color[0], color[1], color[2], color[3]);
            if (i !== divisions / 2) {
                iterator.next();
            }
        }
        iterator.end();
    }

    Grid.prototype.render = function (transform) {
        if (this._gridVb && this._gridProgram) {
            var device = pc.gfx.Device.getCurrent();
            device.setProgram(this._gridProgram);
            device.setVertexBuffer(this._gridVb, 0);
            device.scope.resolve("matrix_model").setValue(transform);
            device.draw({
                primitiveType: pc.gfx.PrimType.LINES,
                numVertices: this._gridVb.getNumVertices(),
                useIndexBuffer: false
            });
        }
    };

    return {
        Grid: Grid
    }
}());