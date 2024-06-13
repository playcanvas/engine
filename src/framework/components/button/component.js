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
 * @category User Interface
 */
class ButtonComponent extends Component {
    /**
     * Fired when the mouse is pressed while the cursor is on the component. The handler is passed
     * a {@link ElementMouseEvent}.
     *
     * @event
     * @example
     * entity.button.on('mousedown', (event) => {
     *     console.log(`Mouse down on entity ${entity.name}`);
     * });
     */
    static EVENT_MOUSEDOWN = 'mousedown';

    /**
     * Fired when the mouse is released while the cursor is on the component. The handler is passed
     * a {@link ElementMouseEvent}.
     *
     * @event
     * @example
     * entity.button.on('mouseup', (event) => {
     *     console.log(`Mouse up on entity ${entity.name}`);
     * });
     */
    static EVENT_MOUSEUP = 'mouseup';

    /**
     * Fired when the mouse cursor enters the component. The handler is passed a
     * {@link ElementMouseEvent}.
     *
     * @event
     * @example
     * entity.button.on('mouseenter', (event) => {
     *     console.log(`Mouse entered entity ${entity.name}`);
     * });
     */
    static EVENT_MOUSEENTER = 'mouseenter';

    /**
     * Fired when the mouse cursor leaves the component. The handler is passed a
     * {@link ElementMouseEvent}.
     *
     * @event
     * @example
     * entity.button.on('mouseleave', (event) => {
     *     console.log(`Mouse left entity ${entity.name}`);
     * });
     */
    static EVENT_MOUSELEAVE = 'mouseleave';

    /**
     * Fired when the mouse is pressed and released on the component or when a touch starts and ends on
     * the component. The handler is passed a {@link ElementMouseEvent} or {@link ElementTouchEvent}.
     *
     * @event
     * @example
     * entity.button.on('click', (event) => {
     *     console.log(`Clicked entity ${entity.name}`);
     * });
     */
    static EVENT_CLICK = 'click';

    /**
     * Fired when a touch starts on the component. The handler is passed a {@link ElementTouchEvent}.
     *
     * @event
     * @example
     * entity.button.on('touchstart', (event) => {
     *     console.log(`Touch started on entity ${entity.name}`);
     * });
     */
    static EVENT_TOUCHSTART = 'touchstart';

    /**
     * Fired when a touch ends on the component. The handler is passed a {@link ElementTouchEvent}.
     *
     * @event
     * @example
     * entity.button.on('touchend', (event) => {
     *     console.log(`Touch ended on entity ${entity.name}`);
     * });
     */
    static EVENT_TOUCHEND = 'touchend';

    /**
     * Fired when a touch is canceled on the component. The handler is passed a
     * {@link ElementTouchEvent}.
     *
     * @event
     * @example
     * entity.button.on('touchcancel', (event) => {
     *     console.log(`Touch canceled on entity ${entity.name}`);
     * });
     */
    static EVENT_TOUCHCANCEL = 'touchcancel';

    /**
     * Fired when a touch leaves the component. The handler is passed a {@link ElementTouchEvent}.
     *
     * @event
     * @example
     * entity.button.on('touchleave', (event) => {
     *     console.log(`Touch left entity ${entity.name}`);
     * });
     */
    static EVENT_TOUCHLEAVE = 'touchleave';

    /**
     * Fired when a xr select starts on the component. The handler is passed a
     * {@link ElementSelectEvent}.
     *
     * @event
     * @example
     * entity.button.on('selectstart', (event) => {
     *     console.log(`Select started on entity ${entity.name}`);
     * });
     */
    static EVENT_SELECTSTART = 'selectstart';

    /**
     * Fired when a xr select ends on the component. The handler is passed a
     * {@link ElementSelectEvent}.
     *
     * @event
     * @example
     * entity.button.on('selectend', (event) => {
     *     console.log(`Select ended on entity ${entity.name}`);
     * });
     */
    static EVENT_SELECTEND = 'selectend';

    /**
     * Fired when a xr select now hovering over the component. The handler is passed a
     * {@link ElementSelectEvent}.
     *
     * @event
     * @example
     * entity.button.on('selectenter', (event) => {
     *     console.log(`Select entered entity ${entity.name}`);
     * });
     */
    static EVENT_SELECTENTER = 'selectenter';

    /**
     * Fired when a xr select not hovering over the component. The handler is passed a
     * {@link ElementSelectEvent}.
     *
     * @event
     * @example
     * entity.button.on('selectleave', (event) => {
     *     console.log(`Select left entity ${entity.name}`);
     * });
     */
    static EVENT_SELECTLEAVE = 'selectleave';

    /**
     * Fired when the button changes state to be hovered.
     *
     * @event
     * @example
     * entity.button.on('hoverstart', () => {
     *     console.log(`Entity ${entity.name} hovered`);
     * });
     */
    static EVENT_HOVERSTART = 'hoverstart';

    /**
     * Fired when the button changes state to be not hovered.
     *
     * @event
     * @example
     * entity.button.on('hoverend', () => {
     *     console.log(`Entity ${entity.name} unhovered`);
     * });
     */
    static EVENT_HOVEREND = 'hoverend';

    /**
     * Fired when the button changes state to be pressed.
     *
     * @event
     * @example
     * entity.button.on('pressedstart', () => {
     *     console.log(`Entity ${entity.name} pressed`);
     * });
     */
    static EVENT_PRESSEDSTART = 'pressedstart';

    /**
     * Fired when the button changes state to be not pressed.
     *
     * @event
     * @example
     * entity.button.on('pressedend', () => {
     *     console.log(`Entity ${entity.name} unpressed`);
     * });
     */
    static EVENT_PRESSEDEND = 'pressedend';

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

    // TODO: Remove this override in upgrading component
    /**
     * @type {import('./data.js').ButtonComponentData}
     * @ignore
     */
    get data() {
        const record = this.system.store[this.entity.getGuid()];
        return record ? record.data : null;
    }

    /**
     * Sets the enabled state of the component.
     *
     * @type {boolean}
     */
    set enabled(arg) {
        this._setValue('enabled', arg);
    }

    /**
     * Gets the enabled state of the component.
     *
     * @type {boolean}
     */
    get enabled() {
        return this.data.enabled;
    }

    /**
     * Sets the button's active state. If set to false, the button will be visible but will not
     * respond to hover or touch interactions. Defaults to true.
     *
     * @type {boolean}
     */
    set active(arg) {
        this._setValue('active', arg);
    }

    /**
     * Gets the button's active state.
     *
     * @type {boolean}
     */
    get active() {
        return this.data.active;
    }

    /**
     * Sets the entity to be used as the button background. The entity must have an
     * {@link ElementComponent} configured as an image element.
     *
     * @type {import('../../../framework/entity.js').Entity}
     */
    set imageEntity(arg) {
        this._setValue('imageEntity', arg);
    }

    /**
     * Gets the entity to be used as the button background.
     *
     * @type {import('../../../framework/entity.js').Entity}
     */
    get imageEntity() {
        return this.data.imageEntity;
    }

    /**
     * Sets the padding to be used in hit-test calculations. Can be used to expand the bounding box
     * so that the button is easier to tap. Defaults to `[0, 0, 0, 0]`.
     *
     * @type {import('../../../core/math/vec4.js').Vec4}
     */
    set hitPadding(arg) {
        this._setValue('hitPadding', arg);
    }

    /**
     * Gets the padding to be used in hit-test calculations.
     *
     * @type {import('../../../core/math/vec4.js').Vec4}
     */
    get hitPadding() {
        return this.data.hitPadding;
    }

    /**
     * Sets the button transition mode. This controls how the button responds when the user hovers
     * over it/presses it. Can be:
     *
     * - {@link BUTTON_TRANSITION_MODE_TINT}
     * - {@link BUTTON_TRANSITION_MODE_SPRITE_CHANGE}
     *
     * Defaults to {@link BUTTON_TRANSITION_MODE_TINT}.
     *
     * @type {number}
     */
    set transitionMode(arg) {
        this._setValue('transitionMode', arg);
    }

    /**
     * Gets the button transition mode.
     *
     * @type {number}
     */
    get transitionMode() {
        return this.data.transitionMode;
    }

    /**
     * Sets the tint color to be used on the button image when the user hovers over it. Defaults to
     * `[0.75, 0.75, 0.75]`.
     *
     * @type {Color}
     */
    set hoverTint(arg) {
        this._setValue('hoverTint', arg);
    }

    /**
     * Gets the tint color to be used on the button image when the user hovers over it.
     *
     * @type {Color}
     */
    get hoverTint() {
        return this.data.hoverTint;
    }

    /**
     * Sets the tint color to be used on the button image when the user presses it. Defaults to
     * `[0.5, 0.5, 0.5]`.
     *
     * @type {Color}
     */
    set pressedTint(arg) {
        this._setValue('pressedTint', arg);
    }

    /**
     * Gets the tint color to be used on the button image when the user presses it.
     *
     * @type {Color}
     */
    get pressedTint() {
        return this.data.pressedTint;
    }

    /**
     * Sets the tint color to be used on the button image when the button is not interactive.
     * Defaults to `[0.25, 0.25, 0.25]`.
     *
     * @type {Color}
     */
    set inactiveTint(arg) {
        this._setValue('inactiveTint', arg);
    }

    /**
     * Gets the tint color to be used on the button image when the button is not interactive.
     *
     * @type {Color}
     */
    get inactiveTint() {
        return this.data.inactiveTint;
    }

    /**
     * Sets the duration to be used when fading between tints, in milliseconds. Defaults to 0.
     *
     * @type {number}
     */
    set fadeDuration(arg) {
        this._setValue('fadeDuration', arg);
    }

    /**
     * Gets the duration to be used when fading between tints, in milliseconds.
     *
     * @type {number}
     */
    get fadeDuration() {
        return this.data.fadeDuration;
    }

    /**
     * Sets the sprite to be used as the button image when the user hovers over it.
     *
     * @type {import('../../../framework/asset/asset.js').Asset}
     */
    set hoverSpriteAsset(arg) {
        this._setValue('hoverSpriteAsset', arg);
    }

    /**
     * Gets the sprite to be used as the button image when the user hovers over it.
     *
     * @type {import('../../../framework/asset/asset.js').Asset}
     */
    get hoverSpriteAsset() {
        return this.data.hoverSpriteAsset;
    }

    /**
     * Sets the frame to be used from the hover sprite.
     *
     * @type {number}
     */
    set hoverSpriteFrame(arg) {
        this._setValue('hoverSpriteFrame', arg);
    }

    /**
     * Gets the frame to be used from the hover sprite.
     *
     * @type {number}
     */
    get hoverSpriteFrame() {
        return this.data.hoverSpriteFrame;
    }

    /**
     * Sets the sprite to be used as the button image when the user presses it.
     *
     * @type {import('../../../framework/asset/asset.js').Asset}
     */
    set pressedSpriteAsset(arg) {
        this._setValue('pressedSpriteAsset', arg);
    }

    /**
     * Gets the sprite to be used as the button image when the user presses it.
     *
     * @type {import('../../../framework/asset/asset.js').Asset}
     */
    get pressedSpriteAsset() {
        return this.data.pressedSpriteAsset;
    }

    /**
     * Sets the frame to be used from the pressed sprite.
     *
     * @type {number}
     */
    set pressedSpriteFrame(arg) {
        this._setValue('pressedSpriteFrame', arg);
    }

    /**
     * Gets the frame to be used from the pressed sprite.
     *
     * @type {number}
     */
    get pressedSpriteFrame() {
        return this.data.pressedSpriteFrame;
    }

    /**
     * Sets the sprite to be used as the button image when the button is not interactive.
     *
     * @type {import('../../../framework/asset/asset.js').Asset}
     */
    set inactiveSpriteAsset(arg) {
        this._setValue('inactiveSpriteAsset', arg);
    }

    /**
     * Gets the sprite to be used as the button image when the button is not interactive.
     *
     * @type {import('../../../framework/asset/asset.js').Asset}
     */
    get inactiveSpriteAsset() {
        return this.data.inactiveSpriteAsset;
    }

    /**
     * Sets the frame to be used from the inactive sprite.
     *
     * @type {number}
     */
    set inactiveSpriteFrame(arg) {
        this._setValue('inactiveSpriteFrame', arg);
    }

    /**
     * Gets the frame to be used from the inactive sprite.
     *
     * @type {number}
     */
    get inactiveSpriteFrame() {
        return this.data.inactiveSpriteFrame;
    }

    /** @ignore */
    _setValue(name, value) {
        const data = this.data;
        const oldValue = data[name];
        data[name] = value;
        this.fire('set', name, oldValue, value);
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
            const isAdding = onOrOff === 'on';

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
        if (
            !tintColor ||
            !this._imageReference.hasComponent('element') ||
            this._imageReference.entity.element.type === ELEMENTTYPE_GROUP
        )
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
        if (
            !tintColor ||
            !this._imageReference.hasComponent('element') ||
            this._imageReference.entity.element.type === ELEMENTTYPE_GROUP
        )
            return;

        const color3 = toColor3(tintColor);
        const color = this._imageReference.entity.element.color;
        const opacity = this._imageReference.entity.element.opacity;

        if (color3.equals(color) && tintColor.a === opacity) return;

        this._tweenInfo = {
            startTime: now(),
            from: new Color(color.r, color.g, color.b, opacity),
            to: tintColor.clone(),
            lerpColor: new Color()
        };
    }

    _updateTintTween() {
        const elapsedTime = now() - this._tweenInfo.startTime;
        let elapsedProportion = this.fadeDuration === 0 ? 1 : elapsedTime / this.fadeDuration;
        elapsedProportion = math.clamp(elapsedProportion, 0, 1);

        if (Math.abs(elapsedProportion - 1) > 1e-5) {
            const lerpColor = this._tweenInfo.lerpColor;
            lerpColor.lerp(this._tweenInfo.from, this._tweenInfo.to, elapsedProportion);
            this._applyTintImmediately(
                new Color(lerpColor.r, lerpColor.g, lerpColor.b, lerpColor.a)
            );
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

export { ButtonComponent };
