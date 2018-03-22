pc.extend(pc, function () {
    /**
     * @component
     * @name pc.LayoutChildComponent
     * @description Create a new LayoutChildComponent
     * @class A LayoutChildComponent enables the Entity to control the sizing applied to it by its parent {@link pc.LayoutGroup}.
     * @param {pc.LayoutChildComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * TODO Add properties
     */
    var LayoutChildComponent = function LayoutChildComponent (system, entity) {

    };
    LayoutChildComponent = pc.inherits(LayoutChildComponent, pc.Component);

    pc.extend(LayoutChildComponent.prototype, {
        onRemove: function () {
            // TODO Implement
        }
    });

    // TODO Add properties

    return {
        LayoutChildComponent: LayoutChildComponent
    };
}());
