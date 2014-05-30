// admin.js
'use strict';

var fs = require('fs');
var https = require('https');

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
if (cmdobj) {
	if (cmdobj.cmd === 'load') {
		load(cmdobj, function (count) {
			showCount(count);
			process.exit();
		});
	} else {
		send(cmdobj, function (parsed) {
			if (Array.isArray(parsed)) {
				showCount(parsed.length);
			}
			process.exit();
		});
	}
} else {
	process.exit();
}

function showCount(count) {
	console.log(count + ' object' +
				(count === 1 ? '' : 's'));
}

function send(object, callback) {
	var data = '';
	var request = https.request(httpsOptions, function (response) {
		response.on('data', function (chunk) {
			data += chunk;
		});
		response.on('end', function () {
			var parsed = JSON.parse(data);
			console.log(parsed);
			callback(parsed);
		});
	});
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
			console.log('\nERROR: this command requires:', cmdobj.cmd, '<dbName>', "'<object>'");
			commands();
			return null;
		} else {
			return cmdobj;
		}
	case 'load':
		str = '[anything]';
	case 'dump':
		if (cmdobj.dbName) {
			return cmdobj;
		} else {
			console.log('\nERROR: this command requires:',  cmdobj.cmd, '<dbName>', str);
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
	str += '\n\tload <dbName> [<anything>]';
	str += '\n\tdump <dbName>';
	str += '\n\tlog [true | false]';
	str += '\n\tgetInfo';
	str += '\n\trescan';
	str += '\n\tshutdown\n';
	console.log("\nUsage: node admin command [<dbName>]",
				"['<object>' | true | false | anything]");
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

function load(cmdobj, callback) {
	var dbName = cmdobj.dbName;
	var csv = cmdobj.args.length !== 0;
	var filename = dbName + (csv ? '.csv' : '.txt');
	try {
		var file = fs.readFileSync(filename).toString().split('\n');
		file.pop();
		if (csv) {
			var keys = fs.readFileSync(dbName + '.keys').toString().split('\n');
			keys.pop();
		}
	} catch (error) {
		console.log(error);
		process.exit();
	}

	require('child_process').spawn('touch', [dbName + '.mrdb']);
	send({cmd: 'rescan'}, function () {
		console.log();
		sendData();
	});

	var loadCount = 0;
	function sendData() {
		var line = file.shift();
		if (line === undefined) {
			callback(loadCount);
		}
		if (csv) {
			var object = csvObject(line);
		} else {
			object = textObject(line);
		}
		send(object, function () {
			++loadCount;
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

	function textObject (line) {
		var args = line.trim().replace(/['"]/g, '');
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
		var object = {};
		object.cmd = 'put';
		object.dbName = dbName;
		object.args = args;
		return object;
	}
}
