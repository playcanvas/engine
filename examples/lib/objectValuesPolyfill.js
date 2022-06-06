if (!Object.values) {
    Object.values = function (o) {
        return Object.keys(o).map(function (k) {
            return o[k];
        });
    };
}
