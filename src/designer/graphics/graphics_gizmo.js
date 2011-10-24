pc.designer.graphics.GizmoMode = {
    TRANSLATE: 0,
    ROTATE: 1,
    SCALE: 2
};

pc.extend(pc.designer.graphics, function() {
    // Private members

    // Public Interface
    var Gizmo = function Gizmo() {
        var library = pc.gfx.Device.getCurrent().getProgramLibrary();
        this.posProgram = library.getProgram("basic", { vertexColors: false, diffuseMapping: false });

        // Create the vertex formats
        var posFormat = new pc.gfx.VertexFormat();
        posFormat.begin();
        posFormat.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
        posFormat.end();

        // Create the rotate gizmo geometry
        var ringSegments = 50;
        var numVerts = (ringSegments + 1);
        var angle = 0.0;
        var iterator;

        this.rotate = {};
        this.rotate.axes = {};
        this.rotate.axes.vertexBuffers = [];
        for (var ring = 0; ring <= 3; ring++) {
            // Create a vertex buffer
            this.rotate.axes.vertexBuffers[ring] = new pc.gfx.VertexBuffer(posFormat, numVerts);

            // Fill the vertex buffer
            iterator = new pc.gfx.VertexIterator(this.rotate.axes.vertexBuffers[ring]);
            for (var seg = 0; seg <= ringSegments; seg++) {
                angle = 2 * Math.PI * (seg / ringSegments);
                sinAngle = Math.sin(angle);
                cosAngle = Math.cos(angle);            
                if (ring === 0) {
                    iterator.element.vertex_position.set(0, sinAngle, cosAngle);
                } else if (ring === 1) {
                    iterator.element.vertex_position.set(sinAngle, 0, cosAngle);
                } else if (ring === 2) {
                    iterator.element.vertex_position.set(sinAngle, cosAngle, 0);
                }                
                iterator.next();
            }
            iterator.end();
        }
        var sphereMat = new pc.scene.Material();
        sphereMat.setState({
            cull: true,
            colorWrite: { red: false, green: false, blue: false, alpha: false },
            depthWrite: true
        });
        sphereMat.setProgram(this.posProgram);
        sphereMat.setParameter("constant_color", [ 0.7, 0.7, 0.7, 0.4 ]);
        this.rotate.sphere = pc.graph.procedural.createSphere({ 
            material: sphereMat,
            segments: 75,
            radius: 0.99 
        });

        // Create the translate gizmo geometry
        this.translate = {};
        this.translate.axes = {};
        this.translate.axes.vertexBuffers = [];
        numVerts = 2;
        for (axis = 0; axis < 3; axis++) {
            this.translate.axes.vertexBuffers[axis] = new pc.gfx.VertexBuffer(posFormat, numVerts);
            iterator = new pc.gfx.VertexIterator(this.translate.axes.vertexBuffers[axis]);
            iterator.element.vertex_position.set(0, 0, 0);
            iterator.next();
            if (axis === 0) {
                iterator.element.vertex_position.set(1, 0, 0);
            } else if (axis === 1) {
                iterator.element.vertex_position.set(0, 1, 0);
            } else if (axis === 2) {
                iterator.element.vertex_position.set(0, 0, 1);
            }
            iterator.end();
        }

        // Create the translate gizmo arrow heads
        this.translate.tips = {};
        this.translate.tips.transforms = [];
        this.translate.tips.transforms[0] = pc.math.mat4.clone(pc.math.mat4.identity);
        this.translate.tips.transforms[1] = pc.math.mat4.makeRotate(Math.PI / 2, [0,0,1]);
        this.translate.tips.transforms[2] = pc.math.mat4.makeRotate(-Math.PI / 2, [0,1,0]);

        var numBaseSegments = 20;
        numVerts = (numBaseSegments + 2);
        var positions = [];
        positions.push(1.3, 0, 0);
        for (var i = 0; i <= numBaseSegments; i++) {
            angle = 2 * Math.PI * (i / numBaseSegments);
            positions.push(1.0, Math.sin(angle) * 0.055, Math.cos(angle) * 0.055);
        }

        var indices = [];
        for (var i = 0; i < numBaseSegments; i++) {
            indices.push(0, i + 1, i + 2);
        }
        
        // Copy data into vertex/index buffers
        this.translate.tips.vertexBuffer = new pc.gfx.VertexBuffer(posFormat, numVerts);
        iterator = new pc.gfx.VertexIterator(this.translate.tips.vertexBuffer);
        for (var i = 0; i < numVerts; i++) {
            iterator.element.vertex_position.set(positions[i*3], positions[i*3+1], positions[i*3+2]);
            iterator.next();
        }
        iterator.end();

        this.translate.tips.indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT16, indices.length);
        var dst = new Uint16Array(this.translate.tips.indexBuffer.lock());
        dst.set(indices);
        this.translate.tips.indexBuffer.unlock();

        // Create the scale gizmo geometry
        this.scale = {};
        this.scale.axes = {};
        this.scale.axes.vertexBuffers = [];
        numVerts = 2;
        for (axis = 0; axis < 3; axis++) {
            this.scale.axes.vertexBuffers[axis] = new pc.gfx.VertexBuffer(posFormat, numVerts);
            iterator = new pc.gfx.VertexIterator(this.scale.axes.vertexBuffers[axis]);
            iterator.element.vertex_position.set(0, 0, 0);
            iterator.next();
            if (axis === 0) {
                iterator.element.vertex_position.set(1, 0, 0);
            } else if (axis === 1) {
                iterator.element.vertex_position.set(0, 1, 0);
            } else if (axis === 2) {
                iterator.element.vertex_position.set(0, 0, 1);
            }
            iterator.end();
        }

        // Create the scale gizmo cube heads
        this.scale.tips = {};
        this.scale.tips.transforms = [];
        this.scale.tips.transforms[0] = pc.math.mat4.makeTranslate(1.1, 0.0, 0.0);
        this.scale.tips.transforms[1] = pc.math.mat4.makeTranslate(0.0, 1.1, 0.0);
        this.scale.tips.transforms[2] = pc.math.mat4.makeTranslate(0.0, 0.0, 1.1);

        var positions = [
            -0.1,-0.1,-0.1,
            -0.1,0.1,-0.1,
            0.1,0.1,-0.1,
            0.1,-0.1,-0.1,
            -0.1,-0.1,0.1,
            0.1,-0.1,0.1,
            0.1,0.1,0.1,
            -0.1,0.1,0.1,
            -0.1,-0.1,-0.1,
            0.1,-0.1,-0.1,
            0.1,-0.1,0.1,
            -0.1,-0.1,0.1,
            0.1,-0.1,-0.1,
            0.1,0.1,-0.1,
            0.1,0.1,0.1,
            0.1,-0.1,0.1,
            0.1,0.1,-0.1,
            -0.1,0.1,-0.1,
            -0.1,0.1,0.1,
            0.1,0.1,0.1,
            -0.1,0.1,-0.1,
            -0.1,-0.1,-0.1,
            -0.1,-0.1,0.1,
            -0.1,0.1,0.1];
        var indices = [0,1,2,2,3,0,4,5,6,6,7,4,8,9,10,10,11,8,12,13,14,14,15,12,16,17,18,18,19,16,20,21,22,22,23,20];
        
        // Copy data into vertex/index buffers
        numVerts = positions.length / 3;
        this.scale.tips.vertexBuffer = new pc.gfx.VertexBuffer(posFormat, numVerts);
        iterator = new pc.gfx.VertexIterator(this.scale.tips.vertexBuffer);
        for (var i = 0; i < numVerts; i++) {
            iterator.element.vertex_position.set(positions[i*3], positions[i*3+1], positions[i*3+2]);
            iterator.next();
        }
        iterator.end();

        this.scale.tips.indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT16, indices.length);
        var dst = new Uint16Array(this.scale.tips.indexBuffer.lock());
        dst.set(indices);
        this.scale.tips.indexBuffer.unlock();
    }

    Gizmo.prototype.render = function (mode, transform, activeAxis) {
        var gizmo;
        if (mode === pc.designer.graphics.GizmoMode.TRANSLATE) {
            gizmo = this.translate;
        } else if (mode === pc.designer.graphics.GizmoMode.ROTATE) {
            gizmo = this.rotate;
        } else if (mode === pc.designer.graphics.GizmoMode.SCALE) {
            gizmo = this.scale;
        }
        
        var device = pc.gfx.Device.getCurrent();
        var drawOptions = {
            primitiveType: pc.gfx.PrimType.LINE_STRIP,
            numVertices: gizmo.axes.vertexBuffers[0].getNumVertices(),
            useIndexBuffer: false
        };

        device.clear({
            depth: 1.0,
            flags: pc.gfx.ClearFlag.DEPTH
        });

        if (mode === pc.designer.graphics.GizmoMode.ROTATE) {
            this.rotate.sphere.dispatch(transform);
        }

        device.updateLocalState({
            cull: false
        });
        device.setProgram(this.posProgram);
        device.scope.resolve("matrix_model").setValue(transform);
        device.scope.resolve("constant_color").setValue((activeAxis === 0) ? [1,1,0,1] : [1,0,0,1]);
        device.setVertexBuffer(gizmo.axes.vertexBuffers[0], 0);
        device.draw(drawOptions);
        device.scope.resolve("constant_color").setValue((activeAxis === 1) ? [1,1,0,1] : [0,1,0,1]);
        device.setVertexBuffer(gizmo.axes.vertexBuffers[1], 0);
        device.draw(drawOptions);
        device.scope.resolve("constant_color").setValue((activeAxis === 2) ? [1,1,0,1] : [0,0,1,1]);
        device.setVertexBuffer(gizmo.axes.vertexBuffers[2], 0);
        device.draw(drawOptions);

        if ((mode === pc.designer.graphics.GizmoMode.TRANSLATE) ||
            (mode === pc.designer.graphics.GizmoMode.SCALE)) {
            drawOptions = {
                primitiveType: pc.gfx.PrimType.TRIANGLES,
                numVertices: gizmo.tips.indexBuffer.getNumIndices(),
                useIndexBuffer: true
            };
            device.setIndexBuffer(gizmo.tips.indexBuffer);
            device.setVertexBuffer(gizmo.tips.vertexBuffer, 0);

            var xform = pc.math.mat4.multiply(transform, gizmo.tips.transforms[0]);
            device.scope.resolve("matrix_model").setValue(xform);
            device.scope.resolve("constant_color").setValue([1,0,0,1]);
            device.draw(drawOptions);
            xform = pc.math.mat4.multiply(transform, gizmo.tips.transforms[1]);
            device.scope.resolve("matrix_model").setValue(xform);
            device.scope.resolve("constant_color").setValue([0,1,0,1]);
            device.draw(drawOptions);
            xform = pc.math.mat4.multiply(transform, gizmo.tips.transforms[2]);
            device.scope.resolve("matrix_model").setValue(xform);
            device.scope.resolve("constant_color").setValue([0,0,1,1]);
            device.draw(drawOptions);
        }

        device.clearLocalState();
    };

    return {
        Gizmo: Gizmo
    }
}());