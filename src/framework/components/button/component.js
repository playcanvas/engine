Object.assign(pc, function () {
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
     * @property {pc.Entity} imageEntity A reference to the entity to be used as the button background. The entity must have an ImageElement component.
     * @property {pc.Vec4} hitPadding Padding to be used in hit-test calculations. Can be used to expand the bounding box so that the button is easier to tap.
     * @property {pc.BUTTON_TRANSITION_MODE} transitionMode Controls how the button responds when the user hovers over it/presses it.
     * @property {pc.Color} hoverTint Color to be used on the button image when the user hovers over it.
     * @property {pc.Color} pressedTint Color to be used on the button image when the user presses it.
     * @property {pc.Color} inactiveTint Color to be used on the button image when the button is not interactive.
     * @property {Number} fadeDuration Duration to be used when fading between tints, in milliseconds.
     * @property {pc.Asset} hoverSpriteAsset Sprite to be used as the button image when the user hovers over it.
     * @property {Number} hoverSpriteFrame Frame to be used from the hover sprite.
     * @property {pc.Asset} pressedSpriteAsset Sprite to be used as the button image when the user presses it.
     * @property {Number} pressedSpriteFrame Frame to be used from the pressed sprite.
     * @property {pc.Asset} inactiveSpriteAsset Sprite to be used as the button image when the button is not interactive.
     * @property {Number} inactiveSpriteFrame Frame to be used from the inactive sprite.
     */
    var ButtonComponent = function ButtonComponent(system, entity) {
        pc.Component.call(this, system, entity);

        this._visualState = VisualState.DEFAULT;
        this._isHovering = false;
        this._isPressed = false;

        this._defaultTint = new pc.Color(1, 1, 1, 1);
        this._defaultSpriteAsset = null;
        this._defaultSpriteFrame = 0;

        this._imageReference = new pc.EntityReference(this, 'imageEntity', {
            'element#gain': this._onImageElementGain,
            'element#lose': this._onImageElementLose,
            'element#set:color': this._onSetColor,
            'element#set:opacity': this._onSetOpacity,
            'element#set:spriteAsset': this._onSetSpriteAsset,
            'element#set:spriteFrame': this._onSetSpriteFrame
        });

        this._toggleLifecycleListeners('on', system);
    };
    ButtonComponent.prototype = Object.create(pc.Component.prototype);
    ButtonComponent.prototype.constructor = ButtonComponent;

    Object.assign(ButtonComponent.prototype, {
        _toggleLifecycleListeners: function (onOrOff, system) {
            this[onOrOff]('set_active', this._onSetActive, this);
            this[onOrOff]('set_transitionMode', this._onSetTransitionMode, this);
            this[onOrOff]('set_hoverTint', this._onSetTransitionValue, this);
            this[onOrOff]('set_pressedTint', this._onSetTransitionValue, this);
            this[onOrOff]('set_inactiveTint', this._onSetTransitionValue, this);
            this[onOrOff]('set_hoverSpriteAsset', this._onSetTransitionValue, this);
            this[onOrOff]('set_hoverSpriteFrame', this._onSetTransitionValue, this);
            this[onOrOff]('set_pressedSpriteAsset', this._onSetTransitionValue, this);
            this[onOrOff]('set_pressedSpriteFrame', this._onSetTransitionValue, this);
            this[onOrOff]('set_inactiveSpriteAsset', this._onSetTransitionValue, this);
            this[onOrOff]('set_inactiveSpriteFrame', this._onSetTransitionValue, this);

            system.app.systems.element[onOrOff]('add', this._onElementComponentAdd, this);
            system.app.systems.element[onOrOff]('beforeremove', this._onElementComponentRemove, this);
        },

        _onSetActive: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                this._updateVisualState();
            }
        },

        _onSetTransitionMode: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                this._cancelTween();
                this._resetToDefaultVisualState(oldValue);
                this._forceReapplyVisualState();
            }
        },

        _onSetTransitionValue: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                this._forceReapplyVisualState();
            }
        },

        _onElementComponentRemove: function (entity) {
            if (this.entity === entity) {
                this._toggleHitElementListeners('off');
            }
        },

        _onElementComponentAdd: function (entity) {
            if (this.entity === entity) {
                this._toggleHitElementListeners('on');
            }
        },

        _onImageElementLose: function () {
            this._cancelTween();
            this._resetToDefaultVisualState(this.transitionMode);
        },

        _onImageElementGain: function () {
            this._storeDefaultVisualState();
            this._forceReapplyVisualState();
        },

        _toggleHitElementListeners: function (onOrOff) {
            if (this.entity.element) {
                var isAdding = (onOrOff === 'on');

                // Prevent duplicate listeners
                if (isAdding && this._hasHitElementListeners) {
                    return;
                }

                this.entity.element[onOrOff]('mouseenter', this._onMouseEnter, this);
                this.entity.element[onOrOff]('mouseleave', this._onMouseLeave, this);
                this.entity.element[onOrOff]('mousedown', this._onMouseDown, this);
                this.entity.element[onOrOff]('mouseup', this._onMouseUp, this);
                this.entity.element[onOrOff]('touchstart', this._onTouchStart, this);
                this.entity.element[onOrOff]('touchend', this._onTouchEnd, this);
                this.entity.element[onOrOff]('touchleave', this._onTouchLeave, this);
                this.entity.element[onOrOff]('touchcancel', this._onTouchCancel, this);
                this.entity.element[onOrOff]('click', this._onClick, this);

                this._hasHitElementListeners = isAdding;
            }
        },

        _storeDefaultVisualState: function () {
            if (this._imageReference.hasComponent('element')) {
                this._storeDefaultColor(this._imageReference.entity.element.color);
                this._storeDefaultOpacity(this._imageReference.entity.element.opacity);
                this._storeDefaultSpriteAsset(this._imageReference.entity.element.spriteAsset);
                this._storeDefaultSpriteFrame(this._imageReference.entity.element.spriteFrame);
            }
        },

        _storeDefaultColor: function (color) {
            this._defaultTint.r = color.r;
            this._defaultTint.g = color.g;
            this._defaultTint.b = color.b;
        },

        _storeDefaultOpacity: function (opacity) {
            this._defaultTint.a = opacity;
        },

        _storeDefaultSpriteAsset: function (spriteAsset) {
            this._defaultSpriteAsset = spriteAsset;
        },

        _storeDefaultSpriteFrame: function (spriteFrame) {
            this._defaultSpriteFrame = spriteFrame;
        },

        _onSetColor: function (color) {
            if (!this._isApplyingTint) {
                this._storeDefaultColor(color);
                this._forceReapplyVisualState();
            }
        },

        _onSetOpacity: function (opacity) {
            if (!this._isApplyingTint) {
                this._storeDefaultOpacity(opacity);
                this._forceReapplyVisualState();
            }
        },

        _onSetSpriteAsset: function (spriteAsset) {
            if (!this._isApplyingSprite) {
                this._storeDefaultSpriteAsset(spriteAsset);
                this._forceReapplyVisualState();
            }
        },

        _onSetSpriteFrame: function (spriteFrame) {
            if (!this._isApplyingSprite) {
                this._storeDefaultSpriteFrame(spriteFrame);
                this._forceReapplyVisualState();
            }
        },

        _onMouseEnter: function (event) {
            this._isHovering = true;

            this._updateVisualState();
            this._fireIfActive('mouseenter', event);
        },

        _onMouseLeave: function (event) {
            this._isHovering = false;
            this._isPressed = false;

            this._updateVisualState();
            this._fireIfActive('mouseleave', event);
        },

        _onMouseDown: function (event) {
            this._isPressed = true;

            this._updateVisualState();
            this._fireIfActive('mousedown', event);
        },

        _onMouseUp: function (event) {
            this._isPressed = false;

            this._updateVisualState();
            this._fireIfActive('mouseup', event);
        },

        _onTouchStart: function (event) {
            this._isPressed = true;

            this._updateVisualState();
            this._fireIfActive('touchstart', event);
        },

        _onTouchEnd: function (event) {
            // The default behaviour of the browser is to simulate a series of
            // `mouseenter/down/up` events immediately after the `touchend` event,
            // in order to ensure that websites that don't explicitly listen for
            // touch events will still work on mobile (see https://www.html5rocks.com/en/mobile/touchandmouse/
            // for reference). This leads to an issue whereby buttons will enter
            // the `hover` state on mobile browsers after the `touchend` event is
            // received, instead of going back to the `default` state. Calling
            // preventDefault() here fixes the issue.
            event.event.preventDefault();

            this._isPressed = false;

            this._updateVisualState();
            this._fireIfActive('touchend', event);
        },

        _onTouchLeave: function (event) {
            this._isPressed = false;

            this._updateVisualState();
            this._fireIfActive('touchleave', event);
        },

        _onTouchCancel: function (event) {
            this._isPressed = false;

            this._updateVisualState();
            this._fireIfActive('touchcancel', event);
        },

        _onClick: function (event) {
            this._fireIfActive('click', event);
        },

        _fireIfActive: function (name, event) {
            if (this.data.active) {
                this.fire(name, event);
            }
        },

        _updateVisualState: function (force) {
            var oldVisualState = this._visualState;
            var newVisualState = this._determineVisualState();

            if ((oldVisualState !== newVisualState || force) && this.enabled) {
                this._visualState = newVisualState;

                if (oldVisualState === VisualState.HOVER) {
                    this._fireIfActive('hoverend');
                }

                if (oldVisualState === VisualState.PRESSED) {
                    this._fireIfActive('pressedend');
                }

                if (newVisualState === VisualState.HOVER) {
                    this._fireIfActive('hoverstart');
                }

                if (newVisualState === VisualState.PRESSED) {
                    this._fireIfActive('pressedstart');
                }

                switch (this.transitionMode) {
                    case pc.BUTTON_TRANSITION_MODE_TINT:
                        var tintName = STATES_TO_TINT_NAMES[this._visualState];
                        var tintColor = this[tintName];
                        this._applyTint(tintColor);
                        break;

                    case pc.BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
                        var spriteAssetName = STATES_TO_SPRITE_ASSET_NAMES[this._visualState];
                        var spriteFrameName = STATES_TO_SPRITE_FRAME_NAMES[this._visualState];
                        var spriteAsset = this[spriteAssetName];
                        var spriteFrame = this[spriteFrameName];
                        this._applySprite(spriteAsset, spriteFrame);
                        break;
                }
            }
        },

        // Called when a property changes that mean the visual state must be reapplied,
        // even if the state enum has not changed. Examples of this are when the tint
        // value for one of the states is changed via the editor.
        _forceReapplyVisualState: function () {
            this._updateVisualState(true);
        },

        // Called before the image entity changes, in order to restore the previous
        // image back to its original tint. Note that this happens immediately, i.e.
        // without any animation.
        _resetToDefaultVisualState: function (transitionMode) {
            if (this._imageReference.hasComponent('element')) {
                switch (transitionMode) {
                    case pc.BUTTON_TRANSITION_MODE_TINT:
                        this._cancelTween();
                        this._applyTintImmediately(this._defaultTint);
                        break;

                    case pc.BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
                        this._applySprite(this._defaultSpriteAsset, this._defaultSpriteFrame);
                        break;
                }
            }
        },

        _determineVisualState: function () {
            if (!this.active) {
                return VisualState.INACTIVE;
            } else if (this._isPressed) {
                return VisualState.PRESSED;
            } else if (this._isHovering) {
                return VisualState.HOVER;
            }

            return VisualState.DEFAULT;
        },

        _applySprite: function (spriteAsset, spriteFrame) {
            spriteFrame = spriteFrame || 0;

            if (this._imageReference.hasComponent('element')) {
                this._isApplyingSprite = true;
                this._imageReference.entity.element.spriteAsset = spriteAsset;
                this._imageReference.entity.element.spriteFrame = spriteFrame;
                this._isApplyingSprite = false;
            }
        },

        _applyTint: function (tintColor) {
            this._cancelTween();

            if (this.fadeDuration === 0) {
                this._applyTintImmediately(tintColor);
            } else {
                this._applyTintWithTween(tintColor);
            }
        },

        _applyTintImmediately: function (tintColor) {
            if (this._imageReference.hasComponent('element') && tintColor) {
                this._isApplyingTint = true;
                this._imageReference.entity.element.color = toColor3(tintColor);
                this._imageReference.entity.element.opacity = tintColor.a;
                this._isApplyingTint = false;
            }
        },

        _applyTintWithTween: function (tintColor) {
            if (this._imageReference.hasComponent('element') && tintColor) {
                var color = this._imageReference.entity.element.color;
                var opacity = this._imageReference.entity.element.opacity;

                this._tweenInfo = {
                    startTime: pc.now(),
                    from: new pc.Color(color.r, color.g, color.b, opacity),
                    to: tintColor.clone(),
                    lerpColor: new pc.Color()
                };
            }
        },

        _updateTintTween: function () {
            var elapsedTime = pc.now() - this._tweenInfo.startTime;
            var elapsedProportion = this.fadeDuration === 0 ? 1 : (elapsedTime / this.fadeDuration);
            elapsedProportion = pc.math.clamp(elapsedProportion, 0, 1);

            if (Math.abs(elapsedProportion - 1) > 1e-5) {
                var lerpColor = this._tweenInfo.lerpColor;
                lerpColor.lerp(this._tweenInfo.from, this._tweenInfo.to, elapsedProportion);
                this._applyTintImmediately(new pc.Color(lerpColor.r, lerpColor.g, lerpColor.b, lerpColor.a));
            } else {
                this._applyTintImmediately(this._tweenInfo.to);
                this._cancelTween();
            }
        },

        _cancelTween: function () {
            delete this._tweenInfo;
        },

        onUpdate: function () {
            if (this._tweenInfo) {
                this._updateTintTween();
            }
        },

        onEnable: function () {
            this._imageReference.onParentComponentEnable();
            this._toggleHitElementListeners('on');
            this._forceReapplyVisualState();
        },

        onDisable: function () {
            this._toggleHitElementListeners('off');
            this._resetToDefaultVisualState(this.transitionMode);
        },

        onRemove: function () {
            this._toggleLifecycleListeners('off', this.system);
            this.onDisable();
        }
    });

    function toColor3(color4) {
        return new pc.Color(color4.r, color4.g, color4.b);
    }

    return {
        ButtonComponent: ButtonComponent
    };
}());

/**
 * @event
 * @name pc.ButtonComponent#mousedown
 * @description Fired when the mouse is pressed while the cursor is on the component.
 * @param {pc.ElementMouseEvent} event The event
 */

/**
 * @event
 * @name pc.ButtonComponent#mouseup
 * @description Fired when the mouse is released while the cursor is on the component.
 * @param {pc.ElementMouseEvent} event The event
 */

/**
 * @event
 * @name pc.ButtonComponent#mouseenter
 * @description Fired when the mouse cursor enters the component.
 * @param {pc.ElementMouseEvent} event The event
 */

/**
 * @event
 * @name pc.ButtonComponent#mouseleave
 * @description Fired when the mouse cursor leaves the component.
 * @param {pc.ElementMouseEvent} event The event
 */

/**
 * @event
 * @name pc.ButtonComponent#click
 * @description Fired when the mouse is pressed and released on the component or when a touch starts and ends on the component.
 * @param {pc.ElementMouseEvent|pc.ElementTouchEvent} event The event
 */

/**
 * @event
 * @name pc.ButtonComponent#touchstart
 * @description Fired when a touch starts on the component.
 * @param {pc.ElementTouchEvent} event The event
 */

/**
 * @event
 * @name pc.ButtonComponent#touchend
 * @description Fired when a touch ends on the component.
 * @param {pc.ElementTouchEvent} event The event
 */

/**
 * @event
 * @name pc.ButtonComponent#touchcancel
 * @description Fired when a touch is cancelled on the component.
 * @param {pc.ElementTouchEvent} event The event
 */

/**
 * @event
 * @name pc.ButtonComponent#touchleave
 * @description Fired when a touch leaves the component.
 * @param {pc.ElementTouchEvent} event The event
 */

/**
 * @event
 * @name pc.ButtonComponent#hoverstart
 * @description Fired when the button changes state to be hovered
 */

/**
 * @event
 * @name pc.ButtonComponent#hoverend
 * @description Fired when the button changes state to be not hovered
 */

/**
 * @event
 * @name pc.ButtonComponent#pressedstart
 * @description Fired when the button changes state to be pressed
 */

/**
 * @event
 * @name pc.ButtonComponent#pressedend
 * @description Fired when the button changes state to be not pressed
 */
