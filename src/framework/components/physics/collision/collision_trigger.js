pc.extend(pc.fw, function () {

    var ammoVec1, ammoQuat;
    
    /**
    * @private
    * @name pc.fw.Trigger
    * @description Creates a trigger object used to create internal physics objects that interact with 
    * rigid bodies and trigger collision events with no collision response
    * @param {pc.fw.ApplicationContext} context The ApplicationContext for the running application
    * @param {pc.fw.Component} component The component for which the trigger will be created
    * @param {pc.fw.ComponentData} data The data for the component
    */
    var Trigger = function Trigger (context, component, data) {
        this.entity = component.entity;
        this.component = component;
        this.context = context; 

        if (typeof(Ammo) !== 'undefined') {
            ammoVec1 = new Ammo.btVector3();
            ammoQuat = new Ammo.btQuaternion(); 
        }

        this.initialize(data);
    };

    Trigger.prototype =  {
        initialize: function (data) {
            var entity = this.entity;
            var shape = data.shape;

            if (shape && typeof(Ammo) !== 'undefined') {
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
                ammoVec1.setValue(0,0,0);
                body.setLinearFactor(ammoVec1);
                body.setAngularFactor(ammoVec1);

                body.setCollisionFlags(body.getCollisionFlags() | pc.fw.RIGIDBODY_CF_NORESPONSE_OBJECT);
                body.entity = entity;

                if (this.component.enabled) {
                    this.enable();
                }
            } 
        },

        destroy: function () {
            if (this.body) {
                this.context.systems.rigidbody.removeBody(this.body);
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
            this.context.systems.rigidbody.addBody(body);
            body.forceActivationState(pc.fw.RIGIDBODY_ACTIVE_TAG);
            body.activate();
        },

        disable: function () {
            var body = this.body;
            this.context.systems.rigidbody.removeBody(body);
            body.forceActivationState(pc.fw.RIGIDBODY_DISABLE_SIMULATION);
        }
    };

    return {
        Trigger: Trigger
    };

}());