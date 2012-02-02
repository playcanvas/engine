pc.extend(pc.audio, function () {
    var Listener;
    
    if (pc.audio.hasAudioContext()) {
        Listener = function (manager) {
            this.position = pc.math.vec3.create(0,0,0);
            this.velocity = pc.math.vec3.create(0,0,0);
            
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
        
    } else {
        Listener = function (manager) {
            this.position = pc.math.vec3.create(0,0,0);
            this.velocity = pc.math.vec3.create(0,0,0);
        };
        
        Listener.prototype.getPosition = function () {
            return this.position;
        }
        
        Listener.prototype.setPosition = function (position) {
            pc.math.vec3.copy(position, this.position);
        };
        
        Listener.prototype.getVelocity = function () {
            return this.velocity;
        }

        Listener.prototype.setVelocity = function (velocity) {
            pc.math.vec3.copy(velocity, this.velocity);
        };
        
    }

    return {
        Listener: Listener
    };
    
}());
