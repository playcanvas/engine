/**
 * Map utility functions.
 *
 * @ignore
 */
class MapUtils {
    /**
     * Merges multiple maps into a new Map instance. If multiple maps contain the same key, the
     * value from the later map in the arguments list takes precedence.
     *
     * Null or undefined maps are safely handled and skipped during the merge process.
     *
     * @param {...(Map|null|undefined)} maps - Maps to merge.
     * @returns {Map} A new Map containing all entries from the input maps with conflicts resolved.
     * @example
     * // Create a merged map where entries from map2 override entries from map1
     * const mergedMap = MapUtils.merge(map1, map2);
     */
    static merge(...maps) {
        // Start with a copy of the first map for better performance with large maps
        const result = new Map(maps[0] ?? []);

        // Add entries from remaining maps, overriding existing keys
        for (let i = 1; i < maps.length; i++) {
            const map = maps[i];
            if (map) {
                for (const [key, value] of map) {
                    result.set(key, value);
                }
            }
        }
        return result;
    }
}

export { MapUtils };
