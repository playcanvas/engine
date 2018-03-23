pc.extend(pc, function () {
    /**
     * @name pc.LayoutCalculator
     * @description Create a new LayoutCalculator
     * @class Used to manage layout calculations for LayoutGroupComponents
     */
    function LayoutCalculator() {}

    var PROPERTY_MAPPINGS = {};

    PROPERTY_MAPPINGS[pc.ORIENTATION_HORIZONTAL] = {
        axis: ['x', 'y'],
        size: ['width', 'height'],
        minSize: ['minWidth', 'minHeight'],
        maxSize: ['maxWidth', 'maxHeight'],
        fitting: ['widthFitting', 'heightFitting'],
        fittingProportion: ['fitWidthProportion', 'fitHeightProportion'],
        direction: [1, -1]
    };

    PROPERTY_MAPPINGS[pc.ORIENTATION_VERTICAL] = {
        axis: ['y', 'x'],
        size: ['height', 'width'],
        minSize: ['minHeight', 'minWidth'],
        maxSize: ['maxHeight', 'maxWidth'],
        fitting: ['heightFitting', 'widthFitting'],
        fittingProportion: ['fitHeightProportion', 'fitWidthProportion'],
        direction: [-1, 1]
    };

    // The layout logic is largely identical for the horizontal and vertical orientations,
    // with the exception of a few bits of swizzling re the primary and secondary axes to
    // use etc. This function generates a calculator for a given orientation, with each of
    // the swizzled properties conveniently placed in closure scope.
    function createCalculator(orientation) {
        var propertyMappings = PROPERTY_MAPPINGS[orientation];

        // The x/y axis to use
        var axisA = propertyMappings.axis[0];
        var axisB = propertyMappings.axis[1];

        // The width/height dimension properties to use
        var sizeA = propertyMappings.size[0];
        var sizeB = propertyMappings.size[1];
        var minSizeA = propertyMappings.minSize[0];
        var minSizeB = propertyMappings.minSize[1];
        var maxSizeA = propertyMappings.maxSize[0];
        var maxSizeB = propertyMappings.maxSize[1];

        // The widthFitting/heightFitting logic and fitWidthProportion/fitHeightProportion properties to use
        var fittingA = propertyMappings.fitting[0];
        var fittingB = propertyMappings.fitting[1];
        var fittingProportionA = propertyMappings.fittingProportion[0];
        var fittingProportionB = propertyMappings.fittingProportion[1];

        // Whether to walk in a positive or negative direction along the axis (allows for inversion of y)
        var directionA = propertyMappings.direction[0];
        var directionB = propertyMappings.direction[1];

        // Calculates the left/top extent of an element based on its position and pivot value
        function minExtentA(element) { return -element[sizeA] * element.pivot[axisA]; }
        function minExtentB(element) { return -element[sizeB] * element.pivot[axisB]; }

        // Calculates the right/bottom extent of an element based on its position and pivot value
        function maxExtentA(element) { return  element[sizeA] * (1 - element.pivot[axisA]); }
        function maxExtentB(element) { return  element[sizeB] * (1 - element.pivot[sizeB]); }

        function calculateAll(elements, options) {
            var sizes = calculateSizes(elements, options);
            var basePositions = calculateBasePositions(elements, options, sizes);
            var alignedPositions = calculateAlignedPositions(elements, options, sizes, basePositions);

            applySizesAndPositions(elements, sizes, alignedPositions);
        }

        // Calculate the required size for each element, based on the requested fitting mode
        function calculateSizes(elements, options) {
            switch (options[fittingA]) {
                case pc.FITTING_NONE:
                    return getValuePairs(elements, sizeA, sizeB);

                case pc.FITTING_STRETCH:
                    throw new Error('Implement me');

                case pc.FITTING_SHRINK:
                    throw new Error('Implement me');

                case pc.FITTING_BOTH:
                    throw new Error('Implement me');

                default:
                    throw new Error('Unrecognized fitting mode: ' + options[fittingA]);
            }
        }

        // Calculate base positions based on the element sizes, spacing and padding
        function calculateBasePositions(elements, options) {
            var cursor = {};
            cursor[axisA] = options.padding[axisA];
            cursor[axisB] = options.padding[axisB];

            var positions = [];

            elements.forEach(function(element, index) {
                cursor[axisA] -= minExtentA(element);

                positions[index] = {};
                positions[index][axisA] = cursor[axisA];
                positions[index][axisB] = cursor[axisB];

                cursor[axisA] += maxExtentA(element) + options.spacing[axisA];
            });

            return positions;
        }

        // Adjust base positions to account for the requested alignment
        function calculateAlignedPositions(elements, options, sizes, basePositions) {
            // TODO Implement
            return basePositions;
        }

        function applySizesAndPositions(elements, sizes, positions) {
            elements.forEach(function(element, index) {
                element[sizeA] = sizes[index][sizeA];
                element[sizeB] = sizes[index][sizeB];
                element[axisA] = positions[index][axisA];
                element[axisB] = positions[index][axisB];
            });
        }

        return calculateAll;
    }

    function getValues(elements, propertyName) {
        return elements.map(function(element) {
            return element[propertyName];
        });
    }

    function getValuePairs(elements, propertyName1, propertyName2) {
        return elements.map(function(element) {
            var values = {};
            values[propertyName1] = element[propertyName1];
            values[propertyName2] = element[propertyName2];
            return values;
        });
    }

    function normalizeValues(values) {
        var sum = values.reduce(function(accumulator, current) {
            return accumulator + current;
        }, 0);

        if (sum === 0) {
            return values.map(function() {
                return 1 / values.length;
            });
        } else {
            return values.map(function(value) {
                return value / sum;
            });
        }
    }

    var CALCULATE_FNS = {};
    CALCULATE_FNS[pc.ORIENTATION_HORIZONTAL] = createCalculator(pc.ORIENTATION_HORIZONTAL);
    CALCULATE_FNS[pc.ORIENTATION_VERTICAL] = createCalculator(pc.ORIENTATION_VERTICAL);

    LayoutCalculator.prototype = {
        calculateLayout: function (elements, options) {
            var calculateFn = CALCULATE_FNS[options.orientation];

            if (!calculateFn) {
                throw new Error('Unrecognized orientation value: ' + options.orientation);
            } else {
                calculateFn(elements, options);
            }
        }
    };

    return {
        LayoutCalculator: LayoutCalculator
    };
}());
