import { AnimNode } from '../../../../src/framework/anim/controller/anim-node.js';
import { AnimState } from '../../../../src/framework/anim/controller/anim-state.js';
import { expect } from 'chai';

describe('AnimNode', () => {

    describe('#constructor', () => {

        it('instantiates correctly', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNode = new AnimNode(animState, null, 'node', 1);
            expect(animNode).to.be.ok;
        });

    });

    describe('#name', () => {

        it('returns the name of the AnimNode', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNode = new AnimNode(animState, null, 'node', 1);
            expect(animNode.name).to.equal('node');
        });

    });

    describe('#parent', () => {

        it('returns the parent of the AnimNode', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNodeParent = new AnimNode(animState, null, 'parent', 1);
            const animNode = new AnimNode(animState, animNodeParent, 'node', 1);
            expect(animNode.parent).to.equal(animNodeParent);
        });

    });

    describe('#path', () => {

        it('returns the name of the AnimNode when it has no parent', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNode = new AnimNode(animState, null, 'node', 1);
            expect(animNode.path).to.equal('node');
        });

        it('returns a path representing a node and its hierarchy', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNodeParent = new AnimNode(animState, null, 'parent', 1);
            const animNode = new AnimNode(animState, animNodeParent, 'node', 1);
            expect(animNode.path).to.equal('parent.node');
        });

    });

    describe('#pointLength', () => {

        it('returns the correct point length when the point is 1 dimensional', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNode = new AnimNode(animState, null, 'node', 1);
            expect(animNode.pointLength).to.equal(1);
        });

        it('returns the correct point length when the point is 2 dimensional', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNode = new AnimNode(animState, null, 'node', [5, 2]);
            expect(animNode.pointLength).to.equal(Math.sqrt(5 * 5 + 2 * 2));
        });

    });

    describe('#weight', () => {

        it('can set the weight of the AnimNode', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNode = new AnimNode(animState, null, 'node', 1);
            animNode.weight = 0.5;
            expect(animNode._weight).to.equal(0.5);
        });

        it('can get the weight of the AnimNode when no parent is present', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNode = new AnimNode(animState, null, 'node', 1);
            expect(animNode.parent).to.equal(null);
            expect(animNode.weight).to.equal(1.0);
        });

        it('can get the correct weight of the AnimNode when a parent is present', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNodeParent = new AnimNode(animState, null, 'parent', 1);
            animNodeParent.weight = 0.5;
            const animNode = new AnimNode(animState, animNodeParent, 'node', 1);
            animNode.weight = 0.5;
            expect(animNode.parent).to.equal(animNodeParent);
            expect(animNode.weight).to.equal(0.25);
        });

    });

    describe('#normalizedWeight', () => {

        it('can get the normalized weight when the AnimNode\'s state total weight is non zero', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            animState.animations = [
                {
                    name: 'animation1',
                    weight: 2.5
                },
                {
                    name: 'animation2',
                    weight: 2.5
                }
            ];
            const animNode = new AnimNode(animState, null, 'node', 1);
            animNode.weight = 2.5;
            expect(animNode.normalizedWeight).to.equal(0.5);
        });

        it('can get the normalized weight when the AnimNode\'s state total weight is zero', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNode = new AnimNode(animState, null, 'node', 1);
            animNode.weight = 2.5;
            expect(animNode.normalizedWeight).to.equal(0);
        });

    });

    describe('#absoluteSpeed', () => {

        it('returns an absolue speed when speed is negative', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNode = new AnimNode(animState, null, 'node', 1, -5);
            expect(animNode.speed).to.equal(-5);
            expect(animNode.absoluteSpeed).to.equal(5);
        });

        it('returns an absolue speed when speed is positive', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNode = new AnimNode(animState, null, 'node', 1, 5);
            expect(animNode.speed).to.equal(5);
            expect(animNode.absoluteSpeed).to.equal(5);
        });

    });

    describe('#speed', () => {

        it('returns a speed value thats weighted by the weightedSpeed value', () => {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            const animNode = new AnimNode(animState, null, 'node', 1, 0.5);
            animNode.weightedSpeed = 0.5;
            expect(animNode.speed).to.equal(0.25);
        });

    });
});
