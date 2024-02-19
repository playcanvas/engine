import { ResourceHandler } from './handler.js';

class FolderHandler extends ResourceHandler {
    constructor(app) {
        super(app);
        this.handlerType = 'folder';
    }

    load(url, callback) {
        callback(null, null);
    }
}

export { FolderHandler };
