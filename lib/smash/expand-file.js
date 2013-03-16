var path = require("path");

module.exports = function(file, extension) {
  if (!extension) extension = defaultExtension;
  if (/\/$/.test(file)) file += "index" + extension;
  else if (!path.extname(file)) file += extension;
  return file;
};

var defaultExtension = ".js";
