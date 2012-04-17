function FlyCam() {
    this.target = pc.math.vec3.create(0.0, 0.0, 0.0);
}

FlyCam = FlyCam.extendsFrom(pc.scene.CameraNode);

FlyCam.prototype.pan = function(movement) {
    var factorX = pc.math.clamp(movement[0], -100.0, 100.0) * -0.025;
    var factorY = pc.math.clamp(movement[1], -100.0, 100.0) * -0.025;

    var ltm = this.getLocalTransform();
    var lookRight = pc.math.vec3.create(ltm[0],  ltm[1],  ltm[2]);
    var lookUp    = pc.math.vec3.create(ltm[4],  ltm[5],  ltm[6]);
    var lookPos   = pc.math.vec3.create(ltm[12], ltm[13], ltm[14]);

    pc.math.vec3.scale(lookUp, -factorY, lookUp);
    pc.math.vec3.scale(lookRight, factorX, lookRight);

    pc.math.vec3.add(lookPos, lookUp, lookPos);
    pc.math.vec3.add(lookPos, lookRight, lookPos);
    pc.math.vec3.add(this.target, lookUp, this.target);
    pc.math.vec3.add(this.target, lookRight, this.target);

    ltm[12] = lookPos[0];
    ltm[13] = lookPos[1];
    ltm[14] = lookPos[2];
}

FlyCam.prototype.dolly = function (distance) {
    // Dolly along the Z axis of the camera's local transform
    var factor = pc.math.clamp(distance, -100.0, 100.0) * -0.025;

    var ltm = this.getLocalTransform();
    var lookDir = pc.math.vec3.create(ltm[8],  ltm[9],  ltm[10]);
    var lookPos = pc.math.vec3.create(ltm[12], ltm[13], ltm[14]);

    pc.math.vec3.scale(lookDir, factor, lookDir);
    pc.math.vec3.add(lookPos, lookDir, lookPos);

    ltm[12] = lookPos[0];
    ltm[13] = lookPos[1];
    ltm[14] = lookPos[2];
}

FlyCam.prototype.orbit = function (rotation) {
    var ltm = this.getLocalTransform();
    
    var eyePos = pc.math.vec3.create(ltm[12], ltm[13], ltm[14]);
    var targetToEye = pc.math.vec3.create(0,0,0);
    pc.math.vec3.subtract(eyePos, this.target, targetToEye);

    var rotMat1 = pc.math.mat4.makeRotate(-rotation[1], pc.math.mat4.getX(ltm));
    var rotMat2 = pc.math.mat4.makeRotate(-rotation[0], [0, 1, 0]);
    
    var tempMat1 = pc.math.mat4.multiply(rotMat2, rotMat1);
    targetToEye = pc.math.mat4.multiplyVec3(targetToEye, 1, tempMat1, targetToEye);
    
    pc.math.vec3.add(this.target, targetToEye, eyePos)
    
    pc.math.mat4.makeLookAt(eyePos, this.target, [0,1,0], ltm);
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
