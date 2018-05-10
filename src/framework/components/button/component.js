pc.extend(pc, function () {
    var VisualState = {
        DEFAULT: 'DEFAULT',
        HOVER: 'HOVER',
        PRESSED: 'PRESSED',
        INACTIVE: 'INACTIVE'
    };

    var STATES_TO_TINT_NAMES = {};
    STATES_TO_TINT_NAMES[VisualState.DEFAULT] = '_defaultTint';
    STATES_TO_TINT_NAMES[VisualState.HOVER] = 'hoverTint';
    STATES_TO_TINT_NAMES[VisualState.PRESSED] = 'pressedTint';
    STATES_TO_TINT_NAMES[VisualState.INACTIVE] = 'inactiveTint';

    var STATES_TO_SPRITE_ASSET_NAMES = {};
    STATES_TO_SPRITE_ASSET_NAMES[VisualState.DEFAULT] = '_defaultSpriteAsset';
    STATES_TO_SPRITE_ASSET_NAMES[VisualState.HOVER] = 'hoverSpriteAsset';
    STATES_TO_SPRITE_ASSET_NAMES[VisualState.PRESSED] = 'pressedSpriteAsset';
    STATES_TO_SPRITE_ASSET_NAMES[VisualState.INACTIVE] = 'inactiveSpriteAsset';

    var STATES_TO_SPRITE_FRAME_NAMES = {};
    STATES_TO_SPRITE_FRAME_NAMES[VisualState.DEFAULT] = '_defaultSpriteFrame';
    STATES_TO_SPRITE_FRAME_NAMES[VisualState.HOVER] = 'hoverSpriteFrame';
    STATES_TO_SPRITE_FRAME_NAMES[VisualState.PRESSED] = 'pressedSpriteFrame';
    STATES_TO_SPRITE_FRAME_NAMES[VisualState.INACTIVE] = 'inactiveSpriteFrame';

    /**
     * @component
     * @name pc.ButtonComponent
     * @description Create a new ButtonComponent
     * @classdesc A ButtonComponent enables a group of entities to behave like a button, with different visual states for hover and press interactions.
     * @param {pc.ButtonComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {Boolean} active If set to false, the button will be visible but will not respond to hover or touch interactions.
     * @property {pc.Entity} imageEntity A reference to the entity to be used as the button background. The entity must have an ImageElement component.'
     * @property {pc.Vec4} hitPadding Padding to be used in hit-test calculations. Can be used to expand the bounding box so that the button is easier to tap.
     * @property {pc.BUTTON_TRANSITION_MODE} transitionMode Controls how the button responds when the user hovers over it/presses it.
     * @property {pc.Vec4} hoverTint Color to be used on the button image when the user hovers over it.
     * @property {pc.Vec4} pressedTint Color to be used on the button image when the user presses it.
     * @property {pc.Vec4} inactiveTint Color to be used on the button image when the button is not interactive.
     * @property {Number} fadeDuration Duration to be used when fading between tints, in milliseconds.
     * @property {pc.Asset} hoverSpriteAsset Sprite to be used as the button image when the user hovers over it.
     * @property {Number} hoverSpriteFrame Frame to be used from the hover sprite.
     * @property {pc.Asset} pressedSpriteAsset Sprite to be used as the button image when the user presses it.
     * @property {Number} pressedSpriteFrame Frame to be used from the pressed sprite.
     * @property {pc.Asset} inactiveSpriteAsset Sprite to be used as the button image when the button is not interactive.
     * @property {Number} inactiveSpriteFrame Frame to be used from the inactive sprite.
     */
    var ButtonComponent = function ButtonComponent(system, entity) {
        this._visualState = VisualState.DEFAULT;
        this._isHovering = false;
        this._isPressed = false;
        this._imageEntity = null;

        this._defaultTint = new pc.Color(1, 1, 1, 1);
        this._defaultSpriteAsset = null;
        this._defaultSpriteFrame = 0;

        this._toggleLifecycleListeners('on', system);
    };
    ButtonComponent = pc.inherits(ButtonComponent, pc.Component);

    pc.extend(ButtonComponent.prototype, {
        _toggleLifecycleListeners: function(onOrOff, system) {
            this.on('set_active', this._onSetActive, this);
            this.on('set_transitionMode', this._onSetTransitionMode, this);
            this.on('set_hoverTint', this._onSetTransitionValue, this);
            this.on('set_pressedTint', this._onSetTransitionValue, this);
            this.on('set_inactiveTint', this._onSetTransitionValue, this);
            this.on('set_hoverSpriteAsset', this._onSetTransitionValue, this);
            this.on('set_hoverSpriteFrame', this._onSetTransitionValue, this);
            this.on('set_pressedSpriteAsset', this._onSetTransitionValue, this);
            this.on('set_pressedSpriteFrame', this._onSetTransitionValue, this);
            this.on('set_inactiveSpriteAsset', this._onSetTransitionValue, this);
            this.on('set_inactiveSpriteFrame', this._onSetTransitionValue, this);
            this.on('set_imageEntity', this._onSetImageEntity, this);

            pc.ComponentSystem.on('postInitialize', this._onPostInitialize, this);

            system.app.systems.element.on('add', this._onElementComponentAdd, this);
            system.app.systems.element.on('beforeremove', this._onElementComponentRemove, this);
        },

        _onSetActive: function(name, oldValue, newValue) {
            if (oldValue !== newValue) {
                console.log('_onSetActive');
                this._updateVisualState();
            }
        },

        _onSetTransitionMode: function(name, oldValue, newValue) {
            if (oldValue !== newValue) {
                console.log('_onSetTransitionMode');
                this._resetToDefaultVisualState(oldValue);
                this._forceReapplyVisualState();
            }
        },

        _onSetTransitionValue: function(name, oldValue, newValue) {
            if (oldValue !== newValue) {
                console.log('_onSetTransitionValue', name, newValue && newValue.data);
                this._forceReapplyVisualState();
            }
        },

        _onSetImageEntity: function(name, oldGuid, newGuid) {
            if (oldGuid !== newGuid) {
                this._updateImageEntityReference();
            }
        },

        _onPostInitialize: function() {
            this._updateImageEntityReference();
        },

        // The public imageEntity property stores the entity guid (and this is what is
        // persisted in the database), but internally we need a reference to the actual
        // entity so that we can add listeners to it, modify its tint/sprite when the
        // user interacts with it, etc. This method is called whenever the guid changes
        // in order to resolve the guid to an actual entity reference.
        _updateImageEntityReference: function() {
            var imageGuid = this.data.imageEntity;
            var hasChanged = !this._imageEntity || this._imageEntity.getGuid() !== imageGuid;

            if (imageGuid && hasChanged) {
                console.log('_updateImageEntityReference');

                this._onBeforeImageEntityChange();
                this._imageEntity = this.system.app.root.findByGuid(imageGuid);
                this._onAfterImageEntityChange();
            }
        },

        _onImageEntityDestroy: function(entity) {
            if (this._imageEntity === entity) {
                console.log('_onImageEntityDestroy');
                this._onBeforeImageEntityChange();
                this._imageEntity = null;
            }
        },

        _onElementComponentRemove: function(entity) {
            if (this._imageEntity === entity) {
                console.log('_onElementComponentRemove');
                this._onBeforeImageEntityChange();
            }
        },

        _onElementComponentAdd: function(entity) {
            if (this._imageEntity === entity) {
                console.log('_onElementComponentAdd');
                this._onAfterImageEntityChange();
            }
        },

        _onBeforeImageEntityChange: function() {
            this._toggleImageListeners('off');
            this._resetToDefaultVisualState(this.transitionMode);
        },

        _onAfterImageEntityChange: function() {
            this._toggleImageListeners('on');
            this._storeDefaultVisualState();
            this._forceReapplyVisualState();
        },

        _toggleImageListeners: function(onOrOff) {
            if (this._imageEntity && this._imageEntity.element) {
                console.log('_toggleImageListeners YES', onOrOff);

                var isAdding = (onOrOff === 'on');

                if (isAdding && this._hasImageListeners) {
                    // TODO Remove or convert to console.warn()
                    throw new Error('Attempted to add multiple image listeners - this should not happen');
                    return;
                }

                this._imageEntity[onOrOff]('destroy', this._onImageEntityDestroy, this);

                this._imageEntity.element[onOrOff]('set:color', this._onSetColor, this);
                this._imageEntity.element[onOrOff]('set:opacity', this._onSetOpacity, this);
                this._imageEntity.element[onOrOff]('set:spriteAsset', this._onSetSpriteAsset, this);
                this._imageEntity.element[onOrOff]('set:spriteFrame', this._onSetSpriteFrame, this);
                this._imageEntity.element[onOrOff]('mouseenter', this._onMouseEnter, this);
                this._imageEntity.element[onOrOff]('mouseleave', this._onMouseLeave, this);
                this._imageEntity.element[onOrOff]('mousedown', this._onMouseDown, this);
                this._imageEntity.element[onOrOff]('mouseup', this._onMouseUp, this);
                // TODO Test touch events on phone
                this._imageEntity.element[onOrOff]('touchstart', this._onTouchStart, this);
                this._imageEntity.element[onOrOff]('touchend', this._onTouchEnd, this);
                this._imageEntity.element[onOrOff]('touchcancel', this._onTouchCancel, this);
                this._imageEntity.element[onOrOff]('click', this._onClick, this);

                this._hasImageListeners = isAdding;
            } else {
                console.log('_toggleImageListeners NO', onOrOff, this._imageEntity, this._imageEntity && this._imageEntity.element);
            }
        },

        _storeDefaultVisualState: function() {
            if (this._imageEntity && this._imageEntity.element) {
                this._onSetColor(this._imageEntity.element.color);
                this._onSetOpacity(this._imageEntity.element.opacity);
                this._onSetSpriteAsset(this._imageEntity.element.spriteAsset);
                this._onSetSpriteFrame(this._imageEntity.element.spriteFrame);
            }
        },

        _onSetColor: function(color) {
            if (!this._isApplyingTint) {
                console.log('_onSetColor', color.data);
                this._defaultTint.r = color.r;
                this._defaultTint.g = color.g;
                this._defaultTint.b = color.b;
                this._forceReapplyVisualState();
            }
        },

        _onSetOpacity: function(opacity) {
            if (!this._isApplyingTint) {
                console.log('_onSetOpacity', opacity);
                this._defaultTint.a = opacity;
                this._forceReapplyVisualState();
            }
        },

        _onSetSpriteAsset: function(spriteAsset) {
            if (!this._isApplyingSprite) {
                console.log('_onSetSpriteAsset', spriteAsset);
                this._defaultSpriteAsset = spriteAsset;
                this._forceReapplyVisualState();
            }
        },

        _onSetSpriteFrame: function(spriteFrame) {
            if (!this._isApplyingSprite) {
                console.log('_onSetSpriteFrame', spriteFrame);
                this._defaultSpriteFrame = spriteFrame;
                this._forceReapplyVisualState();
            }
        },

        _onMouseEnter: function(event) {
            this._isHovering = true;

            this._updateVisualState();
            this.fire('mouseenter', event);
        },

        _onMouseLeave: function(event) {
            this._isHovering = false;
            this._isPressed = false;

            this._updateVisualState();
            this.fire('mouseleave', event);
        },

        _onMouseDown: function(event) {
            this._isPressed = true;

            this._updateVisualState();
            this.fire('mousedown', event);
        },

        _onMouseUp: function(event) {
            this._isPressed = false;

            this._updateVisualState();
            this.fire('mouseup', event);
        },

        _onTouchStart: function(event) {
            this._isPressed = true;

            this._updateVisualState();
            this.fire('touchstart', event);
        },

        _onTouchEnd: function(event) {
            this._isPressed = false;

            this._updateVisualState();
            this.fire('touchend', event);
        },

        _onTouchCancel: function(event) {
            this._isPressed = false;

            this._updateVisualState();
            this.fire('touchcancel', event);
        },

        _onClick: function(event) {
            this.fire('click', event);
        },

        _updateVisualState: function(force) {
            var oldVisualState = this._visualState;
            var newVisualState = this._determineVisualState();

            if ((oldVisualState !== newVisualState || force) && this.enabled) {
                this._visualState = newVisualState;

                console.log('_updateVisualState', oldVisualState, '->', newVisualState);

                switch (this.transitionMode) {
                    case pc.BUTTON_TRANSITION_MODE_TINT:
                        var tintName = STATES_TO_TINT_NAMES[this._visualState];
                        var tintColor = this[tintName];
                        this._applyTint(tintColor, false);
                        break;

                    case pc.BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
                        var spriteAssetName = STATES_TO_SPRITE_ASSET_NAMES[this._visualState];
                        var spriteFrameName = STATES_TO_SPRITE_FRAME_NAMES[this._visualState];
                        var spriteAsset = this[spriteAssetName];
                        var spriteFrame = this[spriteFrameName];
                        console.log('_updateVisualState spriteAssetName:', spriteAssetName);
                        console.log('_updateVisualState spriteFrameName:', spriteFrameName);
                        this._applySprite(spriteAsset, spriteFrame);
                        break;
                }
            }
        },

        // Called when a property changes that mean the visual state must be reapplied,
        // even if the state enum has not changed. Examples of this are when the tint
        // value for one of the states is changed via the editor.
        _forceReapplyVisualState: function() {
            if (this._visualState !== VisualState.DEFAULT) {
                this._updateVisualState(true);
            }
        },

        // Called before the image entity changes, in order to restore the previous
        // image back to its original tint. Note that this happens immediately, i.e.
        // without any animation.
        _resetToDefaultVisualState: function(transitionMode) {
            if (this._imageEntity && this._imageEntity.element) {
                switch (transitionMode) {
                    case pc.BUTTON_TRANSITION_MODE_TINT:
                        this._applyTint(this._defaultTint, true);
                        break;

                    case pc.BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
                        this._applySprite(this._defaultSpriteAsset, this._defaultSpriteFrame);
                        break;
                }
            }
        },

        _determineVisualState: function() {
            if (!this.active) {
                return VisualState.INACTIVE;
            } else if (this._isPressed) {
                return VisualState.PRESSED;
            } else if (this._isHovering) {
                return VisualState.HOVER;
            }

            return VisualState.DEFAULT;
        },

        _applyTint: function(tintColor, applyImmediately) {
            if (this._imageEntity && this._imageEntity.element && tintColor) {
                console.log('_applyTint', tintColor.data);

                if (applyImmediately) {
                    this._isApplyingTint = true;
                    this._imageEntity.element.color = toColor3(tintColor);
                    this._imageEntity.element.opacity = tintColor.a;
                    this._isApplyingTint = false;
                } else {
                    // TODO Animate
                    this._isApplyingTint = true;
                    this._imageEntity.element.color = toColor3(tintColor);
                    this._imageEntity.element.opacity = tintColor.a;
                    this._isApplyingTint = false;
                }
            }
        },

        _applySprite: function(spriteAsset, spriteFrame) {
            spriteFrame = spriteFrame || 0;

            if (this._imageEntity && this._imageEntity.element) {
                console.log('_applySprite', spriteAsset, spriteFrame);

                this._isApplyingSprite = true;
                this._imageEntity.element.spriteAsset = spriteAsset;
                this._imageEntity.element.spriteFrame = spriteFrame;
                this._isApplyingSprite = false;
            }
        },

        onEnable: function () {
            console.log('onEnable');
            this._updateImageEntityReference();
            this._forceReapplyVisualState();
        },

        onDisable: function () {
            console.log('onDisable');
            this._resetToDefaultVisualState(this.transitionMode);
            this._toggleImageListeners('off');
        },

        onRemove: function () {
            console.log('onRemove');
            this.onDisable();
            this._toggleLifecycleListeners('off', this.system);
        }
    });

    function toColor3(color4) {
        return new pc.Color(color4.r, color4.g, color4.b);
    }

    return {
        ButtonComponent: ButtonComponent
    };
}());
