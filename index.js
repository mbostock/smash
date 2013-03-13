var fs = require("fs"),
    path = require("path"),
    stream = require("stream"),
    queue = require("queue-async");

module.exports = smash;
smash.readAllImports = readAllImports;
smash.readImports = readImports;

function smash(files) {
  var s = new stream.Transform({encoding: "utf8", decodeStrings: false}),
      last = "";

  s._transform = function(chunk, encoding, callback) {
    var lines = chunk.split("\n");
    if (lines.length > 1) {
      lines[0] = last + lines[0];
      last = lines.pop();
      lines.forEach(function(line) {
        if (!/^import\b/.test(line)) s.push(line + "\n");
      });
    } else {
      last += chunk;
    }
    callback();
  };

  readAllImports(files, function(error, files) {
    var q = queue(1);
    files.forEach(function(file) {
      q.defer(function(callback) {
        fs.createReadStream(file, {encoding: "utf8"})
            .on("open", function() { this.pipe(s, {end: false}); })
            .on("error", callback)
            .on("end", callback);
      });
    });
    q.await(function(error) {
      if (error) s.emit("error", error);
      else s.end();
    });
  });

  return s;
}

function readAllImports(files, callback) {
  var fileMap = {},
      allFiles = [];

  function readAllImports(file, callback) {
    if (file in fileMap) return callback(null);
    fileMap[file] = true;
    readImports(file, function(error, files) {
      var q = queue(1);
      files.forEach(function(file) {
        q.defer(readAllImports, file);
      });
      q.awaitAll(function(error) {
        if (!error) allFiles.push(file);
        callback(error);
      });
    });
  }

  var q = queue(1);
  files.forEach(function(file) {
    q.defer(readAllImports, file);
  });
  q.awaitAll(function(error) {
    callback(error, error ? null : allFiles);
  });
}

function readImports(file, callback) {
  var directory = path.dirname(file),
      extension = path.extname(file);
  fs.readFile(file, "utf8", function(error, text) {
    if (error) return callback(error);
    var files = [];

    text.split("\n").forEach(function(line, i) {
      if (/^import\b/.test(line)) {
        var match = /^import\s+"([^"]+)"\s*;?\s*$/.exec(line);
        if (match) {
          var target = match[1];
          if (!path.extname(target)) target += extension;
          files.push(path.join(directory, target));
        } else {
          throw new Error("invalid import: " + file + ":" + i + ": " + line);
        }
      }
    });

    callback(null, files);
  });
}
