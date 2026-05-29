import { BUTTON_TRANSITION_MODE_TINT, Color, Entity, Quat, Script, Vec2, Vec3, Vec4, XRTARGETRAY_POINTER } from 'playcanvas';

/** @import { Asset, XrInputSource } from 'playcanvas' */

// Pre-allocated vectors for performance
const tmpVec3A = new Vec3();
const tmpVec3B = new Vec3();
const tmpVec3C = new Vec3();
const tmpVec3D = new Vec3();
const tmpQuat = new Quat();

// Finger joint IDs for extension detection (pre-allocated to avoid GC pressure)
const FINGER_JOINTS = [
    { tip: 'index-finger-tip', meta: 'index-finger-metacarpal' },
    { tip: 'middle-finger-tip', meta: 'middle-finger-metacarpal' },
    { tip: 'ring-finger-tip', meta: 'ring-finger-metacarpal' },
    { tip: 'pinky-finger-tip', meta: 'pinky-finger-metacarpal' }
];

/**
 * Provides a hybrid WebXR menu system that supports Hand Tracking ("Palm Up" gesture),
 * Controller button toggle, and an always-visible camera-anchored mode for debug HUDs. The
 * menu automatically picks the right input mode and switches between hand-anchored,
 * controller-anchored, and camera-anchored positioning.
 *
 * This script uses PlayCanvas' UI system (Screen, Element, Button components) for rendering
 * the menu, providing proper text rendering and familiar button interaction patterns.
 *
 * This script should be attached to an entity in your scene. It creates menu buttons dynamically
 * based on the `menuItems` configuration. When an interactive item is activated, it fires the
 * corresponding app event.
 *
 * Items in `menuItems` come in two kinds:
 *
 * - **Interactive buttons** — declared with both `label` and `eventName`. Clickable; fire
 *   `app.fire(eventName)` when triggered.
 * - **Labels** — declared with only `label` (no `eventName`). Non-interactive. Render in the
 *   same stack but skip click/hover, and their text is dimmed via {@link XrMenu#labelTextOpacity}.
 *   Useful for value readouts that can be updated at runtime with {@link XrMenu#setItemLabel}.
 *
 * Features:
 *
 * - **Hand Tracking** — detects "open palm facing camera" gesture to show the menu anchored
 *   to the palm.
 * - **Controller mode** — toggle menu visibility with a configurable gamepad button, anchored
 *   to the controller.
 * - **Always-visible mode** ({@link XrMenu#alwaysVisible}) — bypasses palm/button toggling,
 *   keeps the menu visible for the full XR session, and follows the camera at a configurable
 *   offset ({@link XrMenu#followDistance}, {@link XrMenu#followOffset}). Useful for debug HUDs.
 * - **XR ray picking** — controller pointer rays drive hover via ray-vs-`worldCorners`
 *   intersection, and the trigger (gamepad button 0) fires clicks. Self-contained, does not
 *   rely on ElementInput's XR hover events.
 * - **Finger touch** — hand-tracking index-fingertip pokes are also supported on interactive
 *   buttons.
 * - **Runtime label updates** — {@link XrMenu#setItemLabel} changes the displayed text of any
 *   item (interactive or label-only) after the menu has been built. The new text is persisted
 *   into `menuItems` so it survives a future regeneration.
 * - Smooth following with configurable dampening.
 * - Fires `'xr:menu:active'` app event when menu visibility changes (for coordination with
 *   other scripts).
 *
 * @example
 * // Configure menu items via script attributes — mix interactive buttons with read-only labels:
 * menuItems: [
 *     { label: 'STATUS: idle' },                            // label-only row
 *     { label: 'Teleport', eventName: 'menu:teleport' },    // interactive
 *     { label: 'Settings', eventName: 'menu:settings' },
 *     { label: 'Exit',     eventName: 'xr:end' }
 * ]
 *
 * @example
 * // Update a label at runtime (e.g. show live values):
 * const xrMenu = menuEntity.script.xrMenu;
 * app.on('update', () => xrMenu.setItemLabel(0, `STATUS: ${currentStatus}`));
 *
 * @example
 * // Always-visible debug HUD anchored to the right of the eye line:
 * menuEntity.script.create(XrMenu, {
 *     properties: {
 *         menuItems: [ ... ],
 *         alwaysVisible: true,
 *         followDistance: 0.6,
 *         followOffset: new pc.Vec2(0.25, -0.15)
 *     }
 * });
 */
class XrMenu extends Script {
    static scriptName = 'xrMenu';

    /**
     * Array of menu item definitions. Each item should have a `label` (display text) and
     * `eventName` (app event to fire when activated).
     *
     * @type {Array<{label: string, eventName: string}>}
     * @attribute
     */
    menuItems = [];

    /**
     * Audio asset for button click sound.
     *
     * @type {Asset|null}
     * @attribute
     */
    clickSound = null;

    /**
     * Font asset for button text. Required for text rendering.
     *
     * @type {Asset|null}
     * @attribute
     */
    fontAsset = null;

    /**
     * Offset from the anchor point where the menu appears.
     * For hand tracking: Z is distance from palm center along the palm normal.
     * For controllers: Applied in controller-local space.
     *
     * @type {Vec3}
     * @attribute
     */
    menuOffset = new Vec3(0, 0, 0.06);

    /**
     * Vertical spacing between menu buttons in meters.
     *
     * @type {number}
     * @attribute
     * @range [0.001, 0.05]
     * @precision 0.001
     */
    buttonSpacing = 0.0025;

    /**
     * Width of each button in meters.
     *
     * @type {number}
     * @attribute
     * @range [0.02, 0.3]
     * @precision 0.01
     */
    buttonWidth = 0.075;

    /**
     * Height of each button in meters.
     *
     * @type {number}
     * @attribute
     * @range [0.01, 0.1]
     * @precision 0.001
     */
    buttonHeight = 0.015;

    /**
     * Font size for button text in UI pixels.
     *
     * @type {number}
     * @attribute
     * @range [4, 48]
     */
    fontSize = 8;

    /**
     * Overall scale multiplier for the entire menu.
     *
     * @type {number}
     * @attribute
     * @range [0.5, 2]
     * @precision 0.1
     */
    menuScale = 1.0;

    /**
     * How quickly the menu follows the anchor point. Higher values = snappier movement.
     *
     * @type {number}
     * @attribute
     * @range [1, 30]
     */
    followSpeed = 25;

    /**
     * Dot product threshold for detecting palm-up gesture. Higher values require the palm
     * to face more directly toward the camera.
     *
     * @type {number}
     * @attribute
     * @range [0.3, 0.95]
     * @precision 0.05
     */
    palmUpThreshold = 0.6;

    /**
     * Gamepad button index used to toggle the menu in controller mode.
     * Default is 4 (typically Y button on left controller, B on right).
     *
     * @type {number}
     * @attribute
     * @range [0, 10]
     */
    toggleButtonIndex = 4;

    /**
     * Which hand the menu should be attached to ('left' or 'right').
     *
     * @type {string}
     * @attribute
     */
    preferredHand = 'left';

    /**
     * Distance threshold for finger touch hover in meters.
     *
     * @type {number}
     * @attribute
     * @range [0.01, 0.1]
     * @precision 0.01
     */
    touchDistance = 0.05;

    /**
     * Cooldown time after button press before another press is allowed (seconds).
     *
     * @type {number}
     * @attribute
     * @range [0.1, 1.0]
     * @precision 0.1
     */
    pressCooldown = 0.3;

    /**
     * Background color of menu buttons. Default is a dark slate so white text reads cleanly.
     *
     * @type {Color}
     * @attribute
     */
    buttonColor = new Color(0.12, 0.14, 0.18, 0.85);

    /**
     * Color of menu buttons when hovered. Default matches the typical XR pointer-ray cyan so
     * "ray on button" reads as a single visual feedback loop.
     *
     * @type {Color}
     * @attribute
     */
    hoverColor = new Color(0.30, 0.65, 0.95, 1);

    /**
     * Color of menu buttons when pressed/activated.
     *
     * @type {Color}
     * @attribute
     */
    pressColor = new Color(0.55, 0.85, 1.0, 1);

    /**
     * Text color for button labels.
     *
     * @type {Color}
     * @attribute
     */
    textColor = new Color(0.95, 0.97, 1.0);

    /**
     * Opacity multiplier applied to text on label-only items (those declared without an
     * `eventName`). Used so interactive buttons read as the primary affordance and label rows
     * sit visually behind them. Range 0..1.
     *
     * @type {number}
     * @attribute
     * @range [0, 1]
     * @precision 0.05
     */
    labelTextOpacity = 0.65;

    /**
     * Optional texture asset for button backgrounds.
     *
     * @type {Asset|null}
     * @attribute
     */
    buttonTexture = null;

    /**
     * Duration of fade in/out animation in seconds.
     *
     * @type {number}
     * @attribute
     * @range [0, 1]
     * @precision 0.05
     */
    fadeDuration = 0.15;

    /**
     * When true, the menu is shown for the full duration of the XR session and follows the
     * camera, rather than being toggled by the palm-up gesture or controller button. Hand-tracking
     * finger-touch and controller-ray interaction still work. Useful for debug HUDs.
     *
     * @type {boolean}
     * @attribute
     */
    alwaysVisible = false;

    /**
     * Distance in meters in front of the camera to place the menu when {@link alwaysVisible} is on.
     *
     * @type {number}
     * @attribute
     * @range [0.2, 2]
     * @precision 0.05
     */
    followDistance = 0.6;

    /**
     * Lateral and vertical offset in meters applied in camera-local space when
     * {@link alwaysVisible} is on. `x` is positive-right, `y` is positive-up.
     *
     * @type {Vec2}
     * @attribute
     */
    followOffset = new Vec2(0, -0.2);

    // Internal state
    /** @type {Entity|null} */
    _menuContainer = null;

    /** @type {Entity|null} */
    _screenEntity = null;

    /** @type {Entity[]} */
    _buttons = [];

    /** @type {Set<XrInputSource>} */
    _inputSources = new Set();

    /** @type {boolean} */
    _menuVisible = false;

    /** @type {boolean} */
    _toggleButtonWasPressed = false;

    /** @type {Vec3} */
    _targetPosition = new Vec3();

    /** @type {Quat} */
    _targetRotation = new Quat();

    /** @type {Entity|null} */
    _hoveredButton = null;

    /** @type {Entity|null} */
    _pressedButton = null;

    /** @type {number} */
    _lastPressTime = 0;

    /** @type {XrInputSource|null} */
    _activeInputSource = null;

    /** @type {Entity|null} */
    _cameraEntity = null;

    /** @type {number} */
    _uiScale = 0.001; // Convert UI pixels to meters

    /** @type {number} */
    _currentOpacity = 0;

    /** @type {number} */
    _targetOpacity = 0;

    /** @type {boolean} */
    _followInitialized = false;

    /**
     * Per-input-source previous gamepad trigger (button 0) state, used to edge-detect "trigger pull"
     * during XR ray picking. WeakMap so entries clean up when the input source goes away.
     *
     * @type {WeakMap<XrInputSource, boolean>}
     * @private
     */
    _triggerWasPressed = new WeakMap();

    initialize() {
        if (!this.app.xr) {
            console.warn('XrMenu: XR is not available on this application');
            return;
        }

        // Find camera entity for palm detection
        this._cameraEntity = this.entity.findComponent('camera')?.entity || null;
        if (!this._cameraEntity) {
            // Try to find any camera in the scene
            this._cameraEntity = this.app.root.findComponent('camera')?.entity || null;
        }

        // Set up click sound (non-positional for UI feedback)
        if (this.clickSound) {
            this.entity.addComponent('sound', {
                positional: false
            });
            this.entity.sound?.addSlot('click', {
                asset: this.clickSound.id,
                volume: 0.5
            });
        }

        // Create menu container and UI
        this._createMenu();

        // Hide menu initially
        this._setMenuVisible(false);

        // Listen for XR input sources
        this.app.xr.input.on('add', this._onInputSourceAdd, this);
        this.app.xr.input.on('remove', this._onInputSourceRemove, this);

        // Listen for XR session end to clean up
        this.app.xr.on('end', this._onXrEnd, this);

        this.on('destroy', () => {
            this._onDestroy();
        });
    }

    _onDestroy() {
        if (this.app.xr) {
            this.app.xr.input.off('add', this._onInputSourceAdd, this);
            this.app.xr.input.off('remove', this._onInputSourceRemove, this);
            this.app.xr.off('end', this._onXrEnd, this);
        }

        // Destroy menu container
        if (this._menuContainer) {
            this._menuContainer.destroy();
            this._menuContainer = null;
        }

        this._buttons = [];
        this._inputSources.clear();
    }

    _onXrEnd() {
        this._setMenuVisible(false);
        this._inputSources.clear();
        this._activeInputSource = null;
        this._followInitialized = false;
    }

    /**
     * Updates the displayed text of a menu item by index. Works for both interactive buttons
     * and label-only items (those declared without an `eventName`). The caller controls casing —
     * the text is written verbatim.
     *
     * @param {number} index - Index into the `menuItems` array passed at construction.
     * @param {string} text - New display text.
     * @returns {boolean} True if the item was found and updated, false otherwise.
     */
    setItemLabel(index, text) {
        // Persist the new text into menuItems so it survives a future _generateButtons call,
        // and so the *first* _generateButtons (which may run after this method when
        // setItemLabel is called synchronously after script.create) picks up the updated label
        // instead of the placeholder originally passed in menuItems.
        const item = this.menuItems[index];
        if (item) item.label = text;

        const entity = this._buttons[index];
        if (!entity) return false;

        // Prefer the direct ref captured in menuData; fall back to children[0] for items that
        // were created before menuData.textElement was added (defensive — shouldn't happen).
        // @ts-ignore - menuData is a custom property attached in _createButton
        const textElement = entity.menuData?.textElement ?? entity.children[0]?.element;
        if (!textElement) return false;
        textElement.text = text;
        // @ts-ignore
        if (entity.menuData) entity.menuData.label = text;
        return true;
    }

    /**
     * @param {XrInputSource} inputSource - The input source that was added.
     * @private
     */
    _onInputSourceAdd(inputSource) {
        this._inputSources.add(inputSource);
    }

    /**
     * @param {XrInputSource} inputSource - The input source that was removed.
     * @private
     */
    _onInputSourceRemove(inputSource) {
        this._inputSources.delete(inputSource);
        if (this._activeInputSource === inputSource) {
            this._activeInputSource = null;
            this._setMenuVisible(false);
        }
    }

    /**
     * Creates the menu with PlayCanvas UI system.
     *
     * @private
     */
    _createMenu() {
        // Create a container entity for positioning
        this._menuContainer = new Entity('XrMenuContainer');
        this.app.root.addChild(this._menuContainer);

        // Create a world-space screen for UI
        this._screenEntity = new Entity('XrMenuScreen');
        this._screenEntity.addComponent('screen', {
            referenceResolution: new Vec2(1000, 1000),
            screenSpace: false,
            scaleBlend: 1
        });

        // Scale the screen to convert pixels to meters
        const scale = this._uiScale * this.menuScale;
        this._screenEntity.setLocalScale(scale, scale, scale);

        this._menuContainer.addChild(this._screenEntity);

        // Generate buttons from menuItems
        this._generateButtons();
    }

    /**
     * Generates menu buttons from the menuItems configuration.
     *
     * @private
     */
    _generateButtons() {
        if (!this._screenEntity) return;

        // Clear existing buttons
        for (const button of this._buttons) {
            button.destroy();
        }
        this._buttons = [];

        // Convert meter sizes to UI pixels
        const widthPx = this.buttonWidth / this._uiScale;
        const heightPx = this.buttonHeight / this._uiScale;
        const spacingPx = this.buttonSpacing / this._uiScale;

        // Create buttons from menuItems
        for (let i = 0; i < this.menuItems.length; i++) {
            const item = this.menuItems[i];
            if (!item || typeof item !== 'object') continue;

            const label = item.label || `Button ${i}`;
            const eventName = item.eventName || '';

            const button = this._createButton(label, eventName, i, widthPx, heightPx);
            if (button) {
                this._screenEntity.addChild(button);
                this._buttons.push(button);
            }
        }

        // Layout buttons vertically
        this._layoutButtons(heightPx, spacingPx);
    }

    /**
     * Creates a single menu button using PlayCanvas UI.
     *
     * @param {string} label - Display text for the button.
     * @param {string} eventName - Event to fire when button is activated.
     * @param {number} index - Index of the button in the menu.
     * @param {number} widthPx - Button width in pixels.
     * @param {number} heightPx - Button height in pixels.
     * @returns {Entity} The created button entity.
     * @private
     */
    _createButton(label, eventName, index, widthPx, heightPx) {
        const isLabel = !eventName;
        const button = new Entity(isLabel ? `MenuLabel_${index}` : `MenuButton_${index}`);

        // Add button component for interactivity (interactive items only). We keep TINT mode
        // (the only auto-color mode the engine ships) but set all three tints equal to the
        // base buttonColor, so the component's auto-tint is effectively a no-op. Visuals are
        // driven manually by _setButtonHover / _setButtonPress, which works reliably for both
        // XR ray picking and finger touch even when ElementInput's XR hover events don't fire.
        if (!isLabel) {
            button.addComponent('button', {
                active: true,
                transitionMode: BUTTON_TRANSITION_MODE_TINT,
                hoverTint: this.buttonColor,
                pressedTint: this.buttonColor,
                inactiveTint: this.buttonColor
            });
        }

        // Add element component for visual appearance (image type for button background)
        /** @type {Object} */
        const elementConfig = {
            type: 'image',
            anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
            pivot: new Vec2(0.5, 0.5),
            width: widthPx,
            height: heightPx,
            color: this.buttonColor,
            opacity: this.buttonColor.a,
            useInput: !isLabel,
            layers: [this.app.scene.layers.getLayerByName('UI')?.id ?? 0]
        };

        // Textured background only for interactive buttons; labels stay flat so they read as non-buttons
        if (!isLabel && this.buttonTexture?.resource) {
            elementConfig.textureAsset = this.buttonTexture.id;
            elementConfig.color = new Color(1, 1, 1, this.buttonColor.a); // Tint white to show texture
        }

        button.addComponent('element', elementConfig);

        // Store metadata
        // @ts-ignore - Adding custom property
        button.menuData = {
            label: label,
            eventName: eventName,
            index: index,
            isLabel: isLabel,
            /** @type {import('playcanvas').ElementComponent|null} */
            textElement: null // populated after the text child is created below
        };

        // Handle button click (interactive items only). We keep the click event as a fallback
        // for input paths that still work through ElementInput (e.g. desktop mouse during
        // pre-XR debugging). _onButtonClick has a cooldown guard, so double-firing with our
        // own ray-picking click is harmless.
        //
        // We deliberately do NOT subscribe to hoverstart/hoverend here: ElementInput's XR hover
        // events are unreliable in practice, and if they fire they'd update _hoveredButton
        // without applying any visual — fighting the ray-picking path that drives both. Hover
        // state in this script is owned entirely by _updateRayInteraction and _checkFingerTouch.
        if (!isLabel && button.button) {
            button.button.on('click', () => {
                this._onButtonClick(button);
            });
        }

        // Create text label as child
        const textEntity = new Entity('ButtonText');
        textEntity.addComponent('element', {
            type: 'text',
            text: label,
            anchor: new Vec4(0, 0, 1, 1),
            pivot: new Vec2(0.5, 0.5),
            margin: new Vec4(4, 4, 4, 4),
            fontSize: this.fontSize,
            color: this.textColor,
            fontAsset: this.fontAsset?.id ?? this._getDefaultFontAsset()?.id,
            autoWidth: false,
            autoHeight: false,
            wrapLines: false,
            alignment: new Vec2(0.5, 0.5)
        });
        button.addChild(textEntity);

        // Direct reference — avoids relying on children[0] indexing (cheap to mis-assume if a
        // future change adds a sibling element).
        // @ts-ignore - menuData is a custom property attached above
        button.menuData.textElement = textEntity.element;

        return button;
    }

    /**
     * Gets or creates a default font asset.
     *
     * @returns {Asset|null} The default font asset.
     * @private
     */
    _getDefaultFontAsset() {
        // Try to find an existing font in the asset registry
        const fonts = this.app.assets.filter(asset => asset.type === 'font');
        if (fonts.length > 0) {
            return fonts[0];
        }
        return null;
    }

    /**
     * Handles button click with visual feedback.
     *
     * @param {Entity} button - The clicked button.
     * @private
     */
    _onButtonClick(button) {
        // @ts-ignore
        const menuData = button.menuData;
        if (!menuData) return;

        // Debounce: avoid double-firing if multiple input paths (ray picking + ElementInput
        // click + finger touch) all detect the same press within pressCooldown.
        const now = Date.now() / 1000;
        if (now - this._lastPressTime < this.pressCooldown) return;
        this._lastPressTime = now;

        // Play click sound
        if (this.entity.sound) {
            this.entity.sound.play('click');
        }

        // Visual feedback - flash press color and scale
        this._setButtonPress(button, true);

        // Reset visual after short delay
        setTimeout(() => {
            this._setButtonPress(button, false);
        }, 150);

        // Fire the event
        if (menuData.eventName) {
            this.app.fire(menuData.eventName);
        }
    }

    /**
     * Sets press visual state on a button.
     *
     * @param {Entity} button - The button.
     * @param {boolean} pressed - Whether the button is pressed.
     * @private
     */
    _setButtonPress(button, pressed) {
        if (!button.element) return;

        // @ts-ignore
        button._isPressed = pressed;

        if (pressed) {
            button.element.color = this.pressColor;
            button.setLocalScale(0.95, 0.95, 1);
        } else {
            // Restore based on current hover state
            const isHovered = this._hoveredButton === button;
            if (isHovered) {
                button.element.color = this.hoverColor;
                button.setLocalScale(1.05, 1.05, 1);
            } else {
                button.element.color = this.buttonColor;
                button.setLocalScale(1, 1, 1);
            }
        }
    }

    /**
     * Sets hover visual state on a button.
     *
     * @param {Entity} button - The button to set hover state on.
     * @param {boolean} hovered - Whether the button is hovered.
     * @private
     */
    _setButtonHover(button, hovered) {
        if (!button.element) return;

        // Don't change visuals if button is currently pressed
        // @ts-ignore
        if (button._isPressed) return;

        if (hovered) {
            button.element.color = this.hoverColor;
            button.setLocalScale(1.05, 1.05, 1);
        } else {
            button.element.color = this.buttonColor;
            button.setLocalScale(1, 1, 1);
        }
    }

    /**
     * Lays out buttons vertically in the menu.
     *
     * @param {number} heightPx - Button height in pixels.
     * @param {number} spacingPx - Spacing between buttons in pixels.
     * @private
     */
    _layoutButtons(heightPx, spacingPx) {
        const totalHeight = (this._buttons.length - 1) * (heightPx + spacingPx) + heightPx;
        const startY = totalHeight / 2 - heightPx / 2;

        for (let i = 0; i < this._buttons.length; i++) {
            const button = this._buttons[i];
            button.setLocalPosition(0, startY - i * (heightPx + spacingPx), 0);
        }
    }

    /**
     * Sets menu visibility and fires the appropriate event.
     *
     * @param {boolean} visible - Whether the menu should be visible.
     * @private
     */
    _setMenuVisible(visible) {
        if (this._menuVisible === visible) return;

        this._menuVisible = visible;
        this._targetOpacity = visible ? 1 : 0;

        // Enable container immediately when showing (opacity will fade in)
        if (visible && this._menuContainer) {
            this._menuContainer.enabled = true;

            // Snap to current anchor position immediately (don't lerp from old position)
            if (this._activeInputSource) {
                const anchor = this._activeInputSource.hand ?
                    this._getPalmAnchor(this._activeInputSource) :
                    this._getControllerAnchor(this._activeInputSource);
                if (anchor) {
                    this._menuContainer.setPosition(anchor.position);
                    this._menuContainer.setRotation(anchor.rotation);
                }
            }
        }

        // Fire event for other scripts to coordinate (e.g., disable navigation while menu is open)
        this.app.fire('xr:menu:active', visible);

        // Reset hover state when hiding
        if (!visible) {
            if (this._hoveredButton) {
                this._setButtonHover(this._hoveredButton, false);
            }
            this._hoveredButton = null;
            this._pressedButton = null;
        }
    }

    /**
     * Updates the opacity of all menu elements.
     *
     * @param {number} opacity - Opacity value from 0 to 1.
     * @private
     */
    _updateMenuOpacity(opacity) {
        for (const button of this._buttons) {
            if (button.element) {
                button.element.opacity = opacity * this.buttonColor.a;
            }
            // Also update text opacity. Label-only items get a dim multiplier so the eye is drawn
            // to interactive buttons.
            const textChild = /** @type {Entity|undefined} */ (button.children[0]);
            if (textChild?.element) {
                // @ts-ignore - menuData is a custom property attached in _createButton
                const isLabel = button.menuData?.isLabel === true;
                textChild.element.opacity = opacity * (isLabel ? this.labelTextOpacity : 1);
            }
        }
    }

    /**
     * Toggles menu visibility.
     *
     * @private
     */
    _toggleMenuVisibility() {
        this._setMenuVisible(!this._menuVisible);
    }

    /**
     * Finds the preferred input source based on handedness setting.
     *
     * @returns {XrInputSource|null} The preferred input source or null.
     * @private
     */
    _findPreferredInput() {
        for (const inputSource of this._inputSources) {
            if (inputSource.handedness === this.preferredHand) {
                return inputSource;
            }
        }

        // Fallback to any available input
        for (const inputSource of this._inputSources) {
            if (inputSource.handedness !== 'none') {
                return inputSource;
            }
        }

        return null;
    }

    /**
     * Checks if the fingers are extended (open hand).
     * Measures the distance from fingertip to metacarpal (knuckle) -
     * when extended this is large (~8-10cm), when curled it's small (~3-5cm).
     *
     * @param {XrInputSource} inputSource - The hand input source.
     * @returns {boolean} True if fingers are extended.
     * @private
     */
    _areFingersExtended(inputSource) {
        const hand = inputSource.hand;
        if (!hand || !hand.tracking) return false;

        let extendedCount = 0;

        for (const finger of FINGER_JOINTS) {
            const tip = hand.getJointById(finger.tip);
            const meta = hand.getJointById(finger.meta);

            if (!tip || !meta) continue;

            // Distance from metacarpal (knuckle) to fingertip
            // Extended finger: ~8-10cm (0.08-0.10m)
            // Curled finger: ~3-5cm (0.03-0.05m)
            const tipToMeta = tip.getPosition().distance(meta.getPosition());

            // Threshold: finger is extended if tip is more than 6cm from knuckle
            if (tipToMeta > 0.06) {
                extendedCount++;
            }
        }

        // Require at least 3 fingers extended for "open hand"
        return extendedCount >= 3;
    }

    /**
     * Checks if the palm is facing the camera with an open hand gesture.
     *
     * @param {XrInputSource} inputSource - The hand input source.
     * @returns {boolean} True if palm is facing camera with open hand.
     * @private
     */
    _isPalmFacingCamera(inputSource) {
        // First check if fingers are extended (open hand)
        if (!this._areFingersExtended(inputSource)) {
            return false;
        }

        // Get palm normal using shared calculation
        const palmNormal = this._getPalmNormal(inputSource);
        if (!palmNormal) return false;

        // Get camera forward direction
        if (!this._cameraEntity) return false;

        const cameraForward = this._cameraEntity.forward;

        // Check if palm normal faces roughly toward camera (negative dot product)
        // We want the palm facing the user, so the normal should point toward the camera
        const dot = palmNormal.dot(cameraForward);

        // Negative dot means palm is facing camera
        return dot < -this.palmUpThreshold;
    }

    /**
     * Calculates the palm normal vector (pointing away from palm surface).
     *
     * @param {XrInputSource} inputSource - The hand input source.
     * @returns {Vec3|null} The palm normal or null.
     * @private
     */
    _getPalmNormal(inputSource) {
        const hand = inputSource.hand;
        if (!hand || !hand.tracking) return null;

        const wrist = hand.wrist;
        const middleMeta = hand.getJointById('middle-finger-metacarpal');
        const indexMeta = hand.getJointById('index-finger-metacarpal');
        const pinkyMeta = hand.getJointById('pinky-finger-metacarpal');

        if (!wrist || !middleMeta || !indexMeta || !pinkyMeta) return null;

        const wristPos = wrist.getPosition();
        const middlePos = middleMeta.getPosition();
        const indexPos = indexMeta.getPosition();
        const pinkyPos = pinkyMeta.getPosition();

        // Vector from wrist to middle finger base
        tmpVec3A.sub2(middlePos, wristPos);

        // Vector from index to pinky (across the palm)
        tmpVec3B.sub2(pinkyPos, indexPos);

        // Cross product gives palm normal
        tmpVec3C.cross(tmpVec3A, tmpVec3B).normalize();

        // Flip normal for left hand so it always points away from palm surface
        if (inputSource.handedness === 'left') {
            tmpVec3C.mulScalar(-1);
        }

        return tmpVec3C;
    }

    /**
     * Gets the palm anchor position and rotation for menu placement.
     *
     * Note: Returns references to reused internal Vec3/Quat objects for performance.
     * Callers must use the values immediately or copy them - do not store the references.
     *
     * @param {XrInputSource} inputSource - The hand input source.
     * @returns {{position: Vec3, rotation: Quat}|null} Anchor transform or null.
     * @private
     */
    _getPalmAnchor(inputSource) {
        const hand = inputSource.hand;
        if (!hand || !hand.tracking) return null;

        // Use middle-finger-phalanx-proximal (first knuckle) for positioning closer to palm center
        const middleProximal = hand.getJointById('middle-finger-phalanx-proximal');
        const middleMeta = hand.getJointById('middle-finger-metacarpal');
        if (!middleProximal || !middleMeta) return null;

        // Get palm normal (pointing away from palm surface, toward camera when palm is up)
        const palmNormal = this._getPalmNormal(inputSource);
        if (!palmNormal) return null;

        // Position at center of palm (halfway between metacarpal and proximal)
        this._targetPosition.lerp(middleMeta.getPosition(), middleProximal.getPosition(), 0.5);

        // Offset the menu along the palm normal (in front of palm)
        tmpVec3A.copy(palmNormal).mulScalar(this.menuOffset.z);
        this._targetPosition.add(tmpVec3A);

        // Menu should face the camera (full look-at, not just Y rotation)
        if (this._cameraEntity) {
            const cameraPos = this._cameraEntity.getPosition();
            tmpVec3A.sub2(cameraPos, this._targetPosition);

            if (tmpVec3A.lengthSq() > 0.001) {
                tmpVec3A.normalize();

                // Calculate yaw (Y rotation)
                const yaw = Math.atan2(tmpVec3A.x, tmpVec3A.z) * (180 / Math.PI);

                // Calculate pitch (X rotation) - tilt to face camera
                const pitch = -Math.asin(tmpVec3A.y) * (180 / Math.PI);

                this._targetRotation.setFromEulerAngles(pitch, yaw, 0);
            }
        }

        return {
            position: this._targetPosition,
            rotation: this._targetRotation
        };
    }

    /**
     * Gets the controller anchor position and rotation for menu placement.
     *
     * Note: Returns references to reused internal Vec3/Quat objects for performance.
     * Callers must use the values immediately or copy them - do not store the references.
     *
     * @param {XrInputSource} inputSource - The controller input source.
     * @returns {{position: Vec3, rotation: Quat}|null} Anchor transform or null.
     * @private
     */
    _getControllerAnchor(inputSource) {
        if (!inputSource.grip) return null;

        const position = inputSource.getPosition();
        const rotation = inputSource.getRotation();

        if (!position || !rotation) return null;

        // Apply offset in controller-local space
        this._targetPosition.copy(position);
        tmpVec3A.copy(this.menuOffset);
        rotation.transformVector(tmpVec3A, tmpVec3A);
        this._targetPosition.add(tmpVec3A);

        // Menu faces outward from controller
        this._targetRotation.copy(rotation);

        return {
            position: this._targetPosition,
            rotation: this._targetRotation
        };
    }

    /**
     * Checks for finger touch interaction with buttons.
     *
     * @param {XrInputSource} inputSource - The hand input source.
     * @private
     */
    _checkFingerTouch(inputSource) {
        const hand = inputSource.hand;
        if (!hand || !hand.tracking) return;

        // Get index finger tip position (using the opposite hand for interaction)
        // Find the other hand to use for touching
        let touchHand = null;
        for (const source of this._inputSources) {
            if (source !== inputSource && source.hand && source.hand.tracking) {
                touchHand = source.hand;
                break;
            }
        }

        if (!touchHand) return;

        const indexTip = touchHand.getJointById('index-finger-tip');
        if (!indexTip) return;

        const fingerPos = indexTip.getPosition();

        let closestButton = null;
        let closestDist = this.touchDistance;

        for (const button of this._buttons) {
            // @ts-ignore - menuData is a custom property attached in _createButton
            if (button.menuData?.isLabel) continue;
            const buttonPos = button.getPosition();
            const dist = fingerPos.distance(buttonPos);

            if (dist < closestDist) {
                closestDist = dist;
                closestButton = button;
            }
        }

        const now = Date.now() / 1000; // Current time in seconds
        const pressDist = this.touchDistance * 0.6; // Press threshold

        if (closestButton) {
            // Set hover state if this is a new hover
            if (this._hoveredButton !== closestButton) {
                // Clear previous hover
                if (this._hoveredButton) {
                    this._setButtonHover(this._hoveredButton, false);
                }
                this._hoveredButton = closestButton;
                this._setButtonHover(closestButton, true);
            }

            // Check for press (finger moving into button)
            // Only allow press if: within press distance, not already pressed, and cooldown elapsed
            if (closestDist < pressDist) {
                const cooldownElapsed = (now - this._lastPressTime) > this.pressCooldown;

                if (!this._pressedButton && cooldownElapsed) {
                    this._pressedButton = closestButton;
                    this._lastPressTime = now;
                    this._onButtonClick(closestButton);
                }
            } else if (this._pressedButton === closestButton && closestDist >= pressDist) {
                // Finger moved out of press threshold but is still hovering - clear pressed state
                this._pressedButton = null;
            }
        } else {
            // Finger fully exited hover zone - clear states and allow re-press
            if (this._hoveredButton) {
                this._setButtonHover(this._hoveredButton, false);
            }
            this._hoveredButton = null;
            this._pressedButton = null;
        }
    }

    /**
     * Updates hand tracking mode.
     *
     * @param {XrInputSource} inputSource - The hand input source.
     * @param {number} dt - Delta time.
     * @private
     */
    _updateHandMode(inputSource, dt) {
        // Check for palm-up gesture
        const palmFacing = this._isPalmFacingCamera(inputSource);

        if (palmFacing) {
            if (!this._menuVisible) {
                this._setMenuVisible(true);
            }

            // Check for finger touch interaction
            this._checkFingerTouch(inputSource);
        } else {
            if (this._menuVisible) {
                this._setMenuVisible(false);
            }
        }

        // Update anchor position while menu is visible OR still fading out
        if ((this._menuVisible || this._currentOpacity > 0) && this._menuContainer) {
            const anchor = this._getPalmAnchor(inputSource);
            if (anchor) {
                // Smooth interpolation
                tmpVec3A.lerp(
                    this._menuContainer.getPosition(),
                    anchor.position,
                    Math.min(1, this.followSpeed * dt)
                );
                this._menuContainer.setPosition(tmpVec3A);

                tmpQuat.slerp(
                    this._menuContainer.getRotation(),
                    anchor.rotation,
                    Math.min(1, this.followSpeed * dt)
                );
                this._menuContainer.setRotation(tmpQuat);
            }
        }
    }

    /**
     * Updates controller mode.
     *
     * @param {XrInputSource} inputSource - The controller input source.
     * @param {number} dt - Delta time.
     * @private
     */
    _updateControllerMode(inputSource, dt) {
        // Check for menu toggle button
        const gamepad = inputSource.gamepad;
        if (gamepad?.buttons?.[this.toggleButtonIndex]) {
            const pressed = gamepad.buttons[this.toggleButtonIndex].pressed;

            if (pressed && !this._toggleButtonWasPressed) {
                this._toggleMenuVisibility();
            }
            this._toggleButtonWasPressed = pressed;
        } else {
            // Reset toggle state if the gamepad or button is unavailable
            this._toggleButtonWasPressed = false;
        }

        // Update menu position while visible OR still fading out
        if ((this._menuVisible || this._currentOpacity > 0) && this._menuContainer) {
            const anchor = this._getControllerAnchor(inputSource);
            if (anchor) {
                // Smooth interpolation
                tmpVec3A.lerp(
                    this._menuContainer.getPosition(),
                    anchor.position,
                    Math.min(1, this.followSpeed * dt)
                );
                this._menuContainer.setPosition(tmpVec3A);

                tmpQuat.slerp(
                    this._menuContainer.getRotation(),
                    anchor.rotation,
                    Math.min(1, this.followSpeed * dt)
                );
                this._menuContainer.setRotation(tmpQuat);
            }
        }
    }

    update(dt) {
        if (!this.app.xr?.active) return;

        // Animate opacity fade
        if (this._currentOpacity !== this._targetOpacity) {
            const fadeSpeed = this.fadeDuration > 0 ? 1 / this.fadeDuration : 100;
            if (this._targetOpacity > this._currentOpacity) {
                this._currentOpacity = Math.min(this._targetOpacity, this._currentOpacity + fadeSpeed * dt);
            } else {
                this._currentOpacity = Math.max(this._targetOpacity, this._currentOpacity - fadeSpeed * dt);
            }
            this._updateMenuOpacity(this._currentOpacity);

            // Disable container when fully faded out
            if (this._currentOpacity <= 0 && this._menuContainer) {
                this._menuContainer.enabled = false;
            }
        }

        // Always-visible mode: pin to the camera and skip the palm-up / toggle-button gating.
        // Hand-tracking finger touch and custom controller ray picking still work.
        if (this.alwaysVisible) {
            if (!this._menuVisible) this._setMenuVisible(true);
            this._followCamera(dt);
            for (const source of this._inputSources) {
                if (source.hand && source.hand.tracking) {
                    this._checkFingerTouch(source);
                    break;
                }
            }
            this._updateRayInteraction();
            return;
        }

        // Find the preferred input source
        const inputSource = this._findPreferredInput();
        if (!inputSource) return;

        // Reset controller toggle state when input source changes
        if (this._activeInputSource !== inputSource) {
            this._toggleButtonWasPressed = false;
        }
        this._activeInputSource = inputSource;

        // Determine input mode and update accordingly
        if (inputSource.hand) {
            this._updateHandMode(inputSource, dt);
        } else if (inputSource.grip) {
            this._updateControllerMode(inputSource, dt);
        }
    }

    /**
     * Positions the menu container in front of the camera with smoothing. Used by
     * {@link alwaysVisible} mode.
     *
     * @param {number} dt - Delta time.
     * @private
     */
    _followCamera(dt) {
        const cam = this._cameraEntity;
        const container = this._menuContainer;
        if (!cam || !container) return;

        const camPos = cam.getPosition();
        const camRot = cam.getRotation();

        // Target: camPos + forward * distance + right * offset.x + up * offset.y
        tmpVec3A.copy(cam.forward).mulScalar(this.followDistance).add(camPos);
        tmpVec3B.copy(cam.right).mulScalar(this.followOffset.x);
        tmpVec3A.add(tmpVec3B);
        tmpVec3B.copy(cam.up).mulScalar(this.followOffset.y);
        tmpVec3A.add(tmpVec3B);

        // Snap on the first frame so the menu doesn't fly in from the world origin
        if (!this._followInitialized) {
            container.setPosition(tmpVec3A);
            container.setRotation(camRot);
            this._followInitialized = true;
            return;
        }

        const t = Math.min(1, this.followSpeed * dt);
        tmpVec3B.lerp(container.getPosition(), tmpVec3A, t);
        container.setPosition(tmpVec3B);

        tmpQuat.slerp(container.getRotation(), camRot, t);
        container.setRotation(tmpQuat);
    }

    /**
     * Picks interactive buttons by raycasting each tracked-pointer XR input source against the
     * menu's plane and bounds. Drives hover visuals via {@link _setButtonHover}, and edge-detects
     * the gamepad trigger (button 0) to fire {@link _onButtonClick}. Self-contained — does not
     * depend on ElementInput's XR support.
     *
     * @private
     */
    _updateRayInteraction() {
        if (!this._menuContainer || this._currentOpacity <= 0) return;

        let bestButton = null;
        let bestDist = Infinity;
        let pickingSource = null;

        for (const source of this._inputSources) {
            if (source.targetRayMode !== XRTARGETRAY_POINTER) continue;
            const origin = source.getOrigin();
            const direction = source.getDirection();
            if (!origin || !direction) continue;

            for (const button of this._buttons) {
                // @ts-ignore - menuData is a custom property attached in _createButton
                if (button.menuData?.isLabel) continue;
                if (!button.element) continue;

                // Use the element's actual world corners (BL, BR, TR, TL). This accounts for
                // the screen's internal Y-flip on world-space screens and any anchor/pivot
                // offset between the entity origin and the visual rectangle.
                const corners = button.element.worldCorners;
                const bl = corners[0];
                const br = corners[1];
                const tl = corners[3];

                // Width vector (BL -> BR) and height vector (BL -> TL), not normalised.
                tmpVec3A.sub2(br, bl);              // width vec
                tmpVec3B.sub2(tl, bl);              // height vec
                tmpVec3C.cross(tmpVec3A, tmpVec3B); // plane normal (length = w * h)

                const denom = tmpVec3C.dot(direction);
                if (Math.abs(denom) < 1e-6) continue; // ray parallel to plane

                tmpVec3D.sub2(bl, origin);
                const t = tmpVec3D.dot(tmpVec3C) / denom;
                if (t < 0 || t > bestDist) continue;

                // Hit point relative to BL
                tmpVec3D.copy(direction).mulScalar(t).add(origin).sub(bl);

                // Project onto the (un-normalised) width and height vectors.
                // For a point inside the rectangle:
                //   u = hit . widthVec   ∈ [0, widthVec.lengthSq]
                //   v = hit . heightVec  ∈ [0, heightVec.lengthSq]
                const u = tmpVec3D.dot(tmpVec3A);
                const v = tmpVec3D.dot(tmpVec3B);
                const widthSq = tmpVec3A.lengthSq();
                const heightSq = tmpVec3B.lengthSq();

                if (u >= 0 && u <= widthSq && v >= 0 && v <= heightSq) {
                    bestButton = button;
                    bestDist = t;
                    pickingSource = source;
                }
            }
        }

        // Hover transition — single owner of _hoveredButton.
        if (this._hoveredButton !== bestButton) {
            if (this._hoveredButton) this._setButtonHover(this._hoveredButton, false);
            if (bestButton) this._setButtonHover(bestButton, true);
            this._hoveredButton = bestButton;
        }

        // Edge-detect trigger pull per source; fire click only for the source currently pointing.
        for (const source of this._inputSources) {
            if (source.targetRayMode !== XRTARGETRAY_POINTER) continue;
            const triggerNow = !!source.gamepad?.buttons?.[0]?.pressed;
            const triggerPrev = this._triggerWasPressed.get(source) ?? false;
            if (source === pickingSource && bestButton && triggerNow && !triggerPrev) {
                this._onButtonClick(bestButton);
            }
            this._triggerWasPressed.set(source, triggerNow);
        }
    }
}

export { XrMenu };
