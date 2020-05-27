var DebugPhysics = pc.createScript('debugPhysics');

DebugPhysics.attributes.add('drawShapes', {
    type: 'boolean',
    default: false,
    title: 'Draw Shapes',
    description: 'Draw representations of physics collision shapes'
});
DebugPhysics.attributes.add('opacity', {
    type: 'number',
    default: 0.5,
    min: 0,
    max: 1,
    title: 'Opacity',
    description: 'Opacity of physics collision shapes'
});
DebugPhysics.attributes.add('castShadows', {
    type: 'boolean',
    default: true,
    title: 'Cast Shadows',
    description: 'Cast shadows from physics collision shapes'
});

// initialize code called once per entity
DebugPhysics.prototype.initialize = function () {
    this.on('attr:castShadows', function (value, prev) {
        this.debugRoot.children.forEach(function (child) {
            child.model.castShadows = value;
        });
    }, this);
    this.on('attr:opacity', function (value, prev) {
        this.debugRoot.children.forEach(function (child) {
            var material = child.model.material;
            material.opacity = value;
            material.update();
        }, this);
    }, this);

    this.debugRoot = new pc.Entity('Physics Debug Root');
    this.app.root.addChild(this.debugRoot);

    this.on('enable', function () {
        this.debugRoot = new pc.Entity('Physics Debug Root');
        this.app.root.addChild(this.debugRoot);
    });

    this.on('disable', function () {
        var collisionComponents = this.app.root.findComponents('collision');
        collisionComponents.forEach(function (collision) {
            if (collision.hasOwnProperty('_debugShape')) {
                delete collision._debugShape;
            }
        });
        this.debugRoot.destroy();
    });
};

DebugPhysics.prototype.createModel = function (mesh, material) {
    var node = new pc.GraphNode();
    var meshInstance = new pc.MeshInstance(node, mesh, material);
    var model = new pc.Model();
    model.graph = node;
    model.meshInstances = [meshInstance];
    return model;
};

DebugPhysics.prototype.postUpdate = function (dt) {
    // For any existing debug shapes, mark them as not updated (yet)
    this.debugRoot.children.forEach(function (child) {
        child.updated = false;
    });

    if (this.drawShapes) {
        // For each collision component, update its debug shape (creating one
        // if one does not exist)
        var collisionComponents = this.app.root.findComponents('collision');
        collisionComponents.forEach(function (collision) {
            if (collision.enabled && collision.entity.enabled) {
                var deleteShape = false;

                // If the type or shape of the collision components has changed, recreate the visuals
                if (collision._debugShape) {
                    if (collision._debugShape._collisionType !== collision.type) {
                        deleteShape = true;
                    } else {
                        switch (collision.type) {
                            case 'box':
                                if (!collision._debugShape._halfExents.equals(collision.halfExtents)) {
                                    deleteShape = true;
                                }
                                break;
                            case 'cone':
                            case 'cylinder':
                            case 'capsule':
                                if (collision._debugShape._height !== collision.height || collision._debugShape._radius !== collision.radius) {
                                    deleteShape = true;
                                }
                                break;
                            case 'sphere':
                                if (collision._debugShape._radius !== collision.radius) {
                                    deleteShape = true;
                                }
                                break;
                        }
                    }
                }

                if (deleteShape) {
                    collision._debugShape.destroy();
                    delete collision._debugShape;
                }

                // No accompanying debug render shape for this collision component so create one
                if (!collision._debugShape) {
                    var material = new pc.StandardMaterial();
                    material.diffuse.set(Math.random(), Math.random(), Math.random());
                    material.opacity = this.opacity;
                    material.blendType = pc.BLEND_NORMAL;
                    material.update();

                    var debugShape = new pc.Entity();

                    var mesh;
                    switch (collision.type) {
                        case 'box':
                            mesh = pc.createBox(this.app.graphicsDevice, {
                                halfExtents: collision.halfExtents
                            });
                            debugShape._halfExents = collision.halfExtents.clone();
                            break;
                        case 'cone':
                            mesh = pc.createCone(this.app.graphicsDevice, {
                                height: collision.height,
                                radius: collision.radius
                            });
                            debugShape._height = collision.height;
                            debugShape._radius = collision.radius;
                            break;
                        case 'cylinder':
                            mesh = pc.createCylinder(this.app.graphicsDevice, {
                                height: collision.height,
                                radius: collision.radius
                            });
                            debugShape._height = collision.height;
                            debugShape._radius = collision.radius;
                            break;
                        case 'sphere':
                            mesh = pc.createSphere(this.app.graphicsDevice, {
                                radius: collision.radius
                            });
                            debugShape._radius = collision.radius;
                            break;
                        case 'capsule':
                            mesh = pc.createCapsule(this.app.graphicsDevice, {
                                height: collision.height,
                                radius: collision.radius
                            });
                            debugShape._height = collision.height;
                            debugShape._radius = collision.radius;
                            break;
                    }

                    if (mesh) {
                        debugShape.addComponent('model', {
                            castShadows: this.castShadows,
                            type: 'asset'
                        });
                        debugShape.model.model = this.createModel(mesh, material);
                    }

                    this.debugRoot.addChild(debugShape);

                    // Cache collision component
                    debugShape._collision = collision;
                    debugShape._collisionType = collision.type;
                    collision._debugShape = debugShape;
                }

                collision._debugShape.setPosition(collision.entity.getPosition());
                collision._debugShape.setRotation(collision.entity.getRotation());

                collision._debugShape.updated = true;
            }
        }, this);
    }

    // If a debug shape was not updated this frame, the source collision component
    // isn't around any more so we can delete it
    this.debugRoot.children.forEach(function (child) {
        if (!child.updated) {
            delete child._collision._debugShape;
            delete child._collision;
            child.destroy();
        }
    });
};
