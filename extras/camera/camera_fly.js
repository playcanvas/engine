pc.script.attribute('speed', 'number', 10);
pc.script.attribute('fastSpeed', 'number', 20);

pc.script.create('flyCamera', function (app) {
    var FlyCamera = function (entity) {
        this.entity = entity;

        // Camera euler angle rotation around x and y axes
        var eulers = this.entity.getLocalEulerAngles()
        this.ex = eulers.x;
        this.ey = eulers.y;

        // Disabling the context menu stops the browser displaying a menu when
        // you right-click the page
        app.mouse.disableContextMenu();
        app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
        app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);

    };

    FlyCamera.prototype = {
        update: function (dt) {
            // Update the camera's orientation
            this.entity.setLocalEulerAngles(this.ex, this.ey, 0);

            var speed = this.speed;
            if (app.keyboard.isPressed(pc.KEY_SHIFT)) {
                speed = this.fastSpeed;
            }

            // Update the camera's position
            if (app.keyboard.isPressed(pc.KEY_UP) || app.keyboard.isPressed(pc.KEY_W)) {
                this.entity.translateLocal(0, 0, -speed*dt);
            } else if (app.keyboard.isPressed(pc.KEY_DOWN) || app.keyboard.isPressed(pc.KEY_S)) {
                this.entity.translateLocal(0, 0, speed*dt);
            }

            if (app.keyboard.isPressed(pc.KEY_LEFT) || app.keyboard.isPressed(pc.KEY_A)) {
                this.entity.translateLocal(-speed*dt, 0, 0);
            } else if (app.keyboard.isPressed(pc.KEY_RIGHT) || app.keyboard.isPressed(pc.KEY_D)) {
                this.entity.translateLocal(speed*dt, 0, 0);
            }
        },

        onMouseMove: function (event) {
            // Update the current Euler angles, clamp the pitch.
            this.ex -= event.dy / 5;
            this.ex = pc.math.clamp(this.ex, -90, 90);
            this.ey -= event.dx / 5;
        },

        onMouseDown: function (event) {
            // When the mouse button is clicked try and capture the pointer
            if (!pc.Mouse.isPointerLocked()) {
                app.mouse.enablePointerLock();
            }
        },
    };

   return FlyCamera;
});
