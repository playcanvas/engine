// ***********    Initialize application   *******************
var canvas = document.getElementById("application-canvas");

// Create the application and start the update loop
var application = new pc.fw.Application(canvas);
application.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
application.setCanvasFillMode(pc.fw.FillMode.FILL_WINDOW);
application.setCanvasResolution(pc.fw.ResolutionMode.AUTO);

application.context.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

// Set the gravity for our rigid bodies
application.context.systems.rigidbody.setGravity(0, -9.8, 0);

// create a few materials for our objects
var white = createMaterial(new pc.Color(1,1,1));
var red = createMaterial(new pc.Color(1,0,0));
var green = createMaterial(new pc.Color(0,1,0));
var blue = createMaterial(new pc.Color(0,0,1));
var yellow = createMaterial(new pc.Color(1,1,0));

// ***********    Create our floor   *******************

var floor = new pc.fw.Entity();

// add a 'box' model
application.context.systems.model.addComponent(floor, {
    type: "box",
});

// make the floor white
floor.model.material = white;

// scale it
floor.setLocalScale(10, 1, 10);

// add a collision component
application.context.systems.collision.addComponent(floor, {
    type: "box",
    halfExtents: new pc.Vec3(5, 0.5, 5)
});

// add a rigidbody component so that other objects collide with it
application.context.systems.rigidbody.addComponent(floor, {
    type: "static",
    restitution: 0.5
});

// add the floor to the hierarchy
application.context.root.addChild(floor);

// ***********    Create lights   *******************

// make our scene prettier by adding a directional light
var light = new pc.fw.Entity();
application.context.systems.light.addComponent(light, {
    type: "directional",
    color: new pc.Color(1, 1, 1),
    castShadows: true,
    shadowResolution: 2048
});

// set the direction for our light
light.setLocalEulerAngles(45, 30, 0);

// Add the light to the hierarchy
application.context.root.addChild(light);

// ***********    Create camera    *******************

// Create an Entity with a camera component
var camera = new pc.fw.Entity();
application.context.systems.camera.addComponent(camera, {
    clearColor: new pc.Color(0.5, 0.5, 0.8),
    farClip: 50
});

// add the camera to the hierarchy
application.context.root.addChild(camera);

// Move the camera a little further away
camera.translate(0, 10, 15);
camera.lookAt(0, 0, 0);

// ***********    Create templates    *******************

// Create a template for a falling box
// It will have a model component of type 'box'...
var boxTemplate = new pc.fw.Entity();
application.context.systems.model.addComponent(boxTemplate, {
    type: "box",
    castShadows: true
});

// ... a collision component of type 'box'...
application.context.systems.collision.addComponent(boxTemplate, {
    type: "box",
    halfExtents: new pc.Vec3(0.5, 0.5, 0.5)
});

// ... and a rigidbody component of type 'dynamic' so that it is simulated
// by the physics engine
application.context.systems.rigidbody.addComponent(boxTemplate, {
    type: "dynamic",
    mass: 50,
    restitution: 0.5
});

// make the box red
boxTemplate.model.material = red;

// Create other shapes too for variety...

// A sphere...
var sphereTemplate = new pc.fw.Entity();
application.context.systems.model.addComponent(sphereTemplate, {
    type: "sphere",
    castShadows: true
});

application.context.systems.collision.addComponent(sphereTemplate, {
    type: "sphere",
    radius: 0.5
});

application.context.systems.rigidbody.addComponent(sphereTemplate, {
    type: "dynamic",
    mass: 50,
    restitution: 0.5
});

// make the sphere green
sphereTemplate.model.material = green;

// A capsule...
var capsuleTemplate = new pc.fw.Entity();
application.context.systems.model.addComponent(capsuleTemplate, {
    type: "capsule",
    castShadows: true
});

application.context.systems.collision.addComponent(capsuleTemplate, {
    type: "capsule",
    radius: 0.5,
    height: 2
});

application.context.systems.rigidbody.addComponent(capsuleTemplate, {
    type: "dynamic",
    mass: 50,
    restitution: 0.5
});

// make the capsule blue
capsuleTemplate.model.material = blue;

// A cylinder...
var cylinderTemplate = new pc.fw.Entity();
application.context.systems.model.addComponent(cylinderTemplate, {
    type: "cylinder",
    castShadows: true
});

application.context.systems.collision.addComponent(cylinderTemplate, {
    type: "cylinder",
    radius: 0.5,
    height: 1
});

application.context.systems.rigidbody.addComponent(cylinderTemplate, {
    type: "dynamic",
    mass: 50,
    restitution: 0.5
});

// make the cylinder yellow
cylinderTemplate.model.material = yellow;

// add all the templates to an array so that
// we can randomly spawn them
var templates = [boxTemplate, sphereTemplate, capsuleTemplate, cylinderTemplate];

// position our templates out of the view
templates.forEach(function (template) {
    application.context.root.addChild(template);
    template.setLocalPosition(500, 0, 0);

    // when we manually change the position of an Entity with a dynamic rigidbody
    // we need to call syncEntityToBody() so that the rigidbody will get the position
    // and rotation of the Entity.
    template.rigidbody.syncEntityToBody();
})

// ***********    Update Function   *******************

// initialize variables for our update function
var timer = 0;
var count = 40;

// Set an update function on the application's update event
application.on("update", function (dt) {
    // create a falling box every 0.2 seconds
    if (count > 0) {
        timer -= dt;
        if (timer <= 0) {
            count--;
            timer = 0.2;

            // Clone a random template and position it above the floor
            var template = templates[Math.floor(pc.math.random(0, templates.length))];
            var clone = template.clone();
            application.context.root.addChild(clone);
            clone.setLocalPosition(pc.math.random(-1,1), 10, pc.math.random(-1,1));

            clone.rigidbody.syncEntityToBody();
        }
    }

});
