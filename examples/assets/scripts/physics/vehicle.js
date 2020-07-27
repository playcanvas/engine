var Vehicle = pc.createScript('vehicle');

Vehicle.attributes.add('wheels', {
    type: 'entity',
    array: true,
    title: 'Wheels'
});
Vehicle.attributes.add('maxEngineForce', {
    type: 'number',
    default: 2000,
    title: 'Max Engine Force'
});
Vehicle.attributes.add('maxBrakingForce', {
    type: 'number',
    default: 100,
    title: 'Max Braking Force'
});
Vehicle.attributes.add('maxSteering', {
    type: 'number',
    default: 0.2,
    title: 'Max Steering'
});

Object.defineProperty(Vehicle.prototype, 'speed', {
    get: function () {
        return this.vehicle ? this.vehicle.getCurrentSpeedKmHour() : 0;
    }
});

// initialize code called once per entity
Vehicle.prototype.initialize = function () {
    var body = this.entity.rigidbody.body;
    var dynamicsWorld = this.app.systems.rigidbody.dynamicsWorld;

    // Create vehicle
    var tuning = new Ammo.btVehicleTuning();
    var vehicleRayCaster = new Ammo.btDefaultVehicleRaycaster(dynamicsWorld);
    var vehicle = new Ammo.btRaycastVehicle(tuning, body, vehicleRayCaster);
    vehicle.setCoordinateSystem(0, 1, 2);

    // Never deactivate the vehicle
    var DISABLE_DEACTIVATION = 4;
    body.setActivationState(DISABLE_DEACTIVATION);

    // Add wheels to the vehicle
    var wheelAxle = new Ammo.btVector3(-1, 0, 0);
    var wheelDirection = new Ammo.btVector3(0, -1, 0);
    var connectionPoint = new Ammo.btVector3(0, 0, 0);

    this.wheels.forEach(function (wheelEntity) {
        var wheelScript = wheelEntity.script.vehicleWheel;

        var frictionSlip = wheelScript.frictionSlip;
        var isFront = wheelScript.isFront;
        var radius = wheelScript.radius;
        var rollInfluence = wheelScript.rollInfluence;
        var suspensionCompression = wheelScript.suspensionCompression;
        var suspensionDamping = wheelScript.suspensionDamping;
        var suspensionRestLength = wheelScript.suspensionRestLength;
        var suspensionStiffness = wheelScript.suspensionStiffness;

        var wheelPos = wheelEntity.getLocalPosition();
        connectionPoint.setValue(wheelPos.x, wheelPos.y, wheelPos.z);
        var wheelInfo = vehicle.addWheel(connectionPoint, wheelDirection, wheelAxle, suspensionRestLength, radius, tuning, isFront);

        wheelInfo.set_m_suspensionStiffness(suspensionStiffness);
        wheelInfo.set_m_wheelsDampingRelaxation(suspensionDamping);
        wheelInfo.set_m_wheelsDampingCompression(suspensionCompression);
        wheelInfo.set_m_frictionSlip(frictionSlip);
        wheelInfo.set_m_rollInfluence(rollInfluence);
    }, this);

    Ammo.destroy(wheelAxle);
    Ammo.destroy(wheelDirection);
    Ammo.destroy(connectionPoint);

    // Add the vehicle to the dynamics world
    dynamicsWorld.addAction(vehicle);

    this.vehicle = vehicle;

    this.engineForce = 0;
    this.brakingForce = 0;
    this.steering = 0;

    // Event handling
    this.on("enable", function () {
        dynamicsWorld.addAction(vehicle);
    });

    this.on("disable", function () {
        dynamicsWorld.removeAction(vehicle);
    });

    this.on("destroy", function () {
        dynamicsWorld.removeAction(vehicle);

        Ammo.destroy(vehicleRayCaster);
        Ammo.destroy(vehicle);
    });

    this.on('vehicle:controls', function (steering, throttle) {
        this.steering = pc.math.lerp(this.steering, steering * this.maxSteering, 0.3);

        if (throttle > 0) {
            this.brakingForce = 0;
            this.engineForce = this.maxEngineForce;
        } else if (throttle < 0) {
            this.brakingForce = 0;
            this.engineForce = -this.maxEngineForce;
        } else {
            this.brakingForce = this.maxBrakingForce;
            this.engineForce = 0;
        }
    });
};

// update code called every frame
Vehicle.prototype.update = function (dt) {
    var vehicle = this.vehicle;
    var i;

    // Apply steering to the front wheels
    vehicle.setSteeringValue(this.steering, 0);
    vehicle.setSteeringValue(this.steering, 1);

    // Apply engine and braking force to the back wheels
    vehicle.applyEngineForce(this.engineForce, 2);
    vehicle.setBrake(this.brakingForce, 2);
    vehicle.applyEngineForce(this.engineForce, 3);
    vehicle.setBrake(this.brakingForce, 3);

    var numWheels = vehicle.getNumWheels();
    for (i = 0; i < numWheels; i++) {
        // synchronize the wheels with the (interpolated) chassis worldtransform
        vehicle.updateWheelTransform(i, true);
        var t = this.vehicle.getWheelTransformWS(i);

        var p = t.getOrigin();
        var q = t.getRotation();

        var wheel = this.wheels[i];
        wheel.setPosition(p.x(), p.y(), p.z());
        wheel.setRotation(q.x(), q.y(), q.z(), q.w());
    }
};


var VehicleWheel = pc.createScript('vehicleWheel');

VehicleWheel.attributes.add('isFront', {
    type: 'boolean',
    default: true,
    title: 'Front Wheel'
});
VehicleWheel.attributes.add('radius', {
    type: 'number',
    default: 0.5,
    title: 'Radius'
});
VehicleWheel.attributes.add('width', {
    type: 'number',
    default: 0.4,
    title: 'Width'
});
VehicleWheel.attributes.add('suspensionStiffness', {
    type: 'number',
    default: 20,
    title: 'Suspension Stiffness'
});
VehicleWheel.attributes.add('suspensionDamping', {
    type: 'number',
    default: 2.3,
    title: 'Suspension Damping'
});
VehicleWheel.attributes.add('suspensionCompression', {
    type: 'number',
    default: 4.4,
    title: 'Suspension Compression'
});
VehicleWheel.attributes.add('suspensionRestLength', {
    type: 'number',
    default: 0.6,
    title: 'Suspension Rest Length'
});
VehicleWheel.attributes.add('rollInfluence', {
    type: 'number',
    default: 0.2,
    title: 'Roll Influence'
});
VehicleWheel.attributes.add('frictionSlip', {
    type: 'number',
    default: 1000,
    title: 'Friction Slip'
});
VehicleWheel.attributes.add('debugRender', {
    type: 'boolean',
    default: false,
    title: 'Debug Render'
});

VehicleWheel.prototype.initialize = function () {
    var createDebugWheel = function (radius, width) {
        var debugWheel = new pc.Entity();
        debugWheel.addComponent('model', {
            type: 'cylinder',
            castShadows: true
        });
        debugWheel.setLocalEulerAngles(0, 0, 90);
        debugWheel.setLocalScale(radius * 2, width, radius * 2);
        return debugWheel;
    };

    if (this.debugRender) {
        this.debugWheel = createDebugWheel(this.radius, this.width);
        this.entity.addChild(this.debugWheel);
    }

    this.on('attr:debugRender', function (value, prev) {
        if (value) {
            this.debugWheel = createDebugWheel(this.radius, this.width);
            this.entity.addChild(this.debugWheel);
        } else {
            if (this.debugWheel) {
                this.debugWheel.destroy();
                this.debugWheel = null;
            }
        }
    });
};


var VehicleControls = pc.createScript('vehicleControls');

VehicleControls.attributes.add('targetVehicle', {
    type: 'entity',
    title: 'Target Vehicle'
});
VehicleControls.attributes.add('leftButton', {
    type: 'entity',
    title: 'Left Button'
});
VehicleControls.attributes.add('rightButton', {
    type: 'entity',
    title: 'Right Button'
});
VehicleControls.attributes.add('forwardButton', {
    type: 'entity',
    title: 'Forward Button'
});
VehicleControls.attributes.add('reverseButton', {
    type: 'entity',
    title: 'Reverse Button'
});

VehicleControls.prototype.initialize = function () {
    this.leftButtonPressed = false;
    this.rightButtonPressed = false;
    this.upButtonPressed = false;
    this.downButtonPressed = false;
    this.leftKeyPressed = false;
    this.rightKeyPressed = false;
    this.upKeyPressed = false;
    this.downKeyPressed = false;

    if (this.leftButton) {
        this.leftButton.enabled = pc.platform.mobile;
        this.leftButton.button.on('pressedstart', function () {
            this.leftButtonPressed = true;
        }, this);
        this.leftButton.button.on('pressedend', function () {
            this.leftButtonPressed = false;
        }, this);
    }
    if (this.rightButton) {
        this.rightButton.enabled = pc.platform.mobile;
        this.rightButton.button.on('pressedstart', function () {
            this.rightButtonPressed = true;
        }, this);
        this.rightButton.button.on('pressedend', function () {
            this.rightButtonPressed = false;
        }, this);
    }
    if (this.forwardButton) {
        this.forwardButton.enabled = pc.platform.mobile;
        this.forwardButton.button.on('pressedstart', function () {
            this.upButtonPressed = true;
        }, this);
        this.forwardButton.button.on('pressedend', function () {
            this.upButtonPressed = false;
        }, this);
    }
    if (this.reverseButton) {
        this.reverseButton.enabled = pc.platform.mobile;
        this.reverseButton.button.on('pressedstart', function () {
            this.downButtonPressed = true;
        }, this);
        this.reverseButton.button.on('pressedend', function () {
            this.downButtonPressed = false;
        }, this);
    }

    this.app.keyboard.on('keydown', function (e) {
        switch (e.key) {
            case pc.KEY_A:
            case pc.KEY_LEFT:
                this.leftKeyPressed = true;
                break;
            case pc.KEY_D:
            case pc.KEY_RIGHT:
                this.rightKeyPressed = true;
                break;
            case pc.KEY_W:
            case pc.KEY_UP:
                this.upKeyPressed = true;
                break;
            case pc.KEY_S:
            case pc.KEY_DOWN:
                this.downKeyPressed = true;
                break;
        }
    }, this);
    this.app.keyboard.on('keyup', function (e) {
        switch (e.key) {
            case pc.KEY_A:
            case pc.KEY_LEFT:
                this.leftKeyPressed = false;
                break;
            case pc.KEY_D:
            case pc.KEY_RIGHT:
                this.rightKeyPressed = false;
                break;
            case pc.KEY_W:
            case pc.KEY_UP:
                this.upKeyPressed = false;
                break;
            case pc.KEY_S:
            case pc.KEY_DOWN:
                this.downKeyPressed = false;
                break;
        }
    }, this);
};

VehicleControls.prototype.update = function (dt) {
    var targetVehicle = this.targetVehicle ? this.targetVehicle : this.entity;

    if (targetVehicle) {
        var steering = 0;
        var throttle = 0;

        if (this.leftButtonPressed || this.leftKeyPressed) steering++;
        if (this.rightButtonPressed || this.rightKeyPressed) steering--;
        if (this.upButtonPressed || this.upKeyPressed) throttle++;
        if (this.downButtonPressed || this.downKeyPressed) throttle--;

        targetVehicle.script.vehicle.fire('vehicle:controls', steering, throttle);
    }
};
