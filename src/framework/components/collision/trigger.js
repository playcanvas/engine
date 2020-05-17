Object.assign(pc, function () {

    var ammoVec1, ammoQuat, ammoTransform;

    /**
     * @private
     * @class
     * @name pc.Trigger
     * @classdesc Creates a trigger object used to create internal physics objects that interact with
     * rigid bodies and trigger collision events with no collision response.
     * @param {pc.Application} app - The running {pc.Application}.
     * @param {pc.Component} component - The component for which the trigger will be created.
     * @param {pc.ComponentData} data - The data for the component.
     */
    var Trigger = function Trigger(app, component, data) {
        this.entity = component.entity;
        this.component = component;
        this.app = app;

        if (typeof Ammo !== 'undefined' && ! ammoVec1) {
            ammoVec1 = new Ammo.btVector3();
            ammoQuat = new Ammo.btQuaternion();
            ammoTransform = new Ammo.btTransform();
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

                var pos = entity.getPosition();
                var rot = entity.getRotation();

                ammoVec1.setValue(pos.x, pos.y, pos.z);
                ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);

                ammoTransform.setOrigin(ammoVec1);
                ammoTransform.setRotation(ammoQuat);

                var body = this.system.createBody(mass, shape, ammoTransform);

                body.setRestitution(0);
                body.setFriction(0);
                body.setDamping(0, 0);
                ammoVec1.setValue(0, 0, 0);
                body.setLinearFactor(ammoVec1);
                body.setAngularFactor(ammoVec1);

                body.setCollisionFlags(body.getCollisionFlags() | pc.BODYFLAG_NORESPONSE_OBJECT);
                body.entity = entity;

                this.body = body;

                if (this.component.enabled && entity.enabled) {
                    this.enable();
                }
            }
        },

        destroy: function () {
            var body = this.body;
            if (!body) return;

            this.disable();

            this.app.systems.rigidbody.destroyBody(body);
        },

        syncEntityToBody: function () {
            var wtm = this.entity.getWorldTransform();
            ammoTransform.setFromOpenGLMatrix(wtm.data);

            var body = this.body;
            body.setWorldTransform(ammoTransform);
            body.activate();
        },

        enable: function () {
            var body = this.body;
            if (!body) return;

            var systems = this.app.systems;
            systems.rigidbody.addBody(body, pc.BODYGROUP_TRIGGER, pc.BODYMASK_NOT_STATIC ^ pc.BODYGROUP_TRIGGER);
            systems.collision._triggers.push(this.component);

            // set the body's activation state to active so that it is
            // simulated properly again
            body.forceActivationState(pc.BODYSTATE_ACTIVE_TAG);

            this.syncEntityToBody();
        },

        disable: function () {
            var body = this.body;
            if (!body) return;

            var systems = this.app.systems;
            var idx = systems.collision._triggers.indexOf(this.component);
            if (idx > -1) {
                systems.collision._triggers.splice(idx, 1);
            }
            systems.rigidbody.removeBody(body);

            // set the body's activation state to disable simulation so
            // that it properly deactivates after we remove it from the physics world
            body.forceActivationState(pc.BODYSTATE_DISABLE_SIMULATION);
        }
    });

    return {
        Trigger: Trigger
    };
}());
