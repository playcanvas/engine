Object.assign(pc, function () {
    var ButtonComponentData = function () {
        this.enabled = true;

        this.active = true;
        this.imageEntity = null;
        this.hitPadding = new pc.Vec4();
        this.transitionMode = pc.BUTTON_TRANSITION_MODE_TINT;
        this.hoverTint = new pc.Color(0.75, 0.75, 0.75);
        this.pressedTint = new pc.Color(0.5, 0.5, 0.5);
        this.inactiveTint = new pc.Color(0.25, 0.25, 0.25);
        this.fadeDuration = 0;
        this.hoverSpriteAsset = null;
        this.hoverSpriteFrame = 0;
        this.pressedSpriteAsset = null;
        this.pressedSpriteFrame = 0;
        this.inactiveSpriteAsset = null;
        this.inactiveSpriteFrame = 0;
    };

    return {
        ButtonComponentData: ButtonComponentData
    };
}());
