import { AnimTargetValue } from '../../../../src/framework/anim/evaluator/anim-target-value.js';
import { ANIM_LAYER_ADDITIVE, ANIM_LAYER_OVERWRITE } from '../../../../src/framework/anim/controller/constants.js';
import { expect } from 'chai';

describe('AnimTargetValue', () => {

    describe('#constructor', () => {

        it('instantiates correctly with an object', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            expect(animTargetValue).to.be.ok;
        });

    });

    describe('#setMask', () => {

        it('sets dirty to true if normalizeWeights is true', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.dirty = false;
            animTargetValue.setMask(0, 1);
            expect(animTargetValue.dirty).to.equal(true);
        });

        it('doesn\'t set dirty to true if normalizeWeights is false', () => {
            const mockComponent = {
                normalizeWeights: false,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.dirty = false;
            animTargetValue.setMask(0, 1);
            expect(animTargetValue.dirty).to.equal(false);
        });

        it('sets the indexed mask value to the given value', () => {
            const mockComponent = {
                normalizeWeights: false,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            expect(animTargetValue.mask[0]).to.equal(0);
            animTargetValue.setMask(0, 1);
            expect(animTargetValue.mask[0]).to.equal(1);
        });

        it('sets the previous mask values to 0 if normalizeWeights is true and the layers blend type is overwrite', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.mask[0] = 1;
            animTargetValue.setMask(1, 1);
            expect(animTargetValue.mask[0]).to.equal(0);
        });

        it('doesn\'t set the previous mask value to 0 if normalizeWeights is true and the layers blend type is additive', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.mask[0] = 1;
            animTargetValue.setMask(1, 1);
            expect(animTargetValue.mask[0]).to.equal(1);
        });

        it('doesn\'t set the previous mask value to 0 if normalizeWeights is false and the layers blend type is overwrite', () => {
            const mockComponent = {
                normalizeWeights: false,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.mask[0] = 1;
            animTargetValue.setMask(1, 1);
            expect(animTargetValue.mask[0]).to.equal(1);
        });

        it('doesn\'t set the previous mask value to 0 if normalizeWeights is false and the layers blend type is additive', () => {
            const mockComponent = {
                normalizeWeights: false,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.mask[0] = 1;
            animTargetValue.setMask(1, 1);
            expect(animTargetValue.mask[0]).to.equal(1);
        });

    });

    describe('#updateWeights', () => {

        it('sets the instances weights to that of the component\'s layers weights', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 2,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            expect(animTargetValue.weights).to.deep.equal(new Float32Array([0, 0]));
            animTargetValue.updateWeights();
            expect(animTargetValue.weights).to.deep.equal(new Float32Array([1, 2]));
        });

        it('sets the total weight to the sum of all the component\'s layers weights and their masks', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 2,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            expect(animTargetValue.totalWeight).to.equal(0);
            animTargetValue.updateWeights();
            expect(animTargetValue.totalWeight).to.equal(0);
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateWeights();
            expect(animTargetValue.totalWeight).to.equal(3);
        });

    });

    describe('#getWeight', () => {

        it('calls updateWeights if dirty is true', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            let updateWeightsCalled = false;
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.updateWeights = () => {
                updateWeightsCalled = true;
            };
            animTargetValue.dirty = true;
            animTargetValue.getWeight(0);
            expect(updateWeightsCalled).to.equal(true);
        });

        it('does not call updateWeights if dirty is false', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            let updateWeightsCalled = false;
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.updateWeights = () => {
                updateWeightsCalled = true;
            };
            animTargetValue.dirty = false;
            animTargetValue.getWeight(0);
            expect(updateWeightsCalled).to.equal(false);
        });

        it('returns 0 when the indexed mask is 0', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.mask[0] = 0;
            expect(animTargetValue.getWeight(0)).to.equal(0);
        });

        it('returns 1 when the indexed mask is 1', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.mask[0] = 1;
            expect(animTargetValue.getWeight(0)).to.equal(1);
        });

        it('returns 0 when normalizeWeights is true and totalWeight is 0', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.totalWeight = 0;
            animTargetValue.mask[0] = 1;
            animTargetValue.dirty = false;
            const weight = animTargetValue.getWeight(0);
            expect(weight).to.equal(0);
        });

        it('returns a normalized weight when normalizeWeights is true and totalWeight is non 0', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 4,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.mask[0] = 1;
            animTargetValue.mask[1] = 1;
            animTargetValue.dirty = true;
            const weight = animTargetValue.getWeight(0);
            expect(weight).to.equal(0.2);
        });

        it('returns a weight when normalizeWeights is false and totalWeight is non 0', () => {
            const mockComponent = {
                normalizeWeights: false,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 4,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent);
            animTargetValue.mask[0] = 1;
            animTargetValue.mask[1] = 1;
            animTargetValue.dirty = true;
            const weight = animTargetValue.getWeight(0);
            expect(weight).to.equal(1);
        });

    });

    describe('#updateValue', () => {

        it('can set a vector', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_VEC3);
            animTargetValue.baseValue = [0, 0, 0];
            animTargetValue.setMask(0, 1);
            animTargetValue.updateValue(0, [1, 1, 1]);
            expect(animTargetValue.value).to.deep.equal([1, 1, 1]);
        });

        it('can set a normalized vector', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_VEC3);
            animTargetValue.baseValue = [0, 0, 0];
            animTargetValue.setMask(0, 1);
            animTargetValue.updateValue(0, [1, 1, 1]);
            expect(animTargetValue.value).to.deep.equal([1, 1, 1]);
        });

        it('can set a quat', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_QUAT);
            animTargetValue.baseValue = [0, 0, 0, 1];
            animTargetValue.setMask(0, 1);
            animTargetValue.updateValue(0, [1, 0, 0, 0]);
            expect(animTargetValue.value).to.deep.equal([1, 0, 0, 0]);
        });

        it('can set a normalized quat', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_QUAT);
            animTargetValue.baseValue = [0, 0, 0, 1];
            animTargetValue.setMask(0, 1);
            animTargetValue.updateValue(0, [1, 0, 0, 0]);
            expect(animTargetValue.value).to.deep.equal([1, 0, 0, 0]);
        });

        it('can blend two additive vectors together', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_VEC3);
            animTargetValue.baseValue = [0, 0, 0];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 1, 1]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [2, 2, 2]);
            expect(animTargetValue.value).to.deep.equal([3, 3, 3]);
        });

        it('can blend two additive vectors together with normalized weights', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_VEC3);
            animTargetValue.baseValue = [0, 0, 0];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 1, 1]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [2, 2, 2]);
            expect(animTargetValue.value).to.deep.equal([1.25, 1.25, 1.25]);
        });

        it('can blend two additive quats together', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_QUAT);
            animTargetValue.baseValue = [0, 0, 0, 1];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 0, 0, 0]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [0, 1, 0, 0]);
            expect(animTargetValue.value).to.deep.equal([0, 0, 1, 0]);
        });

        it('can blend two additive quats together with normalized weights', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_QUAT);
            animTargetValue.baseValue = [0, 0, 0, 1];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 0, 0, 0]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [0, 1, 0, 0]);
            expect(animTargetValue.value).to.deep.equal([
                0.4999999999999999,
                0.7071067811865475,
                0,
                0.4999999999999999
            ]);
        });


        it('can blend two overwrite vectors together', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_VEC3);
            animTargetValue.baseValue = [0, 0, 0];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 1, 1]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [2, 2, 2]);
            expect(animTargetValue.value).to.deep.equal([2, 2, 2]);
        });

        it('can blend two overwrite vectors together with normalized weights', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_VEC3);
            animTargetValue.baseValue = [0, 0, 0];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 1, 1]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [2, 2, 2]);
            expect(animTargetValue.value).to.deep.equal([2, 2, 2]);
        });

        it('can blend two overwrite quats together', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_QUAT);
            animTargetValue.baseValue = [0, 0, 0, 1];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 0, 0, 0]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [0, 1, 0, 0]);
            expect(animTargetValue.value).to.deep.equal([0, 1, 0, 0]);
        });

        it('can blend two overwrite quats together with normalized weights', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_QUAT);
            animTargetValue.baseValue = [0, 0, 0, 1];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 0, 0, 0]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [0, 1, 0, 0]);
            expect(animTargetValue.value).to.deep.equal([0, 1, 0, 0]);
        });

        it('can blend one additive and one overwrite vector together', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_VEC3);
            animTargetValue.baseValue = [0, 0, 0];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 1, 1]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [2, 2, 2]);
            expect(animTargetValue.value).to.deep.equal([2, 2, 2]);
        });

        it('can blend one additive and one overwrite vector together', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_VEC3);
            animTargetValue.baseValue = [0, 0, 0];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 1, 1]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [2, 2, 2]);
            expect(animTargetValue.value).to.deep.equal([2, 2, 2]);
        });

        it('can blend one additive and one overwrite vector together with normalized weights', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_VEC3);
            animTargetValue.baseValue = [0, 0, 0];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 1, 1]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [2, 2, 2]);
            expect(animTargetValue.value).to.deep.equal([2, 2, 2]);
        });

        it('can blend one additive and one overwrite quat together', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_QUAT);
            animTargetValue.baseValue = [0, 0, 0, 1];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 0, 0, 0]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [0, 1, 0, 0]);
            expect(animTargetValue.value).to.deep.equal([0, 1, 0, 0]);
        });

        it('can blend one additive and one overwrite quat together with normalized weights', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_QUAT);
            animTargetValue.baseValue = [0, 0, 0, 1];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 0, 0, 0]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [0, 1, 0, 0]);
            expect(animTargetValue.value).to.deep.equal([0, 1, 0, 0]);
        });

        it('can blend one overwrite and one additive vector together', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_VEC3);
            animTargetValue.baseValue = [0, 0, 0];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 1, 1]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [2, 2, 2]);
            expect(animTargetValue.value).to.deep.equal([3, 3, 3]);
        });

        it('can blend one overwrite and one additive vector together with normalized weights', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_VEC3);
            animTargetValue.baseValue = [0, 0, 0];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 1, 1]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [2, 2, 2]);
            expect(animTargetValue.value).to.deep.equal([1.25, 1.25, 1.25]);
        });

        it('can blend one overwrite and one additive quat together', () => {
            const mockComponent = {
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_QUAT);
            animTargetValue.baseValue = [0, 0, 0, 1];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 0, 0, 0]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [0, 1, 0, 0]);
            expect(animTargetValue.value).to.deep.equal([0, 0, 1, 0]);
        });

        it('can blend one overwrite and one additive quat together with normalized weights', () => {
            const mockComponent = {
                normalizeWeights: true,
                layers: [
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_OVERWRITE
                    },
                    {
                        weight: 1,
                        blendType: ANIM_LAYER_ADDITIVE
                    }
                ]
            };
            const animTargetValue = new AnimTargetValue(mockComponent, AnimTargetValue.TYPE_QUAT);
            animTargetValue.baseValue = [0, 0, 0, 1];
            animTargetValue.setMask(0, 1);
            animTargetValue.setMask(1, 1);
            animTargetValue.updateValue(0, [1, 0, 0, 0]);
            animTargetValue.counter++;
            animTargetValue.updateValue(1, [0, 1, 0, 0]);
            expect(animTargetValue.value).to.deep.equal([
                0.4999999999999999,
                0.7071067811865475,
                0,
                0.4999999999999999
            ]);
        });

    });

});
