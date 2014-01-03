pc.extend(pc.audio, function () {
    var Listener;
    
    if (pc.audio.hasAudioContext()) {
        Listener = function (manager) {
            this.position = new pc.Vec3();
            this.velocity = new pc.Vec3();
            this.orientation = new pc.Mat4();
            
            this.listener = manager.context.listener;
        };
        
        Listener.prototype.getPosition = function () {
            return this.position;
        };

        Listener.prototype.setPosition = function (position) {
            this.position.copy(position);
            this.listener.setPosition(position[0], position[1], position[2]);
        };
        
        Listener.prototype.getVelocity = function () {
            return this.velocity;
        };

        Listener.prototype.setVelocity = function (velocity) {
            this.velocity.copy(velocity);
            this.listener.setPosition(velocity.x, velocity.y, velocity.z);
        };
        
        Listener.prototype.setOrientation = function (orientation) {
            this.orientation.copy(orientation);
            this.listener.setOrientation(-orientation[8], -orientation[9], -orientation[10], orientation[4], orientation[5], orientation[6]);
        };
        
        Listener.prototype.getOrientation = function () {
            return this.orientation;
        };
    } else {
        Listener = function (manager) {
            this.position = new pc.Vec3();
            this.velocity = new pc.Vec3();
            this.orientation = new pc.Mat4();
        };
        
        Listener.prototype.getPosition = function () {
            return this.position;
        };
        
        Listener.prototype.setPosition = function (position) {
            this.position.copy(position);
        };
        
        Listener.prototype.getVelocity = function () {
            return this.velocity;
        };

        Listener.prototype.setVelocity = function (velocity) {
            this.velocity.copy(velocity);
        };

        Listener.prototype.setOrientation = function (orientation) {
            this.orientation.copy(orientation);
        };
        
        Listener.prototype.getOrientation = function () {
            return this.orientation;
        };
    }

    return {
        Listener: Listener
    };
}());
