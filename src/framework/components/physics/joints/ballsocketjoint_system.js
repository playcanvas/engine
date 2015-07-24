pc.extend(pc, function () {
    /**
     * @private
     * @name pc.BallSocketJointComponentSystem
     * @constructor Create a new BallSocketJointComponentSystem
     * @class Manages creation of BallSocketJointComponents
     * @param {pc.Application} app The running {pc.Application}
     * @extends pc.ComponentSystem
     */
    var BallSocketJointComponentSystem = function BallSocketJointComponentSystem(app) {
        this.id = "ballsocketjoint";
        app.systems.add(this.id, this);

        this.ComponentType = pc.BallSocketJointComponent;
        this.DataType = pc.BallSocketJointComponentData;

        this.schema = [{
            name: "pivot",
            displayName: "Pivot",
            description: "Local space pivot",
            type: "vector",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: [0, 0, 0]
        }, {
            name: "position",
            displayName: "Position",
            description: "World space joint position",
            type: "vector",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: [0, 0, 0]
        }, {
            name: "tau",
            displayName: "Tau",
            description: "TBD",
            type: "number",
            defaultValue: 0.001,
            options: {
                min: 0,
                max: 1
            }
        }, {
            name: "damping",
            displayName: "Damping",
            description: "Damping",
            type: "number",
            defaultValue: 1,
            options: {
                min: 0,
                max: 1
            }
        }, {
            name: "impulseClamp",
            displayName: "Impulse Clamp",
            description: "Impulse Clamp",
            type: "number",
            defaultValue: 0,
            options: {
                min: 0,
                max: 100
            }
        }, {
            name: "constraint",
            exposed: false
        }];

        this.debugRender = false;

        this.on('remove', this.onRemove, this);

        pc.ComponentSystem.on('update', this.onUpdate, this);
        pc.ComponentSystem.on('toolsUpdate', this.onToolsUpdate, this);
    };
    BallSocketJointComponentSystem = pc.inherits(BallSocketJointComponentSystem, pc.ComponentSystem);

    BallSocketJointComponentSystem.prototype = pc.extend(BallSocketJointComponentSystem.prototype, {
        onLibraryLoaded: function () {
            if (typeof Ammo !== 'undefined') {
                // Only register update event if Ammo is loaded
            } else {
                pc.ComponentSystem.off('update', this.onUpdate, this);
            }
        },

        initializeComponentData: function (component, _data, properties) {
            if (typeof Ammo !== 'undefined') {
                // duplicate the input data because we are modifying it
                var data = pc.extend({}, _data);

                if (component.entity.rigidbody) {
                    if (data.pivot && pc.type(data.pivot) === 'array') {
                        data.pivot = new pc.Vec3(data.pivot[0], data.pivot[1], data.pivot[2]);
                    }

                    if (data.position && pc.type(data.position) === 'array') {
                        data.position = new pc.Vec3(data.position[0], data.position[1], data.position[2]);
                    }

                    var pivotA = new Ammo.btVector3(data.pivot.x, data.pivot.y, data.pivot.z);
                    var body = component.entity.rigidbody.body;
                    data.constraint = new Ammo.btPoint2PointConstraint(body, pivotA);

                    var pivotB = data.constraint.getPivotInB();
                    data.position = [ pivotB.x(), pivotB.y(), pivotB.z() ];

                    var app = this.app;
                    app.systems.rigidbody.addConstraint(data.constraint);
                }
            }

            properties = ['constraint', 'pivot', 'position', 'tau', 'damping', 'impulseClamp'];

            BallSocketJointComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        cloneComponent: function (entity, clone) {
            // overridden to make sure pivotA is duplicated
            var data = {
                pivot: [ entity.ballsocketjoint.pivot.x, entity.ballsocketjoint.pivot.y, entity.ballsocketjoint.pivot.z ],
                position: [ entity.ballsocketjoint.position.x, entity.ballsocketjoint.position.y, entity.ballsocketjoint.position.z ],
                tau: entity.ballsocketjoint.tau,
                damping: entity.ballsocketjoint.damping,
                impulseClamp: entity.ballsocketjoint.impulseClamp
            };
            return this.addComponent(clone, data);
        },

        onRemove: function (entity, data) {
            if (data.constraint) {
                this.app.systems.rigidbody.removeConstraint(data.constraint);
            }
        },

        /**
        * @private
        * @function
        * @name pc.BallSocketJointComponentSystem#setDebugRender
        * @description Display debug representation of the joint
        * @param {Boolean} value Enable or disable
        */
        setDebugRender: function (value) {
            this.debugRender = value;
        },

        onUpdate: function (dt) {
            if (this.debugRender) {
                this.updateDebugShapes();
            }
        },

        onToolsUpdate: function (dt) {
            this.updateDebugShapes();
        },

        updateDebugShapes: function () {
            var components = this.store;
            for (var id in components) {
                var entity = components[id].entity;
                var data = components[id].data;
            }
        }
    });

    return {
        BallSocketJointComponentSystem: BallSocketJointComponentSystem
    };
}());
