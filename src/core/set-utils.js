const set = {

    // helper function to compare two sets for equality
    equals(set1, set2) {

        if (set1.size !== set2.size) {
            return false;
        }
        for (const item of set1) {
            if (!set2.has(item)) {
                return false;
            }
        }
        return true;
    }
};

export { set };
