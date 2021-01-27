describe("pc.AnimEvaluator", function () {

    it("AnimEvaluator: looping", function () {

        new pc.Application(document.createElement('canvas'));
        // build the graph to be animated
        var parent = new pc.GraphNode("parent");
        var child1 = new pc.GraphNode("child1");
        var child2 = new pc.GraphNode("child2");

        pc.app.root.addChild(parent);
        parent.addChild(child1);
        child1.addChild(child2);
        // create curve
        var keys = new pc.AnimData(1, [0, 1, 2]);
        var translations = new pc.AnimData(3, [0, 0, 0, 1, 0, 0, 1, 0, 1]);
        var curvePath = {
            entityPath: ['child1'],
            component: 'graph',
            propertyPath: ['localPosition']
        };
        var curve = new pc.AnimCurve([curvePath], 0, 0, pc.INTERPOLATION_LINEAR);

        // construct the animation track
        var track = new pc.AnimTrack("test track", 2, [keys], [translations], [curve]);

        // construct an animation clip
        var clip = new pc.AnimClip(track, 0.0, 1.0, true, true);

        // construct the animation evaluator
        var animEvaluator = new pc.AnimEvaluator(new pc.DefaultAnimBinder(parent));
        animEvaluator.addClip(clip);

        // check initial state
        animEvaluator.update(0);
        equal(clip.time, 0);
        equal(child1.localPosition.x, 0);
        equal(child1.localPosition.y, 0);
        equal(child1.localPosition.z, 0);

        animEvaluator.update(0.5);
        equal(clip.time, 0.5);
        equal(child1.localPosition.x, 0.5);
        equal(child1.localPosition.y, 0);
        equal(child1.localPosition.z, 0);

        animEvaluator.update(1.0);
        equal(clip.time, 1.5);
        equal(child1.localPosition.x, 1.0);
        equal(child1.localPosition.y, 0);
        equal(child1.localPosition.z, 0.5);

        // checked looped state (current time 0.5)
        animEvaluator.update(1.0);
        equal(clip.time, 0.5);
        equal(child1.localPosition.x, 0.5);
        equal(child1.localPosition.y, 0);
        equal(child1.localPosition.z, 0);
    });
});

