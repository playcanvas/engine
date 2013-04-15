pc.extend(pc.input, function () {

    var Orientation = function () {
        pc.extend(this, pc.events);
    };
    
    Orientation.prototype.attach = function (window) {
        this.window = window;
        
        this.onOrientationEvent = this.onOrientationEvent.bind(this);
        
        this.window.addEventListener('deviceorientation', this.onOrientationEvent, false);
        this.window.addEventListener('MozOrientation', this.onOrientationEvent, false);
        
        this.window = null;
    };
    
    Orientation.prototype.detach = function () {
        this.window.removeEventListener('deviceorientation', this.onOrientationEvent);
        this.window.removeEventListener('MozOrientation', this.onOrientationEvent);
    };
    
    Orientation.prototype.onOrientationEvent = function (e) {
        // For FireFox 3.6+  
        if (!e.gamma && !e.beta) {  
          e.gamma = -(e.x * (180 / Math.PI));  
          e.beta = -(e.y * (180 / Math.PI));  
        }
        this.fire('deviceorientation', e);
    };

    return {
        Orientation: Orientation
    };
}());