pc.extend(pc.audio, function () {
    // default maxDistance, same as Web Audio API
    var MAX_DISTANCE = 10000;
    
    var Channel3d;
    
    if (pc.audio.hasAudioContext()) {
        Channel3d = function (manager, sound, options) {
            this.position = pc.math.vec3.create();
            this.velocity = pc.math.vec3.create();
            
            var context = manager.context;
            this.panner = context.createPanner();
        };
        Channel3d = pc.inherits(Channel3d, pc.audio.Channel);
        
        Channel3d.prototype = pc.extend(Channel3d.prototype, {            
            getPosition: function () {
                return this.position;
            },

            setPosition: function (position) {
                pc.math.vec3.copy(position, this.position);
                this.panner.setPosition(position[0], position[1], position[2]);
            },

            getVelocity: function () {
                return this.velocity;
            },

            setVelocity: function (velocity) {
                pc.math.vec3.copy(velocity, this.velocity);
                this.panner.setVelocity(velocity[0], velocity[1], velocity[2]);
            },
            
            getMaxDistance: function () {
                return this.panner.maxDistance;
            },
            
            setMaxDistance: function (max) {
                this.panner.maxDistance = max;
            },
            
            getMinDistance: function () {
                return this.panner.refDistance;
            },
            
            setMinDistance: function (min) {
                this.panner.refDistance = min;
            },
            
            getRollOffFactor: function () {
                return this.panner.rolloffFactor;
            },
            
            setRollOffFactor: function (factor) {
                this.panner.rolloffFactor = factor;
            },

            /**
            * @private
            * @function
            * @name pc.audio.Channel3d#_createSource
            * @description Create the buffer source and connect it up to the correct audio nodes 
            */
            _createSource: function () {
                var context = this.manager.context;

                this.source = context.createBufferSource();
                this.source.buffer = this.sound.buffer;

                // Connect up the nodes
                this.source.connect(this.panner);
                this.panner.connect(this.gain);
                this.gain.connect(context.destination);
            }
        });        
    } else if (pc.audio.hasAudio()) {
        // temp vector storage
        var offset = pc.math.vec3.create();
        var distance;
        
        // Fall off function which should be the same as the one in the Web Audio API, 
        // taken from OpenAL
        var fallOff = function (posOne, posTwo, refDistance, maxDistance, rolloffFactor) {
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
        Channel3d = pc.inherits(Channel3d, pc.audio.Channel);
        
        Channel3d.prototype = pc.extend(Channel3d.prototype, {
            getPosition: function () {
                return this.position;
            },
        
            setPosition: function (position) {
                pc.math.vec3.copy(position, this.position);

                if (this.source) {
                    var listener = this.manager.getListener();
                    
                    var lpos = listener.getPosition();
                    
                    var factor = fallOff(lpos, this.position, this.minDistance, this.maxDistance, this.rollOffFactor);
                    
                    var v = this.getVolume();
                    this.source.volume = v * factor;                
                }
            },
            
            getVelocity: function () {
                return this.velocity;
            },
            
            setVelocity: function (velocity) {
                pc.math.vec3.copy(velocity, this.velocity);
            },

            getMaxDistance: function () {
                return this.maxDistance;
            },
            
            setMaxDistance: function (max) {
                this.maxDistance = max;
            },
            
            getMinDistance: function () {
                return this.minDistance;
            },
            
            setMinDistance: function (min) {
                this.minDistance = min;
            },
            
            getRollOffFactor: function () {
                return this.rolloffFactor;
            },
            
            setRollOffFactor: function (factor) {
                this.rolloffFactor = factor;
            }    
        });        
    } else {
        console.warn('No support for 3D audio found');
        Channel3d = function () {};
    }
    
    return {
        Channel3d: Channel3d
    };
}());
