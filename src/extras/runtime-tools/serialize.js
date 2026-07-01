const DEFAULTS = { depth: 6, maxKeys: 64, maxItems: 100, maxString: 4096 };

/**
 * Runs a function and returns a `[error, result]` tuple instead of throwing, so callers can
 * contain failures from arbitrary user code and throwing getters without scattering try/catch.
 *
 * @param {() => any} fn - The function to run.
 * @returns {[Error|null, any]} The caught error (or null) and the result.
 * @ignore
 */
const tryCatch = (fn) => {
    try {
        return [null, fn()];
    } catch (e) {
        return [e instanceof Error ? e : new Error(String(e)), undefined];
    }
};

const round = (n) => {
    const r = Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
    return Object.is(r, -0) ? 0 : r;
};

// duck-typed so no engine math classes need importing: Vec2/Vec3/Vec4/Quat/Color
const isVec = v => typeof v === 'object' && v !== null &&
    ((typeof v.x === 'number' && typeof v.y === 'number' && Object.keys(v).length <= 4) ||
     (typeof v.r === 'number' && typeof v.g === 'number' && typeof v.b === 'number'));

const vecToArr = (v) => {
    if (typeof v.r === 'number') {
        return typeof v.a === 'number' ? [round(v.r), round(v.g), round(v.b), round(v.a)] : [round(v.r), round(v.g), round(v.b)];
    }
    const a = [round(v.x), round(v.y)];
    if (typeof v.z === 'number') a.push(round(v.z));
    if (typeof v.w === 'number') a.push(round(v.w));
    return a;
};

const isNode = v => typeof v === 'object' && v !== null && Array.isArray(v.children) && typeof v.getPosition === 'function';

const pathOf = (e) => {
    const parts = [];
    for (let n = e; n; n = n.parent) {
        parts.push(n.name || '(unnamed)');
    }
    return parts.reverse().join('/');
};

// graph nodes are reduced to identity + world orientation, never expanded as a tree —
// callers query children/components explicitly if they want them.
const nodeSummary = (v) => {
    const s = { name: v.name ?? null, path: pathOf(v), enabled: v.enabled };
    const [, pos] = tryCatch(() => v.getPosition?.());
    if (pos) s.position = vecToArr(pos);
    const [, fwd] = tryCatch(() => v.forward);
    if (fwd) s.forward = vecToArr(fwd);
    s.children = v.children?.length ?? 0;
    if (v.c) s.components = Object.keys(v.c);
    return s;
};

function walk(v, depth, seen, o) {
    if (v === null || v === undefined) return null;
    const t = typeof v;
    if (t === 'number') return Number.isFinite(v) ? v : String(v);
    if (t === 'bigint') return String(v);
    if (t === 'boolean') return v;
    if (t === 'string') return v.length > o.maxString ? `${v.slice(0, o.maxString)}…` : v;
    if (t === 'function') return `[fn ${v.name || 'anonymous'}]`;
    if (t === 'symbol') return v.toString();

    // object specials that do not recurse
    if (isVec(v)) return vecToArr(v);
    if (ArrayBuffer.isView(v)) {
        return v instanceof DataView ? `[DataView ${v.byteLength}]` : capArr(Array.from(/** @type {any} */ (v)), depth, seen, o);
    }
    if (isNode(v)) return nodeSummary(v);
    if (typeof Node !== 'undefined' && v instanceof Node) return `<${v.nodeName?.toLowerCase()}>`;

    // recursing containers, guarded against cycles and runaway depth
    if (seen.has(v)) return '[circular]';
    if (depth <= 0) return `[${v.constructor?.name ?? 'Object'}]`;
    seen.add(v);
    let result;
    if (Array.isArray(v)) {
        result = capArr(v, depth, seen, o);
    } else if (v instanceof Map) {
        result = capArr([...v.entries()], depth, seen, o);
    } else if (v instanceof Set) {
        result = capArr([...v], depth, seen, o);
    } else {
        result = {};
        const keys = Object.keys(v); // own enumerable only — prototype getters are read on request, not walked
        let n = 0;
        for (const k of keys) {
            if (n++ >= o.maxKeys) {
                result['…'] = `+${keys.length - o.maxKeys} more keys`;
                break;
            }
            const [err, val] = tryCatch(() => v[k]);
            result[k] = err ? `[getter error: ${err.message}]` : walk(val, depth - 1, seen, o);
        }
    }
    seen.delete(v); // enter/exit so shared (non-cyclic) refs serialize fully instead of as '[circular]'
    return result;
}

function capArr(arr, depth, seen, o) {
    const out = arr.slice(0, o.maxItems).map(x => walk(x, depth - 1, seen, o));
    if (arr.length > o.maxItems) out.push(`+${arr.length - o.maxItems} more`);
    return out;
}

/**
 * Serializes an arbitrary value — including live engine objects — into bounded, cycle-safe JSON
 * suitable for returning across an eval bridge to a debugger or agent. Graph nodes reduce to a
 * summary (name, path, position, forward, component list); vectors/quats/colors become arrays.
 *
 * @param {any} value - The value to serialize.
 * @param {{ depth?: number, maxKeys?: number, maxItems?: number, maxString?: number }} [opts] - Bounds.
 * @returns {any} A JSON-serializable representation, or `{ error }` if serialization threw.
 * @ignore
 */
const serialize = (value, opts) => {
    const o = { ...DEFAULTS, ...opts };
    const [err, res] = tryCatch(() => walk(value, o.depth, new WeakSet(), o));
    return err ? { error: err.message } : res;
};

export { serialize, tryCatch };
