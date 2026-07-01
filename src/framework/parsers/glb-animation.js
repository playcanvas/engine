import { Http } from '../../platform/net/http.js';
import { AnimEvents } from '../anim/evaluator/anim-events.js';
import { GlbParser } from './glb-parser.js';

/**
 * Parser for glb {@link Animation} resources.
 *
 * @ignore
 */
class GlbAnimationParser {
    canParse(context) {
        return context.ext === 'glb';
    }

    load(url, callback, asset) {
        const original = typeof url === 'string' ? url : url.original;
        this.handler.fetch(url, Http.ResponseType.ARRAY_BUFFER, (err, response) => {
            if (err) {
                callback(`Error loading animation resource: ${original} [${err}]`);
            } else {
                GlbParser.parse('filename.glb', '', response, this.handler.device, this.handler.assets, asset?.options ?? {}, (err, parseResult) => {
                    if (err) {
                        callback(err);
                    } else {
                        const animations = parseResult.animations;
                        if (asset?.data?.events) {
                            for (let i = 0; i < animations.length; i++) {
                                animations[i].events = new AnimEvents(Object.values(asset.data.events));
                            }
                        }
                        parseResult.destroy();
                        callback(null, animations);
                    }
                });
            }
        }, asset);
    }
}

export { GlbAnimationParser };
