pc.extend(pc, function () {
    /**
     * @name pc.CameraComponentSystem
     * @class Used to add and remove {@link pc.CameraComponent}s from Entities. It also holds an
     * array of all active cameras.
     * @description Create a new CameraComponentSystem
     * @param {pc.Application} app The Application
     * @extends pc.ComponentSystem
     */
    var CameraComponentSystem = function (app) {
        this.id = 'camera';
        this.description = "Renders the scene from the location of the Entity.";
        app.systems.add(this.id, this);

        this.ComponentType = pc.CameraComponent;
        this.DataType = pc.CameraComponentData;

        this.schema = [
            'enabled',
            'clearColorBuffer',
            'clearColor',
            'clearDepthBuffer',
            'clearStencilBuffer',
            'frustumCulling',
            'projection',
            'fov',
            'orthoHeight',
            'nearClip',
            'farClip',
            'priority',
            'rect',
            'camera',
            'aspectRatio',
            'horizontalFov',
            'model',
            'renderTarget',
            'stereo'
        ];

        // holds all the active camera components
        this.cameras = [ ];

        this.on('beforeremove', this.onBeforeRemove, this);
        this.on('remove', this.onRemove, this);

        pc.ComponentSystem.on('update', this.onUpdate, this);
    };
    CameraComponentSystem = pc.inherits(CameraComponentSystem, pc.ComponentSystem);

    pc.extend(CameraComponentSystem.prototype, {
        initializeComponentData: function (component, _data, properties) {
            properties = [
                'postEffects',
                'enabled',
                'model',
                'camera',
                'aspectRatio',
                'horizontalFov',
                'renderTarget',
                'clearColor',
                'fov',
                'orthoHeight',
                'nearClip',
                'farClip',
                'projection',
                'priority',
                'clearColorBuffer',
                'clearDepthBuffer',
                'clearStencilBuffer',
                'frustumCulling',
                'rect',
                'stereo'
            ];

            // duplicate data because we're modifying the data
            var data = {};
            properties.forEach(function (prop) {
                data[prop] = _data[prop];
            });

            if (data.clearColor && pc.type(data.clearColor) === 'array') {
                var c = data.clearColor;
                data.clearColor = new pc.Color(c[0], c[1], c[2], c[3]);
            }

            if (data.rect && pc.type(data.rect) === 'array') {
                var rect = data.rect;
                data.rect = new pc.Vec4(rect[0], rect[1], rect[2], rect[3]);
            }

            if (data.activate) {
                console.warn("WARNING: activate: Property is deprecated. Set enabled property instead.");
                data.enabled = data.activate;
            }

            data.camera = new pc.Camera();
            data._node = component.entity;

            data.postEffects = new pc.PostEffectQueue(this.app, component);

            CameraComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onBeforeRemove: function (entity, component) {
            this.removeCamera(component);
        },

        onRemove: function (entity, data) {
            data.camera = null;
        },

        onUpdate: function (dt) {
            var components = this.store;
            var cam;

            if (this.app.hmd) {
                var fd = this.app.hmd.getFrameData();
                for (var id in components) {
                    var component = components[id];
                    var componentData = component.data;
                    if (componentData.enabled && component.entity.enabled && componentData.stereo) {
                        cam = componentData.camera;

                        // Change WebVR near/far planes based on the stereo camera
                        // Can't have multiple stereo cameras with different planes
                        this.app.hmd.setClipPlanes(cam._nearClip, cam._farClip);

                        if (cam._node) {
                            cam._node.localTransform.copy(this.app.hmd.combinedViewInv);
                            cam._node.dirtyLocal = false;
                            cam._node.dirtyWorld = true;
                            cam._node.syncHierarchy();
                        }
                    }
                }
            }
        },

        addCamera: function (camera) {
            this.cameras.push(camera);
            this.sortCamerasByPriority();
        },

        removeCamera: function (camera) {
            var index = this.cameras.indexOf(camera);
            if (index >= 0) {
                this.cameras.splice(index, 1);
                this.sortCamerasByPriority();
            }
        },

        sortCamerasByPriority: function () {
            this.cameras.sort(function (a, b) {
                return a.priority - b.priority;
            });
        }
    });

    return {
        CameraComponentSystem: CameraComponentSystem
    };
}());
