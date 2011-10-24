pc.graph.materialplugin.phong = {};

pc.graph.materialplugin.phong.isTransparent = function (material) {
    var parameters = material.getParameters();
    if (parameters["material_opacity"] !== undefined) {
        if (parameters["material_opacity"]._data < 1.0)
            return true;
    }
    if (parameters["texture_opacityMap"] !== undefined) {
        return true;
    }
    if (parameters["texture_diffuseOpacityMap"] !== undefined) {
        return true;
    }
    return false;
}

pc.graph.materialplugin.phong.generateStateKey = function (geometry) {
    var device = pc.gfx.Device.getCurrent();
    var currState = device.getCurrentState();
    var numDirs = pc.scene.LightNode.getNumEnabled(pc.scene.LightType.DIRECTIONAL);
    var numPnts = pc.scene.LightNode.getNumEnabled(pc.scene.LightType.POINT);
    var skinned = geometry.isSkinned();
    var key = "";
    if (skinned) key += "skin_";
    if (currState.fog) key += "fog_";
    if (currState.alphaTest) key += "atst_";
    key += numDirs + "dir_" + numPnts + "pnt";
    return key;
}

pc.graph.materialplugin.phong.getProgram = function (material, geometry) {
    var device = pc.gfx.Device.getCurrent();
    var currState = device.getCurrentState();
    var numDirs = pc.scene.LightNode.getNumEnabled(pc.scene.LightType.DIRECTIONAL);
    var numPnts = pc.scene.LightNode.getNumEnabled(pc.scene.LightType.POINT);
    var skinned = geometry.isSkinned();
    var parameters = material.getParameters();
    var options = {
        alphaTest:       currState.alphaTest,
        fog:             currState.fog,
        skin:            skinned,
        numDirectionals: numDirs,
        numPoints:       numPnts,
        diffuseMap:      (parameters["texture_diffuseMap"] !== undefined),
        specularMap:     (parameters["texture_specularMap"] !== undefined),
        emissiveMap:     (parameters["texture_emissiveMap"] !== undefined),
        opacityMap:      (parameters["texture_opacityMap"] !== undefined),
        bumpMap:         (parameters["texture_bumpMap"] !== undefined),
        normalMap:       (parameters["texture_normalMap"] !== undefined),
        parallaxMap:     (parameters["texture_parallaxMap"] !== undefined),
        sphereMap:       (parameters["texture_sphereMap"] !== undefined),
        cubeMap:         (parameters["texture_cubeMap"] !== undefined),
        lightMap:        (parameters["texture_lightMap"] !== undefined),
        shadowMap:       (parameters["texture_shadowMap"] !== undefined)
    };
    var library = device.getProgramLibrary();
    var program = library.getProgram("phong", options);
    return program;
}