Object.assign(pc, (function () {
    var DummyComponentData = function DummyComponentData() {};
    DummyComponentData = pc.inherits(DummyComponentData, pc.ComponentData);

    return {
        DummyComponentData: DummyComponentData
    };
}()));
