void getViewDir(inout psInternalData data) {
    data.viewDirW = normalize(view_position - vPositionW);
}

