pc.extend(pc.audio, function () {
    // default maxDistance, same as Web Audio API
    var MAX_DISTANCE = 10000;
    
    var Channel3d;
    
    if (pc.audio.hasAudioContext()) {
        Channel3d = function (manager, sound) {
            this.position = pc.math.vec3.create();
            this.velocity = pc.math.vec3.create();
            
            this.panner = manager.context.createPanner();
            
            this.source.disconnect(0);
            this.source.connect(this.panner);
            this.panner.connect(manager.context.destination);
        };
        Channel3d = Channel3d.extendsFrom(pc.audio.Channel);
        
        Channel3d.prototype.getPosition = function () {
            return this.position;
        };
    
        Channel3d.prototype.setPosition = function (position) {
            pc.math.vec3.copy(position, this.position);
            this.panner.setPosition(position[0], position[1], position[2]);
        };
        
        Channel3d.prototype.getVelocity = function () {
            return this.velocity;
        };
        
        Channel3d.prototype.setVelocity = function (velocity) {
            pc.math.vec3.copy(velocity, this.velocity);
            this.panner.setVelocity(velocity[0], velocity[1], velocity[2]);
        };
        
        Channel3d.prototype.getMaxDistance = function () {
            return this.panner.maxDistance;
        };
        
        Channel3d.prototype.setMaxDistance = function (max) {
            this.panner.maxDistance = max;
        };
        
        Channel3d.prototype.getMinDistance = function () {
            return this.panner.refDistance;
        };
        
        Channel3d.prototype.setMinDistance = function (min) {
            this.panner.refDistance = min;
        };
        
        Channel3d.prototype.getRollOffFactor= function () {
            return this.panner.rolloffFactor;
        };
        
        Channel3d.prototype.setRollOffFactor= function (factor) {
            this.panner.rolloffFactor = factor;
        };
        
    } else if (pc.audio.hasAudio()) {
        // temp vector storage
        var offset = pc.math.vec3.create();
        var distance;
        
        // Fall off function which should be the same as the one in the Web Audio API, 
        // taken from OpenAL
        function fallOff (posOne, posTwo, refDistance, maxDistance, rolloffFactor) {
            var min = 0;
            
            offset = pc.math.vec3.subtract(posOne, posTwo, offset);
            distance = pc.math.vec3.length(offset);
            
            if (distance < refDistance) {
                return 1;
            } else if (distance > maxDistance) {
                return 0;
            } else {
                var numerator = refDistance + (rolloffFactor * (distance - refDistance));
                if ( numerator !== 0 ) {
                    return refDistance / numerator;    
                } else {
                    return 1;
                }
                
            }
        };

        Channel3d = function (manager, sound) {
            this.position = pc.math.vec3.create();
            this.velocity = pc.math.vec3.create();
            
            this.maxDistance = MAX_DISTANCE;
            this.minDistance = 1;
            this.rollOffFactor = 1;
            
        };
        Channel3d = Channel3d.extendsFrom(pc.audio.Channel);
        
        Channel3d.prototype.getPosition = function () {
            return this.position;
        };
    
        Channel3d.prototype.setPosition = function (position) {
            pc.math.vec3.copy(position, this.position);
            var listener = this.manager.getListener();
            
            var lpos = listener.getPosition();
            
            var factor = fallOff(lpos, this.position, this.minDistance, this.maxDistance, this.rollOffFactor);
            
            var v = this.getVolume();
            this.source.volume = v * factor;
        };
        
        Channel3d.prototype.getVelocity = function () {
            return this.velocity;
        };
        
        Channel3d.prototype.setVelocity = function (velocity) {
            pc.math.vec3.copy(velocity, this.velocity);
        };

        Channel3d.prototype.getMaxDistance = function () {
            return this.maxDistance;
        };
        
        Channel3d.prototype.setMaxDistance = function (max) {
            this.maxDistance = max;
        };
        
        Channel3d.prototype.getMinDistance = function () {
            return this.minDistance;
        };
        
        Channel3d.prototype.setMinDistance = function (min) {
            this.minDistance = min;
        };
        
        Channel3d.prototype.getRollOffFactor= function () {
            return this.rolloffFactor;
        };
        
        Channel3d.prototype.setRollOffFactor= function (factor) {
            this.rolloffFactor = factor;
        };    
    }
    
    return {
        Channel3d: Channel3d
    };
}());
