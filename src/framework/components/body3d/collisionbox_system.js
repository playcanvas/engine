pc.extend(pc.fw, function () {

    // Shared vectors to avoid excessive allocation
    var position = pc.math.vec3.create();
    var rotation = pc.math.vec3.create();
    var constrainedRotation = pc.math.quat.create();
    var scale = pc.math.vec3.create(1, 1, 1);
    var transform = pc.math.mat4.create();

    /**
     * @private
     * @name pc.fw.CollisionBoxComponentSystem
     * @constructor Create a new CollisionBoxComponentSystem
     * @class 
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var CollisionBoxComponentSystem = function CollisionBoxComponentSystem (context) {
        this.id = "collisionbox";
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.CollisionBoxComponent;
        this.DataType = pc.fw.CollisionBoxComponentData;

        this.schema = [{
            name: "x",
            displayName: "Size: X",
            description: "The half-extent of the box in the x-axis",
            type: "number",
            options: {
                min: 0,
                step: 0.1,
            },
            defaultValue: 0.5
        }, {
            name: "y",
            displayName: "Size: Y",
            description: "The half-extent of the box in the y-axis",
            type: "number",
            options: {
                min: 0,
                step: 0.1,
            },
            defaultValue: 0.5
        }, {
            name: "z",
            displayName: "Size: Z",
            description: "The half-extent of the box in the z-axis",
            type: "number",
            options: {
                min: 0,
                step: 0.1,
            },
            defaultValue: 0.5
        }, {
            name: "shape",
            exposed: false
        }];

        this.exposeProperties();

        this._gfx = _createGfxResources();
        
        this.debugRender = false;

        this.bind('remove', this.onRemove.bind(this));

        pc.fw.ComponentSystem.bind('update', this.onUpdate.bind(this));
        pc.fw.ComponentSystem.bind('toolsUpdate', this.onToolsUpdate.bind(this));
          
    };
    CollisionBoxComponentSystem = pc.inherits(CollisionBoxComponentSystem, pc.fw.ComponentSystem);
    
    CollisionBoxComponentSystem.prototype = pc.extend(CollisionBoxComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (typeof(Ammo) !== 'undefined') {
                data.shape = new Ammo.btBoxShape(new Ammo.btVector3(data.x, data.y, data.z));
            }
            
            properties = ['x', 'y', 'z', 'shape'];

            CollisionBoxComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            if (component.entity.body3d) {
                component.entity.body3d.createBody();
            }
        },
        
        onRemove: function (entity, data) {
            if (entity.body3d && entity.body3d.body) {
                this.context.systems.body3d.removeBody(entity.body3d.body);
            }
        },

        /**
        * @private
        * @name pc.fw.CollisionBoxComponentSystem#setDebugRender
        * @description Display collision shape outlines
        * @param {Boolean} value Enable or disable
        */
        setDebugRender: function (value) {
            this.debugRender = value;
        },

        onUpdate: function (dt) {
            if (this.debugRender) {
                var components = this.store;
                for (id in components) {
                    //this.renderBox(components[id].entity, components[id].data, this._gfx.rectVertexBuffer, this._gfx.rectIndexBuffer);
                }
            }
        },

        onToolsUpdate: function (dt) {
            var components = this.store;
            for (id in components) {
                //this.renderBox(components[id].entity, components[id].data, this._gfx.rectVertexBuffer, this._gfx.rectIndexBuffer);
            }
        },

        renderBox: function (entity, data, vertexBuffer, indexBuffer) {
            this.context.scene.enqueue("opaque", function () {
                var positions = new Float32Array(vertexBuffer.lock());

                positions[0]  = -data['x'];
                positions[1]  = -data['y'];
                positions[2]  = -data['z'];
                positions[3]  = -data['x'];
                positions[4]  = -data['y'];
                positions[5]  = data['z'];
                positions[6]  = data['x'];
                positions[7]  = -data['y'];
                positions[8]  = data['z'];
                positions[9]  = data['x'];
                positions[10]  = -data['y'];
                positions[11]  = -data['z'];

                positions[12]  = -data['x'];
                positions[13]  = data['y'];
                positions[14]  = -data['z'];
                positions[15]  = -data['x'];
                positions[16]  = data['y'];
                positions[17]  = data['z'];
                positions[18]  = data['x'];
                positions[19]  = data['y'];
                positions[20]  = data['z'];
                positions[21]  = data['x'];
                positions[22]  = data['y'];
                positions[23]  = -data['z'];

                vertexBuffer.unlock();

                var device = pc.gfx.Device.getCurrent();
                device.setProgram(this._gfx.program);
                device.setIndexBuffer(indexBuffer);
                device.setVertexBuffer(vertexBuffer, 0);

                pc.math.mat4.compose(entity.getPosition(), entity.getRotation(), scale, transform);

                device.scope.resolve("matrix_model").setValue(transform);
                device.scope.resolve("uColor").setValue(this._gfx.color);
                device.draw({
                    type: pc.gfx.PrimType.LINES,
                    base: 0,
                    count: indexBuffer.getNumIndices(),
                    indexed: true
                });
            }.bind(this));
        }
    });


    var _createGfxResources = function () {
        // Create the graphical resources required to render a camera frustum
        var device = pc.gfx.Device.getCurrent();
        var library = device.getProgramLibrary();
        var program = library.getProgram("basic", { vertexColors: false, diffuseMap: false });
        var vertBufferLength = 8;
        var indexBufferLength = 24;

        var format = new pc.gfx.VertexFormat();
        format.begin();
        format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
        format.end();
        var rectVertexBuffer = new pc.gfx.VertexBuffer(format, vertBufferLength, pc.gfx.VertexBufferUsage.DYNAMIC);
        var rectIndexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT8, indexBufferLength);
        var indices = new Uint8Array(rectIndexBuffer.lock());
        indices.set([
            0,1,1,2,2,3,3,0,
            4,5,5,6,6,7,7,4,
            0,4,1,5,2,6,3,7
        ]);
        rectIndexBuffer.unlock();

        // Set the resources on the component
        return {
            program: program,
            rectIndexBuffer: rectIndexBuffer,
            rectVertexBuffer: rectVertexBuffer,
            color: [0,0,1,1]
        };
    };

    return {
        CollisionBoxComponentSystem: CollisionBoxComponentSystem
    };
}());