// Object.js
'use scrict';

Object.prototype.toBuffer = function () {
	return (Buffer.isBuffer(this)) ? this : new Buffer(JSON.stringify(this));
};

Object.prototype.toObject = function () {
	return (Buffer.isBuffer(this)) ? JSON.parse(this.toString()) : this;
};
