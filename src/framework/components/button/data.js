import { Color } from '../../../core/math/color.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { BUTTON_TRANSITION_MODE_TINT } from './constants.js';

/**
 * @import { Asset } from '../../../framework/asset/asset.js'
 * @import { Entity } from '../../../framework/entity.js'
 */

class ButtonComponentData {
    enabled = true;

    active = true;

    /** @type {Entity|null} */
    imageEntity = null;

    hitPadding = new Vec4();

    transitionMode = BUTTON_TRANSITION_MODE_TINT;

    hoverTint = new Color(0.75, 0.75, 0.75);

    pressedTint = new Color(0.5, 0.5, 0.5);

    inactiveTint = new Color(0.25, 0.25, 0.25);

    fadeDuration = 0;

    /** @type {Asset|null} */
    hoverSpriteAsset = null;

    hoverSpriteFrame = 0;

    /** @type {Asset|null} */
    pressedSpriteAsset = null;

    pressedSpriteFrame = 0;

    /** @type {Asset|null} */
    inactiveSpriteAsset = null;

    inactiveSpriteFrame = 0;
}

export { ButtonComponentData };
