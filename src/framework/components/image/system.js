pc.extend(pc, function () {
    /**
     * @name pc.ImageComponentSystem
     * @description Create a new ImageComponentSystem
     * @class Attach 2D text to an entity
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */

    var ImageComponentSystem = function ImageComponentSystem(app) {
        this.id = 'image';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.ImageComponent;
        this.DataType = pc.ImageComponentData;

        this.schema = [ 'enabled' ];

        this.material = null;
        this._shader = null;
        this.resolution = [1,1,1]; // canvas resolution
        this._defaultTexture = new pc.Texture(app.graphicsDevice, {width:4, height:4, format:pc.PIXELFORMAT_R8_G8_B8});

        this.app.graphicsDevice.on("resizecanvas", this._onResize, this);
    };
    ImageComponentSystem = pc.inherits(ImageComponentSystem, pc.ComponentSystem);

    pc.extend(ImageComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            this._createMaterials();

            if (data.asset !== undefined) component.asset = data.asset;
            if (data.material !== undefined) component.material = data.material;

            component._update();

            ImageComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        _createMaterials: function () {
            if (!this.material) {
                this.material = new pc.StandardMaterial();
            }
        },

        _onResize: function (width, height) {
            this.resolution[0] = width;
            this.resolution[1] = height;
        }
    });

    return {
        ImageComponentSystem: ImageComponentSystem
    }
}());
