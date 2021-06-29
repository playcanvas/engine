import { RefCountedObject } from '../core/ref-counted-object.js';
import { SkinInstance } from './skin-instance.js';

// Class used as an entry in the ref-counted skin instance cache
class SkinInstanceCachedObject extends RefCountedObject {
    constructor(skin, skinInstance) {
        super();
        this.skin = skin;
        this.skinInstance = skinInstance;
    }
}

// Pure static class, implementing the cache of skin instances used by render component.
class SkinInstanceCache {
    // map of SkinInstances allowing those to be shared between
    // (specifically a single glb with multiple render components)
    // It maps a rootBone to an array of SkinInstanceCachedObject
    // this allows us to find if a skin instance already exists for a rootbone, and a specific skin
    static _skinInstanceCache = new Map();

    // #if _DEBUG
    // function that logs out the state of the skin instances cache
    static logCachedSkinInstances() {
        console.log("CachedSkinInstances");
        SkinInstanceCache._skinInstanceCache.forEach(function (array, rootBone) {
            console.log(`${rootBone.name}: Array(${array.length})`);
            for (let i = 0; i < array.length; i++) {
                console.log(`  ${i}: RefCount ${array[i].getRefCount()}`);
            }
        });
    }
    // #endif

    // returns cached or creates a skin instance for the skin and a rootBone, to be used by render component
    // on the specified entity
    static createCachedSkinedInstance(skin, rootBone, entity) {

        // try and get skin instance from the cache
        let skinInst = SkinInstanceCache.getCachedSkinInstance(skin, rootBone);

        // don't have skin instance for this skin
        if (!skinInst) {

            skinInst = new SkinInstance(skin);
            skinInst.resolve(rootBone, entity);

            // add it to the cache
            SkinInstanceCache.addCachedSkinInstance(skin, rootBone, skinInst);
        }

        return skinInst;
    }

    // returns already created skin instance from skin, for use on the rootBone
    // ref count of existing skinInstance is increased
    static getCachedSkinInstance(skin, rootBone) {

        let skinInstance = null;

        // get an array of cached object for the rootBone
        const cachedObjArray = SkinInstanceCache._skinInstanceCache.get(rootBone);
        if (cachedObjArray) {

            // find matching skin
            const cachedObj = cachedObjArray.find((element) => element.skin === skin);
            if (cachedObj) {
                cachedObj.incRefCount();
                skinInstance = cachedObj.skinInstance;
            }
        }

        return skinInstance;
    }

    // adds skin instance to the cache, and increases ref count on it
    static addCachedSkinInstance(skin, rootBone, skinInstance) {

        // get an array for the rootBone
        let cachedObjArray = SkinInstanceCache._skinInstanceCache.get(rootBone);
        if (!cachedObjArray) {
            cachedObjArray = [];
            SkinInstanceCache._skinInstanceCache.set(rootBone, cachedObjArray);
        }

        // find entry for the skin
        let cachedObj = cachedObjArray.find((element) => element.skin === skin);
        if (!cachedObj) {
            cachedObj = new SkinInstanceCachedObject(skin, skinInstance);
            cachedObjArray.push(cachedObj);
        }

        cachedObj.incRefCount();
    }

    // removes skin instance from the cache. This decreases ref count, and when that reaches 0 it gets destroyed
    static removeCachedSkinInstance(skinInstance) {

        if (skinInstance) {
            const rootBone = skinInstance.rootBone;
            if (rootBone) {

                // an array for boot bone
                const cachedObjArray = SkinInstanceCache._skinInstanceCache.get(rootBone);
                if (cachedObjArray) {

                    // actual skin instance
                    const cachedObjIndex = cachedObjArray.findIndex((element) => element.skinInstance === skinInstance);
                    if (cachedObjIndex >= 0) {

                        // dec ref on the object
                        const cachedObj = cachedObjArray[cachedObjIndex];
                        cachedObj.decRefCount();

                        // last reference, needs to be destroyed
                        if (cachedObj.getRefCount() === 0) {
                            cachedObjArray.splice(cachedObjIndex, 1);

                            // if the array is empty
                            if (!cachedObjArray.length) {
                                SkinInstanceCache._skinInstanceCache.delete(rootBone);
                            }

                            // destroy the skin instance
                            if (skinInstance) {
                                skinInstance.destroy();
                                cachedObj.skinInstance = null;
                            }
                        }
                    }
                }
            }
        }
    }
}

export { SkinInstanceCache };
