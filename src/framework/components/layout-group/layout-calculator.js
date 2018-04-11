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
        calculatedSize: ['calculatedWidth', 'calculatedHeight'],
        minSize: ['minWidth', 'minHeight'],
        maxSize: ['maxWidth', 'maxHeight'],
        fitting: ['widthFitting', 'heightFitting'],
        fittingProportion: ['fitWidthProportion', 'fitHeightProportion'],
    };

    PROPERTY_MAPPINGS[pc.ORIENTATION_VERTICAL] = {
        axis: ['y', 'x'],
        size: ['height', 'width'],
        calculatedSize: ['calculatedHeight', 'calculatedWidth'],
        minSize: ['minHeight', 'minWidth'],
        maxSize: ['maxHeight', 'maxWidth'],
        fitting: ['heightFitting', 'widthFitting'],
        fittingProportion: ['fitHeightProportion', 'fitWidthProportion'],
    };

    var PROPERTY_DEFAULTS = {
        minWidth: 0,
        minHeight: 0,
        maxWidth: null,
        maxHeight: null,
        width: null,
        height: null,
        fitWidthProportion: 0,
        fitHeightProportion: 0,
    };

    // The layout logic is largely identical for the horizontal and vertical orientations,
    // with the exception of a few bits of swizzling re the primary and secondary axes to
    // use etc. This function generates a calculator for a given orientation, with each of
    // the swizzled properties conveniently placed in closure scope.
    function createCalculator(orientation) {
        var propertyMappings = PROPERTY_MAPPINGS[orientation];
        var availableSpace;
        var options;

        // The x/y axis to use
        var axisA = propertyMappings.axis[0];
        var axisB = propertyMappings.axis[1];

        // The width/height dimension properties to use
        var sizeA = propertyMappings.size[0];
        var sizeB = propertyMappings.size[1];
        var minSizeA = propertyMappings.minSize[0];
        var maxSizeA = propertyMappings.maxSize[0];
        var calculatedSizeA = propertyMappings.calculatedSize[0];
        var calculatedSizeB = propertyMappings.calculatedSize[1];

        // The widthFitting/heightFitting logic and fitWidthProportion/fitHeightProportion properties to use
        var fittingA = propertyMappings.fitting[0];
        var fittingProportionA = propertyMappings.fittingProportion[0];

        // Calculates the left/top extent of an element based on its position and pivot value
        function minExtentA(element, size) { return -size[sizeA] * element.pivot[axisA]; }
        function minExtentB(element, size) { return -size[sizeB] * element.pivot[axisB]; }

        // Calculates the right/bottom extent of an element based on its position and pivot value
        function maxExtentA(element, size) { return  size[sizeA] * (1 - element.pivot[axisA]); }
        function maxExtentB(element, size) { return  size[sizeB] * (1 - element.pivot[axisB]); }

        function calculateAll(allElements, fittingOptions) {
            options = fittingOptions;

            if (options.reverse) {
                allElements = allElements.slice().reverse();
            }

            availableSpace = new pc.Vec2(
                options.containerSize.x - options.padding.data[0] - options.padding.data[2],
                options.containerSize.y - options.padding.data[1] - options.padding.data[3]
            );

            var lines = splitLines(allElements);
            var sizes = calculateSizes(lines);
            var positions = calculateBasePositions(lines, sizes);

            applyAlignment(lines, positions);
            applySizesAndPositions(lines, sizes, positions);
        }

        function splitLines(allElements) {
            // If wrapping is disabled, we just put all elements into a single line.
            if (!options.wrap) {
                return [allElements];
            }

            var sizes = getPropertiesMultiple(allElements, sizeA);
            var lines = [[]];
            var runningSize = 0;
            var allowOverrun = (options[fittingA] === pc.FITTING_SHRINK);

            for (var i = 0; i < allElements.length; ++i) {
                runningSize += sizes[i][sizeA];

                // For the None, Stretch and Both fitting modes, we should break to a new
                // line before we overrun the available space in the container.
                if (!allowOverrun && runningSize >= availableSpace[axisA]) {
                    runningSize = 0;
                    lines.push([]);
                }

                lines[lines.length - 1].push(allElements[i]);

                // For the Shrink fitting mode, we should break to a new line immediately
                // after we've overrun the available space in the container.
                if (allowOverrun && runningSize >= availableSpace[axisA]) {
                    runningSize = 0;
                    lines.push([]);
                }
            }

            return lines;
        }

        // Calculate the required size for each element, based on the requested fitting mode
        function calculateSizes(lines) {
            var sizesAllLines = [];

            lines.forEach(function(line) {
                var sizesThisLine = getPropertiesMultiple(line, sizeA, sizeB);
                var requiredSpace = calculateTotalSpace(sizesThisLine);
                var applyStretching;
                var applyShrinking;

                switch (options[fittingA]) {
                    case pc.FITTING_NONE:
                        applyStretching = false;
                        applyShrinking = false;
                        break;

                    case pc.FITTING_STRETCH:
                        applyStretching = requiredSpace < availableSpace[axisA];
                        applyShrinking  = false;
                        break;

                    case pc.FITTING_SHRINK:
                        applyStretching = false;
                        applyShrinking  = requiredSpace > availableSpace[axisA];
                        break;

                    case pc.FITTING_BOTH:
                        applyStretching = requiredSpace < availableSpace[axisA];
                        applyShrinking  = requiredSpace > availableSpace[axisA];
                        break;

                    default:
                        throw new Error('Unrecognized fitting mode: ' + options[fittingA]);
                }

                if (applyStretching) {
                    stretchSizesToFitContainer(line, sizesThisLine, requiredSpace);
                } else if (applyShrinking) {
                    shrinkSizesToFitContainer(line, sizesThisLine, requiredSpace);
                }

                sizesAllLines.push(sizesThisLine);
            });

            return sizesAllLines;
        }

        function calculateTotalSpace(sizes) {
            var totalSizes = sumValues(sizes, sizeA);
            var totalSpacing = (sizes.length - 1) * options.spacing[axisA];

            return totalSizes + totalSpacing;
        }

        function stretchSizesToFitContainer(line, sizesThisLine, requiredSpace) {
            var remainingSpace = availableSpace[axisA] - requiredSpace;
            var fittingProportions = normalizeValues(getProperties(line, fittingProportionA));

            sizesThisLine.forEach(function(size, i) {
                var increase = remainingSpace * fittingProportions[i];
                var newSize = size[sizeA] + increase;
                var maxSize = getProperty(line[i], maxSizeA);

                if (maxSize !== null && newSize > maxSize) {
                    newSize = maxSize;
                }

                sizesThisLine[i][sizeA] = newSize;
            });
        }

        function shrinkSizesToFitContainer(line, sizesThisLine, requiredSpace) {
            var overshoot = availableSpace[axisA] - requiredSpace;
            var fittingProportions = normalizeValues(getProperties(line, fittingProportionA));
            var minSizes = getProperties(line, minSizeA);

            sizesThisLine.forEach(function(size, i) {
                var inverseFittingProportion = (1 - fittingProportions[i]) / (line.length - 1);
                var reduction = -overshoot * inverseFittingProportion;
                sizesThisLine[i][sizeA] = Math.max(size[sizeA] - reduction, minSizes[i]);
            });
        }

        // Calculate base positions based on the element sizes, spacing and padding
        function calculateBasePositions(lines, sizes) {
            var cursor = {};
            cursor[axisA] = options.padding[axisA];
            cursor[axisB] = options.padding[axisB];

            var positionsAllLines = [];

            // TODO Replace this and various other forEach/map cases with regular loops to avoid GC overhead
            lines.forEach(function(line, lineIndex) {
                var positionsThisLine = [];
                var sizesThisLine = sizes[lineIndex];
                var largestSizeThisLine = { width: -1, height: -1 };
                var largestElementThisLine = null;

                // Find the largest element on this line so that we can use it for
                // calculating positions on axis B
                line.forEach(function(element, elementIndex) {
                    var size = sizesThisLine[elementIndex];

                    if (size[sizeB] > largestSizeThisLine[sizeB]) {
                        largestSizeThisLine = size;
                        largestElementThisLine = element;
                    }
                });

                // Move the cursor to account for the largest element's size and pivot
                cursor[axisB] -= minExtentB(largestElementThisLine, largestSizeThisLine);

                // Distribute elements along the line on axis A
                line.forEach(function(element, elementIndex) {
                    cursor[axisA] -= minExtentA(element, sizesThisLine[elementIndex]);

                    positionsThisLine[elementIndex] = {};
                    positionsThisLine[elementIndex][axisA] = cursor[axisA];
                    positionsThisLine[elementIndex][axisB] = cursor[axisB];

                    cursor[axisA] += maxExtentA(element, sizesThisLine[elementIndex]) + options.spacing[axisA];
                });

                // Record the size of the overall line
                line[sizeA] = cursor[axisA] - options.spacing[axisA];
                line[sizeB] = cursor[axisB];

                // Move the cursor to the next line
                cursor[axisA] = options.padding[axisA];
                cursor[axisB] += maxExtentB(largestElementThisLine, largestSizeThisLine) + options.spacing[axisB];

                positionsAllLines.push(positionsThisLine);
            });

            // Record the size of the full set of lines
            lines[sizeB] = cursor[axisB] - options.spacing[axisB];

            return positionsAllLines;
        }

        // Adjust base positions to account for the requested alignment
        function applyAlignment(lines, basePositions) {
            lines.forEach(function(line, lineIndex) {
                var positionsThisLine = basePositions[lineIndex];
                var axisAOffset = (options.containerSize[axisA] - line[sizeA])  * options.alignment[axisA];
                var axisBOffset = (options.containerSize[axisB] - lines[sizeB]) * options.alignment[axisB];

                line.forEach(function(element, elementIndex) {
                    positionsThisLine[elementIndex][axisA] += axisAOffset;
                    positionsThisLine[elementIndex][axisB] += axisBOffset;
                });
            });
        }

        function applySizesAndPositions(lines, sizes, positions) {
            lines.forEach(function(line, lineIndex) {
                var sizesThisLine = sizes[lineIndex];
                var positionsThisLine = positions[lineIndex];

                line.forEach(function(element, elementIndex) {
                    element[calculatedSizeA] = sizesThisLine[elementIndex][sizeA];
                    element[calculatedSizeB] = sizesThisLine[elementIndex][sizeB];
                    element[axisA] = positionsThisLine[elementIndex][axisA];
                    element[axisB] = positionsThisLine[elementIndex][axisB];
                });
            });
        }

        function getProperties(elements, propertyName) {
            return elements.map(function(element) {
                return getProperty(element, propertyName);
            });
        }

        function getPropertiesMultiple(elements, propertyName1, propertyName2) {
            return elements.map(function(element) {
                var values = {};
                values[propertyName1] = getProperty(element, propertyName1);
                values[propertyName2] = getProperty(element, propertyName2);
                return values;
            });
        }

        // When reading an element's width/height, minWidth/minHeight etc, we have to look in
        // a few different places in order. This is because the presence of a LayoutChildComponent
        // on each element is optional, and each property value also has a set of fallback defaults
        // to be used in cases where no value is specified.
        function getProperty(element, propertyName) {
            var layoutChildComponent = element.entity['layoutchild'];

            // First attempt to get the value from the element's LayoutChildComponent, if present.
            if (layoutChildComponent && layoutChildComponent[propertyName] !== undefined && propertyName !== 'width' && propertyName !== 'height') {
                // The width and height properties are always specified directly on the element.
                if (propertyName === 'width' || propertyName === 'height') {
                    return element[propertyName];
                } else {
                    return layoutChildComponent[propertyName];
                }
            } else if (element[propertyName] !== undefined) {
                return element[propertyName];
            } else {
                return PROPERTY_DEFAULTS[propertyName];
            }
        }

        function sumValues(values, propertyName) {
            return values.reduce(function(accumulator, current) {
                return accumulator + (propertyName ? current[propertyName] : current);
            }, 0);
        }

        function normalizeValues(values) {
            var sum = sumValues(values);

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

        return calculateAll;
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
