/**
 * Returns the average position of the part of a histogram between two fractions of its total:
 * the brightness the auto exposure exposes for, which leaves out the darkest and the brightest
 * parts of the screen. The bins at the two fractions count with the part of them which lies
 * between, so the average changes gradually as the brightness of the screen shifts across them.
 *
 * @param {ArrayLike<number>} histogram - The weight of each bin.
 * @param {number} lowPercent - The fraction of the total, 0-1, below which the darkest bins are
 * left out.
 * @param {number} highPercent - The fraction of the total, 0-1 and above the low one, above which
 * the brightest bins are left out.
 * @returns {number} The average position, as a fractional bin index, or -1 when nothing is left
 * between the two fractions, as for an empty histogram.
 * @ignore
 */
const meterHistogram = (histogram, lowPercent, highPercent) => {
    let total = 0;
    for (let i = 0; i < histogram.length; i++) {
        total += histogram[i];
    }

    const low = total * lowPercent;
    const high = total * highPercent;
    let start = 0;
    let sum = 0;
    let weight = 0;
    for (let i = 0; i < histogram.length; i++) {
        const end = start + histogram[i];
        const part = Math.min(end, high) - Math.max(start, low);
        if (part > 0) {
            sum += part * i;
            weight += part;
        }
        start = end;
    }

    return weight > 0 ? sum / weight : -1;
};

export { meterHistogram };
