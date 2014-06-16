// server.js
'use strict';

var crypto = require('crypto');
var exec = require('child_process').exec;
var fs = require('fs');
var http = require('http');
var https = require('https');
var url = require('url');

var dbFile = require('./dbFile');
require('./Object');

var options = {
	httpPort: 8888,
	httpsPort: 8889,
	secure: false
};

var httpsOptions = {
	pfx: fs.readFileSync('./Certs/server.pfx'),
	ca: fs.readFileSync('./Certs/root.pem'),
	requestCert: true
};

process.on('SIGINT', function () {
	console.log();
	process.kill(process.pid);
});

process.on('SIGTERM', function () {
	dbClose();
});

var dbInfo;
dbOpen();

function dbOpen() {
	dbFile.init(function (info) {
		dbInfo = info;
		if (Object.keys(dbInfo).length === 0) {
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
	http.createServer(function (request, response) {
		if (options.secure) {
			redirect(request, response);
		} else {
			listener(request, response);
		}
	}).listen(options.httpPort, function () {
		console.log('http server is listening at port:', options.httpPort);
	});
	https.createServer(httpsOptions, listener)
		.listen(options.httpsPort, function () {
			console.log('https server is listening at port:', options.httpsPort);
		});

	function redirect(request, response) {
		var https = 'https://' + request.connection.localAddress
			+ ':' + options.httpsPort + '/';
		response.writeHead(301, {'Location': https});
		response.end();
	}

	function listener(request, response) {
		var path = url.parse(request.url).pathname;
		if (path === '/ajax' || path === '/cli') {
			var data = '';
			request.on('data', function(chunk) {
				data += chunk;
			});
			request.on('end', function() {
				response.writeHead(200, {'Content-Type': 'text/plain'});
				if (path === '/cli' && !request.socket.authorized) {
					response.end(JSON.stringify(['ERROR: client is not authorized']));
				} else {
					execute(JSON.parse(data), function (result) {
						response.end(JSON.stringify(result));
					});
					data = '';
				}
			});
		} else {
			if (path === '' || path === '/') {
				path = 'index.html';
			} else if (path.substr(0, 1) === '/') {
				path = path.substr(1);
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
	}
}

var log = false;

function execute(object, callback) {
	var cmd = object.cmd;
	var dbName = object.dbName;
	var args = object.args;
	if (!Array.isArray(args)) {
		args = [args];
	}
	if (log) {
		console.log(cmd, '(' + dbName + ') =>', args);
	}
	if ((cmd === 'get' || cmd === 'put' || cmd === 'remmove' || cmd === 'dump')
		&& (!dbName || !dbInfo[dbName])) {
		callback(['ERROR: database name is missing or invalid']);
		return;
	}
	if ((cmd === 'put' || cmd === 'remove') && dbInfo[dbName].readOnly) {
		callback(['ERROR: this database is read only']);
		return;
	}
	switch (cmd) {
	case 'get':
		callback(get(dbName, args));
		break;
	case 'put':
		callback(put(dbName, args));
		break;
	case 'remove':
		callback(remove(dbName, args));
		break;
	case 'create':
		exec('touch ' + dbName + '.mrdb', function () {
			callback('created ' + dbName);
		});
		break;
	case 'dump':
		callback(dump(dbName));
		break;
	case 'log':
		args = dbName;
		if (args === 'true' || args === 'false') {
			log = args;
		}
		callback(log);
		break;
	case 'getinfo':
		callback(getInfo());
		break;
	case 'rescan':
		dbFile.init(function (info) {
			dbInfo = info;
			callback(getInfo());
		});
		break;
	case 'shutdown':
		process.kill(process.pid);
		callback('shutting down...');
		break;
	}
}

function getInfo(callback) {
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

function remove(dbName, array) {
	var objects = [];
	var strings = [];
	var unsorted;
	while ((unsorted = array.shift()) !== undefined) {
		var removed = dbInfo[dbName].dbIndex.remove(unsorted);
		if (removed !== null) {
			removed.forEach(function (buffer) {
				var buffstr = buffer.slice(4).toString().toLowerCase();
				if (strings.indexOf(buffstr) === -1) {
					objects.push(buffer.slice(4).toObject());
					strings.push(buffstr);
					dbInfo[dbName].dbFile.remove(buffer);
				}
			});
		}
	}
	return objects;
}

function get(dbName, array) {
	var objects = [];
	var strings = [];
	var unsorted;
	while ((unsorted = array.shift()) !== undefined) {
		var gotbuffs = dbInfo[dbName].dbIndex.get(unsorted);
		if (gotbuffs !== null) {
			gotbuffs.forEach(function (buffer) {
				var buffstr = buffer.slice(4).toString().toLowerCase();
				if (strings.indexOf(buffstr) === -1) {
					objects.push(buffer.slice(4).toObject());
					strings.push(buffstr);
				}
			});
		}
	}
	return objects;
}

function dump(dbName) {
	var keys = dbInfo[dbName].dbIndex.getKeys();
	var objects = dbInfo[dbName].dbIndex.dump();
	return [{'keys':keys}].concat(objects);
}
