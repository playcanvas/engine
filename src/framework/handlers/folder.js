import { ResourceHandler } from './handler.js';

class FolderHandler extends ResourceHandler {
    constructor() {
        super('folder');
    }

    load(url, callback) {
        callback(null, null);
    }
}

export { FolderHandler };
