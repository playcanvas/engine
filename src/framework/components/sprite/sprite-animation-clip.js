Object.assign(pc, function () {

    /**
     * @constructor
     * @name pc.SpriteAnimationClip
     * @classdesc Handles playing of sprite animations and loading of relevant sprite assets.
     * @param {pc.SpriteComponent} component The sprite component managing this clip.
     * @param {Object} data Data for the new animation clip.
     * @param {Number} [data.fps] Frames per second for the animation clip.
     * @param {Object} [data.loop] Whether to loop the animation clip.
     * @param {String} [data.name] The name of the new animation clip.
     * @param {Number} [data.spriteAsset] The id of the sprite asset that this clip will play.
     * @property {Number} spriteAsset The id of the sprite asset used to play the animation.
     * @property {pc.Sprite} sprite The current sprite used to play the animation.
     * @property {Number} frame The index of the frame of the {@link pc.Sprite} currently being rendered.
     * @property {Number} time The current time of the animation in seconds.
     * @property {Number} duration The total duration of the animation in seconds.
     * @property {Boolean} isPlaying Whether the animation is currently playing.
     * @property {Boolean} isPaused Whether the animation is currently paused.
     */
    var SpriteAnimationClip = function (component, data) {
        this._component = component;

        this._frame = 0;
        this._sprite = null;
        this._spriteAsset = null;
        this.spriteAsset = data.spriteAsset;

        this.name = data.name;
        this.fps = data.fps || 0;
        this.loop = data.loop || false;

        this._playing = false;
        this._paused = false;

        this._time = 0;

        pc.events.attach(this);
    };

    Object.assign(SpriteAnimationClip.prototype, {
        // When sprite asset is added bind it
        _onSpriteAssetAdded: function (asset) {
            this._component.system.app.assets.off('add:' + asset.id, this._onSpriteAssetAdded, this);
            if (this._spriteAsset === asset.id) {
                this._bindSpriteAsset(asset);
            }
        },

        // Hook up event handlers on sprite asset
        _bindSpriteAsset: function (asset) {
            asset.on("load", this._onSpriteAssetLoad, this);
            asset.on("remove", this._onSpriteAssetRemove, this);

            if (asset.resource) {
                this._onSpriteAssetLoad(asset);
            } else {
                this._component.system.app.assets.load(asset);
            }
        },

        _unbindSpriteAsset: function (asset) {
            asset.off("load", this._onSpriteAssetLoad, this);
            asset.off("remove", this._onSpriteAssetRemove, this);

            // unbind atlas
            if (asset.resource && asset.resource.atlas) {
                this._component.system.app.assets.off('load:' + asset.data.textureAtlasAsset, this._onTextureAtlasLoad, this);
            }
        },

        // When sprite asset is loaded make sure the texture atlas asset is loaded too
        // If so then set the sprite, otherwise wait for the atlas to be loaded first
        _onSpriteAssetLoad: function (asset) {
            if (!asset.resource) {
                this.sprite = null;
            } else {
                if (!asset.resource.atlas) {
                    var atlasAssetId = asset.data.textureAtlasAsset;
                    var assets = this._component.system.app.assets;
                    assets.off('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
                    assets.once('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
                } else {
                    this.sprite = asset.resource;
                }
            }
        },

        // When atlas is loaded try to reset the sprite asset
        _onTextureAtlasLoad: function (atlasAsset) {
            var spriteAsset = this._spriteAsset;
            if (spriteAsset instanceof pc.Asset) {
                this._onSpriteAssetLoad(spriteAsset);
            } else {
                this._onSpriteAssetLoad(this._component.system.app.assets.get(spriteAsset));
            }
        },

        _onSpriteAssetRemove: function (asset) {
            this.sprite = null;
        },

        // If the meshes are re-created make sure
        // we update them in the mesh instance
        _onSpriteMeshesChange: function () {
            if (this._component.currentClip === this) {
                this._component._showFrame(this.frame);
            }
        },

        // Update frame if ppu changes for 9-sliced sprites
        _onSpritePpuChanged: function () {
            if (this._component.currentClip === this) {
                if (this.sprite.renderMode !== pc.SPRITE_RENDERMODE_SIMPLE) {
                    this._component._showFrame(this.frame);
                }
            }
        },

        /**
         * @private
         * @function
         * @name pc.SpriteAnimationClip#_update
         * @param {Number} dt The delta time
         * @description Advances the animation looping if necessary
         */
        _update: function (dt) {
            if (this.fps === 0) return;
            if (!this._playing || this._paused || !this._sprite) return;

            var dir = this.fps < 0 ? -1 : 1;
            var time = this._time + dt * this._component.speed * dir;
            var duration = this.duration;
            var end = (time > duration || time < 0);

            this._setTime(time);

            var frame = this.frame;
            if (this._sprite) {
                frame = Math.floor(this._sprite.frameKeys.length * this._time / duration);
            } else {
                frame = 0;
            }

            if (frame !== this._frame) {
                this._setFrame(frame);
            }

            if (end) {
                if (this.loop) {
                    this.fire('loop');
                    this._component.fire('loop', this);
                } else {
                    this._playing = false;
                    this._paused = false;
                    this.fire('end');
                    this._component.fire('end', this);
                }
            }
        },

        _setTime: function (value) {
            this._time = value;
            var duration = this.duration;
            if (this._time < 0) {
                if (this.loop) {
                    this._time = this._time % duration + duration;
                } else {
                    this._time = 0;
                }
            } else if (this._time > duration) {
                if (this.loop) {
                    this._time = this._time % duration;
                } else {
                    this._time = duration;
                }
            }
        },

        _setFrame: function (value) {
            if (this._sprite) {
                // clamp frame
                this._frame = pc.math.clamp(value, 0, this._sprite.frameKeys.length - 1);
            } else {
                this._frame = value;
            }

            if (this._component.currentClip === this) {
                this._component._showFrame(this._frame);
            }
        },

        _destroy: function () {
            // remove sprite
            if (this._sprite) {
                this.sprite = null;
            }

            // remove sprite asset
            if (this._spriteAsset) {
                this.spriteAsset = null;
            }
        },

        /**
         * @function
         * @name pc.SpriteAnimationClip#play
         * @description Plays the animation. If it's already playing then this does nothing.
         */
        play: function () {
            if (this._playing)
                return;

            this._playing = true;
            this._paused = false;
            this.frame = 0;

            this.fire('play');
            this._component.fire('play', this);
        },

        /**
         * @function
         * @name pc.SpriteAnimationClip#pause
         * @description Pauses the animation.
         */
        pause: function () {
            if (!this._playing || this._paused)
                return;

            this._paused = true;

            this.fire('pause');
            this._component.fire('pause', this);
        },

        /**
         * @function
         * @name pc.SpriteAnimationClip#resume
         * @description Resumes the paused animation.
         */
        resume: function () {
            if (!this._paused) return;

            this._paused = false;
            this.fire('resume');
            this._component.fire('resume', this);
        },

        /**
         * @function
         * @name pc.SpriteAnimationClip#stop
         * @description Stops the animation and resets the animation to the first frame.
         */
        stop: function () {
            if (!this._playing) return;

            this._playing = false;
            this._paused = false;
            this._time = 0;
            this.frame = 0;

            this.fire('stop');
            this._component.fire('stop', this);
        }
    });

    Object.defineProperty(SpriteAnimationClip.prototype, "spriteAsset", {
        get: function () {
            return this._spriteAsset;
        },
        set: function (value) {
            var assets = this._component.system.app.assets;
            var id = value;

            if (value instanceof pc.Asset) {
                id = value.id;
            }

            if (this._spriteAsset !== id) {
                if (this._spriteAsset) {
                    // clean old event listeners
                    var prev = assets.get(this._spriteAsset);
                    if (prev) {
                        this._unbindSpriteAsset(prev);
                    }
                }

                this._spriteAsset = id;

                // bind sprite asset
                if (this._spriteAsset) {
                    var asset = assets.get(this._spriteAsset);
                    if (!asset) {
                        this.sprite = null;
                        assets.on('add:' + this._spriteAsset, this._onSpriteAssetAdded, this);
                    } else {
                        this._bindSpriteAsset(asset);
                    }
                } else {
                    this.sprite = null;
                }
            }
        }
    });

    Object.defineProperty(SpriteAnimationClip.prototype, "sprite", {
        get: function () {
            return this._sprite;
        },
        set: function (value) {
            if (this._sprite) {
                this._sprite.off('set:meshes', this._onSpriteMeshesChange, this);
                this._sprite.off('set:pixelsPerUnit', this._onSpritePpuChanged, this);
                this._sprite.off('set:atlas', this._onSpriteMeshesChange, this);
                if (this._sprite.atlas) {
                    this._sprite.atlas.off('set:texture', this._onSpriteMeshesChange, this);
                }
            }

            this._sprite = value;

            if (this._sprite) {
                this._sprite.on('set:meshes', this._onSpriteMeshesChange, this);
                this._sprite.on('set:pixelsPerUnit', this._onSpritePpuChanged, this);
                this._sprite.on('set:atlas', this._onSpriteMeshesChange, this);

                if (this._sprite.atlas) {
                    this._sprite.atlas.on('set:texture', this._onSpriteMeshesChange, this);
                }
            }

            if (this._component.currentClip === this) {
                var mi;

                // if we are clearing the sprite clear old mesh instance parameters
                if (!value || !value.atlas) {
                    mi = this._component._meshInstance;
                    if (mi) {
                        mi.deleteParameter('texture_emissiveMap');
                        mi.deleteParameter('texture_opacityMap');
                    }

                    this._component._hideModel();
                } else {
                    // otherwise show sprite

                    // update texture
                    if (value.atlas.texture) {
                        mi = this._component._meshInstance;
                        if (mi) {
                            mi.setParameter('texture_emissiveMap', value.atlas.texture);
                            mi.setParameter('texture_opacityMap', value.atlas.texture);
                        }

                        if (this._component.enabled && this._component.entity.enabled) {
                            this._component._showModel();
                        }
                    }

                    // if we have a time then force update
                    // frame based on the time (check if fps is not 0 otherwise time will be Infinity)
                    if (this.time && this.fps) {
                        this.time = this.time;
                    } else {
                        // if we don't have a time
                        // then force update frame counter
                        this.frame = this.frame;
                    }
                }
            }
        }
    });

    Object.defineProperty(SpriteAnimationClip.prototype, "frame", {
        get: function () {
            return this._frame;
        },

        set: function (value) {
            this._setFrame(value);

            // update time to start of frame
            var fps = this.fps || Number.MIN_VALUE;
            this._setTime(this._frame / fps);
        }
    });

    Object.defineProperty(SpriteAnimationClip.prototype, "isPlaying", {
        get: function () {
            return this._playing;
        }
    });

    Object.defineProperty(SpriteAnimationClip.prototype, "isPaused", {
        get: function () {
            return this._paused;
        }
    });

    Object.defineProperty(SpriteAnimationClip.prototype, "duration", {
        get: function () {
            if (this._sprite) {
                var fps = this.fps || Number.MIN_VALUE;
                return this._sprite.frameKeys.length / Math.abs(fps);
            }
            return 0;
        }
    });

    Object.defineProperty(SpriteAnimationClip.prototype, "time", {
        get: function () {
            return this._time;
        },
        set: function (value) {
            this._setTime(value);

            if (this._sprite) {
                this.frame = Math.min(this._sprite.frameKeys.length - 1, Math.floor(this._time * Math.abs(this.fps)));
            } else {
                this.frame = 0;
            }
        }
    });

    return {
        SpriteAnimationClip: SpriteAnimationClip
    };
}());


// Events Documentation

/**
 * @event
 * @name pc.SpriteAnimationClip#play
 * @description Fired when the clip starts playing
 */

/**
 * @event
 * @name pc.SpriteAnimationClip#pause
 * @description Fired when the clip is paused.
 */

/**
 * @event
 * @name pc.SpriteAnimationClip#resume
 * @description Fired when the clip is resumed.
 */

/**
 * @event
 * @name pc.SpriteAnimationClip#stop
 * @description Fired when the clip is stopped.
 */

/**
 * @event
 * @name pc.SpriteAnimationClip#end
 * @description Fired when the clip stops playing because it reached its ending.
 */

/**
 * @event
 * @name pc.SpriteAnimationClip#loop
 * @description Fired when the clip reached the end of its current loop.
 */
