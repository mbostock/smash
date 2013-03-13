var fs = require("fs"),
    path = require("path"),
    events = require("events"),
    stream = require("stream"),
    queue = require("queue-async");

module.exports = smash;
smash.readAllImports = readAllImports;
smash.readImports = readImports;

// Returns a readable stream for the specified files.
// All imports are expanded the first time they are encountered.
// Subsequent redundant imports are ignored.
function smash(files, encoding) {
  if (!encoding) encoding = "utf8";

  var s = new stream.PassThrough({encoding: encoding, decodeStrings: false}),
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
    // Otherwise, imports are stream recursively, and chunks are set serially.
    readStream(file, encoding)
        .on("error", c)
        .on("import", function(file) { q.defer(streamRecursive, file); })
        .on("data", function(chunk) { q.defer(function(callback) { s.write(chunk, callback); }); })
        .on("end", c);

    // This last callback is only invoked when the file is fully streamed.
    q.awaitAll(callback);
  }

  // Stream each file serially.
  files.forEach(function(file) {
    q.defer(streamRecursive, file);
  });

  // When all files are streamed, or an error occurs, we're done!
  q.awaitAll(function(error) {
    if (error) s.emit("error", error);
    else s.end();
  });

  return s;
}

// Reads all the imports from the specified files, returning an array of files.
// The returned array is in dependency order and only contains unique entries.
// The returned arrays also includes any input files at the end.
function readAllImports(files, encoding, callback) {
  if (arguments.length < 3) callback = encoding, encoding = null;

  var fileMap = {},
      allFiles = [];

  function readRecursive(file, callback) {
    if (file in fileMap) return callback(null);
    fileMap[file] = true;
    readImports(file, encoding, function(error, files) {
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
    q.defer(readRecursive, file);
  });
  q.awaitAll(function(error) {
    callback(error, error ? null : allFiles);
  });
}

// Reads the import statements from the specified file, returning an array of
// files. Unlike readAllImports, this does not recursively traverse import
// statements; it only returns import statements in the specified input file.
// Also unlike readAllImports, this method returns every import statement,
// including redundant imports and self-imports.
function readImports(file, encoding, callback) {
  if (arguments.length < 3) callback = encoding, encoding = null;

  var files = [];

  readStream(file, encoding)
      .on("import", function(file) { files.push(file); })
      .on("error", callback)
      .on("end", function() { callback(null, files); });
}

// Returns a stream for the specified file. The returned emitter emits "import"
// events whenever an import statement is encountered, and "data" events
// whenever normal text is encountered, in addition to the standard "error" and
// "end" events.
function readStream(file, encoding) {
  if (!encoding) encoding = "utf8";

  var emitter = new events.EventEmitter(),
      directory = path.dirname(file),
      extension = path.extname(file);

  fs.readFile(file, encoding, function(error, text) {
    if (error) return void emitter.emit("error", error);
    text.split("\n").some(function(line, i) {
      if (/^import\b/.test(line)) {
        var match = /^import\s+"([^"]+)"\s*;?\s*(?:\/\/.*)?$/.exec(line);
        if (match) {
          var target = match[1];
          if (!path.extname(target)) target += extension;
          emitter.emit("import", path.join(directory, target));
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
