import { AnimStateGraph } from '../../../../src/framework/anim/state-graph/anim-state-graph.js';
import { expect } from 'chai';

describe('AnimStateGraph', function () {

    describe('#constructor', function () {

        it('instantiates correctly with data layers as an object', function () {
            const data = {
                'layers': {
                    '0': {
                        'name': 'Base',
                        'states': [0, 1],
                        'transitions': [0]
                    }
                },
                'states': {
                    '0': {
                        'name': 'START',
                        'speed': 1
                    },
                    '1': {
                        'name': 'New State',
                        'speed': 1,
                        'loop': true,
                        'defaultState': true
                    }
                },
                'transitions': {
                    '0': {
                        'from': 0,
                        'to': 1,
                        'conditions': {}
                    }
                },
                'parameters': {}
            };
            const animStateGraph = new AnimStateGraph(data);
            expect(animStateGraph).to.be.ok;
            expect(animStateGraph.layers[0].name).to.equal('Base');
            expect(animStateGraph.layers[0].states[0].name).to.equal('START');
            expect(animStateGraph.layers[0].states[1].name).to.equal('New State');
        });

        it('instantiates correctly with data layers as an array', function () {
            const data = {
                'layers': [
                    {
                        'name': 'Base',
                        'states': [
                            {
                                'name': 'START',
                                'speed': 1
                            },
                            {
                                'name': 'New State',
                                'speed': 1,
                                'loop': true,
                                'defaultState': true
                            }
                        ],
                        'transitions': [
                            {
                                'from': 0,
                                'to': 1,
                                'conditions': {}
                            }
                        ]
                    }
                ],
                'parameters': {}
            };
            const animStateGraph = new AnimStateGraph(data);
            expect(animStateGraph).to.be.ok;
            expect(animStateGraph.layers[0].name).to.equal('Base');
            expect(animStateGraph.layers[0].states[0].name).to.equal('START');
            expect(animStateGraph.layers[0].states[1].name).to.equal('New State');
        });

    });

});
