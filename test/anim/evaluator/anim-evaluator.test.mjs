import { INTERPOLATION_LINEAR } from '../../../src/anim/constants.js';
import { AnimCurve } from '../../../src/anim/evaluator/anim-curve.js';
import { AnimClip } from '../../../src/anim/evaluator/anim-clip.js';
import { AnimData } from '../../../src/anim/evaluator/anim-data.js';
import { AnimEvaluator } from '../../../src/anim/evaluator/anim-evaluator.js';
import { AnimTrack } from '../../../src/anim/evaluator/anim-track.js';
import { Application } from '../../../src/framework/app-base.js';
import { DefaultAnimBinder } from '../../../src/anim/binder/default-anim-binder.js';
import { GraphNode } from '../../../src/scene/graph-node.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';

describe('AnimEvaluator', function () {

    it('AnimEvaluator: looping', function () {
        const canvas = new HTMLCanvasElement(500, 500);
        const app = new Application(canvas);

        // build the graph to be animated
        var parent = new GraphNode('parent');
        var child1 = new GraphNode('child1');
        var child2 = new GraphNode('child2');

        app.root.addChild(parent);
        parent.addChild(child1);
        child1.addChild(child2);
        // create curve
        var keys = new AnimData(1, [0, 1, 2]);
        var translations = new AnimData(3, [0, 0, 0, 1, 0, 0, 1, 0, 1]);
        var curvePath = {
            entityPath: ['child1'],
            component: 'graph',
            propertyPath: ['localPosition']
        };
        var curve = new AnimCurve([curvePath], 0, 0, INTERPOLATION_LINEAR);

        // construct the animation track
        var track = new AnimTrack('test track', 2, [keys], [translations], [curve]);

        // construct an animation clip
        var clip = new AnimClip(track, 0.0, 1.0, true, true);

        // construct the animation evaluator
        var animEvaluator = new AnimEvaluator(new DefaultAnimBinder(parent));
        animEvaluator.addClip(clip);

        // check initial state
        animEvaluator.update(0);
        expect(clip.time).to.equal(0);
        expect(child1.localPosition.x).to.equal(0);
        expect(child1.localPosition.y).to.equal(0);
        expect(child1.localPosition.z).to.equal(0);

        animEvaluator.update(0.5);
        expect(clip.time).to.equal(0.5);
        expect(child1.localPosition.x).to.equal(0.5);
        expect(child1.localPosition.y).to.equal(0);
        expect(child1.localPosition.z).to.equal(0);

        animEvaluator.update(1.0);
        expect(clip.time).to.equal(1.5);
        expect(child1.localPosition.x).to.equal(1.0);
        expect(child1.localPosition.y).to.equal(0);
        expect(child1.localPosition.z).to.equal(0.5);

        // checked looped state (current time 0.5)
        animEvaluator.update(1.0);
        expect(clip.time).to.equal(0.5);
        expect(child1.localPosition.x).to.equal(0.5);
        expect(child1.localPosition.y).to.equal(0);
        expect(child1.localPosition.z).to.equal(0);
    });
});
