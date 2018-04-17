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
        maxWidth: Number.POSITIVE_INFINITY,
        maxHeight: Number.POSITIVE_INFINITY,
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
        var minSizeB = propertyMappings.minSize[1];
        var maxSizeA = propertyMappings.maxSize[0];
        var maxSizeB = propertyMappings.maxSize[1];
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

        function calculateAll(allElements, layoutOptions) {
            options = layoutOptions;

            availableSpace = new pc.Vec2(
                options.containerSize.x - options.padding.data[0] - options.padding.data[2],
                options.containerSize.y - options.padding.data[1] - options.padding.data[3]
            );

            var lines = reverseLinesIfRequired(splitLines(allElements));
            var sizes = calculateSizes(lines);
            var positions = calculateBasePositions(lines, sizes);

            applyAlignment(lines, sizes, positions);
            applySizesAndPositions(lines, sizes, positions);
        }

        // Returns a 2D array of elements broken down into lines, based on the size of
        // each element and whether the `wrap` property is set.
        function splitLines(allElements) {
            if (!options.wrap) {
                // If wrapping is disabled, we just put all elements into a single line.
                return [allElements];
            }

            var lines = [[]];
            var idealSizes = getProperties(allElements, sizeA);
            var runningSize = 0;
            var allowOverrun = (options[fittingA] === pc.FITTING_SHRINK);

            for (var i = 0; i < allElements.length; ++i) {
                runningSize += idealSizes[i];

                // For the None, Stretch and Both fitting modes, we should break to a new
                // line before we overrun the available space in the container.
                if (!allowOverrun && runningSize >= availableSpace[axisA] && lines[lines.length - 1].length !== 0) {
                    runningSize = idealSizes[i];
                    lines.push([]);
                }

                lines[lines.length - 1].push(allElements[i]);

                // For the Shrink fitting mode, we should break to a new line immediately
                // after we've overrun the available space in the container.
                if (allowOverrun && runningSize >= availableSpace[axisA] && i !== allElements.length - 1) {
                    runningSize = 0;
                    lines.push([]);
                }
            }

            return lines;
        }

        function reverseLinesIfRequired(lines) {
            var reverseAxisA = (options.orientation === pc.ORIENTATION_HORIZONTAL && options.reverseX) ||
                               (options.orientation === pc.ORIENTATION_VERTICAL   && options.reverseY);

            var reverseAxisB = (options.orientation === pc.ORIENTATION_HORIZONTAL && options.reverseY) ||
                               (options.orientation === pc.ORIENTATION_VERTICAL   && options.reverseX);

            if (reverseAxisA) {
                for (var lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
                    if (reverseAxisA) {
                        lines[lineIndex].reverse();
                    }
                }
            }

            if (reverseAxisB) {
                lines.reverse();
            }

            return lines;
        }

        // Calculate the required size for each element, based on the requested fitting mode.
        function calculateSizes(lines) {
            var sizesAllLines = [];

            lines.forEach(function(line) {
                var sizesThisLine = getElementSizeProperties(line);
                var idealRequiredSpace = calculateTotalSpace(sizesThisLine, sizeA, axisA);
                var applyStretching;
                var applyShrinking;

                switch (options[fittingA]) {
                    case pc.FITTING_NONE:
                        applyStretching = false;
                        applyShrinking = false;
                        break;

                    case pc.FITTING_STRETCH:
                        applyStretching = idealRequiredSpace < availableSpace[axisA];
                        applyShrinking  = false;
                        break;

                    case pc.FITTING_SHRINK:
                        applyStretching = false;
                        applyShrinking  = idealRequiredSpace >= availableSpace[axisA];
                        break;

                    case pc.FITTING_BOTH:
                        applyStretching = idealRequiredSpace < availableSpace[axisA];
                        applyShrinking  = idealRequiredSpace >= availableSpace[axisA];
                        break;

                    default:
                        throw new Error('Unrecognized fitting mode: ' + options[fittingA]);
                }

                if (applyStretching) {
                    stretchSizesToFitContainer(sizesThisLine, idealRequiredSpace);
                } else if (applyShrinking) {
                    shrinkSizesToFitContainer(sizesThisLine, idealRequiredSpace);
                }

                sizesAllLines.push(sizesThisLine);
            });

            return sizesAllLines;
        }

        function calculateTotalSpace(sizes, dimension, axis) {
            var totalSizes = sumValues(sizes, dimension);
            var totalSpacing = (sizes.length - 1) * options.spacing[axis];

            return totalSizes + totalSpacing;
        }

        function stretchSizesToFitContainer(sizesThisLine, idealRequiredSpace) {
            var ascendingMaxSizeOrder = getTraversalOrder(sizesThisLine, maxSizeA);
            var fittingProportions = getNormalizedValues(sizesThisLine, fittingProportionA);
            var fittingProportionSums = createSumArray(fittingProportions, ascendingMaxSizeOrder);

            // Start by working out how much we have to stretch the child elements by
            // in total in order to fill the available space in the container
            var remainingUndershoot = availableSpace[axisA] - idealRequiredSpace;

            for (var i = 0; i < sizesThisLine.length; ++i) {
                // As some elements may have a maximum size defined, we might not be
                // able to scale all elements by the ideal amount necessary in order
                // to fill the available space. To account for this, we run through
                // the elements in ascending order of their maximum size, redistributing
                // any remaining space to the other elements that are more able to
                // make use of it.
                var index = ascendingMaxSizeOrder[i];

                // Work out how much we ideally want to stretch this element by, based
                // on the amount of space remaining and the fitting proportion value that
                // was specified.
                var targetIncrease = calculateAdjustment(index, remainingUndershoot, fittingProportions, fittingProportionSums);
                var targetSize = sizesThisLine[index][sizeA] + targetIncrease;

                // Work out how much we're actually able to stretch this element by,
                // based on its maximum size, and apply the result.
                var maxSize = sizesThisLine[index][maxSizeA];
                var actualSize = Math.min(targetSize, maxSize);

                sizesThisLine[index][sizeA] = actualSize;

                // Work out how much of the total undershoot value we've just used,
                // and decrement the remaining value by this much.
                var actualIncrease = Math.max(targetSize - actualSize, 0);
                var appliedIncrease = targetIncrease - actualIncrease;

                remainingUndershoot -= appliedIncrease;
            }
        }

        // This loop is very similar to the one in stretchSizesToFitContainer() above,
        // but with some awkward inversions and use of min as opposed to max etc that
        // mean a more generalized version would probably be harder to read/debug than
        // just having a small amount of duplication.
        function shrinkSizesToFitContainer(sizesThisLine, idealRequiredSpace) {
            var descendingMinSizeOrder = getTraversalOrder(sizesThisLine, minSizeA, true);
            var fittingProportions = getNormalizedValues(sizesThisLine, fittingProportionA);
            var inverseFittingProportions = getInverseValues(fittingProportions);
            var inverseFittingProportionSums = createSumArray(inverseFittingProportions, descendingMinSizeOrder);

            var remainingOvershoot = idealRequiredSpace - availableSpace[axisA];

            for (var i = 0; i < sizesThisLine.length; ++i) {
                var index = descendingMinSizeOrder[i];

                // Similar to the stretch calculation above, we calculate the ideal
                // size reduction value for this element based on its fitting proportion.
                //
                // However, note that we're using the inverse of the fitting value, as
                // using the regular value would mean that an element with a fitting
                // value of, say, 0.4, ends up rendering very small when shrinking is
                // being applied. Using the inverse means that the balance of sizes
                // between elements is similar for both the Stretch and Shrink modes.
                var targetReduction = calculateAdjustment(index, remainingOvershoot, inverseFittingProportions, inverseFittingProportionSums);
                var targetSize = sizesThisLine[index][sizeA] - targetReduction;

                var minSize = sizesThisLine[index][minSizeA];
                var actualSize = Math.max(targetSize, minSize);

                sizesThisLine[index][sizeA] = actualSize;

                var actualReduction = Math.max(actualSize - targetSize, 0);
                var appliedReduction = targetReduction - actualReduction;

                remainingOvershoot -= appliedReduction;
            }
        }

        function calculateAdjustment(index, remainingAdjustment, fittingProportions, fittingProportionSums) {
            if (fittingProportionSums[index] === 0) {
                return 0;
            } else {
                return remainingAdjustment * fittingProportions[index] / fittingProportionSums[index];
            }
        }

        // Calculate base positions based on the element sizes, spacing and padding.
        function calculateBasePositions(lines, sizes) {
            var cursor = {};
            cursor[axisA] = options.padding[axisA];
            cursor[axisB] = options.padding[axisB];

            var positionsAllLines = [];

            // TODO Replace this and various other forEach/map cases with regular loops to avoid GC overhead
            lines.forEach(function(line, lineIndex) {
                var positionsThisLine = [];
                var sizesThisLine = sizes[lineIndex];
                var largestSizeThisLine = { width: Number.NEGATIVE_INFINITY, height: Number.NEGATIVE_INFINITY };
                var largestElementThisLine = null;

                // Find the largest element on this line so that we can use it for
                // calculating the line height
                line.forEach(function(element, elementIndex) {
                    var size = sizesThisLine[elementIndex];

                    if (size[sizeB] > largestSizeThisLine[sizeB]) {
                        largestSizeThisLine = size;
                        largestElementThisLine = element;
                    }
                });

                // Move the cursor to account for the largest element's size and pivot
                cursor[axisB] -= minExtentB(largestElementThisLine, largestSizeThisLine);

                // Distribute elements along the line
                line.forEach(function(element, elementIndex) {
                    cursor[axisA] -= minExtentA(element, sizesThisLine[elementIndex]);

                    positionsThisLine[elementIndex] = {};
                    positionsThisLine[elementIndex][axisA] = cursor[axisA];
                    positionsThisLine[elementIndex][axisB] = cursor[axisB];

                    cursor[axisA] += maxExtentA(element, sizesThisLine[elementIndex]) + options.spacing[axisA];
                });

                // Record the size of the overall line
                line[sizeA] = cursor[axisA] - options.spacing[axisA];
                line[sizeB] = maxExtentB(largestElementThisLine, largestSizeThisLine);

                // Move the cursor to the next line
                cursor[axisA] = options.padding[axisA];
                cursor[axisB] += line[sizeB] + options.spacing[axisB];

                positionsAllLines.push(positionsThisLine);
            });

            // Record the size of the full set of lines
            lines[sizeB] = cursor[axisB] - options.spacing[axisB];

            return positionsAllLines;
        }

        // Adjust base positions to account for the requested alignment.
        function applyAlignment(lines, sizes, positions) {
            lines.forEach(function(line, lineIndex) {
                var sizesThisLine = sizes[lineIndex];
                var positionsThisLine = positions[lineIndex];
                var axisAOffset = (options.containerSize[axisA] - line[sizeA])  * options.alignment[axisA];
                var axisBOffset = (options.containerSize[axisB] - lines[sizeB]) * options.alignment[axisB];

                line.forEach(function(element, elementIndex) {
                    var withinLineAxisBOffset = (line[sizeB] - sizesThisLine[elementIndex][sizeB]) * options.alignment[axisB];

                    positionsThisLine[elementIndex][axisA] += axisAOffset;
                    positionsThisLine[elementIndex][axisB] += axisBOffset + withinLineAxisBOffset;
                });
            });
        }

        // Applies the final calculated sizes and positions back to elements themselves.
        function applySizesAndPositions(lines, sizes, positions) {
            lines.forEach(function(line, lineIndex) {
                var sizesThisLine = sizes[lineIndex];
                var positionsThisLine = positions[lineIndex];

                line.forEach(function(element, elementIndex) {
                    element[calculatedSizeA] = sizesThisLine[elementIndex][sizeA];
                    element[calculatedSizeB] = sizesThisLine[elementIndex][sizeB];

                    if (options.orientation === pc.ORIENTATION_HORIZONTAL) {
                        element.entity.setLocalPosition(
                            positionsThisLine[elementIndex][axisA],
                            positionsThisLine[elementIndex][axisB],
                            element.entity.getLocalPosition().z
                        );
                    } else {
                        element.entity.setLocalPosition(
                            positionsThisLine[elementIndex][axisB],
                            positionsThisLine[elementIndex][axisA],
                            element.entity.getLocalPosition().z
                        );
                    }
                });
            });
        }

        // Reads all size-related properties for each element and applies some basic
        // sanitization to ensure that minWidth is greater than 0, maxWidth is greater
        // than minWidth, etc.
        function getElementSizeProperties(elements) {
            var sizeProperties = [];

            for (var i = 0; i < elements.length; ++i) {
                var element = elements[i];
                var minWidth  = Math.max(getProperty(element, 'minWidth'), 0);
                var minHeight = Math.max(getProperty(element, 'minHeight'), 0);
                var maxWidth  = Math.max(getProperty(element, 'maxWidth'), minWidth);
                var maxHeight = Math.max(getProperty(element, 'maxHeight'), minHeight);
                var width  = clamp(getProperty(element, 'width'), minWidth, maxWidth);
                var height = clamp(getProperty(element, 'height'), minHeight, maxHeight);
                var fitWidthProportion  = getProperty(element, 'fitWidthProportion');
                var fitHeightProportion = getProperty(element, 'fitHeightProportion');

                sizeProperties.push({
                    index: i,
                    minWidth:  minWidth,
                    minHeight: minHeight,
                    maxWidth:  maxWidth,
                    maxHeight: maxHeight,
                    width:     width,
                    height:    height,
                    fitWidthProportion:  fitWidthProportion,
                    fitHeightProportion: fitHeightProportion
                });
            }

            return sizeProperties;
        }

        function getProperties(elements, propertyName) {
            return elements.map(function(element) {
                return getProperty(element, propertyName);
            });
        }

        // When reading an element's width/height, minWidth/minHeight etc, we have to look in
        // a few different places in order. This is because the presence of a LayoutChildComponent
        // on each element is optional, and each property value also has a set of fallback defaults
        // to be used in cases where no value is specified.
        function getProperty(element, propertyName) {
            var layoutChildComponent = element.entity['layoutchild'];

            // First attempt to get the value from the element's LayoutChildComponent, if present.
            // TODO Should this check if the LayoutChildComponent is enabled?
            if (layoutChildComponent && layoutChildComponent[propertyName] !== undefined && layoutChildComponent[propertyName] !== null) {
                return layoutChildComponent[propertyName];
            } else if (element[propertyName] !== undefined) {
                return element[propertyName];
            } else {
                return PROPERTY_DEFAULTS[propertyName];
            }
        }

        function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        function sumValues(values, propertyName) {
            return values.reduce(function(accumulator, current) {
                return accumulator + (propertyName ? current[propertyName] : current);
            }, 0);
        }

        function getNormalizedValues(values, propertyName) {
            var sum = sumValues(values, propertyName);

            if (sum === 0) {
                return values.map(function() {
                    return 1 / values.length;
                });
            } else {
                return values.map(function(value) {
                    return value[propertyName] / sum;
                });
            }
        }

        function getInverseValues(values) {
            return values.map(function(value) {
                return (1 - value) / (values.length - 1);
            });
        }

        function getTraversalOrder(values, orderBy, descending) {
            return values
                .slice()
                .sort(function(a, b) {
                    return descending ? b[orderBy] - a[orderBy] : a[orderBy] - b[orderBy];
                })
                .map(function(a) {
                    return a.index;
                });
        }

        // Returns a new array containing the sums of the values in the original array,
        // running from right to left.
        //
        // For example, given: [0.2, 0.2, 0.3, 0.1, 0.2]
        // Will return:        [1.0, 0.8, 0.6, 0.3, 0.2]
        function createSumArray(values, order) {
            var sumArray = [];
            sumArray[order[values.length - 1]] = values[order[values.length - 1]];

            for (var i = values.length - 2; i >= 0; --i) {
                sumArray[order[i]] = sumArray[order[i + 1]] + values[order[i]];
            }

            return sumArray;
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
