var TrackingCamera = pc.createScript('trackingCamera');

TrackingCamera.attributes.add('target', { type: 'entity' });

// update code called every frame
TrackingCamera.prototype.postUpdate = function (dt) {
    if (this.target) {
        var targetPos = this.target.getPosition();
        this.entity.lookAt(targetPos);
    }
};
