class FolderHandler {
    constructor() {}

    load(url, callback) {
        callback(null, null);
    }

    open(url, data) {
        return data;
    }
}

export { FolderHandler };
