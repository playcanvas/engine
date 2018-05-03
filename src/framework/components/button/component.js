pc.extend(pc, function () {
    var InteractivityState = {
        DEFAULT: 'DEFAULT',
        HOVER: 'HOVER',
        PRESSED: 'PRESSED'
    };

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
     * @property {pc.Entity} textEntity A reference to the entity to be used as the button label. The entity must have a TextElement component.'
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
        this._interactivityState = InteractivityState.DEFAULT;
        this._imageEntity = null;
        this._textEntity = null;

        this.on('set_imageEntity', this._onSetImageEntity, this);
        this.on('set_textEntity', this._onSetTextEntity, this);
        this.on('set_active', this._onSetActive, this);
    };
    ButtonComponent = pc.inherits(ButtonComponent, pc.Component);

    pc.extend(ButtonComponent.prototype, {
        _onSetImageEntity: function(name, oldGuid, newGuid) {
            if (oldGuid !== newGuid) {
                if (this._imageEntity) {
                    // TODO Unlisten to imageEntity
                    // TODO Reset imageEntity color
                }

                // TODO Is this the only way to resolve a guid to an entity?
                this._imageEntity = pc.app.root.findByGuid(newGuid);

                // TODO Listen for mouse/touch events from imageEntity
            }
        },

        _onSetTextEntity: function(name, oldGuid, newGuid) {
            if (oldGuid !== newGuid) {
                // TODO Is this the only way to resolve a guid to an entity?
                this._textEntity = pc.app.root.findByGuid(newGuid);

                // TODO Do we actually need the text reference?
            }
        },

        _onSetActive: function(name, oldValue, newValue) {
            if (oldValue !== newValue) {
                // TODO Set imageEntity tint based on InteractivityState
            }
        },

        onRemove: function () {
            this.off('set_active', this._onSetActive, this);
            this.off('set_imageEntity', this._onSetImageEntity, this);
            this.off('set_textEntity', this._onSetTextEntity, this);
        }
    });

    return {
        ButtonComponent: ButtonComponent
    };
}());
