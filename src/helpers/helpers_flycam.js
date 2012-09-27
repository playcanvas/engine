function FlyCam() {
    this.target = pc.math.vec3.create(0.0, 0.0, 0.0);

    var angles = this.getLocalEulerAngles();
    this.x = angles[0];
    this.y = angles[1];
}

FlyCam = pc.inherits(FlyCam, pc.scene.CameraNode);

FlyCam.prototype.pan = function(movement) {
    var tx = pc.math.clamp(movement[0], -100.0, 100.0) * -0.025;
    var ty = pc.math.clamp(movement[1], -100.0, 100.0) * 0.025;

    this.translate(tx, ty, 0);
}

FlyCam.prototype.dolly = function (distance) {
    // Dolly along the Z axis of the camera's local transform
    var tz = pc.math.clamp(distance, -100.0, 100.0) * -0.025;

    this.translate(0, 0, tz);
}

FlyCam.prototype.orbit = function (rotation) {
    this.x += pc.math.clamp(movement[0], -100.0, 100.0) * -0.025;
    this.y -= pc.math.clamp(movement[1], -100.0, 100.0) * -0.025;

    var r = this.getLocalRotation();
//    pc.math.quat.transformVector(r, )
}

FlyCam.prototype.onMouseWheel = function (event) {
    var distance = event.wheel * 10;
    this.dolly(distance);
};

FlyCam.prototype.onMouseMove = function (event) {
    // We can't rely on a right click because that has a 'special function'
    // in most (all?) browsers
    if (event.buttons[pc.input.MOUSE_BUTTON_LEFT] && event.buttons[pc.input.MOUSE_BUTTON_MIDDLE]) {
        var distance = event.movementY;
        this.dolly(distance);
    }
    else if (event.altKey && event.buttons[pc.input.MOUSE_BUTTON_LEFT]) {
        var rotation = [event.movementX/300.0, event.movementY/300.0];
        this.orbit(rotation);
    }
    else if (event.altKey && event.buttons[pc.input.MOUSE_BUTTON_MIDDLE]) {
        var movement = [event.movementX, event.movementY];
        this.pan(movement);
    }    
};
