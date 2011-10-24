pc.extend(pc.fw, function() {
    
    function _calculateGizmoScale(position, cameraTransform, fov) {
        var cameraPosition = pc.math.mat4.getTranslation(cameraTransform);
        var distance = pc.math.vec3.create();
        var denom = 0;
        var width = 1024;
        var height = 768;
        
        pc.math.vec3.subtract(position, cameraPosition, distance);
        distance = - pc.math.vec3.dot(distance, pc.math.mat4.getZ(cameraTransform));
        
        denom = Math.sqrt( width * width + height * height ) * Math.tan( fov * pc.math.DEG_TO_RAD );

        return Math.max(0.0001, (distance / denom) * 150);
    };
    
    function _calculateScale2(position, cameraTransform, fov) {
        var cameraPosition = pc.math.mat4.getTranslation(cameraTransform);
        var distance = pc.math.vec3.create();
        var denom = 0;
        var width = 1024;
        var height = 768;
        
        pc.math.vec3.subtract(position, cameraPosition, distance);
        distance = pc.math.vec3.length(distance);
        
        denom = 2 * distance * Math.tan(fov / 2);
        
        return Math.sqrt(width*width + height*height) / denom;
    };
    
    var gizmos = {
        translate: {
            init: function (entity, systems) {
                var transform;
                var scale = pc.math.mat4.create();
                var translate = pc.math.mat4.create();
                
                this.systems= systems;
                
                this.systems.pick.addShape(entity, new pc.shape.Box());
                this.systems.pick.addShape(entity, new pc.shape.Box());
                this.systems.pick.addShape(entity, new pc.shape.Box());
                
                // Update all shapes
                this.update(0, entity);

            },
            deinit: function (entity) {
                // clear all shapes.
                this.systems.pick.set(entity, "shapes", []);
                this.systems.pick.set(entity, "geometries", []);
            },
            update: function (dt, entity) {
                var useWorld = true;
                
                var position = pc.math.mat4.getTranslation(entity.getWorldTransform());
                var camera = this.systems.camera.getCurrent();
                var cameraTransform = camera.getWorldTransform();
                var fov = this.systems.camera.get(camera, "fov");
                var scaleFactor = _calculateGizmoScale(position, cameraTransform, fov);
                var scale = pc.math.mat4.create();
                var currentScale;
                var i;
                var shapes = [];
                var parentTransform;
                var translate = pc.math.mat4.create();
                var transform = pc.math.mat4.create();
                
                if(useWorld) {
                    parentTransform = pc.math.mat4.makeTranslate(position[0], position[1], position[2], parentTransform);
                } else {
                    parentTransform = entity.getWorldTransform();
                }
                
                // Update the gizmo scale to stay a constant size on screen
                pc.math.mat4.makeScale(scaleFactor, scaleFactor, scaleFactor, scale);
    
                // Only update the scale if it has actually changed.
                currentScale = this.systems.gizmo.get(entity, "scale");
                for(i=0;i<16;++i) {
                    if (currentScale[i] !== scale[i]) {
                        this.systems.gizmo.set(entity, "scale", scale);
                        break;
                    }
                }
                
                // Get the shapes from the Pick Component
                shapes = this.systems.pick.get(entity, "shapes");
                
                // Make a new scale matrix
                scale = pc.math.mat4.clone(pc.math.mat4.identity);
                
                // Update the transforms of all shapes in the Pick Component to stay a constant size on screen
                pc.math.mat4.makeScale(scaleFactor * 1.3, scaleFactor * 0.15, scaleFactor * 0.15, scale);
                pc.math.mat4.makeTranslate(scaleFactor * 0.65, 0, 0, translate);
                pc.math.mat4.multiply(parentTransform, translate, translate);
                pc.math.mat4.multiply(translate, scale, shapes[0].transform);                

                pc.math.mat4.makeScale(scaleFactor * 0.15, scaleFactor * 1.3, scaleFactor * 0.15, scale);
                pc.math.mat4.makeTranslate(0, scaleFactor * 0.65,0, translate);
                pc.math.mat4.multiply(parentTransform, translate, translate);                
                pc.math.mat4.multiply(translate, scale, shapes[1].transform);                

                pc.math.mat4.makeScale(scaleFactor * 0.15, scaleFactor * 0.15, scaleFactor * 1.3, scale);
                pc.math.mat4.makeTranslate(0, 0, scaleFactor * 0.65, translate);
                pc.math.mat4.multiply(parentTransform, translate, translate);                
                pc.math.mat4.multiply(translate, scale, shapes[2].transform);
            },
            render: function (entity, component, renderable) {
                var worldTransform = pc.math.mat4.clone(entity.getWorldTransform());
                var position = pc.math.mat4.getTranslation(worldTransform);
                var activeAxis = this.systems.gizmo.get(entity, "activeAxis");

                var transform = pc.math.mat4.clone(component.scale);
                transform[12] = worldTransform[12];
                transform[13] = worldTransform[13];
                transform[14] = worldTransform[14];
                renderable.render(pc.designer.graphics.GizmoMode.TRANSLATE, transform, activeAxis);
            }
        },
        rotate: {
            init: function (entity, systems) {
                var transform = pc.math.mat4.clone(pc.math.mat4.identity);
                var rotate = pc.math.mat4.create();
                var iradius = 0.1;
                var oradius = 1;

                this.systems = systems;
                this.systems.pick.addShape(entity, new pc.shape.Torus(transform, iradius, oradius));
                this.systems.pick.addShape(entity, new pc.shape.Torus(transform, iradius, oradius));
                this.systems.pick.addShape(entity, new pc.shape.Torus(transform, iradius, oradius));

                // Initialise positions                
                this.update(0, entity);
            },
            deinit: function (entity) {
                // clear all shapes.
                this.systems.pick.set(entity, "shapes", []);
                this.systems.pick.set(entity, "geometries", []);
            },
            update: function (dt, entity) {
                var useWorld = true;
                
                var transform;
                var rotate = pc.math.mat4.create();
                var scale = pc.math.mat4.create();
                var parentTransform;
                var position = pc.math.mat4.getTranslation(entity.getWorldTransform());
                var camera = this.systems.camera.getCurrent();
                var cameraTransform = camera.getWorldTransform();
                var fov = this.systems.camera.get(camera, "fov");
                var scaleFactor = _calculateGizmoScale(position, cameraTransform, fov);
                var shapes = this.systems.pick.get(entity, "shapes");
                
                if(useWorld) {
                    parentTransform = pc.math.mat4.makeTranslate(position[0], position[1], position[2], parentTransform);
                } else {
                    parentTransform = entity.getWorldTransform();
                }

                // Update the gizmo scale to stay a constant size on screen
                pc.math.mat4.makeScale(scaleFactor, scaleFactor, scaleFactor, scale);
                this.systems.gizmo.set(entity, "scale", scale);

                // x 
                shapes[0].transform = pc.math.mat4.clone(pc.math.mat4.identity);
                pc.math.mat4.makeRotate(Math.PI / 2, pc.math.vec3.create(0,0,1), rotate);
                pc.math.mat4.multiply(parentTransform, rotate, rotate);                
                pc.math.mat4.multiply(rotate, scale, shapes[0].transform);

                // y
                shapes[1].transform = pc.math.mat4.clone(pc.math.mat4.identity);
                pc.math.mat4.multiply(parentTransform, scale, shapes[1].transform);

                // z
                shapes[2].transform = pc.math.mat4.clone(pc.math.mat4.identity);
                pc.math.mat4.makeRotate(Math.PI / 2, pc.math.vec3.create(1,0,0), rotate);
                pc.math.mat4.multiply(parentTransform, rotate, rotate);                
                pc.math.mat4.multiply(rotate, scale, shapes[2].transform);
            },
            render: function (entity, component, renderable) {
                var worldTransform = pc.math.mat4.clone(entity.getWorldTransform());
                var position = pc.math.mat4.getTranslation(worldTransform);
                var camera = this.systems.camera.getCurrent();
                var cameraTransform = camera.getWorldTransform();
                var fov = this.systems.camera.get(camera, "fov");
                var scaleFactor = _calculateGizmoScale(position, cameraTransform, fov);
                var activeAxis = this.systems.gizmo.get(entity, "activeAxis");

                var transform = pc.math.mat4.makeScale(scaleFactor, scaleFactor, scaleFactor);
                transform[12] = worldTransform[12];
                transform[13] = worldTransform[13];
                transform[14] = worldTransform[14];
                renderable.render(pc.designer.graphics.GizmoMode.ROTATE, transform, activeAxis);
            }
        },
        scale: {
            init: function (entity, systems) {
                var transform;
                var scale = pc.math.mat4.create();
                var translate = pc.math.mat4.create();

                this.systems = systems;

                this.systems.pick.addShape(entity, new pc.shape.Box());
                this.systems.pick.addShape(entity, new pc.shape.Box());
                this.systems.pick.addShape(entity, new pc.shape.Box());

                // Update all shapes
                this.update(0, entity);
            },
            deinit: function (entity) {
                // clear all shapes.
                this.systems.pick.set(entity, "shapes", []);
                this.systems.pick.set(entity, "geometries", []);
            },
            update: function (dt, entity) {
                var useWorld = true;
                
                var position = pc.math.mat4.getTranslation(entity.getWorldTransform());
                var camera = this.systems.camera.getCurrent();
                var cameraTransform = camera.getWorldTransform();
                var fov = this.systems.camera.get(camera, "fov");
                var scaleFactor = _calculateGizmoScale(position, cameraTransform, fov);
                var scale = pc.math.mat4.create();
                var shapes = [];
                var parentTransform;
                var translate = pc.math.mat4.create();
                var transform = pc.math.mat4.create();
                
                if(useWorld) {
                    parentTransform = pc.math.mat4.makeTranslate(position[0], position[1], position[2], parentTransform);
                } else {
                    parentTransform = entity.getWorldTransform();
                }
                
                // Update the gizmo scale to stay a constant size on screen
                pc.math.mat4.makeScale(scaleFactor, scaleFactor, scaleFactor, scale);
                this.systems.gizmo.set(entity, "scale", scale);
                
                // Get the shapes from the Pick Component
                shapes = this.systems.pick.get(entity, "shapes");
                
                // Make a new scale matrix
                scale = pc.math.mat4.clone(pc.math.mat4.identity);
                
                // Update the transforms of all shapes in the Pick Component to stay a constant size on screen
                pc.math.mat4.makeScale(scaleFactor * 1.3, scaleFactor * 0.15, scaleFactor * 0.15, scale);
                pc.math.mat4.makeTranslate(scaleFactor * 0.65, 0, 0, translate);
                pc.math.mat4.multiply(parentTransform, translate, translate);
                pc.math.mat4.multiply(translate, scale, shapes[0].transform);                

                pc.math.mat4.makeScale(scaleFactor * 0.15, scaleFactor * 1.3, scaleFactor * 0.15, scale);
                pc.math.mat4.makeTranslate(0, scaleFactor * 0.65,0, translate);
                pc.math.mat4.multiply(parentTransform, translate, translate);                
                pc.math.mat4.multiply(translate, scale, shapes[1].transform);                

                pc.math.mat4.makeScale(scaleFactor * 0.15, scaleFactor * 0.15, scaleFactor * 1.3, scale);
                pc.math.mat4.makeTranslate(0, 0, scaleFactor * 0.65, translate);
                pc.math.mat4.multiply(parentTransform, translate, translate);                
                pc.math.mat4.multiply(translate, scale, shapes[2].transform);
            },
            render: function (entity, component, renderable) {
                var worldTransform = pc.math.mat4.clone(entity.getWorldTransform());
                var position = pc.math.mat4.getTranslation(worldTransform);
                var activeAxis = this.systems.gizmo.get(entity, "activeAxis");

                var transform = pc.math.mat4.clone(component.scale);
                transform[12] = worldTransform[12];
                transform[13] = worldTransform[13];
                transform[14] = worldTransform[14];
                renderable.render(pc.designer.graphics.GizmoMode.SCALE, transform, activeAxis);
            }
        }
    };
    
    function _onSet(entity, name, oldValue, newValue) {       
        if(name == "gizmoType") {                
            if (this.activeGizmo) {
                this.activeGizmo.deinit(entity);
            }

            this.activeGizmo = gizmos[newValue];
            this.activeGizmo.init(entity, this.context.systems);

            this.currentGizmoType = newValue;
        }
    };
    
    GizmoComponentSystem = function GizmoComponentSystem(context) {
        this.context.systems.add('gizmo', this);
        
        this.selection = [];
        this.activeGizmo = null;
        this.currentGizmoType = "translate";
        this.renderable = new pc.designer.graphics.Gizmo();

        this.bind("set", pc.callback(this, _onSet));
    };
    
    GizmoComponentSystem = GizmoComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    
    GizmoComponentSystem.prototype.toolsUpdate = function(dt) {        
        var id;
        var entity;
        var gizmo;
        var type;
        var component;
        var components = this._getComponents();
        
        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                //component = this.systems[id].component;
                
                if(this.activeGizmo) {
                    this.activeGizmo.update(dt, entity);
                }
                
            }
        }
    };
    
    GizmoComponentSystem.prototype.toolsRender = function() {
        var id;
        var type;
        var gizmo;
        var components = this._getComponents();
        
        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                component = components[id].component;
                
                if (this.activeGizmo) {
                    this.context.scene.enqueue("last", (function(g, e, c, r) {
                            return function () {
                                g.render(e, c, r);
                            }
                        })(this.activeGizmo, entity, component, this.renderable));
                }
            }
        }
        
    }
    
    GizmoComponentSystem.prototype.createComponent = function (entity, data) {
        var component = new GizmoComponentData();
        var gizmo;
        var pickEntity;
        data = data || {
            gizmoType: "translate"
        }        
        this.addComponent(entity, component);
        
        this.context.systems.pick.createComponent(entity);
        this.context.systems.pick.set(entity, "layer", "gizmo");

        // Set the active gizmo
        //this.set(entity, "pickEntity", pickEntity);
        this.set(entity, "gizmoType", data.gizmoType);
        
        return component;
    };
    
    GizmoComponentSystem.prototype.deleteComponent = function (entity) {
        // Remove the Pick Component as well
        if(this.context.systems.pick.hasComponent(entity)) {
            this.context.systems.pick.deleteComponent(entity);
        }
        
        this.removeComponent(entity);
    }
    
    GizmoComponentSystem.prototype.setSelection = function (selection) {   
        var i;
        var length;
        
        length = this.selection.length;
        for(i = 0 ; i < length ; ++i) {
            this.deselectEntity(this.selection[i]);
        }
        
        this.selection = selection;
        length = selection.length;
        for(i = 0; i < length; ++i) {
            this.selectEntity(this.selection[i]);
        }
    }
    
    GizmoComponentSystem.prototype.setCurrentGizmoType = function (type) {
        this.currentGizmoType = type;    
    };
    
    GizmoComponentSystem.prototype.selectEntity = function (entity) {
        if(!this.hasComponent(entity)) {
            this.createComponent(entity, {gizmoType: this.currentGizmoType});
        }
    };
     
    GizmoComponentSystem.prototype.deselectEntity = function(entity) {
        if(this.hasComponent(entity)) {
            this.deleteComponent(entity);
        }
    };
    
    GizmoComponentSystem.prototype.deselectAll = function () {
        this.select([]);    
    };
    
    return {
        GizmoComponentSystem: GizmoComponentSystem
    };
}());
