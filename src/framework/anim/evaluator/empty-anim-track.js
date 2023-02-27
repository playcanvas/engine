import { AnimTrack } from './anim-track.js';

/**
 * This AnimTrack can be used as a placeholder track when creating a state graph before having all associated animation data available.
 */
class EmptyAnimTrack extends AnimTrack {
    /**
     * Create a new empty AnimTrack instance.
     *
     * @hideconstructor
     */
    constructor() {
        super('empty', Number.MAX_VALUE, [], [], []);
    }
}

export { EmptyAnimTrack };
