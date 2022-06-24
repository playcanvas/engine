const catharsis = require("catharsis");
const originalParse = catharsis.parse;
catharsis.parse = function(str) {
  if (str[0] == '[') {
    return originalParse('Array<*>');
  }
  return originalParse(...arguments);
}
