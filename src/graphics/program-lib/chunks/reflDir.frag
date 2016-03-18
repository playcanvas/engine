void getReflDir(inout psInternalData data) {
    data.reflDirW = normalize(-reflect(data.viewDirW, data.normalW));
}

