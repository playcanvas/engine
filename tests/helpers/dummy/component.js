Object.assign(pc, (function () {
    var DummyComponent = function DummyComponent() {};
    DummyComponent = pc.inherits(DummyComponent, pc.Component);

    return {
        DummyComponent: DummyComponent
    };
}()));
