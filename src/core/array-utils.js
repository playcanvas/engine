const array = {

    // helper function to compare two arrays for equality
    equals(arr1, arr2) {

        if (arr1.size !== arr2.size) {
            return false;
        }
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) {
                return false;
            }
        }
        return true;
    }
};

export { array };
