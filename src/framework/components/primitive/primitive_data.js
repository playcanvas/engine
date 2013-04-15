pc.extend(pc.fw, function () {
    var PrimitiveComponentData = function () {
        // Serialized
        this.type = pc.shape.Type.BOX;
        this.color = "0xffffff";
        this.castShadows = false;
        this.receiveShadows = true;

        // Non-serialized
        this.material = null;
        this.model = null;
    };
    PrimitiveComponentData = pc.inherits(PrimitiveComponentData, pc.fw.ComponentData);
    
    return {
        PrimitiveComponentData: PrimitiveComponentData
    };
}());