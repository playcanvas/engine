Object.values = Object.values || function (object) {
  return Object.keys(object).map(key => object[key]);
};
