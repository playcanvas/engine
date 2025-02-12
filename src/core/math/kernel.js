/**
 * Sampling kernels.
 *
 * @namespace
 * @category Math
 */
class Kernel {
    /**
     * Generate a set of points distributed in a series of concentric rings around the origin. The
     * spacing between points is determined by the number of points in the first ring, and subsequent
     * rings maintain this spacing by adjusting their number of points accordingly.
     *
     * @param {number} numRings - The number of concentric rings to generate.
     * @param {number} numPoints - The number of points in the first ring.
     * @returns {Array<number>} - An array where each point is represented by two numbers.
     */
    static concentric(numRings, numPoints) {
        const kernel = [];

        // center point
        kernel.push(0, 0);

        // spacing based on the first ring
        const spacing = (2 * Math.PI / numRings) / numPoints;

        // Generate points for each ring
        for (let ring = 1; ring <= numRings; ring++) {
            const radius = ring / numRings;
            const circumference = 2 * Math.PI * radius;
            const pointsPerRing = Math.max(1, Math.floor(circumference / spacing));
            const angleStep = (2 * Math.PI) / pointsPerRing;

            for (let point = 0; point < pointsPerRing; point++) {
                const angle = point * angleStep;
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);
                kernel.push(x, y);
            }
        }

        return kernel;
    }
}

export { Kernel };
