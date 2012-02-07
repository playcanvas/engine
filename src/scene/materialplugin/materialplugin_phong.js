pc.scene.materialplugin.phong = {};

pc.scene.materialplugin.phong.isTransparent = function (material) {
    var parameters = material.getParameters();
    if (parameters["material_opacity"] !== undefined) {
        if (parameters["material_opacity"]._data < 1.0)
            return true;
    }
    if (parameters["texture_opacityMap"] !== undefined) {
        return true;
    }
    if (parameters["texture_diffuseMap"] !== undefined) {
        if (parameters["texture_diffuseMap"]._data.getFormat() === pc.gfx.TextureFormat.RGBA)
            return true;
    }
    return false;
}

pc.scene.materialplugin.phong.generateStateKey = function (geometry) {
    var device = pc.gfx.Device.getCurrent();
    var currState = device.getCurrentState();
    var numDirs = pc.scene.LightNode.getNumEnabled(pc.scene.LightType.DIRECTIONAL);
    var numPnts = pc.scene.LightNode.getNumEnabled(pc.scene.LightType.POINT);
    var numSpts = pc.scene.LightNode.getNumEnabled(pc.scene.LightType.SPOT);
    var skinned = geometry.isSkinned();
    var key = '';
    if (skinned) key += 'skin_';
    if (currState.fog) key += 'fog_';
    if (currState.alphaTest) key += 'atst_';
    key += numDirs + 'dir_' + numPnts + 'pnt_' + numSpts + 'spt';
    return key;
}

pc.scene.materialplugin.phong.getProgram = function (material, geometry) {
    var device = pc.gfx.Device.getCurrent();
    var currState = device.getCurrentState();
    var numDirs = pc.scene.LightNode.getNumEnabled(pc.scene.LightType.DIRECTIONAL);
    var numPnts = pc.scene.LightNode.getNumEnabled(pc.scene.LightType.POINT);
    var numSpts = pc.scene.LightNode.getNumEnabled(pc.scene.LightType.SPOT);
    var skinned = geometry.isSkinned();
    var parameters = material.getParameters();
    var options = {
        alphaTest:         currState.alphaTest,
        fog:               currState.fog,
        skin:              skinned,
        numDirectionals:   numDirs,
        numPoints:         numPnts,
        numSpots:          numSpts,
        diffuseMap:        (parameters["texture_diffuseMap"] !== undefined),
        specularMap:       (parameters["texture_specularMap"] !== undefined),
        specularFactorMap: (parameters["texture_specularFactorMap"] !== undefined),
        emissiveMap:       (parameters["texture_emissiveMap"] !== undefined),
        opacityMap:        (parameters["texture_opacityMap"] !== undefined),
        normalMap:         (parameters["texture_normalMap"] !== undefined),
        parallaxMap:       (parameters["texture_parallaxMap"] !== undefined),
        sphereMap:         (parameters["texture_sphereMap"] !== undefined),
        cubeMap:           (parameters["texture_cubeMap"] !== undefined),
        lightMap:          (parameters["texture_lightMap"] !== undefined),
        shadowMap:         (parameters["texture_shadowMap"] !== undefined)
    };
    var library = device.getProgramLibrary();
    var program = library.getProgram("phong", options);
    return program;
}