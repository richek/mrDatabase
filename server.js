// server.js
'use strict';

var fs = require('fs');
var https = require('https');
var url = require('url');

var dbFile = require('./dbFile');
var dbIndex = require('./dbIndex');
require('./Object');

var options = {
	httpsPort: 8888,
	dbPath: './',
	certs: './Certs/',
	log: false
};

var httpsOptions = {
	pfx: fs.readFileSync(options.certs + 'server.pfx'),
	requestCert: true,
	rejectUnauthorized: true
};

var dbInfo = {};

setTraps();
dbOpen();

function setTraps() {
	if (process.platform === 'win32') {
		require('readline').createInterface({
			input: process.stdin,
			output: process.stdout
		}).on('SIGINT', function () {
			dbClose();
		});
	}
	process.on('SIGINT', function () {
		console.log();
		dbClose();
	});
	process.on('SIGTERM', function () {
		dbClose();
	});
}

function dbOpen() {
	dbFile.init(options.dbPath, function (info) {
		dbInfo = info;
		if (dbInfo.length === 0) {
			console.log('no databases found');
		}
		createServer();
	});
}

function dbClose() {
	var dbNames = Object.keys(dbInfo);
	var count = dbNames.length;
	if (count === 0) {
		exit();
	}
	dbNames.forEach(function (dbName) {
		dbInfo[dbName].dbFile.close(function () {
			if (--count === 0) {
				exit();
			}
		});
	});

	function exit() {
		console.log('memory =>', process.memoryUsage());
		process.exit();
	}
}

function createServer() {
	https.createServer(httpsOptions, function (request, response) {
		var path = url.parse(request.url).pathname;
		if (path === '/ajax' || path === '/cli') {
			var data = '';
			request.on('data', function(chunk) {
				data += chunk;
			});
			request.on('end', function() {
				response.writeHead(200, {'Content-Type': 'text/plain'});
				execute(JSON.parse(data), function (result) {
					response.end(JSON.stringify(result));
				});
				data = '';
			});
		} else {
			if (path === '' || path === '/') {
				path = 'index.html';
			} else if (path.charAt(0) === '/') {
				path = path.slice(1);
			}
			var userAgent = request.headers['user-agent'].toLowerCase();
			if (userAgent.indexOf('safari') === -1
				&& userAgent.indexOf('firefox') === -1
				&& userAgent.indexOf('chrome') === -1) {
				path = 'indexbad.html';
			}
			fs.readFile(path, function (error, file) {
				response.end(file);
			});
		}
	}).listen(options.httpsPort, function () {
		console.log('https server is listening at port:', options.httpsPort);
	});
}

function execute(object, callback) {
	if (typeof object !== 'object' || !object.cmd) {
		callback(['ERROR: invalid command object']);
	}
	if (object.cmd === 'get' || object.cmd === 'put' || object.cmd === 'remove'
		|| object.cmd === 'create' || object.cmd === 'dump') {
		if (!object.dbName) {
			callback(['ERROR: database name is missing']);
		}
		if (object.cmd !== 'create') {
			if (!dbInfo[object.dbName]) {
				callback(['ERROR: database name is invalid']);
			}
			if (dbInfo[object.dbName].readOnly
				&& (object.cmd === 'put' || object.cmd === 'remove')) {
				callback(['ERROR: this database is read only']);
			}
		}
	}
	if (!Array.isArray(object.args)) {
		object.args = [object.args];
	}
	for (var argn = 0; argn < object.args.length; ++argn) {
		if (typeof object.args[argn] === 'object') {
			object.args[argn] = normalize(object.args[argn]);
		}
	}
	if (options.log) {
		console.log(object);
	}
	switch (object.cmd) {
	case 'get':
		callback(get(object.dbName, object.args));
		break;
	case 'put':
		callback(put(object.dbName, object.args));
		break;
	case 'remove':
		callback(remove(object.dbName, object.args));
		break;
	case 'create':
		dbFile.touch(object.dbName, function () {
			callback(['created ' + object.dbName]);
		});
		break;
	case 'dump':
		callback(dump(object.dbName));
		break;
	case 'log':
		if (object.dbName) {
			object.dbName = object.dbName.toLowerCase();
			options.log = object.dbName === 'true'
				|| object.dbName === 'on'
				|| object.dbName === 1;
		}
		callback([options.log]);
		break;
	case 'getinfo':
		callback(getInfo());
		break;
	case 'rescan':
		dbFile.init(options.dbPath, function (info) {
			dbInfo = info;
			callback(getInfo());
		});
		break;
	case 'shutdown':
		dbClose();
		callback(['shutting down...']);
		break;
	default:
		callback(['ERROR: invalid command']);
	}

	function normalize(object) {
		var tempObj = {};
		Object.keys(object).forEach(function (key) {
			tempObj[normKey(key)] = String(object[key]).trim().replace(/[  ]+/g, ' ');
		});
		object = {};
		Object.keys(tempObj).sort().forEach(function (key) {
			object[key] = tempObj[key];
		});
		return object;

		function normKey(key) {
			return key.trim().replace(/[  ]+/g, ' ').toLowerCase();
		}
	}
}

function getInfo() {
	var info = {};
	Object.keys(dbInfo).forEach(function (dbName) {
		info[dbName] = {};
		info[dbName].readOnly = dbInfo[dbName].readOnly;
		info[dbName].keys = dbInfo[dbName].dbIndex.getKeys();
		dbInfo[dbName].keys = info[dbName].keys;
	});
	return info;
}

function put(dbName, array) {
	var result = [];
	var unsorted;
	while ((unsorted = array.shift()) !== undefined) {
		var buffer = dbInfo[dbName].dbIndex.put(unsorted);
		if (buffer === null) {
			result.push(null);
		} else {
			dbInfo[dbName].dbFile.put(buffer);
			result.push(buffer.slice(4).toObject());
		}
	}
	return result;
}

function get(dbName, array) {
	var objects = [];
	var gotbuffs = dbInfo[dbName].dbIndex.get(array);
	gotbuffs.forEach(function (buffer) {
		objects.push(buffer.slice(4).toObject());
	});
	return objects;
}

function remove(dbName, array) {
	var objects = [];
	var gotbuffs = dbInfo[dbName].dbIndex.remove(array);
	gotbuffs.forEach(function (buffer) {
		dbInfo[dbName].dbFile.remove(buffer);
		objects.push(buffer.slice(4).toObject());
	});
	return objects;
}

function dump(dbName) {
	var keys = dbInfo[dbName].dbIndex.getKeys();
	var objects = dbInfo[dbName].dbIndex.dump();
	return [{'keys':keys}].concat(objects);
}
