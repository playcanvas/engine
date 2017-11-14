pc.extend(pc, function () {

    /**
    * @name pc.SpriteAnimationClip
    * @class Handles playing of sprite animations and loading of relevant sprite assets.
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
        this._meshes = [];
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

    SpriteAnimationClip.prototype = {
        _createMeshes: function () {
            var i;

            // destroy old meshe
            for (i = 0, len = this._meshes.length; i < len; i++) {
                this._meshes[i].vertexBuffer.destroy();
                this._meshes[i].indexBuffer.destroy();
            }

            // clear meshes array
            this._meshes.length = 0;

            // create normals (same for every mesh)
            var normals = [];
            for (i = 0; i < 12; i+=3) {
                normals[i] = 0;
                normals[i+1] = 0;
                normals[i+2] = 1;
            }

            // create indices (same for every mesh)
            var indices = [];
            indices[0] = 0;
            indices[1] = 1;
            indices[2] = 3;
            indices[3] = 2;
            indices[4] = 3;
            indices[5] = 1;

            var count = this._sprite.frameKeys.length;

            var flipX = this._component.flipX;
            var flipY = this._component.flipY;

            // create a mesh for each frame in the sprite
            for (i = 0; i < count; i++) {
                var frame = this._sprite.atlas.frames[this._sprite.frameKeys[i]];
                var rect = frame.rect;
                var w = this._sprite.atlas.texture.width * rect.data[2] / this._sprite.pixelsPerUnit;
                var h = this._sprite.atlas.texture.height * rect.data[3] / this._sprite.pixelsPerUnit;
                var hp = frame.pivot.x;
                var vp = frame.pivot.y;

                // positions based on pivot and size of frame
                var positions = [];
                positions[0] = -hp*w;
                positions[1] = -vp*h;
                positions[2] = 0;
                positions[3] = (1 - hp) * w;
                positions[4] = -vp*h;
                positions[5] = 0;
                positions[6] = (1 - hp) * w;
                positions[7] = (1 - vp) * h;
                positions[8] = 0;
                positions[9] = -hp*w;
                positions[10] = (1 - vp) * h;
                positions[11] = 0;

                // uvs based on frame rect
                var uvs = [];
                uvs[0] = flipX ? rect.data[0] + rect.data[2] : rect.data[0];
                uvs[1] = flipY ? rect.data[1] + rect.data[3] : rect.data[1];
                uvs[2] = flipX ? rect.data[0] : rect.data[0] + rect.data[2];
                uvs[3] = flipY ? rect.data[1] + rect.data[3] : rect.data[1];
                uvs[4] = flipX ? rect.data[0] : rect.data[0] + rect.data[2];
                uvs[5] = flipY ? rect.data[1] : rect.data[1] + rect.data[3];
                uvs[6] = flipX ? rect.data[0] + rect.data[2] : rect.data[0];
                uvs[7] = flipY ? rect.data[1] : rect.data[1] + rect.data[3];

                // create mesh and add it to our list
                var mesh = pc.createMesh(this._component.system.app.graphicsDevice, positions, {uvs: uvs, normals: normals, indices: indices});
                mesh.aabb.compute(positions);
                this._meshes.push(mesh);
            }
        },

        // reset uvs based on flipX / flipY values
        _flipMeshes: function () {
            if (! this._sprite || ! this._sprite.atlas) return;

            var flipX = this._component.flipX;
            var flipY = this._component.flipY;

            for (var i = 0, len = this._meshes.length; i < len; i++) {
                var frame = this._sprite.atlas.frames[this._sprite.frameKeys[i]];
                var rect = frame.rect.data;
                var mesh = this._meshes[i];
                var vb = mesh.vertexBuffer;

                var it = new pc.VertexIterator(vb);
                it.element[pc.SEMANTIC_TEXCOORD0].set(flipX ? rect[0] + rect[2] : rect[0], flipY ? rect[1] + rect[3] : rect[1]);
                it.next();
                it.element[pc.SEMANTIC_TEXCOORD0].set(flipX ? rect[0] : rect[0] + rect[2], flipY ? rect[1] + rect[3] : rect[1]);
                it.next();
                it.element[pc.SEMANTIC_TEXCOORD0].set(flipX ? rect[0] : rect[0] + rect[2], flipY ? rect[1] : rect[1] + rect[3]);
                it.next();
                it.element[pc.SEMANTIC_TEXCOORD0].set(flipX ? rect[0] + rect[2] : rect[0], flipY ? rect[1] : rect[1] + rect[3]);
                it.end();
            }
        },

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
            asset.on("change", this._onSpriteAssetChange, this);
            asset.on("remove", this._onSpriteAssetRemove, this);

            if (asset.resource) {
                this._onSpriteAssetLoad(asset);
            } else {
                this._component.system.app.assets.load(asset);
            }
        },

        // When sprite asset is loaded make sure the texture atlas asset is loaded too
        // If so then set the sprite, otherwise wait for the atlas to be loaded first
        _onSpriteAssetLoad: function (asset) {
            if (! asset.resource) {
                this.sprite = null;
            } else {
                if (! asset.resource.atlas) {
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

        // When the sprite asset changes reset it
        _onSpriteAssetChange: function (asset) {
            this._onSpriteAssetLoad(asset);
        },

        _onSpriteAssetRemove: function (asset) {
        },

        /**
        * @function
        * @private
        * @name pc.SpriteAnimationClip#_update
        * @param {Number} dt The delta time
        * @description Advances the animation looping if necessary
        */
        _update: function (dt) {
            if (this.fps === 0) return;
            if (!this._playing || this._paused) return;

            this._time += dt * this._component.speed;
            var duration = this.duration;
            var end = false;
            if (this._time > duration) {
                end = true;
                if (this.loop) {
                    this._time = this._time % duration;
                } else {
                    this._time = duration;
                }
            }

            var frame = this.frame;
            if (this._sprite) {
                frame = Math.floor(this._sprite.frameKeys.length * this._time / duration);
            } else {
                frame = 0;
            }

            if (frame !== this.frame)
                this.frame = frame;

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
            if (! this._playing || this._paused)
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
            if (! this._paused) return;

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
            if (! this._playing) return;

            this._playing = false;
            this._paused = false;
            this._time = 0;
            this.frame = 0;

            this.fire('stop');
            this._component.fire('stop', this);
        }
    };


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
                        prev.off("load", this._onSpriteAssetLoad, this);
                        prev.off("change", this._onSpriteAssetChange, this);
                        prev.off("remove", this._onSpriteAssetRemove, this);
                    }
                }

                this._spriteAsset = id;

                // bind sprite asset
                if (this._spriteAsset) {
                    var asset = assets.get(this._spriteAsset);
                    if (! asset) {
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
            this._sprite = value;

            if (value && value.atlas)
                this._createMeshes();

            if (this._component.currentClip === this) {
                // clear old mesh instance parameters if we are clearing the sprite
                if (!value || !value.atlas) {
                    var mi = this._meshInstance;
                    if (mi) {
                        mi.deleteParameter('texture_emissiveMap');
                        mi.deleteParameter('texture_opacityMap');
                    }
                }
                // show sprite
                else {
                    if (this.time) {
                        // if we have a time then force update
                        // frame based on the time
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
            if (this._sprite) {
                // clamp frame
                var frames = this._sprite.frameKeys.length;
                this._frame = pc.math.clamp(value, 0, frames);

                // update time to start of frame
                var fps = this.fps || Number.MIN_VALUE;
                this._time = pc.math.clamp(this._frame / fps, 0, this.duration);
            } else {
                this._frame = value;
                this._time = 0;
            }

            if (this._component.currentClip === this) {
                this._component._showFrame(value);
            }
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

    Object.defineProperty(SpriteAnimationClip.prototype, "duration" , {
        get: function () {
            if (this._sprite) {
                var fps = this.fps || Number.MIN_VALUE;
                return this._sprite.frameKeys.length / fps;
            } else {
                return 0;
            }
        }
    });

    Object.defineProperty(SpriteAnimationClip.prototype, "time", {
        get: function () {
            return this._time;
        },
        set: function (value) {
            this._time = value;
            var duration = this.duration;
            if (this._time < 0) {
                this._time = 0;
            } else if (this._time > duration) {
                if (this.loop) {
                    this._time = this._time % duration;
                } else {
                    this._time = duration;
                }
            }

            if (this._sprite) {
                this.frame = Math.floor(this._sprite.frameKeys.length * this._time / duration);
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
