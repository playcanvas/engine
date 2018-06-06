Object.assign(pc, function () {

    var ammoVec1, ammoQuat;

    /**
     * @private
     * @constructor
     * @name pc.Trigger
     * @classdesc Creates a trigger object used to create internal physics objects that interact with
     * rigid bodies and trigger collision events with no collision response
     * @param {pc.Application} app The running {pc.Application}
     * @param {pc.Component} component The component for which the trigger will be created
     * @param {pc.ComponentData} data The data for the component
     */
    var Trigger = function Trigger(app, component, data) {
        this.entity = component.entity;
        this.component = component;
        this.app = app;

        if (typeof Ammo !== 'undefined') {
            ammoVec1 = new Ammo.btVector3();
            ammoQuat = new Ammo.btQuaternion();
        }

        this.initialize(data);
    };

    Object.assign(Trigger.prototype,  {
        initialize: function (data) {
            var entity = this.entity;
            var shape = data.shape;

            if (shape && typeof Ammo !== 'undefined') {
                if (entity.trigger) {
                    entity.trigger.destroy();
                }

                var mass = 1;

                var localInertia = new Ammo.btVector3(0, 0, 0);
                shape.calculateLocalInertia(mass, localInertia);

                var pos = entity.getPosition();
                var rot = entity.getRotation();
                ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);

                var startTransform = new Ammo.btTransform();
                startTransform.setIdentity();
                startTransform.getOrigin().setValue(pos.x, pos.y, pos.z);
                startTransform.setRotation(ammoQuat);

                var motionState = new Ammo.btDefaultMotionState(startTransform);
                var bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);

                var body = new Ammo.btRigidBody(bodyInfo);
                this.body = body;

                body.setRestitution(0);
                body.setFriction(0);
                body.setDamping(0, 0);
                ammoVec1.setValue(0, 0, 0);
                body.setLinearFactor(ammoVec1);
                body.setAngularFactor(ammoVec1);

                body.setCollisionFlags(body.getCollisionFlags() | pc.BODYFLAG_NORESPONSE_OBJECT);
                body.entity = entity;

                if (this.component.enabled && entity.enabled) {
                    this.enable();
                }
            }
        },

        destroy: function () {
            if (this.body) {
                this.app.systems.rigidbody.removeBody(this.body);
            }
        },

        syncEntityToBody: function () {
            var body = this.body;
            if (body) {
                var position = this.entity.getPosition();
                var rotation = this.entity.getRotation();

                var transform = body.getWorldTransform();
                transform.getOrigin().setValue(position.x, position.y, position.z);

                ammoQuat.setValue(rotation.x, rotation.y, rotation.z, rotation.w);
                transform.setRotation(ammoQuat);
                body.activate();
            }
        },

        enable: function () {
            var body = this.body;
            if (!body) return;

            this.app.systems.rigidbody.addBody(body, pc.BODYGROUP_TRIGGER, pc.BODYMASK_NOT_STATIC ^ pc.BODYGROUP_TRIGGER);

            // set the body's activation state to active so that it is
            // simulated properly again
            body.forceActivationState(pc.BODYSTATE_ACTIVE_TAG);

            body.activate();

            this.syncEntityToBody();
        },

        disable: function () {
            var body = this.body;
            if (!body) return;

            this.app.systems.rigidbody.removeBody(body);

            // set the body's activation state to disable simulation so
            // that it properly deactivates after we remove it from the physics world
            body.forceActivationState(pc.BODYSTATE_DISABLE_SIMULATION);
        }
    });

    return {
        Trigger: Trigger
    };
}());
