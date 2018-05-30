Object.assign(pc, (function () {
    var _schema = ['enabled'];

    /**
     * @constructor
     * @name pc.AudioListenerComponentSystem
     * @classdesc Component System for adding and removing {@link pc.AudioComponent} objects to Entities.
     * @description Create a new AudioListenerComponentSystem
     * @param {pc.Application} app The application managing this system.
     * @param {pc.SoundManager} manager A sound manager instance.
     * @extends pc.ComponentSystem
     */
    function AudioListenerComponentSystem(app, manager) {
        this.id = "audiolistener";
        this.description = "Specifies the location of the listener for 3D audio playback.";
        app.systems.add(this.id, this);

        this.ComponentType = pc.AudioListenerComponent;
        this.DataType = pc.AudioListenerComponentData;

        this.schema = _schema;

        this.manager = manager;
        this.current = null;

        pc.ComponentSystem.on('update', this.onUpdate, this);
    }
    AudioListenerComponentSystem = pc.inherits(AudioListenerComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.AudioListenerComponent.prototype, _schema);

    Object.assign(AudioListenerComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            properties = ['enabled'];

            AudioListenerComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onUpdate: function (dt) {
            if (this.current) {
                var position = this.current.getPosition();
                this.manager.listener.setPosition(position);

                var wtm = this.current.getWorldTransform();
                this.manager.listener.setOrientation(wtm);
            }
        }
    });

    return {
        AudioListenerComponentSystem: AudioListenerComponentSystem
    };
}()));
