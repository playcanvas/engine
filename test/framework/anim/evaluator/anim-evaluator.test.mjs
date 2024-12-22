import { expect } from 'chai';

import { DefaultAnimBinder } from '../../../../src/framework/anim/binder/default-anim-binder.js';
import { INTERPOLATION_LINEAR } from '../../../../src/framework/anim/constants.js';
import { AnimClip } from '../../../../src/framework/anim/evaluator/anim-clip.js';
import { AnimCurve } from '../../../../src/framework/anim/evaluator/anim-curve.js';
import { AnimData } from '../../../../src/framework/anim/evaluator/anim-data.js';
import { AnimEvaluator } from '../../../../src/framework/anim/evaluator/anim-evaluator.js';
import { AnimEvents } from '../../../../src/framework/anim/evaluator/anim-events.js';
import { AnimTrack } from '../../../../src/framework/anim/evaluator/anim-track.js';
import { GraphNode } from '../../../../src/scene/graph-node.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('AnimEvaluator', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    it('AnimEvaluator: update with clip blending', function () {
        // build the graph to be animated
        const parent = new GraphNode('parent');
        const child1 = new GraphNode('child1');
        const child2 = new GraphNode('child2');

        app.root.addChild(parent);
        parent.addChild(child1);
        child1.addChild(child2);
        // create curve
        const keys = new AnimData(1, [0, 1, 2]);
        const translations = new AnimData(3, [0, 0, 0, 1, 0, 0, 1, 0, 1]);
        const curvePath = {
            entityPath: ['child1'],
            component: 'graph',
            propertyPath: ['localPosition']
        };
        const curve = new AnimCurve([curvePath], 0, 0, INTERPOLATION_LINEAR);

        const events = new AnimEvents([
            {
                time: 0.75,
                name: 'event'
            }
        ]);

        // construct the animation track
        const track = new AnimTrack('test track', 2, [keys], [translations], [curve], events);

        let eventFired = false;
        // construct an animation clip
        const clip = new AnimClip(track, 0.0, 1.0, true, true, {
            fire: () => {
                eventFired = true;
            }
        });

        // construct the animation evaluator
        const animEvaluator = new AnimEvaluator(new DefaultAnimBinder(parent));
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
        expect(eventFired).to.equal(false);

        animEvaluator.update(1.0);
        expect(clip.time).to.equal(1.5);
        expect(child1.localPosition.x).to.equal(1.0);
        expect(child1.localPosition.y).to.equal(0);
        expect(child1.localPosition.z).to.equal(0.5);
        expect(eventFired).to.equal(true);

        // checked looped state (current time 0.5)
        animEvaluator.update(1.0);
        expect(clip.time).to.equal(0.5);
        expect(child1.localPosition.x).to.equal(0.5);
        expect(child1.localPosition.y).to.equal(0);
        expect(child1.localPosition.z).to.equal(0);
    });

    it('AnimEvaluator: update without clip blending', function () {
        // build the graph to be animated
        const parent = new GraphNode('parent');
        const child1 = new GraphNode('child1');
        const child2 = new GraphNode('child2');

        app.root.addChild(parent);
        parent.addChild(child1);
        child1.addChild(child2);
        // create curve
        const keys = new AnimData(1, [0, 1, 2]);
        const translations = new AnimData(3, [0, 0, 0, 1, 0, 0, 1, 0, 1]);
        const curvePath = {
            entityPath: ['child1'],
            component: 'graph',
            propertyPath: ['localPosition']
        };
        const curve = new AnimCurve([curvePath], 0, 0, INTERPOLATION_LINEAR);

        // clip with empty track
        const events = new AnimEvents([
            {
                time: 0.75,
                name: 'event'
            }
        ]);

        // construct the animation track
        const track = new AnimTrack('test track', 2, [keys], [translations], [curve], events);

        // construct an animation clip
        let eventFired = false;
        const clip = new AnimClip(track, 0.0, 1.0, true, true, {
            fire: () => {
                eventFired = true;
            }
        });

        // construct the animation track
        const emptyTrack = AnimTrack.EMPTY;
        // construct an animation clip
        const emptyClip = new AnimClip(emptyTrack, 0, 1.0, true, true, {
            fire: () => {
                eventFired = true;
            }
        });

        // construct the animation evaluator
        const animEvaluator = new AnimEvaluator(new DefaultAnimBinder(parent));
        animEvaluator.addClip(clip);
        animEvaluator.addClip(emptyClip);

        // check initial state
        animEvaluator.update(0, false);
        expect(clip.time).to.equal(0);

        animEvaluator.update(0.5, false);
        expect(clip.time).to.equal(0.5);
        expect(eventFired).to.equal(false);

        animEvaluator.update(1.0, false);
        expect(clip.time).to.equal(1.5);
        expect(eventFired).to.equal(true);

        // checked looped state (current time 0.5)
        animEvaluator.update(1.0, false);
        expect(clip.time).to.equal(0.5);
    });
});
