// implementation of isEqual functionality for the Set
if (!Set.prototype.isEqual) {
    Set.prototype.isEqual = function(otherSet) {
        if(this.size !== otherSet.size) return false;
        for(let item of this) if(!otherSet.has(item)) return false;
        return true;
    };
}
