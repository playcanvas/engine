if (typeof(Ammo) !== 'undefined') {
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
                data.shape = new Ammo.btBoxShape(new Ammo.btVector3(data.x, data.y, data.z));

                properties = ['x', 'y', 'z', 'shape'];

                CollisionBoxComponentSystem._super.initializeComponentData.call(this, component, data, properties);

                if (component.entity.body3d) {
                    component.entity.body3d.createBody();
                }
            },
            
            onRemove: function (entity, data) {
                if (entity.body3d) {
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
                        this.renderRect(components[id].entity, components[id].data, this._gfx.rectVertexBuffer, this._gfx.rectIndexBuffer);
                    }
                }
            },

            onToolsUpdate: function (dt) {
                var components = this.store;
                for (id in components) {
                    this.renderRect(components[id].entity, components[id].data, this._gfx.rectVertexBuffer, this._gfx.rectIndexBuffer);
                }
            },

            renderRect: function (entity, data, vertexBuffer, indexBuffer) {
                this.context.scene.enqueue("opaque", function () {
                    var positions = new Float32Array(vertexBuffer.lock());

                    positions[0]  = -data['x'];
                    positions[1]  = 0;
                    positions[2]  = -data['y'];
                    positions[3]  = data['x'];
                    positions[4]  = 0;
                    positions[5]  = -data['y'];
                    positions[6]  = data['x'];
                    positions[7]  = 0;
                    positions[8]  = data['y'];
                    positions[9]  = -data['x'];
                    positions[10] = 0;
                    positions[11] = data['y'];
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
            var vertBufferLength = 4;
            var indexBufferLength = 8;

            var format = new pc.gfx.VertexFormat();
            format.begin();
            format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
            format.end();
            var rectVertexBuffer = new pc.gfx.VertexBuffer(format, vertBufferLength, pc.gfx.VertexBufferUsage.DYNAMIC);
            var rectIndexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT8, indexBufferLength);
            var indices = new Uint8Array(rectIndexBuffer.lock());
            indices.set([0,1,1,2,2,3,3,0]);
            rectIndexBuffer.unlock();

            var format = new pc.gfx.VertexFormat();
            format.begin();
            format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
            format.end();
            var circleVertexBuffer = new pc.gfx.VertexBuffer(format, 42, pc.gfx.VertexBufferUsage.DYNAMIC);
            var circleIndexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT8, 80);
            var inds = new Uint8Array(circleIndexBuffer.lock());
            
            // Spot cone circle - 40 segments
            for (var i = 0; i < 40; i++) {
                inds[i * 2 + 0] = i + 1;
                inds[i * 2 + 1] = i + 2;
            }
            circleIndexBuffer.unlock();

            // Set the resources on the component
            return {
                program: program,
                rectIndexBuffer: rectIndexBuffer,
                rectVertexBuffer: rectVertexBuffer,
                circleIndexBuffer: circleIndexBuffer,
                circleVertexBuffer: circleVertexBuffer,
                color: [0,0,1,1]
            };
        };

        return {
            CollisionBoxComponentSystem: CollisionBoxComponentSystem
        };
    }());
}