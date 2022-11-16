export const METHOD_INITIALIZE = '_onInitialize';
export const METHOD_POST_INITIALIZE = '_onPostInitialize';
export const METHOD_UPDATE = '_onUpdate';
export const METHOD_POST_UPDATE = '_onPostUpdate';
export const METHOD_MAP = {
    [METHOD_INITIALIZE]: 'initialize',
    [METHOD_POST_INITIALIZE]: 'postInitialize',
    [METHOD_UPDATE]: 'update',
    [METHOD_POST_UPDATE]: 'postUpdate'
};
