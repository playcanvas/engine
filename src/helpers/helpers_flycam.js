function FlyCam() {
    this.target = pc.math.vec3.create(0.0, 0.0, 0.0);

    this.x = 0;
    this.y = 0;

    this.distance = 3.25;
}

FlyCam = pc.inherits(FlyCam, pc.scene.CameraNode);

FlyCam.prototype.pan = function(movement) {
    var tx = pc.math.clamp(movement[0], -100.0, 100.0) * -0.025;
    var ty = pc.math.clamp(movement[1], -100.0, 100.0) * 0.025;

    this.translateLocal(tx, ty, 0);
}

FlyCam.prototype.dolly = function (distance) {
    // Dolly along the Z axis of the camera's local transform
    var tz = pc.math.clamp(distance, -100.0, 100.0) * -0.025;

    this.distance += tz;
    this.translateLocal(0, 0, tz);
}

FlyCam.prototype.orbit = function (movement) {
    this.x += movement[0] * 0.2;
    this.y += movement[1] * 0.2;

    var qx = pc.math.quat.create();
    var qy = pc.math.quat.create();
    var qxy = pc.math.quat.create();
    pc.math.quat.setFromAxisAngle(qx, [1, 0, 0], this.y);
    pc.math.quat.setFromAxisAngle(qy, [0, 1, 0], this.x);
    pc.math.quat.multiply(qx, qy, qxy);

    this.setLocalPosition(0, 0, 0);
    this.setLocalRotation(qxy);
    this.translateLocal(0, 0, this.distance);
}

FlyCam.prototype.onMouseWheel = function (event) {
    var distance = event.wheel * 10;
    this.dolly(distance);
}

FlyCam.prototype.onMouseMove = function (event) {
    // We can't rely on a right click because that has a 'special function'
    // in most (all?) browsers
    if (event.buttons[pc.input.MOUSE_BUTTON_LEFT] && event.buttons[pc.input.MOUSE_BUTTON_MIDDLE]) {
        this.dolly(event.movementY);
    } else if (event.altKey && event.buttons[pc.input.MOUSE_BUTTON_LEFT]) {
        this.orbit([event.movementX, event.movementY]);
    } else if (event.altKey && event.buttons[pc.input.MOUSE_BUTTON_MIDDLE]) {
        this.pan([event.movementX, event.movementY]);
    }
}