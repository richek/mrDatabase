// dbIndex.js
'use strict';

(function () {

	module.exports = dbIndex;

	var fuzzy = require('./fuzzy');
	require('./Object');

	function dbIndex() {
		var db = {};

		this.getKeys = function () {
			return Object.keys(db).sort();
		};

		this.put = function (arg) {
			if (Buffer.isBuffer(arg)) {
				var buffer = arg;
				var normbuff = buffer;
				var normobj = buffer.slice(4).toObject();
			} else {
				if (this.get(arg) !== null) {
					return null;
				}
				normobj = normalize(arg);
				normbuff = normobj.toBuffer();
				buffer = new Buffer(normbuff.length + 4);
				buffer.writeInt32LE(0, 0);
				normbuff.copy(buffer, 4);
			}
			Object.keys(normobj).forEach(function (key) {
				var value = normobj[key];
				if (typeof key === 'string') {
					key = key.toLowerCase();
				}
				if (typeof value === 'string') {
					if (value.slice(-1) === '_') {
						value = value.slice(0, -1);
					}
					value = value.toLowerCase();
				}
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
		};

		this.remove = function (unsorted) {
			var removed = [];
			var buffer;
			var gotbuffs = this.get(unsorted);
			if (gotbuffs !== null) {
				while ((buffer = gotbuffs.shift()) !== undefined) {
					removed.push(buffer);
					var object = buffer.slice(4).toObject();
					var buffstr = buffer.slice(4).toString().toLowerCase();
					Object.keys(object).forEach(function (key) {
						var lowerKey = typeof key === 'string' ?
							key.toLowerCase() : key;
						var value = object[key];
						var lowerValue = typeof value === 'string' ?
							value.toLowerCase() : value;
						var strings = [];
						db[lowerKey][lowerValue].forEach(function (buff) {
							strings.push(buff.slice(4).toString().toLowerCase());
						});
						db[lowerKey][lowerValue].splice(strings.indexOf(buffstr), 1);
						if (db[lowerKey][lowerValue].length === 0) {
							delete db[lowerKey][lowerValue];
							if (Object.keys(db[lowerKey]).length === 0) {
								delete db[lowerKey];
							}
						}
					});
				}
			}
			return removed;
		};

		this.get = function (unsorted) {
			var strings = [];
			var buffers = [];
			var normobj = normalize(unsorted);
			Object.keys(normobj).forEach(function (key, index) {
				var lowerKey = typeof key === 'string' ?
					key.toLowerCase() : key;
				var previous = strings;
				strings = [];
				buffers = [];
				if (lowerKey in db) {
					var value = normobj[key];
					if (typeof value === 'string' && value.slice(-1) === '_') {
						var values = [value.slice(0, -1)];
					} else {
						values = fuzzy.filter(value, Object.keys(db[lowerKey]));
					}
					if (values !== null) {
						while ((value = values.shift()) !== undefined) {
							var lowerValue = typeof value === 'string' ?
								value.toLowerCase() : value;
							if (lowerValue in db[lowerKey]) {
								db[lowerKey][lowerValue].forEach(function (buffer) {
									var buffstr = buffer.slice(4).toString().toLowerCase();
									if (index === 0 || previous.indexOf(buffstr) !== -1) {
										strings.push(buffstr);
										buffers.push(buffer);
									}
								});
							}
						}
					}
				}
			});
			return buffers.length === 0 ? null : buffers;
		};

		this.dump = function () {
			var objects = [];
			var strings = [];
			Object.keys(db).forEach(function (key) {
				Object.keys(db[key]).forEach(function (value) {
					db[key][value].forEach(function (buffer) {
						var buffstr = buffer.slice(4).toString().toLowerCase();
						if (strings.indexOf(buffstr) === -1) {
							objects.push(buffer.slice(4).toObject());
							strings.push(buffstr);
						}
					});
				});
			});
			return objects;
		};
	}

	function normalize(unsorted) {
		var lower = {};
		Object.keys(unsorted).forEach(function (key) {
			var lowerKey = typeof key === 'string' ? key.toLowerCase() : key;
			lower[lowerKey] = unsorted[key];
		});
		var normobj = {};
		Object.keys(lower).sort().forEach(function (lowerKey) {
			Object.keys(unsorted).some(function (key) {
				if (key === lowerKey
					|| (typeof key === 'string'
						&& key.toLowerCase() === lowerKey)) {
					normobj[key] = unsorted[key];
					return true;
				}
			});
		});
		return normobj;
	}

}());
