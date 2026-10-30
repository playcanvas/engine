// The most splats a node of the tree takes over in a level from its leaves. A node is the smallest
// part of the scene that changes level as one, so the budget is spent in about budget / this many
// pieces: the more there are, the more closely the level follows distance. Refining a node near the
// camera also adds about this many splats per level, so reaching full detail there costs about
// this many splats per level of the scene, which has to fit the budget left over the scene at its
// coarsest - with room to spare on a mobile budget of 1M splats, where the coarsest level of a
// large scene can take most of it. Smaller nodes make the drawn cut larger, but its cost follows
// the budget over this size, which stays small.
const NODE_SPLATS = 4096;

/**
 * Per-level data of one node of a manifest's octree while the tree is built: the splat range each
 * level is held as, as file index, offset and count. A level with no splats has count 0, and a
 * level whose splats are not one contiguous range of one file has file -1.
 *
 * @typedef {object} TreeEntry
 * @property {{ min: number[], max: number[] }} bound - The bounds of the node's region.
 * @property {number[]} children - Indices of the child entries.
 * @property {Int32Array} file - Per level, the file holding it, -1 when it is spread over more.
 * @property {Float64Array} offset - Per level, the offset of its range in the file.
 * @property {Float64Array} count - Per level, its splat count.
 * @ignore
 */

/**
 * Reads a node of a manifest's octree and its subtree into entries, the leaves holding their own
 * ranges, and an inner node the union of its children's ranges in each level, where that union is
 * one contiguous range of one file.
 *
 * @param {object} node - The manifest node.
 * @param {number} lodLevels - Number of LOD levels.
 * @param {TreeEntry[]} entries - Receives the entries, a node before its subtree.
 * @returns {number} The index of the node's entry.
 */
const readEntries = (node, lodLevels, entries) => {
    const index = entries.length;
    const entry = {
        bound: node.bound,
        children: [],
        file: new Int32Array(lodLevels),
        offset: new Float64Array(lodLevels),
        count: new Float64Array(lodLevels)
    };
    entries.push(entry);

    if (node.lods) {
        for (let level = 0; level < lodLevels; level++) {
            const lod = node.lods[level];
            if (lod && lod.count > 0) {
                entry.file[level] = lod.file;
                entry.offset[level] = lod.offset || 0;
                entry.count[level] = lod.count;
            }
        }
        return index;
    }

    for (const child of node.children ?? []) {
        entry.children.push(readEntries(child, lodLevels, entries));
    }

    // the region's bounds are the union of its children's, so a child is never nearer the camera
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const c of entry.children) {
        const b = entries[c].bound;
        for (let axis = 0; axis < 3; axis++) {
            min[axis] = Math.min(min[axis], b.min[axis]);
            max[axis] = Math.max(max[axis], b.max[axis]);
        }
    }
    entry.bound = { min, max };

    // each level is the children's ranges joined, when they follow each other in one file
    for (let level = 0; level < lodLevels; level++) {
        const parts = [];
        let total = 0;
        let spread = false;
        for (const c of entry.children) {
            const child = entries[c];
            if (child.count[level] > 0) {
                parts.push(child);
                total += child.count[level];
                if (child.file[level] < 0) spread = true;
            }
        }
        entry.count[level] = total;
        if (total === 0) continue;

        if (!spread) {
            parts.sort((a, b) => a.offset[level] - b.offset[level]);
            const file = parts[0].file[level];
            for (let i = 1; i < parts.length && !spread; i++) {
                const prev = parts[i - 1];
                spread = parts[i].file[level] !== file || parts[i].offset[level] !== prev.offset[level] + prev.count[level];
            }
            if (!spread) {
                entry.file[level] = file;
                entry.offset[level] = parts[0].offset[level];
                continue;
            }
        }
        entry.file[level] = -1;
    }

    return index;
};

/**
 * Reorganizes a streamed GSplat manifest whose octree holds its data in the leaves only - each
 * leaf holding every LOD level of its region - into the hierarchical tree a hierarchical
 * {@link GSplatOctree} is created from, where every node holds a single level and is replaced by
 * its children for more detail. No splat data is changed or moved: a node refers to existing
 * ranges of the existing files.
 *
 * Each level is held by the highest node whose whole region holds no more than `nodeSplats`
 * splats in it and in every coarser level, and whose leaves' data for it is one contiguous range
 * of one file. So coarse levels are held by few nodes covering large regions, and fine levels by
 * many small ones, the leaves holding the levels no node above them holds. A node holding several
 * levels becomes a chain of nodes with the same bounds, one per level.
 *
 * @param {object} data - The parsed manifest, `lod-meta.json`.
 * @param {number} [nodeSplats] - The most splats a node may hold in a level it takes over from its
 * leaves. Defaults to 4096.
 * @returns {object} The hierarchical octree data.
 * @ignore
 */
const buildLodTree = (data, nodeSplats = NODE_SPLATS) => {
    const lodLevels = data.lodLevels;
    /** @type {TreeEntry[]} */
    const entries = [];
    readEntries(data.tree, lodLevels, entries);

    // the finest level from which on each level of the region can be held by the node itself
    const finestHeld = entries.map((entry) => {
        let finest = lodLevels;
        for (let level = lodLevels - 1; level >= 0; level--) {
            const count = entry.count[level];
            if (count > nodeSplats || (count > 0 && entry.file[level] < 0)) break;
            finest = level;
        }
        return finest;
    });

    // The nodes holding the levels from `coarsest` down for the region of an entry: the entry's
    // own chain, the finest of which is replaced by the chains below it, or only the chains below
    // it when it holds no level.
    const emit = (index, coarsest) => {
        if (coarsest < 0) return [];
        const entry = entries[index];
        const isLeaf = entry.children.length === 0;
        const finest = isLeaf ? 0 : Math.min(finestHeld[index], coarsest + 1);
        const below = isLeaf ? [] : entry.children.flatMap(c => emit(c, finest - 1));
        if (finest > coarsest) return below;

        let children = below;
        for (let level = finest; level <= coarsest; level++) {
            const count = entry.count[level];
            children = [{
                bound: entry.bound,
                level,
                lods: count > 0 ? { [level]: { file: entry.file[level], offset: entry.offset[level], count } } : {},
                children
            }];
        }
        return children;
    };

    return {
        ...data,
        hierarchical: true,
        tree: {
            bound: entries[0].bound,
            children: emit(0, lodLevels - 1)
        }
    };
};

export { buildLodTree };
