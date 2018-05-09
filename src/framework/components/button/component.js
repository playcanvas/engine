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
     * @property {pc.Asset} hoverAsset Sprite to be used as the button image when the user hovers over it.
     * @property {pc.Asset} pressedAsset Sprite to be used as the button image when the user presses it.
     * @property {pc.Asset} inactiveAsset Sprite to be used as the button image when the button is not interactive.
     */
    var ButtonComponent = function ButtonComponent(system, entity) {
        this._visualState = VisualState.DEFAULT;
        this._isHovering = false;
        this._isPressed = false;
        this._imageEntity = null;

        this._defaultTint = new pc.Color(1, 1, 1, 1);

        this._addOrRemoveLifecycleListeners('on', system);
    };
    ButtonComponent = pc.inherits(ButtonComponent, pc.Component);

    pc.extend(ButtonComponent.prototype, {
        _addOrRemoveLifecycleListeners: function(onOrOff, system) {
            this.on('set_active', this._onSetActive, this);
            this.on('set_transitionMode', this._onSetTransitionMode, this);
            this.on('set_hoverTint', this._onSetTransitionValue, this);
            this.on('set_pressedTint', this._onSetTransitionValue, this);
            this.on('set_inactiveTint', this._onSetTransitionValue, this);
            this.on('set_hoverSprite', this._onSetTransitionValue, this);
            this.on('set_pressedSprite', this._onSetTransitionValue, this);
            this.on('set_inactiveSprite', this._onSetTransitionValue, this);
            this.on('set_imageEntity', this._onSetImageEntity, this);

            pc.ComponentSystem.on('postInitialize', this._onPostInitialize, this);

            system.app.systems.element.on('add', this._onElementComponentAdd, this);
            system.app.systems.element.on('beforeremove', this._onElementComponentRemove, this);

            // TODO Also handle button component addition/removal
            // TODO Also handle button component enable/disable
        },

        _onSetActive: function(name, oldValue, newValue) {
            if (oldValue !== newValue) {
                console.log('_onSetActive');
                this._updateVisualState();
            }
        },

        _onSetTransitionMode: function(name, oldValue, newValue) {
            if (oldValue !== newValue) {
                this._resetToDefaultVisualState(oldValue);
                this._forceReapplyVisualState();
            }
        },

        _onSetTransitionValue: function(name, oldValue, newValue) {
            if (oldValue !== newValue) {
                this._forceReapplyVisualState();
            }
        },

        _onSetImageEntity: function(name, oldGuid, newGuid) {
            if (oldGuid !== newGuid) {
                this._updateImageEntityReference();
            }
        },

        _onPostInitialize: function() {
            this._postInitializeFired = true;
            this._updateImageEntityReference();
        },

        // The public imageEntity property stores the entity guid (and this is what is
        // persisted in the database), but internally we need a reference to the actual
        // entity so that we can add listeners to it, modify its tint/sprite when the
        // user interacts with it, etc. This method is called whenever the guid changes
        // in order to resolve the guid to an actual entity reference.
        _updateImageEntityReference: function() {
            if (this._postInitializeFired) {
                var imageGuid = this.data.imageEntity;
                var hasChanged = !this._imageEntity || this._imageEntity.getGuid() !== imageGuid;

                if (imageGuid && hasChanged) {
                    this._onBeforeImageEntityChange();
                    this._imageEntity = this.system.app.root.findByGuid(imageGuid);
                    this._onAfterImageEntityChange();
                }
            }
        },

        _onImageEntityDestroy: function(entity) {
            if (this._imageEntity === entity) {
                console.log('_onImageEntityDestroy');
                this._onBeforeImageEntityChange();
                this._imageEntity = null;
            }
        },

        _onElementComponentAdd: function(entity) {
            if (this._imageEntity === entity) {
                console.log('_onElementComponentAdd');
                this._onAfterImageEntityChange();
            }
        },

        _onElementComponentRemove: function(entity) {
            if (this._imageEntity === entity) {
                console.log('_onElementComponentRemove');
                this._onBeforeImageEntityChange();
            }
        },

        _onBeforeImageEntityChange: function() {
            this._addOrRemoveImageListeners('off');
            this._resetToDefaultVisualState(this.transitionMode);
        },

        _onAfterImageEntityChange: function() {
            this._addOrRemoveImageListeners('on');
            this._storeDefaultTint();
            this._forceReapplyVisualState();
        },

        _addOrRemoveImageListeners: function(onOrOff) {
            if (this._imageEntity && this._imageEntity.element) {
                console.log('_addOrRemoveImageListeners YES', onOrOff);

                this._imageEntity[onOrOff]('destroy', this._onImageEntityDestroy, this);

                this._imageEntity.element[onOrOff]('set:color', this._onSetColor, this);
                this._imageEntity.element[onOrOff]('set:opacity', this._onSetOpacity, this);
                this._imageEntity.element[onOrOff]('mouseenter', this._onMouseEnter, this);
                this._imageEntity.element[onOrOff]('mouseleave', this._onMouseLeave, this);
                this._imageEntity.element[onOrOff]('mousedown', this._onMouseDown, this);
                this._imageEntity.element[onOrOff]('mouseup', this._onMouseUp, this);
                // TODO Test touch events on phone
                this._imageEntity.element[onOrOff]('touchstart', this._onEnter, this);
                this._imageEntity.element[onOrOff]('touchend', this._onTouchEnd, this);
                this._imageEntity.element[onOrOff]('touchcancel', this._onTouchCancel, this);
            } else {
                console.log('_addOrRemoveImageListeners NO', onOrOff, this._imageEntity, this._imageEntity && this._imageEntity.element);
            }
        },

        _storeDefaultTint: function() {
            if (this._imageEntity && this._imageEntity.element) {
                this._onSetColor(this._imageEntity.element.color);
                this._onSetOpacity(this._imageEntity.element.opacity);
            }
        },

        _onSetColor: function(color) {
            if (!this._isApplyingTint) {
                console.log('_onSetColor');
                this._defaultTint.r = color.r;
                this._defaultTint.g = color.g;
                this._defaultTint.b = color.b;
            }
        },

        _onSetOpacity: function(opacity) {
            if (!this._isApplyingTint) {
                console.log('_onSetOpacity');
                this._defaultTint.a = opacity;
            }
        },

        _onMouseEnter: function() {
            console.log('_onMouseEnter');
            this._isHovering = true;
            this._updateVisualState();
        },

        _onMouseLeave: function() {
            console.log('_onMouseLeave');
            this._isHovering = false;
            this._isPressed = false;
            this._updateVisualState();
        },

        _onMouseDown: function() {
            console.log('_onMouseDown');
            this._isPressed = true;
            this._updateVisualState();
        },

        _onMouseUp: function() {
            console.log('_onMouseUp');
            this._isPressed = false;
            this._updateVisualState();
        },

        _onTouchStart: function() {
            console.log('_onTouchStart');
            this._isPressed = true;
            this._updateVisualState();
        },

        _onTouchEnd: function() {
            console.log('_onTouchEnd');
            this._isPressed = false;
            this._updateVisualState();
        },

        _onTouchCancel: function() {
            console.log('_onTouchCancel');
            this._isPressed = false;
            this._updateVisualState();
        },

        _updateVisualState: function(force) {
            var oldVisualState = this._visualState;
            var newVisualState = this._determineVisualState();

            if (oldVisualState !== newVisualState || force) {
                this._visualState = newVisualState;

                console.log('_updateVisualState', oldVisualState, '->', newVisualState);

                switch (this.transitionMode) {
                    case pc.BUTTON_TRANSITION_MODE_TINT:
                        this._applyTint();
                        break;

                    case pc.BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
                        throw new Error('Not yet implemented');
                }
            }
        },

        // Called when a property changes that mean the visual state must be reapplied,
        // even if the state enum has not changed. Examples of this are when the tint
        // value for one of the states is changed via the editor.
        _forceReapplyVisualState: function() {
            this._updateVisualState(true);
        },

        // Called before the image entity changes, in order to restore the previous
        // image back to its original tint. Note that this happens immediately, i.e.
        // without any animation.
        _resetToDefaultVisualState: function(transitionMode) {
            if (this._imageEntity && this._imageEntity.element) {
                switch (transitionMode) {
                    case pc.BUTTON_TRANSITION_MODE_TINT:
                        this._imageEntity.element.color = toColor3(this._defaultTint);
                        this._imageEntity.element.opacity = this._defaultTint.a;
                        break;

                    case pc.BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
                        throw new Error('Not yet implemented');
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

        _applyTint: function() {
            var tintName = STATES_TO_TINT_NAMES[this._visualState];
            var tintColor = this[tintName];

            if (this._imageEntity && this._imageEntity.element) {
                console.log('_applyTint', tintColor.data);

                // TODO Animate
                this._isApplyingTint = true;
                this._imageEntity.element.color = toColor3(tintColor);
                this._imageEntity.element.opacity = tintColor.a;
                this._isApplyingTint = false;
            }
        },

        onRemove: function () {
            this._addOrRemoveLifecycleListeners('off', this.system);
        }
    });

    function toColor3(color4) {
        return new pc.Color(color4.r, color4.g, color4.b);
    }

    return {
        ButtonComponent: ButtonComponent
    };
}());
