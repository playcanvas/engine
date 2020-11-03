var CubemapRenderer = pc.createScript('cubemapRenderer');

CubemapRenderer.attributes.add('resolution', { type: 'number', default: 64 });
CubemapRenderer.attributes.add('mipmaps', { type: 'boolean', default: false });
CubemapRenderer.attributes.add('depth', { type: 'boolean', default: true });
CubemapRenderer.attributes.add('layerBaseName', { type: 'string', default: "CubeLayer" });

// initialize code called once per entity
CubemapRenderer.prototype.initialize = function () {

    // Create cubemap render target with specified resolution and mipmap generation
    var colorBuffer = new pc.Texture(this.app.graphicsDevice, {
        width: this.resolution,
        height: this.resolution,
        format: pc.PIXELFORMAT_RGBA8,
        cubemap: true,
        mipmaps: this.mipmaps,
        autoMipmap: this.mipmaps
    });
    colorBuffer.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
    colorBuffer.magFilter = pc.FILTER_LINEAR;

    this.cubeMap = colorBuffer;
    this.layers = [];

    // angles to render camera for all 6 faces
    var cameraRotations = [
        new pc.Quat().setFromEulerAngles(0, 90, 180),
        new pc.Quat().setFromEulerAngles(0, -90, 180),
        new pc.Quat().setFromEulerAngles(90, 0, 0),
        new pc.Quat().setFromEulerAngles(-90, 0, 0),
        new pc.Quat().setFromEulerAngles(0, 180, 180),
        new pc.Quat().setFromEulerAngles(0, 0, 180)
    ];

    // set up rendering for all 6 faces
    for (var i = 0; i < 6; i++) {

        // render target, connected to cubemap texture face
        var renderTarget = new pc.RenderTarget(this.app.graphicsDevice, colorBuffer, {
            depth: this.depth,
            face: i
        });

        var layerName = layerBaseName + i;
        var layer = this.app.scene.layers.getLayerByName(layerName);

        if (!layer) {
            console.error("CubemapRenderer: Layer with name ", layerName, " does not exist");
            continue;
        }

        // assign render target
        layer.renderTarget = renderTarget;

        // store ids of all layers
        this.layers.push(layer.id);

        // create a child entity with the camera for this face
        var e = new pc.Entity(layerName);
        e.addComponent('camera', {
            clearColor: new pc.Color(1, 1, 1),
            aspectRatio: 1,
            fov: 90,
            layers: [layer.id]
        });

        // add the camera as a child entity
        this.entity.addChild(e);

        // set up its rotation
        e.setRotation(cameraRotations[i]);
    }
};
