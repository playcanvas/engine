function FolderHandler() {}

Object.assign(FolderHandler.prototype, {
    load: function (url, callback) {
        callback(null, null);
    },

    open: function (url, data) {
        return data;
    }
});

export { FolderHandler };
