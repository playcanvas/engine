if (Number.isFinite === undefined) Number.isFinite = function(value) {
    return typeof value === 'number' && isFinite(value);
}
