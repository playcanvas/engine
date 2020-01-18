Object.assign(pc, function () {
    /**
     * @class
     * @name pc.StencilParameters
     * @classdesc Holds stencil test settings.
     * @description Create a new StencilParameters instance.
     * @param {object} options - Options object to configure the stencil parameters.
     * @property {number} func Sets stencil test function. See {@link pc.GraphicsDevice#setStencilFunc}.
     * @property {number} ref Sets stencil test reference value. See {@link pc.GraphicsDevice#setStencilFunc}.
     * @property {number} fail Sets operation to perform if stencil test is failed. See {@link pc.GraphicsDevice#setStencilOperation}.
     * @property {number} zfail Sets operation to perform if depth test is failed. See {@link pc.GraphicsDevice#setStencilOperation}.
     * @property {number} zpass Sets operation to perform if both stencil and depth test are passed. See {@link pc.GraphicsDevice#setStencilOperation}.
     * @property {number} readMask Sets stencil test reading mask. See {@link pc.GraphicsDevice#setStencilFunc}.
     * @property {number} writeMask Sets stencil test writing mask. See {@link pc.GraphicsDevice#setStencilOperation}.
     */
    var StencilParameters = function (options) {
        this.func = options.func === undefined ? pc.FUNC_ALWAYS : options.func;
        this.ref = options.ref || 0;
        this.readMask = options.readMask === undefined ? 0xFF : options.readMask;
        this.writeMask = options.writeMask === undefined ? 0xFF : options.writeMask;

        this.fail = options.fail || pc.STENCILOP_KEEP; // keep == 0
        this.zfail = options.zfail || pc.STENCILOP_KEEP;
        this.zpass = options.zpass || pc.STENCILOP_KEEP;
    };

    StencilParameters.prototype.clone = function () {
        var clone = new pc.StencilParameters({
            func: this.func,
            ref: this.ref,
            readMask: this.readMask,
            writeMask: this.writeMask,
            fail: this.fail,
            zfail: this.zfail,
            zpass: this.zpass
        });
        return clone;
    };

    return {
        StencilParameters: StencilParameters
    };
}());
