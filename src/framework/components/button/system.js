Object.assign(pc, function () {
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
     * @constructor
     * @name pc.ButtonComponentSystem
     * @classdesc Manages creation of {@link pc.ButtonComponent}s.
     * @description Create a new ButtonComponentSystem
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var ButtonComponentSystem = function ButtonComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'button';
        this.app = app;

        this.ComponentType = pc.ButtonComponent;
        this.DataType = pc.ButtonComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onRemoveComponent, this);

        pc.ComponentSystem.bind('update', this.onUpdate, this);
    };
    ButtonComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    ButtonComponentSystem.prototype.constructor = ButtonComponentSystem;

    pc.Component._buildAccessors(pc.ButtonComponent.prototype, _schema);

    Object.assign(ButtonComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, data, _schema);
        },

        onUpdate: function (dt) {
            var components = this.store;

            for (var id in components) {
                var entity = components[id].entity;
                var component = entity.button;
                if (component.enabled && entity.enabled) {
                    component.onUpdate();
                }
            }
        },

        _onRemoveComponent: function (entity, component) {
            component.onRemove();
        }
    });

    return {
        ButtonComponentSystem: ButtonComponentSystem
    };
}());
