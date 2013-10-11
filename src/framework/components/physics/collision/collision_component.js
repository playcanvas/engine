pc.extend(pc.fw, function () {
    var CollisionComponent = function CollisionComponent (system, entity) {
        entity.collider = this;
    };
    CollisionComponent = pc.inherits(CollisionComponent, pc.fw.Component);
    
    pc.extend(CollisionComponent.prototype, {
    });

    return {
        CollisionComponent: CollisionComponent
    };
}());