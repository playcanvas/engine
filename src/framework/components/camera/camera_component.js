pc.extend(pc.fw, function () {
    var CameraComponent = function CameraComponent(system, entity) {
        // Bind event to update hierarchy if camera node changes
        this.bind("set_camera", this.onSetCamera.bind(this));
        this.bind("set_clearColor", this.onSetClearColor.bind(this));
        this.bind("set_fov", this.onSetFov.bind(this));
        this.bind("set_orthoHeight", this.onSetOrthoHeight.bind(this));
        this.bind("set_nearClip", this.onSetNearClip.bind(this));
        this.bind("set_farClip", this.onSetFarClip.bind(this));
        this.bind("set_projection", this.onSetProjection.bind(this));
    };
    CameraComponent = pc.inherits(CameraComponent, pc.fw.Component);

    pc.extend(CameraComponent.prototype, {
        onSetCamera: function (name, oldValue, newValue) {
            // remove old camera node from hierarchy and add new one
            if (oldValue) {
                this.entity.removeChild(oldValue);
            }        
            this.entity.addChild(newValue);
        },
        onSetClearColor: function (name, oldValue, newValue) {
            var color = parseInt(newValue);
            this.data.camera.getClearOptions().color = [
                ((color >> 24) & 0xff) / 255.0,
                ((color >> 16) & 0xff) / 255.0,
                ((color >> 8) & 0xff) / 255.0,
                ((color) & 0xff) / 255.0
            ];
        },
        onSetFov: function (name, oldValue, newValue) {
            this.data.camera.setFov(newValue);
        },
        onSetOrthoHeight: function (name, oldValue, newValue) {
            this.data.camera.setOrthoHeight(newValue);
        },
        onSetNearClip: function (name, oldValue, newValue) {
            this.data.camera.setNearClip(newValue);
        },
        onSetFarClip: function (name, oldValue, newValue) {
            this.data.camera.setFarClip(newValue);
        },
        onSetProjection: function (name, oldValue, newValue) {
            this.data.camera.setProjection(newValue);
        }
    });

    

    return {
        CameraComponent: CameraComponent
    }; 
}());
