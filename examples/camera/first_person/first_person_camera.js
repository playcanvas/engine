pc.script.create('first_person_camera', function (app) {
    var SPEED = 10;

    var FirstPersonCamera = function (entity) {
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

    FirstPersonCamera.prototype = {
        update: function (dt) {
            // Update the camera's orientation
            this.entity.setLocalEulerAngles(this.ex, this.ey, 0);

            // Update the camera's position
            if (app.keyboard.isPressed(pc.KEY_UP)) {
                this.entity.translateLocal(0, 0, -SPEED*dt);
            } else if (app.keyboard.isPressed(pc.KEY_DOWN)) {
                this.entity.translateLocal(0, 0, SPEED*dt);
            }

            if (app.keyboard.isPressed(pc.KEY_LEFT)) {
                this.entity.translateLocal(-SPEED*dt, 0, 0);
            } else if (app.keyboard.isPressed(pc.KEY_RIGHT)) {
                this.entity.translateLocal(SPEED*dt, 0, 0);
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

   return FirstPersonCamera;
});
