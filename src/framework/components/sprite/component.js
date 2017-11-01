pc.extend(pc, function () {
    'use strict';

    /**
     * @enum pc.SPRITETYPE
     * @name pc.SPRITETYPE_SIMPLE
     * @description A {@link pc.SpriteComponent} that displays a single frame from a sprite asset.
     */
    pc.SPRITETYPE_SIMPLE = 'simple';


    /**
     * @enum pc.SPRITETYPE
     * @name pc.SPRITETYPE_ANIMATED
     * @description A {@link pc.SpriteComponent} that renders sprite animations.
     */
    pc.SPRITETYPE_ANIMATED = 'animated';

    /**
     * @component
     * @name pc.SpriteComponent
     * @extends pc.Component
     * @class Enables an Entity to render a simple static sprite or a sprite animations.
     * @param {pc.SpriteComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @property {String} type The type of the SpriteComponent. Can be one of the following:
     * <ul>
     *     <li>pc.SPRITETYPE_SIMPLE: The component renders a single frame from a sprite asset.
     *     <li>pc.SPRITETYPE_ANIMATED: The component can play sprite animation clips.
     * </ul>
     * @property {Number} frame The frame counter of the sprite. Specifies which frame from the current sprite asset to render.
     * @property {Number} spriteAsset The id of the sprite asset to render. Only works for {@link pc.SPRITETYPE_SIMPLE} types.
     * @property {pc.Sprite} sprite The current sprite.
     * @property {pc.Sprite} sprite The current sprite.
     * @property {pc.Color} color The color tint of the sprite.
     * @property {Number} opacity The opacity of the sprite.
     * @property {pc.Material} material The material used to render a sprite.
     * @property {Boolean} flipX Flip the X axis when rendering a sprite.
     * @property {Boolean} flipY Flip the Y axis when rendering a sprite.
     * @property {Object} clips A dictionary that contains {@link pc.SpriteAnimationClip}s.
     * @property {pc.SpriteAnimationClip} currentClip The current clip being played.
     * @property {Number} speed A global speed modifier used when playing sprite animation clips.
     */
    var SpriteComponent = function SpriteComponent (system, entity) {
        this._type = pc.SPRITETYPE_SIMPLE;
        this._material = system.defaultMaterial;
        this._color = new pc.Color(1,1,1,1);
        this._speed = 1;
        this._flipX = false;
        this._flipY = false;

        this._meshes = [];
        this._node = new pc.GraphNode();
        this._model = new pc.Model();
        this._model.graph = this._node;

        entity.addChild(this._model.graph);
        this._model._entity = entity;

        this._clips = {};

        // create default clip for simple sprite type
        this._defaultClip = new pc.SpriteAnimationClip(this, {
            name: this.entity.name,
            fps: 0,
            loop: false,
            spriteAsset: null
        });

        this._currentClip = this._defaultClip;
    };
    SpriteComponent = pc.inherits(SpriteComponent, pc.Component);

    pc.extend(SpriteComponent.prototype, {
        onEnable: function () {
            SpriteComponent._super.onEnable.call(this);

            // add the model to the scene
            // NOTE: only do this if the mesh instance has been created otherwise
            // the model will not be rendered when added to the scene
            if (this._model && this._meshInstance && !this.system.app.scene.containsModel(this._model)) {
                this.system.app.scene.addModel(this._model);
            }
        },

        onDisable: function () {
            SpriteComponent._super.onDisable.call(this);

            // remove model from scene
            if (this._model) {
                this.system.app.scene.removeModel(this._model);
            }
        },

        // Set the desired mesh on the mesh instance
        _showFrame: function (frame) {
            if (! this._currentClip) return;

            var mesh = this._currentClip._meshes[frame];
            if (! mesh) return;

            // create mesh instance if it doesn't exist yet
            if (! this._meshInstance) {
                this._meshInstance = new pc.MeshInstance(this._node, mesh, this._material);
                this._meshInstance.castShadow = false;
                this._meshInstance.receiveShadow = false;
                this._model.meshInstances.push(this._meshInstance);

                // set overrides on mesh instance
                this._meshInstance.setParameter('material_emissive', this._color.data3);
                this._meshInstance.setParameter('material_opacity', this._color.data[3]);

                if (this.sprite.atlas.texture) {
                    this._meshInstance.setParameter('texture_emissiveMap', this.sprite.atlas.texture);
                    this._meshInstance.setParameter('texture_opacityMap', this.sprite.atlas.texture);
                }

                // now that we created the mesh instance, add the model to the scene
                if (this.enabled && this.entity.enabled && !this.system.app.scene.containsModel(this._model)) {
                    this.system.app.scene.addModel(this._model);
                }
            }

            if (this._meshInstance.mesh !== mesh)
                this._meshInstance.mesh = mesh;
        },

        _flipMeshes: function () {
            this._defaultClip._flipMeshes();
            for (var key in this._clips) {
                this._clips[key]._flipMeshes();
            }
        },

        /**
        * @function
        * @name pc.SpriteComponent#addClip
        * @description Creates and adds a new {@link pc.SpriteAnimationClip} to the component's clips.
        * @param {String} name The name of the new animation clip.
        * @param {Object} options Options for the new animation clip.
        * @param {Number} [options.fps] Frames per second for the animation clip.
        * @param {Object} [options.loop] Whether to loop the animation clip.
        * @param {Number} [options.spriteAsset] The id of the sprite asset that this clip will play.
        * @returns {pc.SpriteAnimationClip} The new clip that was added.
        */
        addClip: function (name, options) {
            var clip = new pc.SpriteAnimationClip(this, {
                name: name,
                fps: options.fps,
                loop: options.loop,
                spriteAsset: options.spriteAsset
            });

            this._clips[name] = clip;

            return clip;
        },

        /**
        * @function
        * @name pc.SpriteComponent#removeClip
        * @description Removes a clip by name.
        * @param {String} name The name of the animation clip to remove.
        */
        removeClip: function (name) {
            delete this._clips[name];
        },

        /**
        * @function
        * @name pc.SpriteComponent#clip
        * @description Get an animation clip by name.
        * @returns {pc.SpriteAnimationClip} The clip.
        */
        clip: function (name) {
            return this._clips[name];
        },

        /**
        * @function
        * @name pc.SpriteComponent#play
        * @description Plays a sprite animation clip by name. If the animation clip is already playing then this will do nothing.
        * @param {String} name The name of the clip to play.
        * @returns {pc.SpriteAnimationClip} The clip that started playing.
        */
        play: function (name) {
            var clip = this._clips[name];

            var current = this._currentClip;
            if (current && current !== clip) {
                current._playing = false;
            }

            this._currentClip = clip;

            if (this._currentClip) {
                this._currentClip = clip;
                this._currentClip.play();
            } else {
                logWARNING('Trying to play sprite animation ' + name + ' which does not exist.');
            }

            return clip;
        },

        /**
        * @function
        * @name pc.SpriteComponent#pause
        * @description Pauses the current animation clip.
        */
        pause: function () {
            if (this._currentClip.isPlaying) {
                this._currentClip.pause();
            }
        },

        /**
        * @function
        * @name pc.SpriteComponent#resume
        * @description Resumes the current paused animation clip.
        */
        resume: function () {
            if (this._currentClip.isPaused) {
                this._currentClip.resume();
            }
        },

        /**
        * @function
        * @name Stops the current animation clip and resets it to the first frame.
        */
        stop: function () {
            this._currentClip.stop();
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "type", {
        get: function () {
            return this._type;
        },

        set: function (value) {
            if (this._type === value)
                return;

            this._type = value;
            if (this._type === pc.SPRITETYPE_SIMPLE) {
                this.stop();
                this._currentClip = this._defaultClip;
                this._currentClip.play();
            } else if (this._type === pc.SPRITETYPE_ANIMATED) {
                this.stop();
                // play first clip
                for (var key in this._clips) {
                    this.play(key);
                    break;
                }
            }
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "frame", {
        get: function () {
            return this._currentClip.frame;
        },

        set: function (value) {
            this._currentClip.frame = value;
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "spriteAsset", {
        get: function () {
            return this._defaultClip._spriteAsset;
        },
        set: function (value) {
            this._defaultClip.spriteAsset = value;
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "sprite", {
        get: function () {
            return this._currentClip.sprite;
        },
        set: function (value) {
            this._currentClip.sprite = value;
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "material", {
        get: function () {
            return this._material;
        },
        set: function (value) {
            this._material = value;
            if (this._meshInstance) {
                this._meshInstance.material = value;
            }
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "color", {
        get: function () {
            return this._color;
        },
        set: function (value) {
            this._color.data[0] = value.data[0];
            this._color.data[1] = value.data[1];
            this._color.data[2] = value.data[2];

            if (this._meshInstance) {
                this._meshInstance.setParameter('material_emissive', this._color.data3);
            }
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "opacity", {
        get: function () {
            return this._color.data[3];
        },
        set: function (value) {
            this._color.data[3] = value;
            if (this._meshInstance) {
                this._meshInstance.setParameter('material_opacity', value);
            }
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "clips", {
        get: function () {
            return this._clips;
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "currentClip", {
        get: function () {
            return this._currentClip;
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "speed", {
        get: function () {
            return this._speed;
        },
        set: function (value) {
            this._speed = value;
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "flipX", {
        get: function () {
            return this._flipX;
        },
        set: function (value) {
            if (this._flipX !== value) {
                this._flipX = value;
                this._flipMeshes();
            }
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "flipY", {
        get: function () {
            return this._flipY;
        },
        set: function (value) {
            if (this._flipY !== value) {
                this._flipY = value;
                this._flipMeshes();
            }
        }
    });

    return {
        SpriteComponent: SpriteComponent
    };
}());


// Events Documentation

/**
* @event
* @name pc.SpriteComponent#play
* @description Fired when an animation clip starts playing
* @param {pc.SpriteAnimationClip} clip The clip that started playing
*/

/**
* @event
* @name pc.SpriteComponent#pause
* @description Fired when an animation clip is paused.
* @param {pc.SpriteAnimationClip} clip The clip that was paused
*/

/**
* @event
* @name pc.SpriteComponent#resume
* @description Fired when an animation clip is resumed.
* @param {pc.SpriteAnimationClip} clip The clip that was resumed
*/

/**
* @event
* @name pc.SpriteComponent#stop
* @description Fired when an animation clip is stopped.
* @param {pc.SpriteAnimationClip} clip The clip that was stopped
*/

/**
* @event
* @name pc.SpriteComponent#end
* @description Fired when an animation clip stops playing because it reached its ending.
* @param {pc.SpriteAnimationClip} clip The clip that ended
*/

/**
* @event
* @name pc.SpriteComponent#loop
* @description Fired when an animation clip reached the end of its current loop.
* @param {pc.SpriteAnimationClip} clip The clip
*/
