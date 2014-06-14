// admin.js
'use strict';

var fs = require('fs');
var http = require('http');
var https = require('https');

var options = {
	https: false
}

var httpOptions = {
	hostname: 'localhost',
	port: 8888,
	path: '/cli',
	method: 'POST'
};

var httpsOptions = {
	pfx: fs.readFileSync('./Certs/admin.pfx'),
	ca: fs.readFileSync('./Certs/root.pem'),
	rejectUnauthorized: true,
	hostname: 'localhost',
	port: 8888,
	path: '/cli',
	method: 'POST'
};

var cmdobj = getcmd();
if (!cmdobj) {
	process.exit();
}
switch (cmdobj.cmd) {
case 'create':
	create(cmdobj, function () {
		process.exit();
	});
	break;
case 'import':
	csvImport(cmdobj, function (count) {
		showCount(count);
		process.exit();
	});
	break;
case 'export':
	csvExport(cmdobj, function (count) {
		showCount(count);
		process.exit();
	});
	break;
case 'dump':
	send(cmdobj, function (parsed) {
		if (Array.isArray(parsed)) {
			showCount(parsed.length);
		}
		process.exit();
	});
	break;
default:
	send(cmdobj, function (parsed) {
		if (Array.isArray(parsed)) {
			showCount(parsed.length);
		}
		process.exit();
	});
	break;
}

function showCount(count) {
	console.log(count + ' object' +
				(count === 1 ? '' : 's'));
}

function send(object, callback) {
	var cmd = object.cmd;
	if (cmd === 'export') {
		object.cmd = 'dump';
	}
	var data = '';
	if (options.https) {
		var request = https.request(httpsOptions, listener);
	} else {
		request = http.request(httpOptions, listener);
	}
	function listener(response) {
		response.on('data', function (chunk) {
			data += chunk;
		});
		response.on('end', function () {
			var parsed = JSON.parse(data);
			if (cmd === 'dump') {
				parsed.shift();
			}
			if (cmd !== 'export') {
				console.log(parsed);
			}
			callback(parsed);
		});
	};
	request.end(JSON.stringify(object));
}

function getcmd() {
	var cmdobj = getobj();
	var str = '';
	switch (cmdobj.cmd) {
	case 'get':
	case 'put':
	case 'remove':
		if (cmdobj.args.length === 0) {
			console.log('\nERROR: this command requires: node admin',
						cmdobj.cmd, '<dbName>', "'<object>'");
			commands();
			return null;
		} else {
			return cmdobj;
		}
	case 'create':
	case 'import':
	case 'export':
	case 'dump':
		if (cmdobj.dbName) {
			return cmdobj;
		} else {
			console.log('\nERROR: this command requires: node admin',
						cmdobj.cmd, '<dbName>');
			commands();
			return null;
		}
	case 'log':
	case 'getinfo':
	case 'rescan':
	case 'shutdown':
		return cmdobj;
	default:
		commands();
		return null;
	}
}

function commands() {
	var str = '\nCommands:\n';
	str += "\n\tget <dbName> '<object>'";
	str += "\n\tput <dbName> '<object>'";
	str += "\n\tremove <dbName> '<object>'";
	str += '\n\tcreate <dbName>';
	str += '\n\timport <dbName>';
	str += '\n\texport <dbName>';
	str += '\n\tdump <dbName>';
	str += '\n\tlog [true | false]';
	str += '\n\tgetInfo';
	str += '\n\trescan';
	str += '\n\tshutdown\n';
	console.log("\nUsage: node admin command [<dbName>]",
				"['<object>' | true | false]");
	console.log(str);
}

function getobj () {
	var args = process.argv.slice(2);
	var cmd = args.shift();
	cmd = typeof cmd === 'string' && cmd.toLowerCase();
	var dbName = args.shift();
	if (!dbName) {
		dbName = null;
	} else if (!args) {
		args.unshift(dbName);
		dbName = null;
	}
	if (Array.isArray(args) && args.length !== 0) {
		args = args.toString();
		args = args.replace(/[']/g, '');
		args = args.replace(/([^{}\[\]:,]+)/g, '"$1"');
		args = args.replace(/" /g, '"');
		args = JSON.parse(args);
		if (typeof args === 'object' && args !== null) {
			Object.keys(args).forEach(function (key) {
				var number = Number(args[key]);
				if (!isNaN(number)) {
					args[key] = number;
				}
			});
		}
	}
	var cmdobj = {};
	cmdobj.cmd = cmd;
	cmdobj.dbName = dbName;
	cmdobj.args = args;
	return cmdobj;
}

function create(cmdobj, callback) {
	send(cmdobj, function () {
		send({cmd:'rescan'}, function () {
			callback();
		});
	});
}

function csvImport(cmdobj, callback) {
	var dbName = cmdobj.dbName;
	var filename = dbName + '.csv';
	var file;
	var keys;
	var importCount = 0;
	var obj = {};
	obj.cmd = 'create';
	obj.dbName = dbName;
	create(obj, function () {
		console.log();
		try {
			file = fs.readFileSync(filename).toString().split('\n');
			file.pop();
		} catch (error) {
			console.log(error);
			process.exit();
		}
		keys = file.shift().split('\t');
		sendData();
	});

	function sendData() {
		var line = file.shift();
		if (line === undefined) {
			callback(importCount);
		}
		var object = csvObject(line);
		send(object, function () {
			++importCount;
			sendData();
		});
	}

	function csvObject(line) {
		var args = {};
		var values = line.split('\t');
		values.forEach(function (value, index) {
			args[keys[index]] = value;
		});
		var object = {};
		object.cmd = 'put';
		object.dbName = dbName;
		object.args = args;
		return object;
	}
}

function csvExport(cmdobj, callback) {
	var dbName = cmdobj.dbName;
	var filename = dbName + '.csv';
	send(cmdobj, function (objects) {
		var keys = objects.shift().keys;
		var file = keys.join('\t') + '\n';
		var exportCount = 0;
		var object;
		while ((object = objects.shift()) !== undefined) {
			var values = [];
			Object.keys(object).forEach(function (key) {
				var lowerKey = typeof key === 'string' ? key.toLowerCase() : key;
				values[keys.indexOf(lowerKey)] = object[key];
			});
			file += values.join('\t') + '\n';
			++exportCount;
		}
		fs.writeFileSync(filename, file);
		callback(exportCount);
	});
}
