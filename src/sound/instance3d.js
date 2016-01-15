pc.extend(pc, function () {
    'use strict';

    // default maxDistance, same as Web Audio API
    var MAX_DISTANCE = 10000;

    var SoundInstance3d;

    if (pc.SoundManager.hasAudioContext()) {
        SoundInstance3d = function (manager, sound, options) {
            options = options || {};

            this._position = new pc.Vec3();
            if (options.position)
                this.position = options.position;

            this._velocity = new pc.Vec3();
            if (options.velocity)
                this.velocity = options.velocity;

            this.maxDistance = options.maxDistance !== undefined ? Number(options.maxDistance) : MAX_DISTANCE;
            this.refDistance = options.refDistance !== undefined ? Number(options.refDistance) : 1;
            this.rollOffFactor = options.rollOffFactor !== undefined ? Number(options.rollOffFactor) : 1;
            this.distanceModel = options.distanceModel !== undefined ? options.distanceModel : pc.DISTANCE_INVERSE;
        };
        SoundInstance3d = pc.inherits(SoundInstance3d, pc.SoundInstance);

        SoundInstance3d.prototype = pc.extend(SoundInstance3d.prototype, {
            _initializeNodes: function () {
                this.gain = this._manager.context.createGain();
                this.panner = this._manager.context.createPanner();
                this.panner.connect(this.gain);
                this._inputNode = this.panner;
                this._connectorNode = this.gain;
                this._connectorNode.connect(this._manager.context.destination);
            }
        });

        Object.defineProperty(SoundInstance3d.prototype, 'position', {
            get: function () {
                return this._position;
            },
            set: function (position) {
                this._position.copy(position);
                this.panner.setPosition(position.x, position.y, position.z);
            }
        });

        Object.defineProperty(SoundInstance3d.prototype, 'velocity', {
            get: function () {
                return this._velocity;
            },
            set: function (velocity) {
                this._velocity.copy(velocity);
                this.panner.setVelocity(velocity.x, velocity.y, velocity.z);
            }
        });

        Object.defineProperty(SoundInstance3d.prototype, 'maxDistance', {
            get: function () {
                return this.panner.maxDistance;
            },
            set: function (value) {
                this.panner.maxDistance = value;
            }
        });

        Object.defineProperty(SoundInstance3d.prototype, 'refDistance', {
            get: function () {
                return this.panner.refDistance;
            },
            set: function (value) {
                this.panner.refDistance = value;
            }
        });

        Object.defineProperty(SoundInstance3d.prototype, 'rollOffFactor', {
            get: function () {
                return this.panner.rollOffFactor;
            },
            set: function (value) {
                this.panner.rollOffFactor = value;
            }
        });

        Object.defineProperty(SoundInstance3d.prototype, 'distanceModel', {
            get: function () {
                return this.panner.distanceModel;
            },
            set: function (value) {
                this.panner.distanceModel = value;
            }
        });

    } else if (pc.SoundManager.hasAudio()) {
        // temp vector storage
        var offset = new pc.Vec3();

        // Fall off function which should be the same as the one in the Web Audio API
        // Taken from https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/distanceModel
        var fallOff = function (posOne, posTwo, refDistance, maxDistance, rollOffFactor, distanceModel) {
            offset = offset.sub2(posOne, posTwo);
            var distance = offset.length();

            if (distance < refDistance) {
                return 1;
            } else if (distance > maxDistance) {
                return 0;
            } else {
                var result = 0;
                if (distanceModel === pc.DISTANCE_LINEAR) {
                    result = 1 - rollOffFactor * (distance - refDistance) / (maxDistance - refDistance);
                } else if (distanceModel === pc.DISTANCE_INVERSE) {
                    result = refDistance / (refDistance + rollOffFactor * (distance - refDistance));
                } else if (distanceModel === pc.DISTANCE_EXPONENTIAL) {
                    result = Math.pow(distance / refDistance, -rollOffFactor);
                }

                return pc.math.clamp(result, 0, 1);
            }
        };

        SoundInstance3d = function (manager, sound, options) {
            options = options || {};

            this._position = new pc.Vec3();
            if (options.position)
                this.position = options.position;

            this._velocity = new pc.Vec3();
            if (options.velocity)
                this.velocity = options.velocity;

            this._maxDistance = options.maxDistance !== undefined ? Number(options.maxDistance) : MAX_DISTANCE;
            this._refDistance = options.refDistance !== undefined ? Number(options.refDistance) : 1;
            this._rollOffFactor = options.rollOffFactor !== undefined ? Number(options.rollOffFactor) : 1;
            this._distanceModel = options.distanceModel !== undefined ? options.distanceModel : pc.DISTANCE_INVERSE;

        };
        SoundInstance3d = pc.inherits(SoundInstance3d, pc.SoundInstance);

        Object.defineProperty(SoundInstance3d.prototype, 'position', {
            get: function () {
                return this._position;
            },
            set: function (position) {
                this._position.copy(position);

                if (this.source) {
                    var listener = this._manager.listener;

                    var lpos = listener.getPosition();

                    var factor = fallOff(lpos, this._position, this.refDistance, this.maxDistance, this.rollOffFactor, this.distanceModel);

                    var v = this.volume;
                    this.source.volume = v * factor;
                }
            }
        });

        Object.defineProperty(SoundInstance3d.prototype, 'velocity', {
            get: function () {
                return this._velocity;
            },
            set: function (velocity) {
                this._velocity.copy(velocity);
            }
        });

        Object.defineProperty(SoundInstance3d.prototype, 'maxDistance', {
            get: function () {
                return this._maxDistance;
            },
            set: function (value) {
                this._maxDistance = value;
            }
        });

        Object.defineProperty(SoundInstance3d.prototype, 'refDistance', {
            get: function () {
                return this._refDistance;
            },
            set: function (value) {
                this._refDistance = value;
            }
        });

        Object.defineProperty(SoundInstance3d.prototype, 'rollOffFactor', {
            get: function () {
                return this._rollOffFactor;
            },
            set: function (value) {
                this._rollOffFactor = value;
            }
        });

        Object.defineProperty(SoundInstance3d.prototype, 'distanceModel', {
            get: function () {
                return this._distanceModel;
            },
            set: function (value) {
                this._distanceModel = value;
            }
        });
    } else {
        console.warn('No support for 3D audio found');
        SoundInstance3d = function () {};
    }

    return {
        SoundInstance3d: SoundInstance3d
    };
}());
