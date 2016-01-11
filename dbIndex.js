// dbIndex.js
'use strict';

(function () {

	module.exports = dbIndex;

	require('./Object');

	function dbIndex() {
		var db = {};

		this.getKeys = function () {
			return Object.keys(db).sort();
		};

		this.put = function (arg) {
			if (Buffer.isBuffer(arg)) {
				var buffer = arg;
				var internal = getInternal(buffer.slice(4).toObject());
			} else {
				internal = getInternal(arg);
				var buff = arg.toBuffer();
				buffer = new Buffer(buff.length + 4);
				buffer.writeInt32LE(-1, 0);
				buff.copy(buffer, 4);
				if (isDuplicate(internal, buffer)) {
					return null;
				}
			}
			Object.keys(internal).forEach(function (key) {
				var value = internal[key];
				if (key in db && value in db[key]) {
					db[key][value].push(buffer);
				} else {
					if (!(key in db)) {
						db[key] = {};
					}
					db[key][value] = [buffer];
				}
			});
			return buffer;

			function isDuplicate(internal, buffer) {
				var buffstr = buffer.slice(4).toString();
				var key = Object.keys(internal)[0];
				var isDup = false;
				if (key in db) {
					var value = internal[key];
					if (value in db[key]) {
						var isDup = db[key][value].some(function (buffer) {
							if (buffstr === buffer.slice(4).toString()) {
								return true;
							}
						});
					}
				}
				return isDup;
			}
		};

		this.get = function (array) {
			var buffers = [];
			var strings = [];
			var external;
			while (external = array.shift()) {
				var gotbuffs = get(external);
				if (gotbuffs) {
					gotbuffs.forEach(function (buffer) {
						var candidate = buffer.slice(4).toObject();
						var buffstr = getInternal(candidate).toBuffer().toString();
						if (strings.indexOf(buffstr) === -1) {
							buffers.push(buffer);
							strings.push(buffstr);
						}
					});
				}
			}
			return buffers;

			function get(external) {
				var buffers = [];
				var strings = [];
				var internal = getInternal(external);
				Object.keys(internal).forEach(function (key, index) {
					var previous = strings;
					buffers = [];
					strings = [];
					if (key in db) {
						var value = internal[key];
						var values = value.substr(-1) === '=' ? [value.slice(0, -1)]
							: fuzzyFilter(value.slice(0, -1), Object.keys(db[key]));
						if (values !== null) {
							while (value = values.shift()) {
								if (value in db[key]) {
									db[key][value].forEach(function (buffer) {
										var candidate = getInternal(buffer.slice(4).toObject());
										var buffstr = candidate.toBuffer().toString();
										if (index === 0 || previous.indexOf(buffstr) !== -1) {
											buffers.push(buffer);
											strings.push(buffstr);
										}
									});
								}
							}
						}
					}
				});
				return buffers.length === 0 ? null : buffers;
			}
		}

		this.remove = function (array) {
			var buffers = [];
			var gotbuffs = this.get(array);
			if (gotbuffs !== null) {
				var buffer;
				while (buffer = gotbuffs.shift()) {
					buffers.push(buffer);
					var object = buffer.slice(4).toObject();
					var buffstr = buffer.slice(4).toString().toLowerCase();
					Object.keys(object).forEach(function (key) {
						var value = object[key].toLowerCase();
						key = key.toLowerCase();
						var strings = [];
						db[key][value].forEach(function (buffer) {
							strings.push(buffer.slice(4).toString().toLowerCase());
						});
						db[key][value].splice(strings.indexOf(buffstr), 1);
						if (db[key][value].length === 0) {
							delete db[key][value];
							if (Object.keys(db[key]).length === 0) {
								delete db[key];
							}
						}
					});
				}
			}
			return buffers;
		};

		this.dump = function () {
			var objects = [];
			var strings = [];
			Object.keys(db).forEach(function (key) {
				Object.keys(db[key]).forEach(function (value) {
					db[key][value].forEach(function (buffer) {
						var external = buffer.slice(4).toObject();
						var internal = getInternal(external);
						var buffstr = internal.toBuffer().toString();
						if (strings.indexOf(buffstr) === -1) {
							objects.push(external);
							strings.push(buffstr);
						}
					});
				});
			});
			return objects;
		};

		function getInternal(external) {
			var internal = {};
			Object.keys(external).forEach(function (key) {
				internal[key] = external[key].toLowerCase();
			});
			return internal;
		}

		function fuzzyFilter(pattern, array) {
			return array.filter(function (string) {
				return match(pattern, string);
			});

			function match(pattern, string) {
				var patternIndex = 0;
				for (var index = 0; index < string.length; ++index) {
					if (string.charAt(index) === pattern.charAt(patternIndex)) {
						++patternIndex;
					}
				}
				return patternIndex === pattern.length;
			}
		}
	}

}());
