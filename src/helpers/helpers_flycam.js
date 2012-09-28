function FlyCam() {
    this.target = pc.math.vec3.create(0.0, 0.0, 0.0);

    this.x = 0;
    this.y = 0;

    this.distance = 3.25;
}

FlyCam = pc.inherits(FlyCam, pc.scene.CameraNode);

FlyCam.prototype.pan = function(movex, movey) {
    // Pan around in the camera's local XY plane
    this.translateLocal(movex, movey, 0);
}

FlyCam.prototype.dolly = function (movez) {
    // Dolly along the Z axis of the camera's local transform
    this.distance += movez;
    this.translateLocal(0, 0, movez);
}

FlyCam.prototype.orbit = function (movex, movey) {
    this.x += movex;
    this.y += movey;

    var qx = pc.math.quat.create();
    var qy = pc.math.quat.create();
    var qxy = pc.math.quat.create();
    pc.math.quat.setFromAxisAngle(qx, [1, 0, 0], this.y);
    pc.math.quat.setFromAxisAngle(qy, [0, 1, 0], this.x);
    pc.math.quat.multiply(qx, qy, qxy);

    this.setLocalRotation(qxy);
    this.setLocalPosition(0, 0, 0);
    this.translateLocal(0, 0, this.distance);
}

FlyCam.prototype.onMouseWheel = function (event) {
    this.dolly(event.wheel * -0.25);
}

FlyCam.prototype.onMouseMove = function (event) {
    // We can't rely on a right click because that has a 'special function'
    // in most (all?) browsers
    if (event.buttons[pc.input.MOUSE_BUTTON_LEFT] && event.buttons[pc.input.MOUSE_BUTTON_MIDDLE]) {
        this.dolly(event.movementY * -0.025);
    } else if (event.altKey && event.buttons[pc.input.MOUSE_BUTTON_LEFT]) {
        this.orbit(event.movementX * 0.2, event.movementY * 0.2);
    } else if (event.altKey && event.buttons[pc.input.MOUSE_BUTTON_MIDDLE]) {
        this.pan(event.movementX * -0.025, event.movementY * 0.025);
    }
}