import { AnimTargetValue } from '../../../../src/framework/anim/evaluator/anim-target-value.js';
import { ANIM_LAYER_ADDITIVE, ANIM_LAYER_OVERWRITE } from '../../../../src/framework/anim/controller/constants.js';
import { expect } from 'chai';

describe('AnimTargetValue', function () {

    describe('#constructor', function () {

        it('instantiates correctly with an object', function () {
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

    describe('#setMask', function () {

        it('sets dirty to true if normalizeWeights is true', function () {
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

        it('doesn\'t set dirty to true if normalizeWeights is false', function () {
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

        it('sets the indexed mask value to the given value', function () {
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

        it('sets the previous mask values to 0 if normalizeWeights is true and the layers blend type is overwrite', function () {
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

        it('doesn\'t set the previous mask value to 0 if normalizeWeights is true and the layers blend type is additive', function () {
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

        it('doesn\'t set the previous mask value to 0 if normalizeWeights is false and the layers blend type is overwrite', function () {
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

        it('doesn\'t set the previous mask value to 0 if normalizeWeights is false and the layers blend type is additive', function () {
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

    describe('#updateWeights', function () {

        it('sets the instances weights to that of the component\'s layers weights', function () {
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

        it('sets the total weight to the sum of all the component\'s layers weights and their masks', function () {
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

    describe('#getWeight', function () {

        it('calls updateWeights if dirty is true', function () {
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

        it('does not call updateWeights if dirty is false', function () {
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

        it('returns 0 when the indexed mask is 0', function () {
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

        it('returns 1 when the indexed mask is 1', function () {
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

        it('returns 0 when normalizeWeights is true and totalWeight is 0', function () {
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

        it('returns a normalized weight when normalizeWeights is true and totalWeight is non 0', function () {
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

        it('returns a weight when normalizeWeights is false and totalWeight is non 0', function () {
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

    describe('#updateValue', function () {

        it('can set a vector', function () {
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

        it('can set a normalized vector', function () {
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

        it('can set a quat', function () {
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

        it('can set a normalized quat', function () {
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

        it('can blend two additive vectors together', function () {
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

        it('can blend two additive vectors together with normalized weights', function () {
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

        it('can blend two additive quats together', function () {
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

        it('can blend two additive quats together with normalized weights', function () {
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


        it('can blend two overwrite vectors together', function () {
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

        it('can blend two overwrite vectors together with normalized weights', function () {
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

        it('can blend two overwrite quats together', function () {
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

        it('can blend two overwrite quats together with normalized weights', function () {
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

        it('can blend one additive and one overwrite vector together', function () {
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

        it('can blend one additive and one overwrite vector together', function () {
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

        it('can blend one additive and one overwrite vector together with normalized weights', function () {
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

        it('can blend one additive and one overwrite quat together', function () {
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

        it('can blend one additive and one overwrite quat together with normalized weights', function () {
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

        it('can blend one overwrite and one additive vector together', function () {
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

        it('can blend one overwrite and one additive vector together with normalized weights', function () {
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

        it('can blend one overwrite and one additive quat together', function () {
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

        it('can blend one overwrite and one additive quat together with normalized weights', function () {
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
