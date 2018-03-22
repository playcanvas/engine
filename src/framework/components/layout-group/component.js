pc.extend(pc, function () {
    /**
     * @component
     * @name pc.LayoutGroupComponent
     * @description Create a new LayoutGroupComponent
     * @class A LayoutGroupComponent enables the Entity to position and scale child {@link pc.ElementComponent}s according to configurable layout rules.
     * @param {pc.LayoutGroupComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * TODO Add properties
     */
    var LayoutGroupComponent = function LayoutGroupComponent (system, entity) {

    };
    LayoutGroupComponent = pc.inherits(LayoutGroupComponent, pc.Component);

    pc.extend(LayoutGroupComponent.prototype, {
        onRemove: function () {
            // TODO Implement
        }
    });

    // TODO Add properties

    return {
        LayoutGroupComponent: LayoutGroupComponent
    };
}());
