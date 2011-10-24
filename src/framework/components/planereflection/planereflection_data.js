pc.extend(pc.fw, function () {
    PlaneReflectionComponentData = function () {
    };
    PlaneReflectionComponentData.extendsFrom(pc.fw.ComponentData);
    
    return {
        PlaneReflectionComponentData: PlaneReflectionComponentData
    };
}());
editor.link.addComponentType("planereflection");