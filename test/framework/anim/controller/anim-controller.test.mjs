import { AnimController } from '../../../../src/framework/anim/controller/anim-controller.js';
import { Entity } from '../../../../src/framework/entity.js';
import { AnimComponentBinder } from '../../../../src/framework/components/anim/component-binder.js';
import { AnimEvaluator } from '../../../../src/framework/anim/evaluator/anim-evaluator.js';
import { Application } from '../../../../src/framework/application.js';
import { AnimTrack } from '../../../../src/framework/anim/evaluator/anim-track.js';
import { AnimData } from '../../../../src/framework/anim/evaluator/anim-data.js';
import { AnimCurve } from '../../../../src/framework/anim/evaluator/anim-curve.js';
import { INTERPOLATION_LINEAR } from '../../../../src/framework/anim/constants.js';
import { ANIM_LESS_THAN } from '../../../../src/framework/anim/controller/constants.js';
import { HTMLCanvasElement } from '@playcanvas/canvas-mock';
import { expect } from 'chai';

describe('AnimController', function () {

    let app;
    let controller;

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);
        const states = [
            {
                name: 'START'
            },
            {
                name: 'Initial State'
            },
            {
                name: 'Other State 1'
            },
            {
                name: 'Other State 2'
            }
        ];
        const transitions = [
            {
                'from': 'START',
                'to': 'Initial State'
            },
            {
                'from': 'Other State 1',
                'to': 'Other State 2',
                priority: 2,
                'conditions': [
                    {
                        'parameterName': 'param',
                        'predicate': ANIM_LESS_THAN,
                        'value': 1
                    }
                ]
            },
            {
                'from': 'Other State 1',
                'to': 'Other State 2',
                priority: 1,
                'conditions': [
                    {
                        'parameterName': 'param',
                        'predicate': ANIM_LESS_THAN,
                        'value': 0.25
                    }
                ]
            },
            {
                'from': 'ANY',
                'to': 'Other State 2',
                priority: 3
            }
        ];
        const graph = new Entity();
        const animBinder = new AnimComponentBinder({ entity: graph }, graph, 'layer', {}, 0);
        animBinder.resolve = () => {};
        const animEvaluator = new AnimEvaluator(animBinder);
        controller = new AnimController(
            animEvaluator,
            states,
            transitions,
            {
                'param': {
                    'name': 'param',
                    'type': 'FLOAT',
                    'value': 0.5
                }
            }, // parameters
            true, // activate
            null, // event handler
            new Set() // consumed triggers
        );
        // add tracks
        const curves = [new AnimCurve(['path/to/entity'], 0, 0, INTERPOLATION_LINEAR)];
        const inputs = [new AnimData(1, [0, 1, 2])];
        const outputs = [new AnimData(3, [0, 0, 0, 1, 2, 3, 2, 4, 6])];
        controller.assignAnimation('Initial State', new AnimTrack('initialStateTrack', 4, inputs, outputs, curves), 1, true);
        controller.assignAnimation('Other State 1', new AnimTrack('otherState1Track', 4, inputs, outputs, curves), 1, true);
        controller.assignAnimation('Other State 2', new AnimTrack('otherState2Track', 4, inputs, outputs, curves), 1, true);
    });

    afterEach(function () {
        app.destroy();
    });

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            expect(controller).to.be.ok;
        });

    });

    describe('#_getActiveStateProgressForTime', function () {

        it('returns 1 when the controller is in the START state', function () {
            controller.activeState = 'START';
            expect(controller._getActiveStateProgressForTime(0)).to.equal(1);
        });

        it('returns 1 when the controller is in the ANY state', function () {
            controller.activeState = 'ANY';
            expect(controller._getActiveStateProgressForTime(0)).to.equal(1);
        });

        it('returns 1 when the controller is in the END state', function () {
            controller.activeState = 'END';
            expect(controller._getActiveStateProgressForTime(0)).to.equal(1);
        });

        it('returns a progress of 0 when the controller is at the start of a states timeline', function () {
            controller.update(0);
            expect(controller._getActiveStateProgressForTime(0)).to.equal(0);
        });

        it('returns a progress of 0.5 when the controller is halfway through a states duration', function () {
            controller.update(0);
            expect(controller._getActiveStateProgressForTime(2)).to.equal(0.5);
        });

        it('returns a progress of 1 when the controller is at the end of a states timeline', function () {
            controller.update(0);
            expect(controller._getActiveStateProgressForTime(4)).to.equal(1);
        });

    });

    describe('#_findTransitionsFromState', function () {

        it('returns the transitions for a given state', function () {
            expect(controller._findTransitionsFromState('START').length).to.equal(1);
            expect(controller._findTransitionsFromState('START')[0].to).to.equal('Initial State');
        });

        it('returns an empty array when a state has no transitions', function () {
            expect(controller._findTransitionsFromState('Initial State').length).to.equal(0);
        });

        it('returns transitions sorted by priority', function () {
            expect(controller._findTransitionsFromState('Other State 1').length).to.equal(2);
            expect(controller._findTransitionsFromState('Other State 1')[0].priority).to.equal(1);
            expect(controller._findTransitionsFromState('Other State 1')[1].priority).to.equal(2);
        });

    });

    describe('#_findTransitionsBetweenStates', function () {

        it('returns the transitions between two states', function () {
            expect(controller._findTransitionsBetweenStates('Other State 1', 'Other State 2').length).to.equal(2);
        });

        it('returns transitions sorted by priority', function () {
            expect(controller._findTransitionsBetweenStates('Other State 1', 'Other State 2').length).to.equal(2);
            expect(controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[0].priority).to.equal(1);
            expect(controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[1].priority).to.equal(2);
        });

    });

    describe('#_transitionHasConditionsMet', function () {

        it('returns true when no conditions are present', function () {
            expect(controller._transitionHasConditionsMet(controller._findTransitionsBetweenStates('START', 'Initial State')[0])).to.equal(true);
        });

        it('returns true when a condition is present and met', function () {
            expect(controller._transitionHasConditionsMet(controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[1])).to.equal(true);
        });

        it('returns false when a condition is present but not met', function () {
            expect(controller._transitionHasConditionsMet(controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[0])).to.equal(false);
        });

    });

    describe('#_findTransition', function () {

        it('returns a transition with the correct from state when from and to are supplied', function () {
            const transition = controller._findTransition('START', 'Initial State');
            expect(transition.from).to.equal('START');
        });

        it('returns a transition with the correct source state when from and to are supplied', function () {
            const transition = controller._findTransition('START', 'Initial State');
            expect(transition.from).to.equal('START');
        });

        it('returns a transition with the correct destination state when from and to are supplied', function () {
            const transition = controller._findTransition('START', 'Initial State');
            expect(transition.to).to.equal('Initial State');
        });

        it('returns a transition when the from param is given and the controller is not transitioning', function () {
            expect(controller._isTransitioning).to.equal(false);
            const transition = controller._findTransition('START');
            expect(transition.from).to.equal('START');
        });

        it('returns null when controller is transitioning and the interruption source is "none"', function () {
            controller._isTransitioning = true;
            expect(controller._isTransitioning).to.equal(true);
            expect(controller._transitionInterruptionSource).to.equal('NONE');
            const transition = controller._findTransition('START');
            expect(transition).to.equal(null);
        });

        it('returns null when controller is transitioning and the interruption source is "none"', function () {
            controller._isTransitioning = true;
            expect(controller._isTransitioning).to.equal(true);
            expect(controller._transitionInterruptionSource).to.equal('NONE');
            const transition = controller._findTransition('START');
            expect(transition).to.equal(null);
        });

        it('returns a transition from the previous state when controller is transitioning and the interruption source is "PREV_STATE"', function () {
            controller._isTransitioning = true;
            controller._transitionInterruptionSource = 'PREV_STATE';
            controller._previousStateName = 'Other State 1';
            expect(controller._isTransitioning).to.equal(true);
            expect(controller._transitionInterruptionSource).to.equal('PREV_STATE');
            const transition = controller._findTransition('START');
            expect(transition.from).to.equal('Other State 1');
        });

        it('returns a transition from the ANY state when controller is transitioning and the interruption source is "PREV_STATE" with no matching previous state', function () {
            controller._isTransitioning = true;
            controller._transitionInterruptionSource = 'PREV_STATE';
            expect(controller._isTransitioning).to.equal(true);
            expect(controller._transitionInterruptionSource).to.equal('PREV_STATE');
            const transition = controller._findTransition('START');
            expect(transition.from).to.equal('ANY');
        });

        it('returns a transition from the next state when controller is transitioning and the interruption source is "NEXT_STATE"', function () {
            controller._isTransitioning = true;
            controller._transitionInterruptionSource = 'NEXT_STATE';
            controller._activeStateName = 'Other State 1';
            expect(controller._isTransitioning).to.equal(true);
            expect(controller._transitionInterruptionSource).to.equal('NEXT_STATE');
            const transition = controller._findTransition('START');
            expect(transition.from).to.equal('Other State 1');
        });

        it('returns a transition from the ANY state when controller is transitioning and the interruption source is "NEXT_STATE" with no matching next state', function () {
            controller.update(0);
            controller._isTransitioning = true;
            controller._transitionInterruptionSource = 'NEXT_STATE';
            expect(controller._isTransitioning).to.equal(true);
            expect(controller._transitionInterruptionSource).to.equal('NEXT_STATE');
            const transition = controller._findTransition('START');
            expect(transition.from).to.equal('ANY');
        });

        it('returns a transition from the next state when controller is transitioning and the interruption source is "PREV_STATE_NEXT_STATE"', function () {
            controller._isTransitioning = true;
            controller._transitionInterruptionSource = 'PREV_STATE_NEXT_STATE';
            controller._activeStateName = 'Other State 1';
            expect(controller._isTransitioning).to.equal(true);
            expect(controller._transitionInterruptionSource).to.equal('PREV_STATE_NEXT_STATE');
            const transition = controller._findTransition('START');
            expect(transition.from).to.equal('Other State 1');
        });

        it('returns a transition from the previous state when controller is transitioning and the interruption source is "PREV_STATE_NEXT_STATE"', function () {
            controller._isTransitioning = true;
            controller._transitionInterruptionSource = 'PREV_STATE_NEXT_STATE';
            controller._previousStateName = 'Other State 1';
            expect(controller._isTransitioning).to.equal(true);
            expect(controller._transitionInterruptionSource).to.equal('PREV_STATE_NEXT_STATE');
            const transition = controller._findTransition('START');
            expect(transition.from).to.equal('Other State 1');
        });

        it('returns a transition from the ANY state when controller is transitioning and the interruption source is "PREV_STATE_NEXT_STATE"', function () {
            controller.update(0);
            controller._isTransitioning = true;
            controller._transitionInterruptionSource = 'PREV_STATE_NEXT_STATE';
            expect(controller._isTransitioning).to.equal(true);
            expect(controller._transitionInterruptionSource).to.equal('PREV_STATE_NEXT_STATE');
            const transition = controller._findTransition('START');
            expect(transition.from).to.equal('ANY');
        });

        it('returns a transition from the next state when controller is transitioning and the interruption source is "NEXT_STATE_PREV_STATE"', function () {
            controller._isTransitioning = true;
            controller._transitionInterruptionSource = 'NEXT_STATE_PREV_STATE';
            controller._activeStateName = 'Other State 1';
            expect(controller._isTransitioning).to.equal(true);
            expect(controller._transitionInterruptionSource).to.equal('NEXT_STATE_PREV_STATE');
            const transition = controller._findTransition('START');
            expect(transition.from).to.equal('Other State 1');
        });

        it('returns a transition from the previous state when controller is transitioning and the interruption source is "NEXT_STATE_PREV_STATE"', function () {
            controller._isTransitioning = true;
            controller._transitionInterruptionSource = 'NEXT_STATE_PREV_STATE';
            controller._previousStateName = 'Other State 1';
            controller._activeStateName = 'NO STATE';
            expect(controller._isTransitioning).to.equal(true);
            expect(controller._transitionInterruptionSource).to.equal('NEXT_STATE_PREV_STATE');
            const transition = controller._findTransition('START');
            expect(transition.from).to.equal('Other State 1');
        });

        it('returns a transition from the ANY state when controller is transitioning and the interruption source is "NEXT_STATE_PREV_STATE"', function () {
            controller.update(0);
            controller._isTransitioning = true;
            controller._transitionInterruptionSource = 'NEXT_STATE_PREV_STATE';
            expect(controller._isTransitioning).to.equal(true);
            expect(controller._transitionInterruptionSource).to.equal('NEXT_STATE_PREV_STATE');
            const transition = controller._findTransition('START');
            expect(transition.from).to.equal('ANY');
        });

    });

    describe('#updateStateFromTransition', function () {

        it('begins transitions to the destination state', function () {
            const transition = controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[0];
            controller.updateStateFromTransition(transition);
            expect(controller.activeStateName).to.equal('Other State 2');
        });

        it('sets the currently active state as the previous state', function () {
            const previousActiveState = controller.activeStateName;
            const transition = controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[0];
            controller.updateStateFromTransition(transition);
            expect(controller.previousStateName).to.equal(previousActiveState);
        });

        it('adds a new clip for the newly active state to the evaluator', function () {
            const transition = controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[0];
            controller.updateStateFromTransition(transition);
            expect(controller._animEvaluator.clips[0].track.name).to.equal('otherState2Track');
        });

        it('sets the controller _isTransitoning property to true', function () {
            const transition = controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[0];
            expect(controller._isTransitioning).to.equal(false);
            controller.updateStateFromTransition(transition);
            expect(controller._isTransitioning).to.equal(true);
        });

        it('sets the current transition time to 0', function () {
            const transition = controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[0];
            controller.updateStateFromTransition(transition);
            expect(controller._currTransitionTime).to.equal(0);
        });

        it('sets the time in state correctly if a transition offset is supplied', function () {
            const transition = controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[0];
            transition._transitionOffset = 0.5;
            controller.updateStateFromTransition(transition);
            expect(controller._timeInState).to.equal(2);
        });

        it('sets the time in state before correctly if a transition offset is supplied', function () {
            const transition = controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[0];
            transition._transitionOffset = 0.5;
            controller.updateStateFromTransition(transition);
            expect(controller._timeInStateBefore).to.equal(2);
        });

        it('sets the new clips time correctly if a transition offset is supplied', function () {
            const transition = controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[0];
            transition._transitionOffset = 0.5;
            controller.updateStateFromTransition(transition);
            expect(controller._animEvaluator.clips[0].time).to.equal(2);
        });

        it('sets the new clips time correctly if a transition offset is not supplied', function () {
            const transition = controller._findTransitionsBetweenStates('Other State 1', 'Other State 2')[0];
            controller.updateStateFromTransition(transition);
            expect(controller._animEvaluator.clips[0].time).to.equal(0);
        });

    });

});
