pc.extend(pc.fw, function () {

    function createCapsuleShape(axis, radius, height) {
        var shape = null;
        if (typeof(Ammo) !== 'undefined') {
            switch (axis) {
                case 0:
                    shape = new Ammo.btCapsuleShapeX(radius, height);
                    break;
                case 1:
                    shape = new Ammo.btCapsuleShape(radius, height);
                    break;
                case 2:
                    shape = new Ammo.btCapsuleShapeZ(radius, height);
                    break;
            }
        }
        return shape;
    }

    /**
     * @component
     * @name pc.fw.CollisionCapsuleComponent
     * @constructor Create a new CollisionCapsuleComponent
     * @class A capsule-shaped collision volume. Use in conjunction with {@link pc.fw.RigidBodyComponent} to create a capsule that can be simulated using the physics engine.
     * @param {pc.fw.CollisionCapsuleComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.     
     * @extends pc.fw.Component
     * @property {Number} axis The local space axis with which the capsule's length is aligned. 0 for X, 1 for Y and 2 for Z. Defaults to 1 (Y-axis).
     * @property {Number} height The total height of the capsule from tip to tip. Defaults to 2.
     * @property {Number} radius The radius of the capsule. Defaults to 0.5.
     */
    var CollisionCapsuleComponent = function CollisionCapsuleComponent(system, entity) {
        this.on('set_axis', this.onSetAxis, this);
        this.on('set_height', this.onSetHeight, this);
        this.on('set_radius', this.onSetRadius, this);
    };
    CollisionCapsuleComponent = pc.inherits(CollisionCapsuleComponent, pc.fw.Component);
    
    pc.extend(CollisionCapsuleComponent.prototype, {

        onSetAxis: function (name, oldValue, newValue) {
            if (this.entity.rigidbody) {
                var axis = newValue;
                var radius = this.data.radius;
                var height = Math.max(this.data.height - 2 * radius, 0);

                this.data.shape = createCapsuleShape(axis, radius, height);
                if (this.data.model) {
                    this.updateDebugShape(axis, radius, height);
                }
                this.entity.rigidbody.createBody();
            }
        },

        onSetHeight: function (name, oldValue, newValue) {
            if (this.entity.rigidbody) {
                var axis = this.data.axis;
                var radius = this.data.radius;
                var height = Math.max(newValue - 2 * radius, 0);

                this.data.shape = createCapsuleShape(axis, radius, height);
                if (this.data.model) {
                    this.updateDebugShape(axis, radius, height);
                }
                this.entity.rigidbody.createBody();
            }
        },

        onSetRadius: function (name, oldValue, newValue) {
            if (this.entity.rigidbody) {
                var axis = this.data.axis;
                var radius = newValue;
                var height = Math.max(this.data.height - 2 * radius, 0);

                this.data.shape = createCapsuleShape(axis, radius, height);
                if (this.data.model) {
                    this.updateDebugShape(axis, radius, height);
                }
                this.entity.rigidbody.createBody();
            }
        },

        updateDebugShape: function (axis, radius, height) {
            var model = this.data.model;
            var vertexBuffer = model.meshInstances[0].mesh.vertexBuffer;

            var positions = new Float32Array(vertexBuffer.lock());

            var xo = 0;
            var yo = 1;
            var zo = 2;
            if (axis === 0) {
                xo = 1;
                yo = 0;
                zo = 2;
            } else if (axis === 2) {
                xo = 0;
                yo = 2;
                zo = 1;
            }

            var i, x = 0;
            var theta;
            // Generate caps
            for (cap = -1; cap < 2; cap += 2) {
                for (i = 0; i < 40; i++) {
                    theta = 2 * Math.PI * (i / 40);
                    positions[x+xo] = radius * Math.cos(theta);
                    positions[x+yo] = cap * height * 0.5;
                    positions[x+zo] = radius * Math.sin(theta);
                    x += 3;

                    theta = 2 * Math.PI * ((i + 1) / 40);
                    positions[x+xo] = radius * Math.cos(theta);
                    positions[x+yo] = cap * height * 0.5;
                    positions[x+zo] = radius * Math.sin(theta);
                    x += 3;
                }

                for (i = 0; i < 20; i++) {
                    theta = Math.PI * (i / 20) + Math.PI * 1.5;
                    positions[x+xo] = 0;
                    positions[x+yo] = cap * (height * 0.5 + radius * Math.cos(theta));
                    positions[x+zo] = cap * (radius * Math.sin(theta));
                    x += 3;

                    theta = Math.PI * ((i + 1) / 20) + Math.PI * 1.5;
                    positions[x+xo] = 0;
                    positions[x+yo] = cap * (height * 0.5 + radius * Math.cos(theta));
                    positions[x+zo] = cap * (radius * Math.sin(theta));
                    x += 3;
                }

                for (i = 0; i < 20; i++) {
                    theta = Math.PI * (i / 20) + Math.PI * 1.5;
                    positions[x+xo] = cap * (radius * Math.sin(theta));
                    positions[x+yo] = cap * (height * 0.5 + radius * Math.cos(theta));
                    positions[x+zo] = 0;
                    x += 3;

                    theta = Math.PI * ((i + 1) / 20) + Math.PI * 1.5;
                    positions[x+xo] = cap * (radius * Math.sin(theta));
                    positions[x+yo] = cap * (height * 0.5 + radius * Math.cos(theta));
                    positions[x+zo] = 0;
                    x += 3;
                }
            }

            // Connect caps
            for (i = 0; i < 4; i++) {
                theta = 2 * Math.PI * (i / 4);
                positions[x+xo] = radius * Math.cos(theta);
                positions[x+yo] = height * 0.5;
                positions[x+zo] = radius * Math.sin(theta);
                x += 3;

                theta = 2 * Math.PI * (i / 4);
                positions[x+xo] = radius * Math.cos(theta);
                positions[x+yo] = -height * 0.5;
                positions[x+zo] = radius * Math.sin(theta);
                x += 3;
            }

            vertexBuffer.unlock();
        }
    });

    return {
        CollisionCapsuleComponent: CollisionCapsuleComponent
    };
}());