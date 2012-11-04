pc.extend(pc.fw, function () {
    var AudioListenerComponent = function () {
        var schema = [];
        this.assignSchema(schema);
    };
    AudioListenerComponent = pc.inherits(AudioListenerComponent, pc.fw.Component);

    pc.extend(AudioListenerComponent.prototype, {
        setCurrentListener: function () {
            if (this.entity.audiolistener) {
                this.system.current = this.entity;
                var position = this.system.current.getPosition();
                this.system.manager.listener.setPosition(position);
            }
        },
    });

    return {
        AudioListenerComponent: AudioListenerComponent
    };
}());