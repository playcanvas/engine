import { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from '../../../../src/scene/constants.js';
import { ELEMENTTYPE_GROUP } from '../../../../src/framework/components/element/constants.js';
import { FITTING_BOTH, FITTING_NONE, FITTING_SHRINK, FITTING_STRETCH } from '../../../../src/framework/components/layout-group/constants.js';
import { Application } from '../../../../src/framework/application.js';
import { Entity } from '../../../../src/framework/entity.js';
import { LayoutCalculator } from '../../../../src/framework/components/layout-group/layout-calculator.js';
import { Vec2 } from '../../../../src/core/math/vec2.js';
import { Vec4 } from '../../../../src/core/math/vec4.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';

/** @typedef {import('../../../../src/framework/components/element/component.js').ElementComponent} ElementComponent */

describe('LayoutCalculator', function () {
    /** @type {Application} */
    let app;
    /** @type {LayoutCalculator} */
    let calculator;
    let options;
    /** @type {ElementComponent[]} */
    let elements;
    /** @type {ElementComponent[]} */
    let mixedWidthElements;
    /** @type {ElementComponent[]} */
    let mixedHeightElements;
    /** @type {ElementComponent[]} */
    let mixedWidthElementsWithLayoutChildComponents;
    /** @type {ElementComponent[]} */
    let mixedHeightElementsWithLayoutChildComponents; // eslint-disable-line no-unused-vars

    const applyProperties = function (object, properties) {
        Object.keys(properties).forEach(function (propertyName) {
            object[propertyName] = properties[propertyName];
        });
    };

    const buildElement = function (properties) {
        const entity = new Entity('myEntity', app);
        const element = app.systems.element.addComponent(entity, { type: ELEMENTTYPE_GROUP });

        if (properties.layoutchild) {
            const layoutChildProperties = properties.layoutchild;
            const layoutChildComponent = app.systems.layoutchild.addComponent(entity);
            delete properties.layoutchild;
            applyProperties(layoutChildComponent, layoutChildProperties);
        }

        applyProperties(element, properties);

        app.root.addChild(entity);

        return element;
    };

    const buildElements = function (elementSpecs) {
        return elementSpecs.map(function (properties) {
            return buildElement(properties);
        });
    };

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);
        calculator = new LayoutCalculator();

        options = {
            orientation: ORIENTATION_HORIZONTAL,
            reverseX: false,
            reverseY: false,
            alignment: new Vec2(0, 0),
            padding: new Vec4(0, 0, 0, 0),
            spacing: new Vec2(0, 0),
            widthFitting: FITTING_NONE,
            heightFitting: FITTING_NONE,
            wrap: false,
            containerSize: new Vec2(500, 400)
        };

        mixedWidthElements = buildElements([
            {
                width: 100,
                height: 100,
                pivot: new Vec2(0, 0)
            },
            {
                width: 50,
                height: 100,
                pivot: new Vec2(0, 0)
            },
            {
                width: 100,
                height: 100,
                pivot: new Vec2(0, 0)
            },
            {
                width: 20,
                height: 100,
                pivot: new Vec2(0, 0)
            },
            {
                width: 30,
                height: 100,
                pivot: new Vec2(0, 0)
            }
        ]);

        mixedHeightElements = buildElements([
            {
                width: 100,
                height: 100,
                pivot: new Vec2(0, 0)
            },
            {
                width: 100,
                height: 50,
                pivot: new Vec2(0, 0)
            },
            {
                width: 100,
                height: 100,
                pivot: new Vec2(0, 0)
            },
            {
                width: 100,
                height: 20,
                pivot: new Vec2(0, 0)
            },
            {
                width: 100,
                height: 30,
                pivot: new Vec2(0, 0)
            }
        ]);

        mixedWidthElementsWithLayoutChildComponents = buildElements([
            {
                width: 100,
                height: 100,
                pivot: new Vec2(0, 0),
                layoutchild: {
                    minWidth: 50,
                    maxWidth: 200,
                    fitWidthProportion: 0.2
                }
            },
            {
                width: 50,
                height: 100,
                pivot: new Vec2(0, 0),
                layoutchild: {
                    minWidth: 25,
                    maxWidth: 100,
                    fitWidthProportion: 0.4
                }
            },
            {
                width: 100,
                height: 100,
                pivot: new Vec2(0, 0),
                layoutchild: {
                    minWidth: 50,
                    maxWidth: 200,
                    fitWidthProportion: 0.1
                }
            },
            {
                width: 20,
                height: 100,
                pivot: new Vec2(0, 0),
                layoutchild: {
                    minWidth: 10,
                    maxWidth: 40,
                    fitWidthProportion: 0.1
                }
            },
            {
                width: 30,
                height: 100,
                pivot: new Vec2(0, 0),
                layoutchild: {
                    minWidth: 15,
                    maxWidth: 60,
                    fitWidthProportion: 0.2
                }
            }
        ]);

        mixedHeightElementsWithLayoutChildComponents = buildElements([
            {
                width: 100,
                height: 100,
                pivot: new Vec2(0, 0),
                layoutchild: {
                    minHeight: 50,
                    maxHeight: 200,
                    fitHeightProportion: 0.2
                }
            },
            {
                width: 100,
                height: 50,
                pivot: new Vec2(0, 0),
                layoutchild: {
                    minHeight: 25,
                    maxHeight: 100,
                    fitHeightProportion: 0.4
                }
            },
            {
                width: 100,
                height: 100,
                pivot: new Vec2(0, 0),
                layoutchild: {
                    minHeight: 50,
                    maxHeight: 200,
                    fitHeightProportion: 0.1
                }
            },
            {
                width: 100,
                height: 20,
                pivot: new Vec2(0, 0),
                layoutchild: {
                    minHeight: 10,
                    maxHeight: 40,
                    fitHeightProportion: 0.1
                }
            },
            {
                width: 100,
                height: 30,
                pivot: new Vec2(0, 0),
                layoutchild: {
                    minHeight: 15,
                    maxHeight: 60,
                    fitHeightProportion: 0.2
                }
            }
        ]);
    });

    afterEach(function () {
        app.destroy();
    });

    const calculate = function () {
        return calculator.calculateLayout(elements, options);
    };

    const assertValues = function (property, values, options) {
        options = options || {};

        elements.forEach(function (element, i) {
            let propertyValue;
            if (property === 'x' || property === 'y') {
                propertyValue = element.entity.localPosition[property];
            } else {
                propertyValue = element[property];
            }

            if (options.approx) {
                expect(propertyValue).to.be.closeTo(values[i], 0.001);
            } else {
                expect(propertyValue).to.equal(values[i]);
            }
        });
    };

    it('throws an error if provided with an unrecognized orientation', function () {
        expect(function () {
            elements = mixedWidthElements;
            options.orientation = 42;
            calculate();
        }).to.throw('Unrecognized orientation value: 42');
    });

    it('lays children out horizontally when orientation is ORIENTATION_HORIZONTAL', function () {
        elements = mixedWidthElements;
        options.orientation = ORIENTATION_HORIZONTAL;

        calculate();

        assertValues('x', [0, 100, 150, 250, 270]);
        assertValues('y', [0,   0,   0,   0,   0]);
    });

    it('lays children out vertically when orientation is ORIENTATION_VERTICAL', function () {
        elements = mixedHeightElements;
        options.orientation = ORIENTATION_VERTICAL;

        calculate();

        assertValues('x', [0,   0,   0,   0,   0]);
        assertValues('y', [0, 100, 150, 250, 270]);
    });

    it('takes into account each element\'s pivot when calculating horizontal positions', function () {
        elements = mixedWidthElements;
        options.orientation = ORIENTATION_HORIZONTAL;

        elements[0].pivot = new Vec2(0.5, 0.1);
        elements[1].pivot = new Vec2(0.2, 0.1);

        calculate();

        assertValues('x', [50, 110, 150, 250, 270], { approx: true });
        assertValues('y', [10,  10,   0,   0,   0], { approx: true });
    });

    it('takes into account each element\'s pivot when calculating vertical positions', function () {
        elements = mixedHeightElements;
        options.orientation = ORIENTATION_VERTICAL;

        elements[0].pivot = new Vec2(0.1, 0.5);
        elements[1].pivot = new Vec2(0.1, 0.2);

        calculate();

        assertValues('x', [10,  10,   0,   0,   0], { approx: true });
        assertValues('y', [50, 110, 150, 250, 270], { approx: true });
    });

    it('returns a layoutInfo object containing the layout bounds', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.wrap = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;

        let layoutInfo;

        options.alignment.x = 0;
        options.alignment.y = 0;
        layoutInfo = calculate();
        expect(layoutInfo.bounds.x).to.equal(0);
        expect(layoutInfo.bounds.y).to.equal(0);
        expect(layoutInfo.bounds.z).to.equal(300);
        expect(layoutInfo.bounds.w).to.equal(100);

        options.alignment.x = 1;
        options.alignment.y = 0.5;
        layoutInfo = calculate();
        expect(layoutInfo.bounds.x).to.equal(200);
        expect(layoutInfo.bounds.y).to.equal(150);
        expect(layoutInfo.bounds.z).to.equal(300);
        expect(layoutInfo.bounds.w).to.equal(100);

        options.alignment.x = 0.5;
        options.alignment.y = 1;
        layoutInfo = calculate();
        expect(layoutInfo.bounds.x).to.equal(100);
        expect(layoutInfo.bounds.y).to.equal(300);
        expect(layoutInfo.bounds.z).to.equal(300);
        expect(layoutInfo.bounds.w).to.equal(100);

        options.widthFitting = FITTING_STRETCH;
        layoutInfo = calculate();
        expect(layoutInfo.bounds.x).to.equal(0);
        expect(layoutInfo.bounds.y).to.equal(300);
        expect(layoutInfo.bounds.z).to.equal(500);
        expect(layoutInfo.bounds.w).to.equal(100);
    });

    it('{ wrap: false } FITTING_NONE does not adjust the size or position of elements to match the container size', function () {
        elements = mixedWidthElements;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;

        calculate();

        assertValues('x', [0, 100, 150, 250, 270]);
        assertValues('y', [0,   0,   0,   0,   0]);

        assertValues('calculatedWidth', [100,  50, 100,  20,  30]);
        assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
    });

    it('{ wrap: false } FITTING_STRETCH uses natural widths when total is larger than container size', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_STRETCH;
        options.containerSize.x = 250;

        calculate();

        assertValues('x', [0, 100, 150, 250, 270]);
        assertValues('y', [0,   0,   0,   0,   0]);

        assertValues('calculatedWidth', [100,  50, 100,  20,  30]);
        assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
    });

    it('{ wrap: false } FITTING_STRETCH stretches elements proportionally when natural widths are less than container size', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_STRETCH;
        options.containerSize.x = 400;

        calculate();

        assertValues('x', [0, 120, 210, 320, 350]);
        assertValues('y', [0,   0,   0,   0,   0]);

        assertValues('calculatedWidth', [120,  90, 110,  30,  50], { approx: true });
        assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
    });

    it('{ wrap: false } FITTING_STRETCH does not make any elements wider than their maxWidth when increasing widths', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_STRETCH;
        options.containerSize.x = 1000;

        calculate();

        assertValues('x', [0, 200, 300, 500, 540]);
        assertValues('y', [0,   0,   0,   0,   0]);

        assertValues('calculatedWidth', [200, 100, 200,  40,  60], { approx: true });
        assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
    });

    it('{ wrap: false } FITTING_STRETCH distributes additional space among remaining elements when one element\'s maxWidth is very small', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_STRETCH;
        options.containerSize.x = 1000;

        elements[0].entity.layoutchild.maxWidth = 300;
        elements[1].entity.layoutchild.maxWidth = 300;
        elements[2].entity.layoutchild.minWidth = 0;
        elements[2].entity.layoutchild.maxWidth = 1;
        elements[3].entity.layoutchild.maxWidth = 300;
        elements[4].entity.layoutchild.maxWidth = 300;

        calculate();

        assertValues('x', [0, 277.556, 577.556, 578.556, 722.370], { approx: true });
        assertValues('y', [0,       0,       0,       0,       0]);

        assertValues('calculatedWidth', [277.555, 300,   1, 143.815, 277.630], { approx: true });
        assertValues('calculatedHeight', [100, 100, 100,     100,     100]);
    });

    it('{ wrap: false } FITTING_STRETCH includes spacing and padding in calculations', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_STRETCH;
        options.containerSize.x = 600;
        options.padding.x = 20;
        options.padding.z = 40;
        options.spacing.x = 10;

        calculate();

        assertValues('x', [20, 196.667, 306.667, 450, 500], { approx: true });
        assertValues('y', [0,       0,       0,   0,   0]);

        assertValues('calculatedWidth', [166.667, 100, 133.333,  40,  60], { approx: true });
        assertValues('calculatedHeight', [100, 100,     100, 100, 100]);
    });

    it('{ wrap: false } FITTING_SHRINK uses natural widths when total is less than container size', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_SHRINK;
        options.containerSize.x = 500;

        calculate();

        assertValues('x', [0, 100, 150, 250, 270]);
        assertValues('y', [0,   0,   0,   0,   0]);

        assertValues('calculatedWidth', [100,  50, 100,  20,  30]);
        assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
    });

    it('{ wrap: false } FITTING_SHRINK shrinks elements proportionally when natural widths are greater than than container size', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_SHRINK;
        options.containerSize.x = 290;

        calculate();

        assertValues('x', [0, 98, 146.5, 244.25, 262]);
        assertValues('y', [0,  0,     0,      0,   0]);

        assertValues('calculatedWidth', [98, 48.5, 97.75, 17.75,  28]);
        assertValues('calculatedHeight', [100,  100,   100,   100, 100]);
    });

    it('{ wrap: false } FITTING_SHRINK does not make any elements smaller than their minWidth when reducing widths', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_SHRINK;
        options.containerSize.x = 100;

        calculate();

        assertValues('x', [0, 60, 85, 140, 150]);
        assertValues('y', [0,  0,  0,   0,   0]);

        assertValues('calculatedWidth', [60,  25,  55,  10,  15]);
        assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
    });

    it('{ wrap: false } FITTING_SHRINK distributes additional size reduction among remaining elements when one element\'s minWidth is very large', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_SHRINK;
        options.containerSize.x = 100;

        elements[0].entity.layoutchild.minWidth = 1;
        elements[1].entity.layoutchild.minWidth = 1;
        elements[2].entity.layoutchild.minWidth = 60;
        elements[3].entity.layoutchild.minWidth = 1;
        elements[4].entity.layoutchild.minWidth = 1;

        calculate();

        assertValues('x', [0, 58.71, 77.742, 137.742, 138.742], { approx: true });
        assertValues('y', [0,     0,      0,       0,       0]);

        assertValues('calculatedWidth', [58.71, 19.032,  60,   1,   1], { approx: true });
        assertValues('calculatedHeight', [100,    100, 100, 100, 100]);
    });

    it('{ wrap: false } FITTING_SHRINK includes spacing and padding in calculations', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_SHRINK;
        options.containerSize.x = 300;
        options.padding.x = 20;
        options.padding.z = 40;
        options.spacing.x = 10;

        calculate();

        assertValues('x', [20, 110, 155, 242.5, 262.5]);
        assertValues('y', [0,   0,   0,     0,     0]);

        assertValues('calculatedWidth', [80,  35, 77.5,  10,  15]);
        assertValues('calculatedHeight', [100, 100,  100, 100, 100]);
    });

    it('{ wrap: false } FITTING_BOTH stretches elements proportionally when natural widths are less than container size', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_BOTH;
        options.containerSize.x = 400;

        calculate();

        assertValues('x', [0, 120, 210, 320, 350]);
        assertValues('y', [0,   0,   0,   0,   0]);

        assertValues('calculatedWidth', [120,  90, 110,  30,  50], { approx: true });
        assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
    });

    it('{ wrap: false } FITTING_BOTH shrinks elements proportionally when natural widths are greater than than container size', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_BOTH;
        options.containerSize.x = 290;

        calculate();

        assertValues('x', [0, 98, 146.5, 244.25, 262]);
        assertValues('y', [0,  0,     0,      0,   0]);

        assertValues('calculatedWidth', [98, 48.5, 97.75, 17.75,  28]);
        assertValues('calculatedHeight', [100,  100,   100,   100, 100]);
    });

    it('{ wrap: false } can reverse elements on the x axis', function () {
        elements = mixedWidthElements;
        options.reverseX = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;

        calculate();

        assertValues('x', [200, 150, 50, 30, 0]);
        assertValues('y', [0,     0,  0,  0, 0]);
    });

    it('{ wrap: false } can reverse elements on the y axis', function () {
        elements = mixedHeightElements;
        options.reverseY = true;
        options.orientation = ORIENTATION_VERTICAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;

        calculate();

        assertValues('x', [0,     0,  0,  0, 0]);
        assertValues('y', [200, 150, 50, 30, 0]);
    });

    it('{ wrap: false } can align to [1, 0.5]', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;

        options.alignment.x = 1;
        options.alignment.y = 0.5;

        calculate();

        assertValues('x', [-40,  60, 110, 210, 230]);
        assertValues('y', [150, 150, 150, 150, 150]);
    });

    it('{ wrap: false } can align to [0.5, 1]', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;

        options.alignment.x = 0.5;
        options.alignment.y = 1;

        calculate();

        assertValues('x', [-20,  80, 130, 230, 250]);
        assertValues('y', [300, 300, 300, 300, 300]);
    });

    it('{ wrap: false } can exclude elements from the layout', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.orientation = ORIENTATION_HORIZONTAL;

        elements[1].entity.layoutchild.excludeFromLayout = true;

        calculate();

        assertValues('x', [0, 0, 100, 200, 220]);
        assertValues('y', [0, 0,   0,   0,   0]);
    });

    it('{ wrap: true } FITTING_NONE does not adjust the size or position of elements to match the container size', function () {
        elements = mixedWidthElements;
        options.wrap = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;

        calculate();

        assertValues('x', [0, 100, 150,   0,  20]);
        assertValues('y', [0,   0,   0, 100, 100]);

        assertValues('calculatedWidth', [100,  50, 100,  20,  30]);
        assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
    });

    it('{ wrap: true } FITTING_NONE calculates line positions based on the largest element on the line', function () {
        elements = mixedWidthElements;
        options.wrap = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;

        elements[2].height = 200;

        calculate();

        assertValues('x', [0, 100, 150,   0,  20]);
        assertValues('y', [0,   0,   0, 200, 200]);

        assertValues('calculatedWidth', [100,  50, 100,  20,  30]);
        assertValues('calculatedHeight', [100, 100, 200, 100, 100]);
    });

    it('{ wrap: true } FITTING_NONE does not adjust the size or position of elements to match the container size', function () {
        elements = mixedWidthElements;
        options.wrap = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;

        calculate();

        assertValues('x', [0, 100, 150,   0,  20]);
        assertValues('y', [0,   0,   0, 100, 100]);

        assertValues('calculatedWidth', [100,  50, 100,  20,  30]);
        assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
    });

    it('{ wrap: true } FITTING_NONE includes spacing and padding in calculations', function () {
        elements = mixedWidthElements;
        options.wrap = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.padding.x = 20;
        options.padding.z = 40;
        options.spacing.x = 10;
        options.spacing.y = 15;
        options.containerSize.x = 260;

        calculate();

        assertValues('x', [20, 130,  20, 130, 160]);
        assertValues('y', [0,    0, 115, 115, 115]);

        assertValues('calculatedWidth', [100,  50, 100,  20,  30]);
        assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
    });

    it('{ wrap: true } FITTING_NONE includes spacing when calculating line breaks', function () {
        elements = mixedWidthElements;
        elements[0].width = 100;
        elements[1].width = 100;
        elements[2].width = 100;
        elements[3].width = 100;
        elements[4].width = 100;

        options.wrap = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.spacing.x = 20;
        options.containerSize.x = 500;

        calculate();

        assertValues('x', [0, 120, 240, 360,   0]);
        assertValues('y', [0,    0,  0,   0, 100]);
    });

    it('{ wrap: true } FITTING_STRETCH stretches elements proportionally when natural widths are less than container size', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.wrap = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_STRETCH;
        options.containerSize.x = 265;

        calculate();

        assertValues('x', [0, 104.286, 162.857,   0,  40], { approx: true });
        assertValues('y', [0,       0,       0, 100, 100]);

        assertValues('calculatedWidth', [104.286, 58.571, 102.143,  40,  60], { approx: true });
        assertValues('calculatedHeight', [100,    100,     100, 100, 100]);
    });

    it('{ wrap: true } FITTING_SHRINK stretches elements proportionally when natural widths are less than container size', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.wrap = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_SHRINK;
        options.containerSize.x = 265;

        calculate();

        assertValues('x', [0, 98.75, 147.917, 246.458,   0], { approx: true });
        assertValues('y', [0,     0,       0,       0, 100]);

        assertValues('calculatedWidth', [98.75, 49.167, 98.542, 18.542,  30], { approx: true });
        assertValues('calculatedHeight', [100,    100,    100,    100, 100]);
    });

    it('{ wrap: true } FITTING_BOTH stretches elements proportionally when natural widths are less than container size', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.wrap = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_BOTH;
        options.containerSize.x = 265;

        calculate();

        assertValues('x', [0, 104.286, 162.857,   0,  40], { approx: true });
        assertValues('y', [0,       0,       0, 100, 100]);

        assertValues('calculatedWidth', [104.286, 58.571, 102.143,  40,  60], { approx: true });
        assertValues('calculatedHeight', [100,    100,     100, 100, 100]);
    });

    it('{ wrap: true } can reverse elements on the x axis', function () {
        elements = mixedWidthElements;
        options.wrap = true;
        options.reverseX = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;

        calculate();

        assertValues('x', [150, 100,  0,  30,   0]);
        assertValues('y', [0,   0,  0, 100, 100]);
    });

    it('{ wrap: true } can reverse elements on the y axis', function () {
        elements = mixedWidthElements;
        options.wrap = true;
        options.reverseY = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;

        calculate();

        assertValues('x', [0, 100, 150, 0, 20]);
        assertValues('y', [100, 100, 100, 0, 0]);
    });

    it('{ wrap: true } can reverse elements both axes', function () {
        elements = mixedWidthElements;
        options.wrap = true;
        options.reverseX = true;
        options.reverseY = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;

        calculate();

        assertValues('x', [150, 100,   0, 30, 0]);
        assertValues('y', [100, 100, 100,  0, 0]);
    });

    it('{ wrap: true } can align to [1, 0.5]', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.wrap = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;
        options.containerSize.y = 400;

        options.alignment.x = 1;
        options.alignment.y = 0.5;

        calculate();

        assertValues('x', [10, 110, 160, 210, 230]);
        assertValues('y', [100, 100, 100, 200, 200]);
    });

    it('{ wrap: true } can align to [0.5, 1]', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.wrap = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;
        options.containerSize.y = 400;

        options.alignment.x = 0.5;
        options.alignment.y = 1;

        calculate();

        assertValues('x', [5, 105, 155, 105, 125]);
        assertValues('y', [200, 200, 200, 300, 300]);
    });

    it('{ wrap: false } can exclude elements from the layout', function () {
        elements = mixedWidthElementsWithLayoutChildComponents;
        options.wrap = true;
        options.orientation = ORIENTATION_HORIZONTAL;
        options.widthFitting = FITTING_NONE;
        options.containerSize.x = 260;

        elements[1].entity.layoutchild.excludeFromLayout = true;

        calculate();

        assertValues('x', [0, 0, 100, 200, 220]);
        assertValues('y', [0, 0,   0,   0,   0]);
    });

});
