// move chai methods on window
(function(window) {
  window.should = window.chai.should();
  window.expect = window.chai.expect;
  window.assert = window.chai.assert;
})(window);

// Added these helpers to speed up porting to mocha
// TODO: remove and replace with expect() calls in tests

window.strictEqual = function (a, b) {
    expect(a).to.equal(b);
};

window.equal = function (a, b) {
    expect(a).to.equal(b);
}

window.notEqual = function (a, b) {
    expect(a).to.not.equal(b);
}

window.deepEqual = function (a, b) {
    expect(a).to.deep.equal(b);
}

window.ok = function (a) {
    expect(a).to.exist;
}

window.close = function (a, b, e) {
    expect(a).to.be.closeTo(b, e);
}
