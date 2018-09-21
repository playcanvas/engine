Object.assign(pc, function () {
    /**
     * @private
     * @constructor
     * @name pc.LayoutCalculator
     * @classdesc Used to manage layout calculations for {@link pc.LayoutGroupComponent}s
     */
    function LayoutCalculator() {}

    var AXIS_MAPPINGS = {};

    AXIS_MAPPINGS[pc.ORIENTATION_HORIZONTAL] = {
        axis: 'x',
        size: 'width',
        calculatedSize: 'calculatedWidth',
        minSize: 'minWidth',
        maxSize: 'maxWidth',
        fitting: 'widthFitting',
        fittingProportion: 'fitWidthProportion'
    };

    AXIS_MAPPINGS[pc.ORIENTATION_VERTICAL] = {
        axis: 'y',
        size: 'height',
        calculatedSize: 'calculatedHeight',
        minSize: 'minHeight',
        maxSize: 'maxHeight',
        fitting: 'heightFitting',
        fittingProportion: 'fitHeightProportion'
    };

    var OPPOSITE_ORIENTATION = {};
    OPPOSITE_ORIENTATION[pc.ORIENTATION_HORIZONTAL] = pc.ORIENTATION_VERTICAL;
    OPPOSITE_ORIENTATION[pc.ORIENTATION_VERTICAL] = pc.ORIENTATION_HORIZONTAL;

    var PROPERTY_DEFAULTS = {
        minWidth: 0,
        minHeight: 0,
        maxWidth: Number.POSITIVE_INFINITY,
        maxHeight: Number.POSITIVE_INFINITY,
        width: null,
        height: null,
        fitWidthProportion: 0,
        fitHeightProportion: 0
    };

    var FITTING_ACTION = {
        NONE: 'NONE',
        APPLY_STRETCHING: 'APPLY_STRETCHING',
        APPLY_SHRINKING: 'APPLY_SHRINKING'
    };

    var availableSpace = new pc.Vec2();

    // The layout logic is largely identical for the horizontal and vertical orientations,
    // with the exception of a few bits of swizzling re the primary and secondary axes to
    // use etc. This function generates a calculator for a given orientation, with each of
    // the swizzled properties conveniently placed in closure scope.
    function createCalculator(orientation) {
        var options;

        // Choose which axes to operate on based on the orientation that we're using. For
        // brevity as they are used a lot, these are shortened to just 'a' and 'b', which
        // represent the primary and secondary axes.
        var a = AXIS_MAPPINGS[orientation];
        var b = AXIS_MAPPINGS[OPPOSITE_ORIENTATION[orientation]];

        // Calculates the left/top extent of an element based on its position and pivot value
        function minExtentA(element, size) {return -size[a.size] * element.pivot[a.axis]; }  // eslint-disable-line
        function minExtentB(element, size) { return -size[b.size] * element.pivot[b.axis]; } // eslint-disable-line

        // Calculates the right/bottom extent of an element based on its position and pivot value
        function maxExtentA(element, size) { return  size[a.size] * (1 - element.pivot[a.axis]); } // eslint-disable-line
        function maxExtentB(element, size) { return  size[b.size] * (1 - element.pivot[b.axis]); } // eslint-disable-line

        function calculateAll(allElements, layoutOptions) {
            allElements = allElements.filter(shouldIncludeInLayout);
            options = layoutOptions;

            availableSpace.x = options.containerSize.x - options.padding.x - options.padding.z;
            availableSpace.y = options.containerSize.y - options.padding.y - options.padding.w;

            resetAnchors(allElements);

            var lines = reverseLinesIfRequired(splitLines(allElements));
            var sizes = calculateSizesOnAxisB(lines, calculateSizesOnAxisA(lines));
            var positions = calculateBasePositions(lines, sizes);

            applyAlignmentAndPadding(lines, sizes, positions);
            applySizesAndPositions(lines, sizes, positions);

            return createLayoutInfo(lines, sizes, positions);
        }

        function shouldIncludeInLayout(element) {
            var layoutChildComponent = element.entity.layoutchild;

            return !layoutChildComponent || !layoutChildComponent.enabled || !layoutChildComponent.excludeFromLayout;
        }

        // Setting the anchors of child elements to anything other than 0,0,0,0 results
        // in positioning that is hard to reason about for the user. Forcing the anchors
        // to 0,0,0,0 gives us more predictable positioning, and also has the benefit of
        // ensuring that the element is not in split anchors mode on either axis.
        function resetAnchors(allElements) {
            for (var i = 0; i < allElements.length; ++i) {
                var element = allElements[i];
                var anchor = element.anchor;

                if (anchor.x !== 0 || anchor.y !== 0 || anchor.z !== 0 || anchor.w !== 0) {
                    element.anchor = pc.Vec4.ZERO;
                }
            }
        }

        // Returns a 2D array of elements broken down into lines, based on the size of
        // each element and whether the `wrap` property is set.
        function splitLines(allElements) {
            if (!options.wrap) {
                // If wrapping is disabled, we just put all elements into a single line.
                return [allElements];
            }

            var lines = [[]];
            var sizes = getElementSizeProperties(allElements);
            var runningSize = 0;
            var allowOverrun = (options[a.fitting] === pc.FITTING_SHRINK);

            for (var i = 0; i < allElements.length; ++i) {
                if (lines[lines.length - 1].length > 0) {
                    runningSize += options.spacing[a.axis];
                }

                var idealElementSize = sizes[i][a.size];
                runningSize += idealElementSize;

                // For the None, Stretch and Both fitting modes, we should break to a new
                // line before we overrun the available space in the container.
                if (!allowOverrun && runningSize > availableSpace[a.axis] && lines[lines.length - 1].length !== 0) {
                    runningSize = idealElementSize;
                    lines.push([]);
                }

                lines[lines.length - 1].push(allElements[i]);

                // For the Shrink fitting mode, we should break to a new line immediately
                // after we've overrun the available space in the container.
                if (allowOverrun && runningSize > availableSpace[a.axis] && i !== allElements.length - 1) {
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

        // Calculate the required size for each element along axis A, based on the requested
        // fitting mode.
        function calculateSizesOnAxisA(lines) {
            var sizesAllLines = [];

            for (var lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
                var line = lines[lineIndex];
                var sizesThisLine = getElementSizeProperties(line);
                var idealRequiredSpace = calculateTotalSpace(sizesThisLine, a);
                var fittingAction = determineFittingAction(options[a.fitting], idealRequiredSpace, availableSpace[a.axis]);

                if (fittingAction === FITTING_ACTION.APPLY_STRETCHING) {
                    stretchSizesToFitContainer(sizesThisLine, idealRequiredSpace, a);
                } else if (fittingAction === FITTING_ACTION.APPLY_SHRINKING) {
                    shrinkSizesToFitContainer(sizesThisLine, idealRequiredSpace, a);
                }

                sizesAllLines.push(sizesThisLine);
            }

            return sizesAllLines;
        }

        // Calculate the required size for each element on axis B, based on the requested
        // fitting mode.
        function calculateSizesOnAxisB(lines, sizesAllLines) {
            var largestElementsForEachLine = [];
            var largestSizesForEachLine = [];
            var elementIndex;
            var lineIndex;
            var line;

            // Find the largest element on each line.
            for (lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
                line = lines[lineIndex];
                line.largestElement = null;
                line.largestSize = { width: Number.NEGATIVE_INFINITY, height: Number.NEGATIVE_INFINITY };

                // Find the largest element on this line.
                for (elementIndex = 0; elementIndex < line.length; ++elementIndex) {
                    var sizesThisElement = sizesAllLines[lineIndex][elementIndex];

                    if (sizesThisElement[b.size] > line.largestSize[b.size]) {
                        line.largestElement = line[elementIndex];
                        line.largestSize = sizesThisElement;
                    }
                }

                largestElementsForEachLine.push(line.largestElement);
                largestSizesForEachLine.push(line.largestSize);
            }

            // Calculate line heights using the largest element on each line.
            var idealRequiredSpace = calculateTotalSpace(largestSizesForEachLine, b);
            var fittingAction = determineFittingAction(options[b.fitting], idealRequiredSpace, availableSpace[b.axis]);

            if (fittingAction === FITTING_ACTION.APPLY_STRETCHING) {
                stretchSizesToFitContainer(largestSizesForEachLine, idealRequiredSpace, b);
            } else if (fittingAction === FITTING_ACTION.APPLY_SHRINKING) {
                shrinkSizesToFitContainer(largestSizesForEachLine, idealRequiredSpace, b);
            }

            // Calculate sizes for other elements based on the height of the line they're on.
            for (lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
                line = lines[lineIndex];

                for (elementIndex = 0; elementIndex < line.length; ++elementIndex) {
                    var sizesForThisElement = sizesAllLines[lineIndex][elementIndex];
                    var currentSize = sizesForThisElement[b.size];
                    var availableSize = lines.length === 1 ? availableSpace[b.axis] : line.largestSize[b.size];
                    var elementFittingAction = determineFittingAction(options[b.fitting], currentSize, availableSize);

                    if (elementFittingAction === FITTING_ACTION.APPLY_STRETCHING) {
                        sizesForThisElement[b.size] = Math.min(availableSize, sizesForThisElement[b.maxSize]);
                    } else if (elementFittingAction === FITTING_ACTION.APPLY_SHRINKING) {
                        sizesForThisElement[b.size] = Math.max(availableSize, sizesForThisElement[b.minSize]);
                    }
                }
            }

            return sizesAllLines;
        }

        function determineFittingAction(fittingMode, currentSize, availableSize) {
            switch (fittingMode) {
                case pc.FITTING_NONE:
                    return FITTING_ACTION.NONE;

                case pc.FITTING_STRETCH:
                    if (currentSize < availableSize) {
                        return FITTING_ACTION.APPLY_STRETCHING;
                    }

                    return FITTING_ACTION.NONE;

                case pc.FITTING_SHRINK:
                    if (currentSize >= availableSize) {
                        return FITTING_ACTION.APPLY_SHRINKING;
                    }

                    return FITTING_ACTION.NONE;

                case pc.FITTING_BOTH:
                    if (currentSize < availableSize) {
                        return FITTING_ACTION.APPLY_STRETCHING;
                    } else if (currentSize >= availableSize) {
                        return FITTING_ACTION.APPLY_SHRINKING;
                    }

                    return FITTING_ACTION.NONE;

                default:
                    throw new Error('Unrecognized fitting mode: ' + fittingMode);
            }
        }

        function calculateTotalSpace(sizes, axis) {
            var totalSizes = sumValues(sizes, axis.size);
            var totalSpacing = (sizes.length - 1) * options.spacing[axis.axis];

            return totalSizes + totalSpacing;
        }

        function stretchSizesToFitContainer(sizesThisLine, idealRequiredSpace, axis) {
            var ascendingMaxSizeOrder = getTraversalOrder(sizesThisLine, axis.maxSize);
            var fittingProportions = getNormalizedValues(sizesThisLine, axis.fittingProportion);
            var fittingProportionSums = createSumArray(fittingProportions, ascendingMaxSizeOrder);

            // Start by working out how much we have to stretch the child elements by
            // in total in order to fill the available space in the container
            var remainingUndershoot = availableSpace[axis.axis] - idealRequiredSpace;

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
                var targetSize = sizesThisLine[index][axis.size] + targetIncrease;

                // Work out how much we're actually able to stretch this element by,
                // based on its maximum size, and apply the result.
                var maxSize = sizesThisLine[index][axis.maxSize];
                var actualSize = Math.min(targetSize, maxSize);

                sizesThisLine[index][axis.size] = actualSize;

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
        function shrinkSizesToFitContainer(sizesThisLine, idealRequiredSpace, axis) {
            var descendingMinSizeOrder = getTraversalOrder(sizesThisLine, axis.minSize, true);
            var fittingProportions = getNormalizedValues(sizesThisLine, axis.fittingProportion);
            var inverseFittingProportions = invertNormalizedValues(fittingProportions);
            var inverseFittingProportionSums = createSumArray(inverseFittingProportions, descendingMinSizeOrder);

            var remainingOvershoot = idealRequiredSpace - availableSpace[axis.axis];

            for (var i = 0; i < sizesThisLine.length; ++i) {
                var index = descendingMinSizeOrder[i];

                // Similar to the stretch calculation above, we calculate the ideal
                // size reduction value for this element based on its fitting proportion.
                // However, note that we're using the inverse of the fitting value, as
                // using the regular value would mean that an element with a fitting
                // value of, say, 0.4, ends up rendering very small when shrinking is
                // being applied. Using the inverse means that the balance of sizes
                // between elements is similar for both the Stretch and Shrink modes.
                var targetReduction = calculateAdjustment(index, remainingOvershoot, inverseFittingProportions, inverseFittingProportionSums);
                var targetSize = sizesThisLine[index][axis.size] - targetReduction;

                var minSize = sizesThisLine[index][axis.minSize];
                var actualSize = Math.max(targetSize, minSize);

                sizesThisLine[index][axis.size] = actualSize;

                var actualReduction = Math.max(actualSize - targetSize, 0);
                var appliedReduction = targetReduction - actualReduction;

                remainingOvershoot -= appliedReduction;
            }
        }

        function calculateAdjustment(index, remainingAdjustment, fittingProportions, fittingProportionSums) {
            var proportion = fittingProportions[index];
            var sumOfRemainingProportions = fittingProportionSums[index];

            if (Math.abs(proportion) < 1e-5 && Math.abs(sumOfRemainingProportions) < 1e-5) {
                return remainingAdjustment;
            }

            return remainingAdjustment * proportion / sumOfRemainingProportions;
        }

        // Calculate base positions based on the element sizes and spacing.
        function calculateBasePositions(lines, sizes) {
            var cursor = {};
            cursor[a.axis] = 0;
            cursor[b.axis] = 0;

            lines[a.size] = Number.NEGATIVE_INFINITY;

            var positionsAllLines = [];

            for (var lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
                var line = lines[lineIndex];

                if (line.length === 0) {
                    return;
                }

                var positionsThisLine = [];
                var sizesThisLine = sizes[lineIndex];

                // Distribute elements along the line
                for (var elementIndex = 0; elementIndex < line.length; ++elementIndex) {
                    var element = line[elementIndex];
                    var sizesThisElement = sizesThisLine[elementIndex];

                    cursor[b.axis] -= minExtentB(element, sizesThisElement);
                    cursor[a.axis] -= minExtentA(element, sizesThisElement);

                    positionsThisLine[elementIndex] = {};
                    positionsThisLine[elementIndex][a.axis] = cursor[a.axis];
                    positionsThisLine[elementIndex][b.axis] = cursor[b.axis];

                    cursor[b.axis] += minExtentB(element, sizesThisElement);
                    cursor[a.axis] += maxExtentA(element, sizesThisElement) + options.spacing[a.axis];
                }

                // Record the size of the overall line
                line[a.size] = cursor[a.axis] - options.spacing[a.axis];
                line[b.size] = line.largestSize[b.size];

                // Keep track of the longest line
                lines[a.size] = Math.max(lines[a.size], line[a.size]);

                // Move the cursor to the next line
                cursor[a.axis] = 0;
                cursor[b.axis] += line[b.size] + options.spacing[b.axis];

                positionsAllLines.push(positionsThisLine);
            }

            // Record the size of the full set of lines
            lines[b.size] = cursor[b.axis] - options.spacing[b.axis];

            return positionsAllLines;
        }

        // Adjust base positions to account for the requested alignment and padding.
        function applyAlignmentAndPadding(lines, sizes, positions) {
            var alignmentA = options.alignment[a.axis];
            var alignmentB = options.alignment[b.axis];

            var paddingA = options.padding[a.axis];
            var paddingB = options.padding[b.axis];

            for (var lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
                var line = lines[lineIndex];
                var sizesThisLine = sizes[lineIndex];
                var positionsThisLine = positions[lineIndex];

                var axisAOffset = (availableSpace[a.axis] - line[a.size])  * alignmentA + paddingA;
                var axisBOffset = (availableSpace[b.axis] - lines[b.size]) * alignmentB + paddingB;

                for (var elementIndex = 0; elementIndex < line.length; ++elementIndex) {
                    var withinLineAxisBOffset = (line[b.size] - sizesThisLine[elementIndex][b.size]) * options.alignment[b.axis];

                    positionsThisLine[elementIndex][a.axis] += axisAOffset;
                    positionsThisLine[elementIndex][b.axis] += axisBOffset + withinLineAxisBOffset;
                }
            }
        }

        // Applies the final calculated sizes and positions back to elements themselves.
        function applySizesAndPositions(lines, sizes, positions) {
            for (var lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
                var line = lines[lineIndex];
                var sizesThisLine = sizes[lineIndex];
                var positionsThisLine = positions[lineIndex];

                for (var elementIndex = 0; elementIndex < line.length; ++elementIndex) {
                    var element = line[elementIndex];

                    element[a.calculatedSize] = sizesThisLine[elementIndex][a.size];
                    element[b.calculatedSize] = sizesThisLine[elementIndex][b.size];

                    if (options.orientation === pc.ORIENTATION_HORIZONTAL) {
                        element.entity.setLocalPosition(
                            positionsThisLine[elementIndex][a.axis],
                            positionsThisLine[elementIndex][b.axis],
                            element.entity.getLocalPosition().z
                        );
                    } else {
                        element.entity.setLocalPosition(
                            positionsThisLine[elementIndex][b.axis],
                            positionsThisLine[elementIndex][a.axis],
                            element.entity.getLocalPosition().z
                        );
                    }
                }
            }
        }

        function createLayoutInfo(lines) {
            var layoutWidth = lines.width;
            var layoutHeight = lines.height;

            var xOffset = (availableSpace.x - layoutWidth) * options.alignment.x + options.padding.x;
            var yOffset = (availableSpace.y - layoutHeight) * options.alignment.y + options.padding.y;

            return {
                bounds: new pc.Vec4(
                    xOffset,
                    yOffset,
                    layoutWidth,
                    layoutHeight
                )
            };
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
                    minWidth: minWidth,
                    minHeight: minHeight,
                    maxWidth: maxWidth,
                    maxHeight: maxHeight,
                    width: width,
                    height: height,
                    fitWidthProportion: fitWidthProportion,
                    fitHeightProportion: fitHeightProportion
                });
            }

            return sizeProperties;
        }

        // When reading an element's width/height, minWidth/minHeight etc, we have to look in
        // a few different places in order. This is because the presence of a LayoutChildComponent
        // on each element is optional, and each property value also has a set of fallback defaults
        // to be used in cases where no value is specified.
        function getProperty(element, propertyName) {
            var layoutChildComponent = element.entity.layoutchild;

            // First attempt to get the value from the element's LayoutChildComponent, if present.
            if (layoutChildComponent && layoutChildComponent.enabled && layoutChildComponent[propertyName] !== undefined && layoutChildComponent[propertyName] !== null) {
                return layoutChildComponent[propertyName];
            } else if (element[propertyName] !== undefined) {
                return element[propertyName];
            }

            return PROPERTY_DEFAULTS[propertyName];
        }

        function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        function sumValues(items, propertyName) {
            return items.reduce(function (accumulator, current) {
                return accumulator + current[propertyName];
            }, 0);
        }

        function getNormalizedValues(items, propertyName) {
            var sum = sumValues(items, propertyName);
            var normalizedValues = [];
            var numItems = items.length;
            var i;

            if (sum === 0) {
                for (i = 0; i < numItems; ++i) {
                    normalizedValues.push(1 / numItems);
                }
            } else {
                for (i = 0; i < numItems; ++i) {
                    normalizedValues.push(items[i][propertyName] / sum);
                }
            }

            return normalizedValues;
        }

        function invertNormalizedValues(values) {
            // Guard against divide by zero error in the inversion calculation below
            if (values.length === 1) {
                return [1];
            }

            var invertedValues = [];
            var numValues = values.length;

            for (var i = 0; i < numValues; ++i) {
                invertedValues.push((1 - values[i]) / (numValues - 1));
            }

            return invertedValues;
        }

        function getTraversalOrder(items, orderBy, descending) {
            items.forEach(assignIndex);

            return items
                .slice()
                .sort(function (itemA, itemB) {
                    return descending ? itemB[orderBy] - itemA[orderBy] : itemA[orderBy] - itemB[orderBy];
                })
                .map(getIndex);
        }

        function assignIndex(item, index) {
            item.index = index;
        }

        function getIndex(item) {
            return item.index;
        }

        // Returns a new array containing the sums of the values in the original array,
        // running from right to left.
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

    Object.assign(LayoutCalculator.prototype, {
        calculateLayout: function (elements, options) {
            var calculateFn = CALCULATE_FNS[options.orientation];

            if (!calculateFn) {
                throw new Error('Unrecognized orientation value: ' + options.orientation);
            } else {
                return calculateFn(elements, options);
            }
        }
    });

    return {
        LayoutCalculator: LayoutCalculator
    };
}());
