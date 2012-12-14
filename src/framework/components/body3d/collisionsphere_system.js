if (typeof(Ammo) !== 'undefined') {
    pc.extend(pc.fw, function () {
        // Shared vectors to avoid excessive allocation
        var position = pc.math.vec3.create();
        var rotation = pc.math.vec3.create();
        var scale = pc.math.vec3.create(1, 1, 1);
        var transform = pc.math.mat4.create();

        /**
         * @private
         * @name pc.fw.CollisionSphereComponentSystem
         * @constructor Create a new CollisionSphereComponentSystem
         * @class 
         * @param {Object} context
         * @extends pc.fw.ComponentSystem
         */
        var CollisionSphereComponentSystem = function CollisionSphereComponentSystem (context) {
            this.id = "collisionsphere";
            context.systems.add(this.id, this);

            this.ComponentType = pc.fw.CollisionSphereComponent;
            this.DataType = pc.fw.CollisionSphereComponentData;

            this.schema = [{
                name: "radius",
                displayName: "Radius",
                description: "The radius of the collision sphere",
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
        CollisionSphereComponentSystem = pc.inherits(CollisionSphereComponentSystem, pc.fw.ComponentSystem);
        
        pc.extend(CollisionSphereComponentSystem.prototype, {
            initializeComponentData: function (component, data, properties) {
                data.shape = new Ammo.btSphereShape(data.radius);

                properties = ['radius', 'shape'];

                CollisionSphereComponentSystem._super.initializeComponentData.call(this, component, data, properties);

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
            * @name pc.fw.CollisionSphereComponentSystem#setDebugRender
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
                        this.renderCircle(components[id].entity, components[id].data, this._gfx.vertexBuffer, this._gfx.indexBuffer);
                    }                    
                }
            },

            onToolsUpdate: function (dt) {
                var components = this.store;
                for (id in components) {
                    //this.renderCircle(components[id].entity, components[id].data, this._gfx.vertexBuffer, this._gfx.indexBuffer);
                }                    
            },

            renderCircle: function (entity, data, vertexBuffer, indexBuffer) {
                this.context.scene.enqueue('opaque', function () {
                    var positions = new Float32Array(vertexBuffer.lock());
                    positions[0] = 0;
                    positions[1] = 0;
                    positions[2] = 0;

                    var r = data['radius'];
                    var numVerts = vertexBuffer.getNumVertices();
                    for (var i = 0; i < numVerts-1; i++) {
                        var theta = 2 * Math.PI * (i / (numVerts-2));
                        var x = r * Math.cos(theta);
                        var z = r * Math.sin(theta);
                        positions[(i+1)*3+0] = x;
                        positions[(i+1)*3+1] = 0;
                        positions[(i+1)*3+2] = z;
                    }
                    vertexBuffer.unlock();

                    // Render a representation of the light
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

            // var format = new pc.gfx.VertexFormat();
            // format.begin();
            // format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
            // format.end();
            // var rectVertexBuffer = new pc.gfx.VertexBuffer(format, vertBufferLength, pc.gfx.VertexBufferUsage.DYNAMIC);
            // var rectIndexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT8, indexBufferLength);
            // var indices = new Uint8Array(rectIndexBuffer.lock());
            // indices.set([0,1,1,2,2,3,3,0]);
            // rectIndexBuffer.unlock();

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
                indexBuffer: circleIndexBuffer,
                vertexBuffer: circleVertexBuffer,
                color: [0,0,1,1]
            };
        };

        return {
            CollisionSphereComponentSystem: CollisionSphereComponentSystem
        };
    }());
}