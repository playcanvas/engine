import { AnimBlendTree } from '../../../../src/framework/anim/controller/anim-blend-tree.js';
import { AnimBlendTree1D } from '../../../../src/framework/anim/controller/anim-blend-tree-1d.js';
import { AnimBlendTreeDirect } from '../../../../src/framework/anim/controller/anim-blend-tree-direct.js';
import { AnimBlendTreeCartesian2D } from '../../../../src/framework/anim/controller/anim-blend-tree-2d-cartesian.js';
import { AnimBlendTreeDirectional2D } from '../../../../src/framework/anim/controller/anim-blend-tree-2d-directional.js';
import { AnimState } from '../../../../src/framework/anim/controller/anim-state.js';
import { expect } from 'chai';

describe('AnimBlendTree', function () {
    const findParameter = () => {};
    const animState = new AnimState({ findParameter }, 'state', 1, true, null);
    const animBlendTree = new AnimBlendTree(animState, null, 'blendTree', 1, ['blendParam'], [
        {
            'name': 'child1',
            'point': 0.0
        },
        {
            'name': 'child2',
            'point': 1.0
        }
    ], false, animState._createTree, findParameter);

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            expect(animBlendTree).to.be.ok;
        });

    });

    describe('#getChild', function () {

        it('can retrieve a child by name', function () {
            expect(animBlendTree.getChild('child1').name).to.equal('child1');
            expect(animBlendTree.getChild('child2').name).to.equal('child2');
        });

        it('returns null when a child is not found', function () {
            expect(animBlendTree.getChild('child3')).to.equal(null);
        });

    });

    describe('#getNodeCount', function () {

        it('returns the count of children in the blend tree', function () {
            expect(animBlendTree.getNodeCount()).to.equal(2);
        });

    });

    describe('#updateParameterValues', function () {

        it('parameters are not set before it is called', function () {
            const params = {
                'param1': {
                    value: 'value1'
                },
                'param2': {
                    value: 'value2'
                }
            };
            const findParameter = (name) => {
                return params[name];
            };
            const animState = new AnimState({ findParameter }, 'state', 1, true, null);
            const animBlendTree = new AnimBlendTree(animState, null, 'blendTree', 1, ['param1', 'param2'], [], false, animState._createTree, findParameter);

            expect(animBlendTree._parameterValues[0]).to.not.be.equal('value1');
            expect(animBlendTree._parameterValues[1]).to.not.be.equal('value2');
        });

        it('can set any updated parameters in the blend tree', function () {
            const params = {
                'param1': {
                    value: 'value1'
                },
                'param2': {
                    value: 'value2'
                }
            };
            const findParameter = (name) => {
                return params[name];
            };
            const animState = new AnimState({ findParameter }, 'state', 1, true, null);
            const animBlendTree = new AnimBlendTree(animState, null, 'blendTree', 1, ['param1', 'param2'], [], false, animState._createTree, findParameter);

            animBlendTree.updateParameterValues();
            expect(animBlendTree._parameterValues).to.deep.equal(['value1', 'value2']);
            params.param2.value = 'value3';
            expect(animBlendTree._parameterValues[1]).to.equal('value2');
            animBlendTree.updateParameterValues();
            expect(animBlendTree._parameterValues[1]).to.equal('value3');
        });

        it('returns false when stored parameters are already up to date', function () {
            const params = {
                'param1': {
                    value: 'value1'
                },
                'param2': {
                    value: 'value2'
                }
            };
            const findParameter = (name) => {
                return params[name];
            };
            const animState = new AnimState({ findParameter }, 'state', 1, true, null);
            const animBlendTree = new AnimBlendTree(animState, null, 'blendTree', 1, ['param1', 'param2'], [], false, animState._createTree, findParameter);

            const result = animBlendTree.updateParameterValues();
            expect(result).to.equal(false);
        });

        it('returns true when stored parameters are already up to date', function () {
            const params = {
                'param1': {
                    value: 'value1'
                },
                'param2': {
                    value: 'value2'
                }
            };
            const findParameter = (name) => {
                return params[name];
            };
            const animState = new AnimState({ findParameter }, 'state', 1, true, null);
            const animBlendTree = new AnimBlendTree(animState, null, 'blendTree', 1, ['param1', 'param2'], [], false, animState._createTree, findParameter);

            let result = animBlendTree.updateParameterValues();
            expect(result).to.equal(false);
            result = animBlendTree.updateParameterValues();
            expect(result).to.equal(true);
        });

    });

});

describe('AnimBlendTree1D', function () {
    const params = {
        'blendParam': {
            value: 0.5
        }
    };
    const findParameter = (name) => {
        return params[name];
    };
    const animState = new AnimState({ findParameter }, 'state', 1, true, null);
    const animBlendTree = new AnimBlendTree1D(animState, null, 'blendTree', 1, ['blendParam'], [
        {
            'name': 'child1',
            'point': 0.0
        },
        {
            'name': 'child2',
            'point': 1.0
        }
    ], false, animState._createTree, findParameter);

    describe('#calculateWeights', function () {

        it('produces equal weights when the parameter is at the midpoint of both children', function () {
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(0.5);
            expect(animBlendTree.getChild('child2').weight).to.equal(0.5);
        });

        it('produces unequal weights when the parameter is not the midpoint of both children', function () {
            params.blendParam.value = 0.25;
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(0.75);
            expect(animBlendTree.getChild('child2').weight).to.equal(0.25);
        });

        it('produces correct results when a parameter is the same as a childs point', function () {
            params.blendParam.value = 1;
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(0);
            expect(animBlendTree.getChild('child2').weight).to.equal(1);
        });

    });
});

describe('AnimBlendTreeDirect', function () {
    const params = {
        'blendParam1': {
            value: 0.5
        },
        'blendParam2': {
            value: 0.5
        }
    };
    const findParameter = (name) => {
        return params[name];
    };
    const animState = new AnimState({ findParameter }, 'state', 1, true, null);
    const animBlendTree = new AnimBlendTreeDirect(animState, null, 'blendTree', 1, ['blendParam1', 'blendParam2'], [
        {
            'name': 'child1'
        },
        {
            'name': 'child2'
        }
    ], false, animState._createTree, findParameter);

    describe('#calculateWeights', function () {

        it('produces equal weights when the parameters are equal', function () {
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(0.5);
            expect(animBlendTree.getChild('child2').weight).to.equal(0.5);
        });

        it('produces unequal weights when the parameters are not equal', function () {
            params.blendParam1.value = 0.75;
            params.blendParam2.value = 0.25;
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(0.75);
            expect(animBlendTree.getChild('child2').weight).to.equal(0.25);
        });

        it('produces a zero weight for single parameters that are zero', function () {
            params.blendParam1.value = 1;
            params.blendParam2.value = 0;
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(1);
            expect(animBlendTree.getChild('child2').weight).to.equal(0);
        });

        it('produces zero weights when all parameters are zero', function () {
            params.blendParam1.value = 0;
            params.blendParam2.value = 0;
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(0);
            expect(animBlendTree.getChild('child2').weight).to.equal(0);
        });

    });

});

describe('AnimBlendTreeCartesian2D', function () {
    const params = {
        'blendParam1': {
            value: 0
        },
        'blendParam2': {
            value: 0
        }
    };
    const findParameter = (name) => {
        return params[name];
    };
    const animState = new AnimState({ findParameter }, 'state', 1, true, null);
    const animBlendTree = new AnimBlendTreeCartesian2D(animState, null, 'blendTree', 1, ['blendParam1', 'blendParam2'], [
        {
            'name': 'child1',
            point: [0, 1]
        },
        {
            'name': 'child2',
            point: [0, -1]
        }
    ], false, animState._createTree, findParameter);

    describe('#calculateWeights', function () {

        it('produces equal weights when the parameters are equal', function () {
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(0.5);
            expect(animBlendTree.getChild('child2').weight).to.equal(0.5);
        });

        it('produces unequal weights when the parameters are not equal', function () {
            params.blendParam2.value = 0.5;
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(0.75);
            expect(animBlendTree.getChild('child2').weight).to.equal(0.25);
        });

        it('produces a zero weight for single parameters that are zero', function () {
            params.blendParam2.value = 1;
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(1);
            expect(animBlendTree.getChild('child2').weight).to.equal(0);
        });

        it('produces a zero weights when all parameters are zero', function () {
            params.blendParam1.value = 0;
            params.blendParam2.value = 0;
            animBlendTree._children[0]._point = [0, 0];
            animBlendTree._children[1]._point = [0, 0];
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(0);
            expect(animBlendTree.getChild('child2').weight).to.equal(0);
        });

    });

});

describe('AnimBlendTreeDirectional2D', function () {
    const params = {
        'blendParam1': {
            value: 0
        },
        'blendParam2': {
            value: 0
        }
    };
    const findParameter = (name) => {
        return params[name];
    };
    const animState = new AnimState({ findParameter }, 'state', 1, true, null);
    const animBlendTree = new AnimBlendTreeDirectional2D(animState, null, 'blendTree', 1, ['blendParam1', 'blendParam2'], [
        {
            'name': 'child1',
            point: [0, 1]
        },
        {
            'name': 'child2',
            point: [0, -1]
        }
    ], false, animState._createTree, findParameter);

    describe('#calculateWeights', function () {

        it('produces equal weights when the parameters are equal', function () {
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(0.5);
            expect(animBlendTree.getChild('child2').weight).to.equal(0.5);
        });

        it('produces unequal weights when the parameters are not equal', function () {
            params.blendParam2.value = 0.5;
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(1);
            expect(animBlendTree.getChild('child2').weight).to.equal(0);
        });

        it('produces a zero weight for single parameters that are zero', function () {
            params.blendParam2.value = 1;
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(1);
            expect(animBlendTree.getChild('child2').weight).to.equal(0);
        });

        it('produces a zero weights when all parameters are zero', function () {
            params.blendParam1.value = 0;
            params.blendParam2.value = 0;
            animBlendTree._children[0]._point = [0, 0];
            animBlendTree._children[1]._point = [0, 0];
            animBlendTree.calculateWeights();
            expect(animBlendTree.getChild('child1').weight).to.equal(0);
            expect(animBlendTree.getChild('child2').weight).to.equal(0);
        });

    });

});
