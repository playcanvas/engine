import { now } from '../../../core/time.js';

import { math } from '../../../core/math/math.js';
import { Color } from '../../../core/math/color.js';

import { EntityReference } from '../../utils/entity-reference.js';

import { Component } from '../component.js';

import { BUTTON_TRANSITION_MODE_SPRITE_CHANGE, BUTTON_TRANSITION_MODE_TINT } from './constants.js';
import { ELEMENTTYPE_GROUP } from '../element/constants.js';

const VisualState = {
    DEFAULT: 'DEFAULT',
    HOVER: 'HOVER',
    PRESSED: 'PRESSED',
    INACTIVE: 'INACTIVE'
};

const STATES_TO_TINT_NAMES = {};
STATES_TO_TINT_NAMES[VisualState.DEFAULT] = '_defaultTint';
STATES_TO_TINT_NAMES[VisualState.HOVER] = 'hoverTint';
STATES_TO_TINT_NAMES[VisualState.PRESSED] = 'pressedTint';
STATES_TO_TINT_NAMES[VisualState.INACTIVE] = 'inactiveTint';

const STATES_TO_SPRITE_ASSET_NAMES = {};
STATES_TO_SPRITE_ASSET_NAMES[VisualState.DEFAULT] = '_defaultSpriteAsset';
STATES_TO_SPRITE_ASSET_NAMES[VisualState.HOVER] = 'hoverSpriteAsset';
STATES_TO_SPRITE_ASSET_NAMES[VisualState.PRESSED] = 'pressedSpriteAsset';
STATES_TO_SPRITE_ASSET_NAMES[VisualState.INACTIVE] = 'inactiveSpriteAsset';

const STATES_TO_SPRITE_FRAME_NAMES = {};
STATES_TO_SPRITE_FRAME_NAMES[VisualState.DEFAULT] = '_defaultSpriteFrame';
STATES_TO_SPRITE_FRAME_NAMES[VisualState.HOVER] = 'hoverSpriteFrame';
STATES_TO_SPRITE_FRAME_NAMES[VisualState.PRESSED] = 'pressedSpriteFrame';
STATES_TO_SPRITE_FRAME_NAMES[VisualState.INACTIVE] = 'inactiveSpriteFrame';

/**
 * A ButtonComponent enables a group of entities to behave like a button, with different visual
 * states for hover and press interactions.
 *
 * @property {boolean} active If set to false, the button will be visible but will not respond to
 * hover or touch interactions.
 * @property {import('../../entity.js').Entity} imageEntity A reference to the entity to be used as
 * the button background. The entity must have an ImageElement component.
 * @property {import('../../../core/math/vec4.js').Vec4} hitPadding Padding to be used in hit-test
 * calculations. Can be used to expand the bounding box so that the button is easier to tap.
 * @property {number} transitionMode Controls how the button responds when the user hovers over
 * it/presses it.
 * @property {Color} hoverTint Color to be used on the button image when the user hovers over it.
 * @property {Color} pressedTint Color to be used on the button image when the user presses it.
 * @property {Color} inactiveTint Color to be used on the button image when the button is not
 * interactive.
 * @property {number} fadeDuration Duration to be used when fading between tints, in milliseconds.
 * @property {import('../../asset/asset.js').Asset} hoverSpriteAsset Sprite to be used as the
 * button image when the user hovers over it.
 * @property {number} hoverSpriteFrame Frame to be used from the hover sprite.
 * @property {import('../../asset/asset.js').Asset} pressedSpriteAsset Sprite to be used as the
 * button image when the user presses it.
 * @property {number} pressedSpriteFrame Frame to be used from the pressed sprite.
 * @property {import('../../asset/asset.js').Asset} inactiveSpriteAsset Sprite to be used as the
 * button image when the button is not interactive.
 * @property {number} inactiveSpriteFrame Frame to be used from the inactive sprite.
 * @augments Component
 * @category User Interface
 */
class ButtonComponent extends Component {
    /**
     * Create a new ButtonComponent instance.
     *
     * @param {import('./system.js').ButtonComponentSystem} system - The ComponentSystem that
     * created this component.
     * @param {import('../../entity.js').Entity} entity - The entity that this component is
     * attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        this._visualState = VisualState.DEFAULT;
        this._isHovering = false;
        this._hoveringCounter = 0;
        this._isPressed = false;

        this._defaultTint = new Color(1, 1, 1, 1);
        this._defaultSpriteAsset = null;
        this._defaultSpriteFrame = 0;

        this._imageReference = new EntityReference(this, 'imageEntity', {
            'element#gain': this._onImageElementGain,
            'element#lose': this._onImageElementLose,
            'element#set:color': this._onSetColor,
            'element#set:opacity': this._onSetOpacity,
            'element#set:spriteAsset': this._onSetSpriteAsset,
            'element#set:spriteFrame': this._onSetSpriteFrame
        });

        this._toggleLifecycleListeners('on', system);
    }

    _toggleLifecycleListeners(onOrOff, system) {
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
    }

    _onSetActive(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this._updateVisualState();
        }
    }

    _onSetTransitionMode(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this._cancelTween();
            this._resetToDefaultVisualState(oldValue);
            this._forceReapplyVisualState();
        }
    }

    _onSetTransitionValue(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this._forceReapplyVisualState();
        }
    }

    _onElementComponentRemove(entity) {
        if (this.entity === entity) {
            this._toggleHitElementListeners('off');
        }
    }

    _onElementComponentAdd(entity) {
        if (this.entity === entity) {
            this._toggleHitElementListeners('on');
        }
    }

    _onImageElementLose() {
        this._cancelTween();
        this._resetToDefaultVisualState(this.transitionMode);
    }

    _onImageElementGain() {
        this._storeDefaultVisualState();
        this._forceReapplyVisualState();
    }

    _toggleHitElementListeners(onOrOff) {
        if (this.entity.element) {
            const isAdding = (onOrOff === 'on');

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
            this.entity.element[onOrOff]('selectstart', this._onSelectStart, this);
            this.entity.element[onOrOff]('selectend', this._onSelectEnd, this);
            this.entity.element[onOrOff]('selectenter', this._onSelectEnter, this);
            this.entity.element[onOrOff]('selectleave', this._onSelectLeave, this);
            this.entity.element[onOrOff]('click', this._onClick, this);

            this._hasHitElementListeners = isAdding;
        }
    }

    _storeDefaultVisualState() {
        // If the element is of group type, all it's visual properties are null
        if (this._imageReference.hasComponent('element')) {
            const element = this._imageReference.entity.element;
            if (element.type !== ELEMENTTYPE_GROUP) {
                this._storeDefaultColor(element.color);
                this._storeDefaultOpacity(element.opacity);
                this._storeDefaultSpriteAsset(element.spriteAsset);
                this._storeDefaultSpriteFrame(element.spriteFrame);
            }
        }
    }

    _storeDefaultColor(color) {
        this._defaultTint.r = color.r;
        this._defaultTint.g = color.g;
        this._defaultTint.b = color.b;
    }

    _storeDefaultOpacity(opacity) {
        this._defaultTint.a = opacity;
    }

    _storeDefaultSpriteAsset(spriteAsset) {
        this._defaultSpriteAsset = spriteAsset;
    }

    _storeDefaultSpriteFrame(spriteFrame) {
        this._defaultSpriteFrame = spriteFrame;
    }

    _onSetColor(color) {
        if (!this._isApplyingTint) {
            this._storeDefaultColor(color);
            this._forceReapplyVisualState();
        }
    }

    _onSetOpacity(opacity) {
        if (!this._isApplyingTint) {
            this._storeDefaultOpacity(opacity);
            this._forceReapplyVisualState();
        }
    }

    _onSetSpriteAsset(spriteAsset) {
        if (!this._isApplyingSprite) {
            this._storeDefaultSpriteAsset(spriteAsset);
            this._forceReapplyVisualState();
        }
    }

    _onSetSpriteFrame(spriteFrame) {
        if (!this._isApplyingSprite) {
            this._storeDefaultSpriteFrame(spriteFrame);
            this._forceReapplyVisualState();
        }
    }

    _onMouseEnter(event) {
        this._isHovering = true;

        this._updateVisualState();
        this._fireIfActive('mouseenter', event);
    }

    _onMouseLeave(event) {
        this._isHovering = false;
        this._isPressed = false;

        this._updateVisualState();
        this._fireIfActive('mouseleave', event);
    }

    _onMouseDown(event) {
        this._isPressed = true;

        this._updateVisualState();
        this._fireIfActive('mousedown', event);
    }

    _onMouseUp(event) {
        this._isPressed = false;

        this._updateVisualState();
        this._fireIfActive('mouseup', event);
    }

    _onTouchStart(event) {
        this._isPressed = true;

        this._updateVisualState();
        this._fireIfActive('touchstart', event);
    }

    _onTouchEnd(event) {
        // The default behavior of the browser is to simulate a series of
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
    }

    _onTouchLeave(event) {
        this._isPressed = false;

        this._updateVisualState();
        this._fireIfActive('touchleave', event);
    }

    _onTouchCancel(event) {
        this._isPressed = false;

        this._updateVisualState();
        this._fireIfActive('touchcancel', event);
    }

    _onSelectStart(event) {
        this._isPressed = true;
        this._updateVisualState();
        this._fireIfActive('selectstart', event);
    }

    _onSelectEnd(event) {
        this._isPressed = false;
        this._updateVisualState();
        this._fireIfActive('selectend', event);
    }

    _onSelectEnter(event) {
        this._hoveringCounter++;

        if (this._hoveringCounter === 1) {
            this._isHovering = true;
            this._updateVisualState();
        }

        this._fireIfActive('selectenter', event);
    }

    _onSelectLeave(event) {
        this._hoveringCounter--;

        if (this._hoveringCounter === 0) {
            this._isHovering = false;
            this._isPressed = false;
            this._updateVisualState();
        }

        this._fireIfActive('selectleave', event);
    }

    _onClick(event) {
        this._fireIfActive('click', event);
    }

    _fireIfActive(name, event) {
        if (this.data.active) {
            this.fire(name, event);
        }
    }

    _updateVisualState(force) {
        const oldVisualState = this._visualState;
        const newVisualState = this._determineVisualState();

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
                case BUTTON_TRANSITION_MODE_TINT: {
                    const tintName = STATES_TO_TINT_NAMES[this._visualState];
                    const tintColor = this[tintName];
                    this._applyTint(tintColor);
                    break;
                }
                case BUTTON_TRANSITION_MODE_SPRITE_CHANGE: {
                    const spriteAssetName = STATES_TO_SPRITE_ASSET_NAMES[this._visualState];
                    const spriteFrameName = STATES_TO_SPRITE_FRAME_NAMES[this._visualState];
                    const spriteAsset = this[spriteAssetName];
                    const spriteFrame = this[spriteFrameName];
                    this._applySprite(spriteAsset, spriteFrame);
                    break;
                }
            }
        }
    }

    // Called when a property changes that mean the visual state must be reapplied,
    // even if the state enum has not changed. Examples of this are when the tint
    // value for one of the states is changed via the editor.
    _forceReapplyVisualState() {
        this._updateVisualState(true);
    }

    // Called before the image entity changes, in order to restore the previous
    // image back to its original tint. Note that this happens immediately, i.e.
    // without any animation.
    _resetToDefaultVisualState(transitionMode) {
        if (this._imageReference.hasComponent('element')) {
            switch (transitionMode) {
                case BUTTON_TRANSITION_MODE_TINT:
                    this._cancelTween();
                    this._applyTintImmediately(this._defaultTint);
                    break;

                case BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
                    this._applySprite(this._defaultSpriteAsset, this._defaultSpriteFrame);
                    break;
            }
        }
    }

    _determineVisualState() {
        if (!this.active) {
            return VisualState.INACTIVE;
        } else if (this._isPressed) {
            return VisualState.PRESSED;
        } else if (this._isHovering) {
            return VisualState.HOVER;
        }

        return VisualState.DEFAULT;
    }

    _applySprite(spriteAsset, spriteFrame) {
        spriteFrame = spriteFrame || 0;

        if (this._imageReference.hasComponent('element')) {
            this._isApplyingSprite = true;

            if (this._imageReference.entity.element.spriteAsset !== spriteAsset) {
                this._imageReference.entity.element.spriteAsset = spriteAsset;
            }

            if (this._imageReference.entity.element.spriteFrame !== spriteFrame) {
                this._imageReference.entity.element.spriteFrame = spriteFrame;
            }

            this._isApplyingSprite = false;
        }
    }

    _applyTint(tintColor) {
        this._cancelTween();

        if (this.fadeDuration === 0) {
            this._applyTintImmediately(tintColor);
        } else {
            this._applyTintWithTween(tintColor);
        }
    }

    _applyTintImmediately(tintColor) {
        if (!tintColor || !this._imageReference.hasComponent('element') || this._imageReference.entity.element.type === ELEMENTTYPE_GROUP)
            return;

        const color3 = toColor3(tintColor);

        this._isApplyingTint = true;

        if (!color3.equals(this._imageReference.entity.element.color))
            this._imageReference.entity.element.color = color3;

        if (this._imageReference.entity.element.opacity !== tintColor.a)
            this._imageReference.entity.element.opacity = tintColor.a;

        this._isApplyingTint = false;
    }

    _applyTintWithTween(tintColor) {
        if (!tintColor || !this._imageReference.hasComponent('element') || this._imageReference.entity.element.type === ELEMENTTYPE_GROUP)
            return;

        const color3 = toColor3(tintColor);
        const color = this._imageReference.entity.element.color;
        const opacity = this._imageReference.entity.element.opacity;

        if (color3.equals(color) && tintColor.a === opacity)
            return;

        this._tweenInfo = {
            startTime: now(),
            from: new Color(color.r, color.g, color.b, opacity),
            to: tintColor.clone(),
            lerpColor: new Color()
        };
    }

    _updateTintTween() {
        const elapsedTime = now() - this._tweenInfo.startTime;
        let elapsedProportion = this.fadeDuration === 0 ? 1 : (elapsedTime / this.fadeDuration);
        elapsedProportion = math.clamp(elapsedProportion, 0, 1);

        if (Math.abs(elapsedProportion - 1) > 1e-5) {
            const lerpColor = this._tweenInfo.lerpColor;
            lerpColor.lerp(this._tweenInfo.from, this._tweenInfo.to, elapsedProportion);
            this._applyTintImmediately(new Color(lerpColor.r, lerpColor.g, lerpColor.b, lerpColor.a));
        } else {
            this._applyTintImmediately(this._tweenInfo.to);
            this._cancelTween();
        }
    }

    _cancelTween() {
        delete this._tweenInfo;
    }

    onUpdate() {
        if (this._tweenInfo) {
            this._updateTintTween();
        }
    }

    onEnable() {
        // Reset input state
        this._isHovering = false;
        this._hoveringCounter = 0;
        this._isPressed = false;

        this._imageReference.onParentComponentEnable();
        this._toggleHitElementListeners('on');
        this._forceReapplyVisualState();
    }

    onDisable() {
        this._toggleHitElementListeners('off');
        this._resetToDefaultVisualState(this.transitionMode);
    }

    onRemove() {
        this._toggleLifecycleListeners('off', this.system);
        this.onDisable();
    }
}

function toColor3(color4) {
    return new Color(color4.r, color4.g, color4.b);
}

/**
 * Fired when the mouse is pressed while the cursor is on the component.
 *
 * @event ButtonComponent#mousedown
 * @param {import('../../input/element-input.js').ElementMouseEvent} event - The event.
 */

/**
 * Fired when the mouse is released while the cursor is on the component.
 *
 * @event ButtonComponent#mouseup
 * @param {import('../../input/element-input.js').ElementMouseEvent} event - The event.
 */

/**
 * Fired when the mouse cursor enters the component.
 *
 * @event ButtonComponent#mouseenter
 * @param {import('../../input/element-input.js').ElementMouseEvent} event - The event.
 */

/**
 * Fired when the mouse cursor leaves the component.
 *
 * @event ButtonComponent#mouseleave
 * @param {import('../../input/element-input.js').ElementMouseEvent} event - The event.
 */

/**
 * Fired when the mouse is pressed and released on the component or when a touch starts and ends on
 * the component.
 *
 * @event ButtonComponent#click
 * @param {import('../../input/element-input.js').ElementMouseEvent|import('../../input/element-input.js').ElementTouchEvent} event - The event.
 */

/**
 * Fired when a touch starts on the component.
 *
 * @event ButtonComponent#touchstart
 * @param {import('../../input/element-input.js').ElementTouchEvent} event - The event.
 */

/**
 * Fired when a touch ends on the component.
 *
 * @event ButtonComponent#touchend
 * @param {import('../../input/element-input.js').ElementTouchEvent} event - The event.
 */

/**
 * Fired when a touch is canceled on the component.
 *
 * @event ButtonComponent#touchcancel
 * @param {import('../../input/element-input.js').ElementTouchEvent} event - The event.
 */

/**
 * Fired when a touch leaves the component.
 *
 * @event ButtonComponent#touchleave
 * @param {import('../../input/element-input.js').ElementTouchEvent} event - The event.
 */

/**
 * Fired when a xr select starts on the component.
 *
 * @event ButtonComponent#selectstart
 * @param {import('../../input/element-input.js').ElementSelectEvent} event - The event.
 */

/**
 * Fired when a xr select ends on the component.
 *
 * @event ButtonComponent#selectend
 * @param {import('../../input/element-input.js').ElementSelectEvent} event - The event.
 */

/**
 * Fired when a xr select now hovering over the component.
 *
 * @event ButtonComponent#selectenter
 * @param {import('../../input/element-input.js').ElementSelectEvent} event - The event.
 */

/**
 * Fired when a xr select not hovering over the component.
 *
 * @event ButtonComponent#selectleave
 * @param {import('../../input/element-input.js').ElementSelectEvent} event - The event.
 */

/**
 * Fired when the button changes state to be hovered.
 *
 * @event ButtonComponent#hoverstart
 */

/**
 * Fired when the button changes state to be not hovered.
 *
 * @event ButtonComponent#hoverend
 */

/**
 * Fired when the button changes state to be pressed.
 *
 * @event ButtonComponent#pressedstart
 */

/**
 * Fired when the button changes state to be not pressed.
 *
 * @event ButtonComponent#pressedend
 */

export { ButtonComponent };
