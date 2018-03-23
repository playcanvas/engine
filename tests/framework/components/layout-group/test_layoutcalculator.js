module("pc.LayoutCalculator", {
    setup: function () {
        this.calculator = new pc.LayoutCalculator();

        this.options = {
            orientation: pc.ORIENTATION_HORIZONTAL,
            reverse: false,
            alignment: new pc.Vec2(0, 0),
            padding: new pc.Vec4(0, 0, 0, 0),
            spacing: new pc.Vec2(0, 0),
            widthFitting: pc.FITTING_NONE,
            heightFitting: pc.FITTING_NONE,
            wrap: false,
            containerSize: new pc.Vec2(500, 500),
        };

        this.mixedWidthElements = [
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
        ];

        this.mixedHeightElements = [
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
        ];
    },

    calculate: function() {
        return this.calculator.calculateLayout(this.elements, this.options);
    },

    assertValues: function(property, values, options) {
        options = options || {};

        this.elements.forEach(function(element, i) {
            if (options.approx) {
                close(element[property], values[i], 0.00001);
            } else {
                strictEqual(element[property], values[i]);
            }
        });
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
    this.assertValues('y', [ 0,   0,   0,   0,   0]);
});

test("takes into account each element's pivot when calculating vertical positions", function () {
    this.elements = this.mixedHeightElements;
    this.options.orientation = pc.ORIENTATION_VERTICAL;

    this.elements[0].pivot = new pc.Vec2(0.1, 0.5);
    this.elements[1].pivot = new pc.Vec2(0.1, 0.2);

    this.calculate();

    this.assertValues('x', [ 0,   0,   0,   0,   0]);
    this.assertValues('y', [50, 110, 150, 250, 270], { approx: true });
});

test("adds the requested horizontal spacing between elements", function () {
    this.elements = this.mixedWidthElements;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.spacing = new pc.Vec2(100, 50);

    this.calculate();

    this.assertValues('x', [0, 200, 350, 550, 670]);
    this.assertValues('y', [0,   0,   0,   0,   0]);
});

test("adds the requested vertical spacing between elements", function () {
    this.elements = this.mixedHeightElements;
    this.options.orientation = pc.ORIENTATION_VERTICAL;
    this.options.spacing = new pc.Vec2(50, 100);

    this.calculate();

    this.assertValues('x', [0,   0,   0,   0,   0]);
    this.assertValues('y', [0, 200, 350, 550, 670]);
});

test("adds the requested padding within the container before positioning elements", function () {
    this.elements = this.mixedWidthElements;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.padding = new pc.Vec2(10, 20, 30, 40);

    this.calculate();

    this.assertValues('x', [10, 110, 160, 260, 280]);
    this.assertValues('y', [20,  20,  20,  20,  20]);
});

test("does not adjust the size or position of elements to match the container size when widthFitting is set to pc.FITTING_NONE", function () {
    this.elements = this.mixedWidthElements;
    this.options.orientation = pc.ORIENTATION_HORIZONTAL;
    this.options.widthFitting = pc.FITTING_NONE;

    this.calculate();

    this.assertValues('x', [0, 100, 150, 250, 270]);
    this.assertValues('y', [0,   0,   0,   0,   0]);

    this.assertValues('width',  [100,  50, 100,  20,  30]);
    this.assertValues('height', [100, 100, 100, 100, 100]);
});
