// admin.js
'use strict';

var fs = require('fs');

// select http|https
var http = require('http');
// var https = require('https');

var options = {
	// pfx only for https
	// pfx: fs.readFileSync('./Certs/client.pfx'),
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
	// select http|https
	var request = http.request(options, function (response) {
	// var request = https.request(options, function (response) {
		var data = '';
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
	});
	request.end(JSON.stringify(object));
}

function getcmd() {
	var cmdobj = getobj();
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
			if (cmdobj.cmd !== 'put') {
				Object.keys(cmdobj.args).forEach(function (key) {
					var suffix = cmdobj.args[key].substr(-1);
					if (suffix !== '=' && suffix !== '~') {
						cmdobj.args[key] += '~';
					}
				});
			}
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

	function getobj () {
		var args = process.argv.slice(2);
		var cmd = String(args.shift()).toLowerCase();
		var dbName = args.shift();
		if (!dbName || !args) {
			if (dbName) {
				args.unshift(dbName);
			}
			dbName = null;
		}
		var object = {};
		if (args) {
			try {
				args = JSON.parse(args);
			} catch (error) {
				args = {};
			}
			if (typeof args === 'object' && !Array.isArray(args)) {
				var obj = {};
				Object.keys(args).forEach(function (key) {
					obj[key.trim().replace(/[  ]+/g, ' ').toLowerCase()] = args[key].trim();
				});
				Object.keys(obj).sort().forEach(function (key) {
					object[key] = obj[key];
				});
			}
		}
		var cmdobj = {};
		cmdobj.cmd = cmd;
		cmdobj.dbName = dbName;
		cmdobj.args = object;
		return cmdobj;
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
		if (!line) {
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
		while (object = objects.shift()) {
			var values = [];
			Object.keys(object).forEach(function (key) {
				var lowerKey = String(key).toLowerCase();
				values[keys.indexOf(lowerKey)] = object[key];
			});
			file += values.join('\t') + '\n';
			++exportCount;
		}
		fs.writeFileSync(filename, file);
		callback(exportCount);
	});
}
