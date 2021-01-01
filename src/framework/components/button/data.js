import { Color } from '../../../core/color.js';

import { Vec4 } from '../../../math/vec4.js';

import { BUTTON_TRANSITION_MODE_TINT } from './constants.js';

function ButtonComponentData() {
    this.enabled = true;

    this.active = true;
    this.imageEntity = null;
    this.hitPadding = new Vec4();
    this.transitionMode = BUTTON_TRANSITION_MODE_TINT;
    this.hoverTint = new Color(0.75, 0.75, 0.75);
    this.pressedTint = new Color(0.5, 0.5, 0.5);
    this.inactiveTint = new Color(0.25, 0.25, 0.25);
    this.fadeDuration = 0;
    this.hoverSpriteAsset = null;
    this.hoverSpriteFrame = 0;
    this.pressedSpriteAsset = null;
    this.pressedSpriteFrame = 0;
    this.inactiveSpriteAsset = null;
    this.inactiveSpriteFrame = 0;
}

export { ButtonComponentData };
