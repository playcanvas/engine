import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Http } from '../../platform/net/http.js';
import { Animation, AnimationKey, AnimationNode } from '../../scene/animation/animation.js';

/**
 * Parser for PlayCanvas JSON {@link Animation} resources. Acts as the catch-all (non-glb) animation
 * parser.
 *
 * @ignore
 */
class JsonAnimationParser {
    canParse() {
        return true;
    }

    load(url, callback, asset) {
        const original = typeof url === 'string' ? url : url.original;
        this.handler.fetch(url, Http.ResponseType.JSON, (err, response) => {
            if (err) {
                callback(`Error loading animation resource: ${original} [${err}]`);
            } else {
                callback(null, this[`_parseAnimationV${response.animation.version}`](response));
            }
        }, asset);
    }

    _parseAnimationV3(data) {
        const animData = data.animation;

        const anim = new Animation();
        anim.name = animData.name;
        anim.duration = animData.duration;

        for (let i = 0; i < animData.nodes.length; i++) {
            const node = new AnimationNode();

            const n = animData.nodes[i];
            node._name = n.name;

            for (let j = 0; j < n.keys.length; j++) {
                const k = n.keys[j];

                const t = k.time;
                const p = k.pos;
                const r = k.rot;
                const s = k.scale;
                const pos = new Vec3(p[0], p[1], p[2]);
                const rot = new Quat().setFromEulerAngles(r[0], r[1], r[2]);
                const scl = new Vec3(s[0], s[1], s[2]);

                const key = new AnimationKey(t, pos, rot, scl);

                node._keys.push(key);
            }

            anim.addNode(node);
        }

        return anim;
    }

    _parseAnimationV4(data) {
        const animData = data.animation;

        const anim = new Animation();
        anim.name = animData.name;
        anim.duration = animData.duration;

        for (let i = 0; i < animData.nodes.length; i++) {
            const node = new AnimationNode();

            const n = animData.nodes[i];
            node._name = n.name;

            const defPos = n.defaults.p;
            const defRot = n.defaults.r;
            const defScl = n.defaults.s;

            for (let j = 0; j < n.keys.length; j++) {
                const k = n.keys[j];

                const t = k.t;
                const p = defPos ? defPos : k.p;
                const r = defRot ? defRot : k.r;
                const s = defScl ? defScl : k.s;
                const pos = new Vec3(p[0], p[1], p[2]);
                const rot = new Quat().setFromEulerAngles(r[0], r[1], r[2]);
                const scl = new Vec3(s[0], s[1], s[2]);

                const key = new AnimationKey(t, pos, rot, scl);

                node._keys.push(key);
            }

            anim.addNode(node);
        }

        return anim;
    }
}

export { JsonAnimationParser };
