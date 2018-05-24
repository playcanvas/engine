Object.assign(pc, (function () {
    var _schema = [
        'enabled',
        'active',
        { name: 'imageEntity', type: 'entity' },
        { name: 'hitPadding', type: 'vec4' },
        'transitionMode',
        { name: 'hoverTint', type: 'rgba' },
        { name: 'pressedTint', type: 'rgba' },
        { name: 'inactiveTint', type: 'rgba' },
        'fadeDuration',
        'hoverSpriteAsset',
        'hoverSpriteFrame',
        'pressedSpriteAsset',
        'pressedSpriteFrame',
        'inactiveSpriteAsset',
        'inactiveSpriteFrame'
    ];

    /**
     * @private
     * @name pc.ButtonComponentSystem
     * @description Create a new ButtonComponentSystem
     * @classdesc Manages creation of {@link pc.ButtonComponent}s.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    function ButtonComponentSystem(app) {
        this.id = 'button';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.ButtonComponent;
        this.DataType = pc.ButtonComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onRemoveComponent, this);
    }
    ButtonComponentSystem = pc.inherits(ButtonComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.ButtonComponent.prototype, _schema);

    Object.assign(ButtonComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            ButtonComponentSystem._super.initializeComponentData.call(this, component, data, _schema);
        },

        _onRemoveComponent: function (entity, component) {
            component.onRemove();
        }
    });

    return {
        ButtonComponentSystem: ButtonComponentSystem
    };
}()));
