module("pc.LayoutCalculator", {
    setup: function () {
        this.app = new pc.Application(document.createElement("canvas"));
        this.calculator = new pc.LayoutCalculator();

        this.options = {
            orientation: pc.ORIENTATION_HORIZONTAL,
            reverseX: false,
            reverseY: false,
            alignment: new pc.Vec2(0, 0),
            padding: new pc.Vec4(0, 0, 0, 0),
            spacing: new pc.Vec2(0, 0),
            widthFitting: pc.FITTING_NONE,
            heightFitting: pc.FITTING_NONE,
            wrap: false,
            containerSize: new pc.Vec2(500, 400),
        };

        this.mixedWidthElements = this.buildElements([
            {
                width: 100,
                height: 100,
                pivot: new pc.Vec2(0, 0),
            },
            {
                width: 50,
                height: 100,
                pivot: new pc.Vec2(0, 0),
            },
            {
                width: 100,
                height: 100,
                pivot: new pc.Vec2(0, 0),
            },
            {
                width: 20,
                height: 100,
                pivot: new pc.Vec2(0, 0),
            },
            {
                width: 30,
                height: 100,
                pivot: new pc.Vec2(0, 0),
            },
        ]);

        this.mixedHeightElements = this.buildElements([
            {
                width: 100,
                height: 100,
                pivot: new pc.Vec2(0, 0),
            },
            {
                width: 100,
                height: 50,
                pivot: new pc.Vec2(0, 0),
            },
            {
                width: 100,
                height: 100,
                pivot: new pc.Vec2(0, 0),
            },
            {
                width: 100,
                height: 20,
                pivot: new pc.Vec2(0, 0),
            },
            {
                width: 100,
                height: 30,
                pivot: new pc.Vec2(0, 0),
            },
        ]);

        this.mixedWidthElementsWithLayoutChildComponents = this.buildElements([
            {
                width: 100,
                height: 100,
                pivot: new pc.Vec2(0, 0),
                layoutchild: {
                    minWidth: 50,
                    maxWidth: 200,
                    fitWidthProportion: 0.2,
                },
            },
            {
                width: 50,
                height: 100,
                pivot: new pc.Vec2(0, 0),
                layoutchild: {
                    minWidth: 25,
                    maxWidth: 100,
                    fitWidthProportion: 0.4,
                },
            },
            {
                width: 100,
                height: 100,
                pivot: new pc.Vec2(0, 0),
                layoutchild: {
                    minWidth: 50,
                    maxWidth: 200,
                    fitWidthProportion: 0.1,
                },
            },
            {
                width: 20,
                height: 100,
                pivot: new pc.Vec2(0, 0),
                layoutchild: {
                    minWidth: 10,
                    maxWidth: 40,
                    fitWidthProportion: 0.1,
                },
            },
            {
                width: 30,
                height: 100,
                pivot: new pc.Vec2(0, 0),
                layoutchild: {
                    minWidth: 15,
                    maxWidth: 60,
                    fitWidthProportion: 0.2,
                },
            },
        ]);

        this.mixedHeightElementsWithLayoutChildComponents = this.buildElements([
            {
                width: 100,
                height: 100,
                pivot: new pc.Vec2(0, 0),
                layoutchild: {
                    minHeight: 50,
                    maxHeight: 200,
                    fitHeightProportion: 0.2,
                },
            },
            {
                width: 100,
                height: 50,
                pivot: new pc.Vec2(0, 0),
                layoutchild: {
                    minHeight: 25,
                    maxHeight: 100,
                    fitHeightProportion: 0.4,
                },
            },
            {
                width: 100,
                height: 100,
                pivot: new pc.Vec2(0, 0),
                layoutchild: {
                    minHeight: 50,
                    maxHeight: 200,
                    fitHeightProportion: 0.1,
                },
            },
            {
                width: 100,
                height: 20,
                pivot: new pc.Vec2(0, 0),
                layoutchild: {
                    minHeight: 10,
                    maxHeight: 40,
                    fitHeightProportion: 0.1,
                },
            },
            {
                width: 100,
                height: 30,
                pivot: new pc.Vec2(0, 0),
                layoutchild: {
                    minHeight: 15,
                    maxHeight: 60,
                    fitHeightProportion: 0.2,
                },
            },
        ]);
    },

    buildElements: function(elementSpecs) {
        return elementSpecs.map(function(properties) {
            return this.buildElement(properties);
        }.bind(this));
    },

    buildElement: function(properties) {
        var entity = new pc.Entity("myEntity", this.app);
        var element = this.app.systems.element.addComponent(entity, { type: pc.ELEMENTTYPE_GROUP });

        if (properties['layoutchild']) {
            var layoutChildProperties = properties['layoutchild'];
            var layoutChildComponent = this.app.systems.layoutchild.addComponent(entity);
            delete properties['layoutchild'];
            this.applyProperties(layoutChildComponent, layoutChildProperties);
        }

        this.applyProperties(element, properties);

        this.app.root.addChild(entity);

        return element;
    },

    applyProperties: function(object, properties) {
        Object.keys(properties).forEach(function(propertyName) {
            object[propertyName] = properties[propertyName];
        });
    },

    calculate: function() {
        return this.calculator.calculateLayout(this.elements, this.options);
    },

    assertValues: function(property, values, options) {
        options = options || {};

        this.elements.forEach(function(element, i) {
            var propertyValue;
            if (property === 'x' || property === 'y') {
                propertyValue = element.entity.localPosition[property];
            } else {
                propertyValue = element[property];
            }

            if (options.approx) {
                QUnit.close(propertyValue, values[i], 0.001);
            } else {
                strictEqual(propertyValue, values[i]);
            }
        });
    },

    teardown: function () {
        this.app.destroy();
    }
});

test("throws an error if provided with an unrecognized orientation", function () {
    throws(function() {
        this.elements = this.mixedWidthElements;
        this.options.orientation = 42;
        this.calculate();
    }.bind(this), 'Unrecognized orientation value: 42');
});

test("lays children out horizontally when orientation is pc.ORIENTATION_HORIZONTAL", function () {
    this.elements = this.mixedWidthElements;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;

    this.calculate();

    this.assertValues('x', [0, 100, 150, 250, 270]);
    this.assertValues('y', [0,   0,   0,   0,   0]);
});

test("lays children out vertically when orientation is pc.ORIENTATION_VERTICAL", function () {
    this.elements = this.mixedHeightElements;
    this.options.orientation = pc.ORIENTATION_VERTICAL;

    this.calculate();

    this.assertValues('x', [0,   0,   0,   0,   0]);
    this.assertValues('y', [0, 100, 150, 250, 270]);
});

test("takes into account each element's pivot when calculating horizontal positions", function () {
    this.elements = this.mixedWidthElements;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;

    this.elements[0].pivot = new pc.Vec2(0.5, 0.1);
    this.elements[1].pivot = new pc.Vec2(0.2, 0.1);

    this.calculate();

    this.assertValues('x', [50, 110, 150, 250, 270], { approx: true });
    this.assertValues('y', [10,  10,   0,   0,   0], { approx: true });
});

test("takes into account each element's pivot when calculating vertical positions", function () {
    this.elements = this.mixedHeightElements;
    this.options.orientation = pc.ORIENTATION_VERTICAL;

    this.elements[0].pivot = new pc.Vec2(0.1, 0.5);
    this.elements[1].pivot = new pc.Vec2(0.1, 0.2);

    this.calculate();

    this.assertValues('x', [10,  10,   0,   0,   0], { approx: true });
    this.assertValues('y', [50, 110, 150, 250, 270], { approx: true });
});

test("{ wrap: false } pc.FITTING_NONE does not adjust the size or position of elements to match the container size", function () {
    this.elements = this.mixedWidthElements;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;

    this.calculate();

    this.assertValues('x', [0, 100, 150, 250, 270]);
    this.assertValues('y', [0,   0,   0,   0,   0]);

    this.assertValues('calculatedWidth',  [100,  50, 100,  20,  30]);
    this.assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
});

test("{ wrap: false } pc.FITTING_STRETCH uses natural widths when total is larger than container size", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_STRETCH;
    this.options.containerSize.x = 250;

    this.calculate();

    this.assertValues('x', [0, 100, 150, 250, 270]);
    this.assertValues('y', [0,   0,   0,   0,   0]);

    this.assertValues('calculatedWidth',  [100,  50, 100,  20,  30]);
    this.assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
});

test("{ wrap: false } pc.FITTING_STRETCH stretches elements proportionally when natural widths are less than container size", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_STRETCH;
    this.options.containerSize.x = 400;

    this.calculate();

    this.assertValues('x', [0, 120, 210, 320, 350]);
    this.assertValues('y', [0,   0,   0,   0,   0]);

    this.assertValues('calculatedWidth',  [120,  90, 110,  30,  50], { approx: true });
    this.assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
});

test("{ wrap: false } pc.FITTING_STRETCH does not make any elements wider than their maxWidth when increasing widths", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_STRETCH;
    this.options.containerSize.x = 1000;

    this.calculate();

    this.assertValues('x', [0, 200, 300, 500, 540]);
    this.assertValues('y', [0,   0,   0,   0,   0]);

    this.assertValues('calculatedWidth',  [200, 100, 200,  40,  60], { approx: true });
    this.assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
});

test("{ wrap: false } pc.FITTING_STRETCH distributes additional space among remaining elements when one element's maxWidth is very small", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_STRETCH;
    this.options.containerSize.x = 1000;

    this.elements[0].entity.layoutchild.maxWidth = 300;
    this.elements[1].entity.layoutchild.maxWidth = 300;
    this.elements[2].entity.layoutchild.minWidth = 0;
    this.elements[2].entity.layoutchild.maxWidth = 1;
    this.elements[3].entity.layoutchild.maxWidth = 300;
    this.elements[4].entity.layoutchild.maxWidth = 300;

    this.calculate();

    this.assertValues('x', [0, 277.556, 577.556, 578.556, 722.370], { approx: true });
    this.assertValues('y', [0,       0,       0,       0,       0]);

    this.assertValues('calculatedWidth',  [277.555, 300,   1, 143.815, 277.630], { approx: true });
    this.assertValues('calculatedHeight', [    100, 100, 100,     100,     100]);
});

test("{ wrap: false } pc.FITTING_STRETCH includes spacing and padding in calculations", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_STRETCH;
    this.options.containerSize.x = 600;
    this.options.padding.data[0] = 20;
    this.options.padding.data[2] = 40;
    this.options.spacing.x = 10;

    this.calculate();

    this.assertValues('x', [20, 196.667, 306.667, 450, 500], { approx: true });
    this.assertValues('y', [ 0,       0,       0,   0,   0]);

    this.assertValues('calculatedWidth',  [166.667, 100, 133.333,  40,  60], { approx: true });
    this.assertValues('calculatedHeight', [    100, 100,     100, 100, 100]);
});

test("{ wrap: false } pc.FITTING_SHRINK uses natural widths when total is less than container size", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_SHRINK;
    this.options.containerSize.x = 500;

    this.calculate();

    this.assertValues('x', [0, 100, 150, 250, 270]);
    this.assertValues('y', [0,   0,   0,   0,   0]);

    this.assertValues('calculatedWidth',  [100,  50, 100,  20,  30]);
    this.assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
});

test("{ wrap: false } pc.FITTING_SHRINK shrinks elements proportionally when natural widths are greater than than container size", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_SHRINK;
    this.options.containerSize.x = 290;

    this.calculate();

    this.assertValues('x', [0, 98, 146.5, 244.25, 262]);
    this.assertValues('y', [0,  0,     0,      0,   0]);

    this.assertValues('calculatedWidth',  [ 98, 48.5, 97.75, 17.75,  28]);
    this.assertValues('calculatedHeight', [100,  100,   100,   100, 100]);
});

test("{ wrap: false } pc.FITTING_SHRINK does not make any elements smaller than their minWidth when reducing widths", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_SHRINK;
    this.options.containerSize.x = 100;

    this.calculate();

    this.assertValues('x', [0, 60, 85, 140, 150]);
    this.assertValues('y', [0,  0,  0,   0,   0]);

    this.assertValues('calculatedWidth',  [ 60,  25,  55,  10,  15]);
    this.assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
});

test("{ wrap: false } pc.FITTING_SHRINK distributes additional size reduction among remaining elements when one element's minWidth is very large", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_SHRINK;
    this.options.containerSize.x = 100;

    this.elements[0].entity.layoutchild.minWidth = 1;
    this.elements[1].entity.layoutchild.minWidth = 1;
    this.elements[2].entity.layoutchild.minWidth = 60;
    this.elements[3].entity.layoutchild.minWidth = 1;
    this.elements[4].entity.layoutchild.minWidth = 1;

    this.calculate();

    this.assertValues('x', [0, 58.71, 77.742, 137.742, 138.742], { approx: true });
    this.assertValues('y', [0,     0,      0,       0,       0]);

    this.assertValues('calculatedWidth',  [58.71, 19.032,  60,   1,   1], { approx: true });
    this.assertValues('calculatedHeight', [  100,    100, 100, 100, 100]);
});

test("{ wrap: false } pc.FITTING_SHRINK includes spacing and padding in calculations", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_SHRINK;
    this.options.containerSize.x = 300;
    this.options.padding.data[0] = 20;
    this.options.padding.data[2] = 40;
    this.options.spacing.x = 10;

    this.calculate();

    this.assertValues('x', [20, 110, 155, 242.5, 262.5]);
    this.assertValues('y', [ 0,   0,   0,     0,     0]);

    this.assertValues('calculatedWidth',  [ 80,  35, 77.5,  10,  15]);
    this.assertValues('calculatedHeight', [100, 100,  100, 100, 100]);
});

test("{ wrap: false } pc.FITTING_BOTH stretches elements proportionally when natural widths are less than container size", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_BOTH;
    this.options.containerSize.x = 400;

    this.calculate();

    this.assertValues('x', [0, 120, 210, 320, 350]);
    this.assertValues('y', [0,   0,   0,   0,   0]);

    this.assertValues('calculatedWidth',  [120,  90, 110,  30,  50], { approx: true });
    this.assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
});

test("{ wrap: false } pc.FITTING_BOTH shrinks elements proportionally when natural widths are greater than than container size", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_BOTH;
    this.options.containerSize.x = 290;

    this.calculate();

    this.assertValues('x', [0, 98, 146.5, 244.25, 262]);
    this.assertValues('y', [0,  0,     0,      0,   0]);

    this.assertValues('calculatedWidth',  [ 98, 48.5, 97.75, 17.75,  28]);
    this.assertValues('calculatedHeight', [100,  100,   100,   100, 100]);
});

test("{ wrap: false } can reverse elements on the x axis", function () {
    this.elements = this.mixedWidthElements;
    this.options.reverseX = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.containerSize.x = 260;

    this.calculate();

    this.assertValues('x', [0, 30, 50, 150, 200]);
    this.assertValues('y', [0,  0,  0,   0,   0]);
});

test("{ wrap: false } can reverse elements on the y axis", function () {
    this.elements = this.mixedHeightElements;
    this.options.reverseY = true;
    this.options.orientation = pc.ORIENTATION_VERTICAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.containerSize.x = 260;

    this.calculate();

    this.assertValues('x', [0,  0,  0,   0,   0]);
    this.assertValues('y', [0, 30, 50, 150, 200]);
});

test("{ wrap: false } can align to [1, 0.5]", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.containerSize.x = 260;

    this.options.alignment.x = 1;
    this.options.alignment.y = 0.5;

    this.calculate();

    this.assertValues('x', [-40,  60, 110, 210, 230]);
    this.assertValues('y', [150, 150, 150, 150, 150]);
});

test("{ wrap: false } can align to [0.5, 1]", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.containerSize.x = 260;

    this.options.alignment.x = 0.5;
    this.options.alignment.y = 1;

    this.calculate();

    this.assertValues('x', [-20,  80, 130, 230, 250]);
    this.assertValues('y', [300, 300, 300, 300, 300]);
});

test("{ wrap: true } pc.FITTING_NONE does not adjust the size or position of elements to match the container size", function () {
    this.elements = this.mixedWidthElements;
    this.options.wrap = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.containerSize.x = 260;

    this.calculate();

    this.assertValues('x', [0, 100, 150,   0,  20]);
    this.assertValues('y', [0,   0,   0, 100, 100]);

    this.assertValues('calculatedWidth',  [100,  50, 100,  20,  30]);
    this.assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
});

test("{ wrap: true } pc.FITTING_NONE calculates line positions based on the largest element on the line", function () {
    this.elements = this.mixedWidthElements;
    this.options.wrap = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.containerSize.x = 260;

    this.elements[2].height = 200;

    this.calculate();

    this.assertValues('x', [0, 100, 150,   0,  20]);
    this.assertValues('y', [0,   0,   0, 200, 200]);

    this.assertValues('calculatedWidth',  [100,  50, 100,  20,  30]);
    this.assertValues('calculatedHeight', [100, 100, 200, 100, 100]);
});

test("{ wrap: true } pc.FITTING_NONE does not adjust the size or position of elements to match the container size", function () {
    this.elements = this.mixedWidthElements;
    this.options.wrap = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.containerSize.x = 260;

    this.calculate();

    this.assertValues('x', [0, 100, 150,   0,  20]);
    this.assertValues('y', [0,   0,   0, 100, 100]);

    this.assertValues('calculatedWidth',  [100,  50, 100,  20,  30]);
    this.assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
});

test("{ wrap: true } pc.FITTING_NONE includes spacing and padding in calculations", function () {
    this.elements = this.mixedWidthElements;
    this.options.wrap = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.padding.data[0] = 20;
    this.options.padding.data[2] = 40;
    this.options.spacing.x = 10;
    this.options.spacing.y = 15;
    this.options.containerSize.x = 260;

    this.calculate();

    this.assertValues('x', [20, 130,  20, 130, 160]);
    this.assertValues('y', [0,    0, 115, 115, 115]);

    this.assertValues('calculatedWidth',  [100,  50, 100,  20,  30]);
    this.assertValues('calculatedHeight', [100, 100, 100, 100, 100]);
});

test("{ wrap: true } pc.FITTING_NONE includes spacing when calculating line breaks", function () {
    this.elements = this.mixedWidthElements;
    this.elements[0].width = 100;
    this.elements[1].width = 100;
    this.elements[2].width = 100;
    this.elements[3].width = 100;
    this.elements[4].width = 100;

    this.options.wrap = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.spacing.x = 20;
    this.options.containerSize.x = 500;

    this.calculate();

    this.assertValues('x', [0, 120, 240, 360,   0]);
    this.assertValues('y', [0,    0,  0,   0, 100]);
});

test("{ wrap: true } pc.FITTING_STRETCH stretches elements proportionally when natural widths are less than container size", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.wrap = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_STRETCH;
    this.options.containerSize.x = 265;

    this.calculate();

    this.assertValues('x', [0, 104.286, 162.857,   0,  40], { approx: true });
    this.assertValues('y', [0,       0,       0, 100, 100]);

    this.assertValues('calculatedWidth',  [104.286, 58.571, 102.143,  40,  60], { approx: true });
    this.assertValues('calculatedHeight', [    100,    100,     100, 100, 100]);
});

test("{ wrap: true } pc.FITTING_SHRINK stretches elements proportionally when natural widths are less than container size", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.wrap = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_SHRINK;
    this.options.containerSize.x = 265;

    this.calculate();

    this.assertValues('x', [0, 98.75, 147.917, 246.458,   0], { approx: true });
    this.assertValues('y', [0,     0,       0,       0, 100]);

    this.assertValues('calculatedWidth',  [98.75, 49.167, 98.542, 18.542,  30], { approx: true });
    this.assertValues('calculatedHeight', [  100,    100,    100,    100, 100]);
});

test("{ wrap: true } pc.FITTING_BOTH stretches elements proportionally when natural widths are less than container size", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.wrap = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_BOTH;
    this.options.containerSize.x = 265;

    this.calculate();

    this.assertValues('x', [0, 104.286, 162.857,   0,  40], { approx: true });
    this.assertValues('y', [0,       0,       0, 100, 100]);

    this.assertValues('calculatedWidth',  [104.286, 58.571, 102.143,  40,  60], { approx: true });
    this.assertValues('calculatedHeight', [    100,    100,     100, 100, 100]);
});

test("{ wrap: true } can reverse elements on the x axis", function () {
    this.elements = this.mixedWidthElements;
    this.options.wrap = true;
    this.options.reverseX = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.containerSize.x = 260;

    this.calculate();

    this.assertValues('x', [150, 100,  0,  30,   0]);
    this.assertValues('y', [  0,   0,  0, 100, 100]);
});

test("{ wrap: true } can reverse elements on the y axis", function () {
    this.elements = this.mixedWidthElements;
    this.options.wrap = true;
    this.options.reverseY = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.containerSize.x = 260;

    this.calculate();

    this.assertValues('x', [  0, 100, 150, 0, 20]);
    this.assertValues('y', [100, 100, 100, 0, 0]);
});

test("{ wrap: true } can reverse elements both axes", function () {
    this.elements = this.mixedWidthElements;
    this.options.wrap = true;
    this.options.reverseX = true;
    this.options.reverseY = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.containerSize.x = 260;

    this.calculate();

    this.assertValues('x', [150, 100,   0, 30, 0]);
    this.assertValues('y', [100, 100, 100,  0, 0]);
});

test("{ wrap: true } can align to [1, 0.5]", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.wrap = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.containerSize.x = 260;
    this.options.containerSize.y = 400;

    this.options.alignment.x = 1;
    this.options.alignment.y = 0.5;

    this.calculate();

    this.assertValues('x', [ 10, 110, 160, 210, 230]);
    this.assertValues('y', [100, 100, 100, 200, 200]);
});

test("{ wrap: true } can align to [0.5, 1]", function () {
    this.elements = this.mixedWidthElementsWithLayoutChildComponents;
    this.options.wrap = true;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;
    this.options.containerSize.x = 260;
    this.options.containerSize.y = 400;

    this.options.alignment.x = 0.5;
    this.options.alignment.y = 1;

    this.calculate();

    this.assertValues('x', [  5, 105, 155, 105, 125]);
    this.assertValues('y', [200, 200, 200, 300, 300]);
});
