// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries
// https://stackoverflow.com/questions/68654735/ie11-compatible-object-fromentries
Object.fromEntries = Object.fromEntries || function fromEntries(entries) {
    if (!entries || !entries[Symbol.iterator]) { throw new Error('Object.fromEntries() requires a single iterable argument'); }
  
    var res = {};
    for(var i = 0; i < entries.length; i++) {
        res[entries[i][0]] = entries[i][1];
    }
    return res;
};

Object.entries = Object.entries || function(obj) {
    var ownProps = Object.keys(obj),
        i = ownProps.length,
        resArray = new Array(i); // preallocate the Array
    while (i--)
        resArray[i] = [ownProps[i], obj[ownProps[i]]];
    
    return resArray;
};
