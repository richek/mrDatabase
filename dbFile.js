// dbFile.js
'use strict';

(function () {

	module.exports.init = init;

	var crypto = require('crypto');
	var fs = require('fs');

	var dbIndex = require('./dbIndex');
	require('./Object');

	var cipherType = 'aes-256-cbc';
	var password = 'HC3hy($sh#)aS81^-2!^!+DZUu5+?w>^JGs5K+!O15ciuSd5#gO^M>0@WH1OH)\?';

	var dbInfo = [];

	function init(callback) {
		fs.readdir('.', function (error, files) {
			var dbNames = [];
			files.forEach(function (fname) {
				if (fname.slice(-5) === '.mrdb') {
					var dbName = fname.slice(0, -5);
					dbNames.push(dbName);
				}
			});
			var dbName;
			var pending = 0;
			while ((dbName = dbNames.shift()) !== undefined) {
				if (dbInfo[dbName]) {
					dbInfo[dbName].dbKeys = dbInfo[dbName].dbIndex.getKeys();
				} else {
					++pending;
					dbInfo[dbName] = {};
					dbInfo[dbName].dbIndex = new dbIndex();
					dbInfo[dbName].dbFile = new dbFile(dbName);
					dbInfo[dbName].dbFile.open(function () {
						if (--pending === 0) {
							callback(dbInfo);
						}
					});
				}
			}
			if (pending === 0) {
				callback(dbInfo);
			}
		});
	}

	function dbFile(name) {
		var dbName = name;
		var readOnly = false;
		var fd;
		var eof;
		var freeSizes = {};
		var queue = [];

		this.open = function (callback) {
			console.log('opening ' + dbName + ' database...');
			var fullPath = dbName + '.mrdb';
			readOnly = false;
			fs.open(fullPath, 'r+', oldRW);

			function oldRW(error, newfd) {
				if (error) {
					fs.open(fullPath, 'w+', newRW);
				} else {
					open(newfd, callback);
				}
			}

			function newRW(error, newfd) {
				if (error) {
					fs.open(fullPath, 'r', 420, oldRO); // 0644
				} else {
					open(newfd, callback);
				}
			}

			function oldRO(error, newfd) {
				if (error) {
					console.log(error);
					delete dbInfo[dbName];
					callback();
				} else {
					readOnly = true;
					open(newfd, callback);
				}
			}
		};

		function open(newfd, callback) {
			dbInfo[dbName].readOnly = readOnly;
			fd = newfd;
			var pending = 0;
			fs.fstat(fd, function (error, stats) {
				++pending;
				eof = stats.size;
				get(0, function () {
					if (--pending === 0) {
						dbInfo[dbName].keys = dbInfo[dbName].dbIndex.getKeys();
						var mode = readOnly ? ' (read only)' : ' (read/write)';
						console.log(dbName + ' database is open' + mode);
						callback();
					}
				});
			});
		}

		function get(pos, callback) {
			if (pos >= eof) {
				callback();
			} else {
				var blocksize;
				var sizeBuffer = new Buffer(4);
				fs.read(fd, sizeBuffer, 0, 4, pos, function () {
					var size = sizeBuffer.readInt32LE(0);
					if (size < 0) {
						blocksize = -size;
						if (blocksize in freeSizes) {
							freeSizes[blocksize].push(pos);
						} else {
							freeSizes[blocksize] = [pos];
						}
						get(pos + blocksize, callback);
					} else {
						blocksize = getBlocksize(size + 4);
						var encrypted = new Buffer(size);
						fs.read(fd, encrypted, 0, size, pos + 4, function () {
							var decipher = crypto.createDecipher(cipherType, password);
							decipher.end(encrypted);
							var decrypted = decipher.read();
							var buffer = new Buffer(decrypted.length + 4);
							buffer.writeInt32LE(pos, 0);
							decrypted.copy(buffer, 4);
							dbInfo[dbName].dbIndex.put(buffer);
							get(pos + blocksize, callback);
						});
					}
				});
			}
		}

		this.close = function (callback) {
			console.log('closing ' + dbName + ' database...');
			var fullpath = dbName + '.mrdb';
			pushQueue(function () {
				fs.close(fd, function () {
					console.log(dbName + ' database is closed');
					if (readOnly) {
						callback();
					} else {
						fs.truncate(fullpath, eof, callback);
					}
				});
			});
		};

		this.put = function (buffer) {
			pushQueue(function () {
				put(buffer);
			});
		};
			
		function put(buffer) {
			var cipher = crypto.createCipher(cipherType, password);
			cipher.end(buffer.slice(4));
			var encoded = cipher.read();
			var size = encoded.length;
			var fileBuffer = new Buffer(size + 4);
			fileBuffer.writeInt32LE(size, 0);
			encoded.copy(fileBuffer, 4);
			var blocksize = getBlocksize(size + 4);
			var pos = getFree(blocksize);
			var next = pos + blocksize;
			if (eof < next) {
				eof = next;
			}
			buffer.writeInt32LE(pos, 0);
			fs.write(fd, fileBuffer, 0, fileBuffer.length, pos, function () {
				fs.fsync(fd, function () {
					shiftQueue();
				});
			});
		}

		this.remove = function (buffer) {
			pushQueue(function () {
				remove(buffer);
			});
		};

		function remove(buffer) {
			var sizeBuffer = new Buffer(4);
			var pos = buffer.readInt32LE(0);
			fs.read(fd, sizeBuffer, 0, 4, pos, function () {
				var size = sizeBuffer.readInt32LE(0);
				var blocksize = getBlocksize(size + 4);
				if (eof <= (pos + blocksize)) {
					eof = pos;
					fs.ftruncate(fd, eof, function () {
						shiftQueue();
					});
				} else {
					sizeBuffer.writeInt32LE(-blocksize, 0);
					fs.write(fd, sizeBuffer, 0, 4, pos, function () {
						if (blocksize in freeSizes) {
							freeSizes[blocksize].push(pos);
						} else {
							freeSizes[blocksize] = [pos];
						}
						fs.fsync(fd, function () {
							shiftQueue();
						});
					});
				}
			});
		}

		function pushQueue(callback) {
			queue.push(callback);
			if (queue.length === 1) {
				callback();
			}
		}

		function shiftQueue() {
			queue.shift();
			if (queue.length > 0) {
				queue[0]();
			}
		}

		function getFree(blocksize) {
			var pos;
			if (blocksize in freeSizes) {
				pos = freeSizes[blocksize].pop();
				if (freeSizes[blocksize].length === 0) {
					delete freeSizes[blocksize];
				}
			} else {
				pos = eof;
			}
			return pos;
		}
	}

	function getBlocksize(size) {
		size += 67;
		return size - (size % 68);
	}

}());
