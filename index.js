var fs = require("fs"),
    vm = require("vm"),
    path = require("path"),
    events = require("events"),
    stream = require("stream"),
    queue = require("queue-async");

module.exports = smash;

smash.version = require("./package").version;

// Returns a readable stream for the specified files.
// All imports are expanded the first time they are encountered.
// Subsequent redundant imports are ignored.
function smash(files) {
  var s = new stream.PassThrough({encoding: "utf8", decodeStrings: false}),
      q = queue(1),
      fileMap = {};

  // Streams the specified file and any imported files to the output stream. If
  // the specified file has already been streamed, does nothing and immediately
  // invokes the callback. Otherwise, the file is streamed in chunks, with
  // imports expanded and resolved as necessary.
  function streamRecursive(file, callback) {
    if (file in fileMap) return void callback(null);
    fileMap[file] = true;

    // Create a serialized queue with an initial guarding callback. This guard
    // ensures that the queue does not end prematurely; it only ends when the
    // entirety of the input file has been streamed, including all imports.
    var c, q = queue(1).defer(function(callback) { c = callback; });

    // The "error" and "end" events can be sent immediately to the guard
    // callback, so that streaming terminates immediately on error or end.
    // Otherwise, imports are streamed recursively and chunks are sent serially.
    readStream(file)
        .on("error", c)
        .on("import", function(file) { q.defer(streamRecursive, file); })
        .on("data", function(chunk) { q.defer(function(callback) { s.write(chunk, callback); }); })
        .on("end", c);

    // This last callback is only invoked when the file is fully streamed.
    q.awaitAll(callback);
  }

  // Stream each file serially.
  files.forEach(function(file) {
    q.defer(streamRecursive, expandFile(file, defaultExtension));
  });

  // When all files are streamed, or an error occurs, we're done!
  q.awaitAll(function(error) {
    if (error) s.emit("error", error);
    else s.end();
  });

  return s;
}

// Loads the specified files and their imports, then evaluates the specified
// expression in the context of the concatenated code.
smash.load = function(files, expression, callback) {
  var chunks = [];
  smash(files)
      .on("error", callback)
      .on("data", function(chunk) { chunks.push(chunk); })
      .on("end", function() { callback(null, vm.runInNewContext(chunks.join("") + ";" + expression)); });
};

// Returns the network of imports, starting with the specified input files.
// For each file in the returned map, an array specifies the set of files
// immediately imported by that file. This array is in order of import, and may
// contain duplicate entries.
smash.readGraph = function(files, callback) {
  var fileMap = {};

  function readRecursive(file, callback) {
    if (file in fileMap) return callback(null);
    smash.readImports(file, function(error, files) {
      if (error) return void callback(error);
      var q = queue(1);
      fileMap[file] = files;
      files.forEach(function(file) {
        q.defer(readRecursive, file);
      });
      q.awaitAll(callback);
    });
  }

  var q = queue(1);
  files.forEach(function(file) {
    q.defer(readRecursive, expandFile(file, defaultExtension));
  });
  q.awaitAll(function(error) {
    callback(error, error ? null : fileMap);
  });
};

// Reads all the imports from the specified files, returning an array of files.
// The returned array is in dependency order and only contains unique entries.
// The returned arrays also includes any input files at the end.
smash.readAllImports = function(files, callback) {
  var fileMap = {},
      allFiles = [];

  function readRecursive(file, callback) {
    if (file in fileMap) return callback(null);
    fileMap[file] = true;
    smash.readImports(file, function(error, files) {
      if (error) return void callback(error);
      var q = queue(1);
      files.forEach(function(file) {
        q.defer(readRecursive, file);
      });
      q.awaitAll(function(error) {
        if (!error) allFiles.push(file);
        callback(error);
      });
    });
  }

  var q = queue(1);
  files.forEach(function(file) {
    q.defer(readRecursive, expandFile(file, defaultExtension));
  });
  q.awaitAll(function(error) {
    callback(error, error ? null : allFiles);
  });
};

// Reads the import statements from the specified file, returning an array of
// files. Unlike readAllImports, this does not recursively traverse import
// statements; it only returns import statements in the specified input file.
// Also unlike readAllImports, this method returns every import statement,
// including redundant imports and self-imports.
smash.readImports = function(file, callback) {
  var files = [];

  readStream(file)
      .on("import", function(file) { files.push(file); })
      .on("error", callback)
      .on("end", function() { callback(null, files); });
};

// Returns a stream for the specified file. The returned emitter emits "import"
// events whenever an import statement is encountered, and "data" events
// whenever normal text is encountered, in addition to the standard "error" and
// "end" events.
function readStream(file) {
  var emitter = new events.EventEmitter(),
      directory = path.dirname(file),
      extension = path.extname(file) || defaultExtension;

  file = expandFile(file, extension);

  fs.readFile(file, "utf8", function(error, text) {
    if (error) return void emitter.emit("error", error);
    text.split("\n").some(function(line, i) {
      if (/^import\b/.test(line)) {
        var match = /^import\s+"([^"]+)"\s*;?\s*(?:\/\/.*)?$/.exec(line);
        if (match) {
          emitter.emit("import", path.join(directory, expandFile(match[1], extension)));
        } else {
          emitter.emit("error", new Error("invalid import: " + file + ":" + i + ": " + line));
          return true;
        }
      } else if (line) {
        emitter.emit("data", line + "\n"); // TODO combine lines?
      }
    }) || emitter.emit("end");
  });

  return emitter;
}

function expandFile(file, extension) {
  if (/\/$/.test(file)) file += "index" + extension;
  else if (!path.extname(file)) file += extension;
  return file;
}

var defaultExtension = ".js";
