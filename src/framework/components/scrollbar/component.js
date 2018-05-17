pc.extend(pc, function () {
    /**
     * @component
     * @name pc.ScrollbarComponent
     * @description Create a new ScrollbarComponent
     * @classdesc A ScrollbarComponent enables a group of entities to behave like a draggable scrollbar.
     * @param {pc.ScrollbarComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {pc.ORIENTATION} orientation Whether the scrollbar moves horizontally or vertically.
     * @property {Number} value The current position value of the scrollbar, in the range 0...1.
     * @property {Number} handleSize The size of the handle relative to the size of the track, in the range 0...1. For a vertical scrollbar, a value of 1 means that the handle will take up the full height of the track.
     * @property {pc.Entity} handleEntity The entity to be used as the scrollbar handle. This entity must have a Scrollbar component.
     */
    var ScrollbarComponent = function ScrollbarComponent(system, entity) {

    };
    ScrollbarComponent = pc.inherits(ScrollbarComponent, pc.Component);

    pc.extend(ScrollbarComponent.prototype, {
        onEnable: function () {

        },

        onDisable: function () {

        },

        onRemove: function () {

        }
    });

    return {
        ScrollbarComponent: ScrollbarComponent
    };
}());

/**
 * @event
 * @name pc.ScrollbarComponent#set:value
 * @description Fired whenever the scroll value changes.
 * @param {Number} value The current scroll value.
 */
