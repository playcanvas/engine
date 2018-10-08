Object.assign(pc, (function () {
    var dummySchema = [
        'enabled',
        { name: 'myEntity1', type: 'entity' },
        { name: 'myEntity2', type: 'entity' }
    ];

    var DummyComponentSystem = function DummyComponentSystem(app) {
        this.id = 'dummy';
        this.app = app;

        this.ComponentType = pc.DummyComponent;
        this.DataType = pc.DummyComponentData;
        this.schema = dummySchema;
    };
    DummyComponentSystem = pc.inherits(DummyComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.DummyComponent.prototype, dummySchema);

    DummyComponentSystem.prototype.initializeComponentData = function(component, data, properties) {
        DummyComponentSystem._super.initializeComponentData.call(this, component, data, dummySchema);
    };

    return {
        DummyComponentSystem: DummyComponentSystem
    };
}()));
