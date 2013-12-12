var queue = require("queue-async"),
    expandFile = require("./expand-file"),
    readImports = require("./read-imports");

// This module is based on read-graph, except that it returns a json object.
// The default format is:
// {
//     "d3-start": {
//         "requires": "/static/d3/start.js"
//     },
//     "d3-format-format": {
//         "requires": "/static/d3/format/format.js",
//         "imports": [
//             "d3-arrays-map",
//             "d3-core-identity",
//             "d3-format-format-localized",
//             "d3-format-formatPrefix",
//             "d3-format-round"
//         ]
//     }
// }
// Returns the network of imports, starting with the specified input files.
// For each file in the returned map, an array specifies the set of files
// immediately imported by that file. This array is in order of import, and may
// contain duplicate entries.
module.exports = function(files, argv, callback) {
    var fileMap = {},
        requiresKey = argv.requiresKey || "requires";
        pathKey = argv.pathKey || "path",
        targetDir = argv.targetDir || "",
        modulePrefix = argv.modulePrefix || "",
        separator = argv.separator || "-",
        basePath = argv.basePath || "";

    function readRecursive(file, parent, callback) {
        var moduleKey = fileToModuleKey(file, basePath, separator, modulePrefix);
        if (typeof parent === "string") fileMap[parent][requiresKey].push(moduleKey);
        if (moduleKey in fileMap) return callback(null);

        readImports(file, function(error, files) {
            if (error) return void callback(error);
            var q = queue(1);
            fileMap[moduleKey] = {};
            fileMap[moduleKey][pathKey] = targetDir + stripBasePath(file, basePath);
            fileMap[moduleKey][requiresKey] = files.length > 0 ? [] : undefined;
            files.forEach(function(file) {
                q.defer(readRecursive, file, moduleKey);
            });
            q.awaitAll(callback);
        });
    }

    var q = queue(1);
    files.forEach(function(file) {
        q.defer(readRecursive, expandFile(file), null);
    });
    q.awaitAll(function(error) {
        callback(error, error ? null : fileMap);
    });
};

function stripBasePath(path, basePath) {
    var newFileName = path;

    if (basePath) {
        newFileName = newFileName.replace(basePath, "");
    }
    return newFileName;
}

function fileToModuleKey(path, basePath, separator, prefix) {
    var moduleName = path;

    prefix = prefix || "";
    separator = separator || "-";

    if (basePath) {
        moduleName = stripBasePath(moduleName, basePath);
    }

    moduleName = moduleName.replace(/\//g, separator);
    if (moduleName.slice(-3) === ".js") moduleName = moduleName.slice(0, -3);

    return prefix + moduleName;
}
