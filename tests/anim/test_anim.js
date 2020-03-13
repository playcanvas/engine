describe("pc.AnimController", function () {

    it("AnimController: looping", function () {
        // create curve
        var keys = new pc.AnimData(1, [0, 1, 2]);
        var translations = new pc.AnimData(3, [0, 0, 0, 1, 0, 0, 1, 0, 1]);
        var curve = new pc.AnimCurve(0, 0, pc.INTERPOLATION_LINEAR);

        // construct the target
        var target = new pc.AnimTarget("child1", 0, -1, -1);

        // construct the animation track
        var track = new pc.AnimTrack("test track", 2, [keys], [translations], [curve], [target]);

        // construct an animation clip
        var clip = new pc.AnimClip(track, 0.0, 1.0, true, true);

        // build the graph to be animated
        var parent = new pc.GraphNode("parent");
        var child1 = new pc.GraphNode("child1");
        var child2 = new pc.GraphNode("child2");
        parent.addChild(child1);
        child1.addChild(child2);

        // construct the animation controller
        var animController = new pc.AnimController(parent);
        animController.addClip(clip);

        // check initial state
        animController.update(0);
        equal(clip.time, 0);
        equal(child1.localPosition.x, 0);
        equal(child1.localPosition.y, 0);
        equal(child1.localPosition.z, 0);

        animController.update(0.5);
        equal(clip.time, 0.5);
        equal(child1.localPosition.x, 0.5);
        equal(child1.localPosition.y, 0);
        equal(child1.localPosition.z, 0);

        animController.update(1.0);
        equal(clip.time, 1.5);
        equal(child1.localPosition.x, 1.0);
        equal(child1.localPosition.y, 0);
        equal(child1.localPosition.z, 0.5);

        // checked looped state (current time 0.5)
        animController.update(1.0);
        equal(clip.time, 0.5);
        equal(child1.localPosition.x, 0.5);
        equal(child1.localPosition.y, 0);
        equal(child1.localPosition.z, 0);
    });
});

