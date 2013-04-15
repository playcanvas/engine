pc.extend(pc.audio, function () {
    var Listener;
    
    if (pc.audio.hasAudioContext()) {
        Listener = function (manager) {
            this.position = pc.math.vec3.create(0,0,0);
            this.velocity = pc.math.vec3.create(0,0,0);
            this.orientation = pc.math.mat4.create();
            
            this.listener = manager.context.listener;
        };
        
        Listener.prototype.getPosition = function () {
            return this.position;
        };

        Listener.prototype.setPosition = function (position) {
            pc.math.vec3.copy(position, this.position);
            this.listener.setPosition(position[0], position[1], position[2]);
        };
        
        Listener.prototype.getVelocity = function () {
            return this.velocity;
        };

        Listener.prototype.setVelocity = function (velocity) {
            pc.math.vec3.copy(velocity, this.velocity);
            this.listener.setPosition(velocity[0], velocity[1], velocity[2]);        
        };
        
        Listener.prototype.setOrientation = function (orientation) {
            pc.math.mat4.copy(orientation, this.orientation);
            this.listener.setOrientation(-orientation[8], -orientation[9], -orientation[10], orientation[4], orientation[5], orientation[6]);
        };
        
        Listener.prototype.getOrientation = function () {
            return this.orientation;
        };
    } else {
        Listener = function (manager) {
            this.position = pc.math.vec3.create(0,0,0);
            this.velocity = pc.math.vec3.create(0,0,0);
            this.orientation = pc.math.mat4.create();
        };
        
        Listener.prototype.getPosition = function () {
            return this.position;
        };
        
        Listener.prototype.setPosition = function (position) {
            pc.math.vec3.copy(position, this.position);
        };
        
        Listener.prototype.getVelocity = function () {
            return this.velocity;
        };

        Listener.prototype.setVelocity = function (velocity) {
            pc.math.vec3.copy(velocity, this.velocity);
        };

        Listener.prototype.setOrientation = function (orientation) {
            pc.math.mat4.copy(orientation, this.orientation);
        };
        
        Listener.prototype.getOrientation = function () {
            return this.orientation;
        };
    }

    return {
        Listener: Listener
    };
    
}());
