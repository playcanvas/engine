/**
 * Creates a material with the specified diffuse color
 */
function createMaterial (color) {
    var material = new pc.scene.PhongMaterial();
    material.diffuse = color;
    // we need to call material.update when we change its properties
    material.update()
    return material;
}
