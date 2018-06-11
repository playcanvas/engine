// deprecated
// leave this empty
pc.extend(pc, function () {
    var AnimatorComponentData = function () {
    	this.enabled = true;
    };
    AnimatorComponentData = pc.inherits(AnimatorComponentData, pc.ComponentData);

    return {
        AnimatorComponentData: AnimatorComponentData
    };
}());
