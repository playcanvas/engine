Object.assign(pc, function () {
    var _schema = ['enabled'];

    /**
     * @private
     * @name pc.LayoutGroupComponentSystem
     * @description Create a new LayoutGroupComponentSystem
     * @classdesc Manages creation of {@link pc.LayoutGroupComponent}s.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var LayoutGroupComponentSystem = function LayoutGroupComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'layoutgroup';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.LayoutGroupComponent;
        this.DataType = pc.LayoutGroupComponentData;

        this.schema = _schema;

        this._reflowQueue = [];

        this.on('beforeremove', this._onRemoveComponent, this);

        // Perform reflow when running in the engine
        pc.ComponentSystem.on('postUpdate', this._onPostUpdate, this);
    };
    LayoutGroupComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    LayoutGroupComponentSystem.prototype.constructor = LayoutGroupComponentSystem;

    pc.Component._buildAccessors(pc.LayoutGroupComponent.prototype, _schema);

    Object.assign(LayoutGroupComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (data.enabled !== undefined) component.enabled = data.enabled;
            if (data.orientation !== undefined) component.orientation = data.orientation;
            if (data.reverseX !== undefined) component.reverseX = data.reverseX;
            if (data.reverseY !== undefined) component.reverseY = data.reverseY;
            if (data.alignment !== undefined) {
                if (data.alignment instanceof pc.Vec2){
                    component.alignment.copy(data.alignment);
                } else {
                    component.alignment.set(data.alignment[0], data.alignment[1]);
                }
                // force update
                component.alignment = component.alignment;
            }
            if (data.padding !== undefined) {
                if (data.padding instanceof pc.Vec4){
                    component.padding.copy(data.padding);
                } else {
                    component.padding.set(data.padding[0], data.padding[1], data.padding[2], data.padding[3]);
                }
                // force update
                component.padding = component.padding;
            }
            if (data.spacing !== undefined) {
                if (data.spacing instanceof pc.Vec2){
                    component.spacing.copy(data.spacing);
                } else {
                    component.spacing.set(data.spacing[0], data.spacing[1]);
                }
                // force update
                component.spacing = component.spacing;
            }
            if (data.widthFitting !== undefined) component.widthFitting = data.widthFitting;
            if (data.heightFitting !== undefined) component.heightFitting = data.heightFitting;
            if (data.wrap !== undefined) component.wrap = data.wrap;

            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
        },

        cloneComponent: function (entity, clone) {
            var layoutGroup = entity.layoutgroup;

            return this.addComponent(clone, {
                enabled: layoutGroup.enabled,
                orientation: layoutGroup.orientation,
                reverseX: layoutGroup.reverseX,
                reverseY: layoutGroup.reverseY,
                alignment: layoutGroup.alignment,
                padding: layoutGroup.padding,
                spacing: layoutGroup.spacing,
                widthFitting: layoutGroup.widthFitting,
                heightFitting: layoutGroup.heightFitting,
                wrap: layoutGroup.wrap
            });
        },

        scheduleReflow: function (component) {
            if (this._reflowQueue.indexOf(component) === -1) {
                this._reflowQueue.push(component);
            }
        },

        _onPostUpdate: function () {
            this._processReflowQueue();
        },

        _processReflowQueue: function () {
            if (this._reflowQueue.length === 0) {
                return;
            }

            // Sort in ascending order of depth within the graph (i.e. outermost first), so that
            // any layout groups which are children of other layout groups will always have their
            // new size set before their own reflow is calculated.
            this._reflowQueue.sort(function (componentA, componentB) {
                return componentA.entity.graphDepth < componentB.entity.graphDepth;
            });

            while (this._reflowQueue.length > 0) {
                // Note that we leave the current item in the queue while performing its reflow
                // and then remove it afterwards, rather than removing it first and then reflowing
                // it. This is safer because the item cannot re-enter the queue while it is
                // already in there (due to the check performed in the scheduleReflow() method).
                this._reflowQueue[0].reflow();
                this._reflowQueue.shift();
            }

            this._reflowQueue = [];
        },

        _onRemoveComponent: function (entity, component) {
            component.onRemove();
        }
    });

    return {
        LayoutGroupComponentSystem: LayoutGroupComponentSystem
    };
}());
