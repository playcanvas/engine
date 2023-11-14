class AnimBlend {
    static dot(a, b) {
        const len  = a.length;
        let result = 0;
        for (let i = 0; i < len; ++i) {
            result += a[i] * b[i];
        }
        return result;
    }

    static normalize(a) {
        let l = AnimBlend.dot(a, a);
        if (l > 0) {
            l = 1.0 / Math.sqrt(l);
            const len = a.length;
            for (let i = 0; i < len; ++i) {
                a[i] *= l;
            }
        }
    }

    static set(a, b, type) {
        const len  = a.length;

        if (type === 'quaternion') {
            let l = AnimBlend.dot(b, b);
            if (l > 0) {
                l = 1.0 / Math.sqrt(l);
            }
            for (let i = 0; i < len; ++i) {
                a[i] = b[i] * l;
            }
        } else {
            for (let i = 0; i < len; ++i) {
                a[i] = b[i];
            }
        }
    }

    static blendVec(a, b, t, additive) {
        const it = additive ? 1.0 : 1.0 - t;
        const len = a.length;
        for (let i = 0; i < len; ++i) {
            a[i] = a[i] * it + b[i] * t;
        }
    }

    static blendQuat(a, b, t, additive) {
        const len = a.length;
        const it = additive ? 1.0 : 1.0 - t;

        // negate b if a and b don't lie in the same winding (due to
        // double cover). if we don't do this then often rotations from
        // one orientation to another go the long way around.
        if (AnimBlend.dot(a, b) < 0) {
            t = -t;
        }

        for (let i = 0; i < len; ++i) {
            a[i] = a[i] * it + b[i] * t;
        }

        if (!additive) {
            AnimBlend.normalize(a);
        }
    }

    static blend(a, b, t, type, additive) {
        if (type === 'quaternion') {
            AnimBlend.blendQuat(a, b, t, additive);
        } else {
            AnimBlend.blendVec(a, b, t, additive);
        }
    }

    static stableSort(a, lessFunc) {
        const len = a.length;
        for (let i = 0; i < len - 1; ++i) {
            for (let j = i + 1; j < len; ++j) {
                if (lessFunc(a[j], a[i])) {
                    const tmp = a[i];
                    a[i] = a[j];
                    a[j] = tmp;
                }
            }
        }
    }
}

export { AnimBlend };
