// fuzzy.js
'use strict';

(function () {

	module.exports.filter = filter;
	module.exports.match = match;

	function filter(pattern, array) {
		if (typeof pattern === 'string') {
			pattern = pattern.toLowerCase();
		}
		return array.filter(function (string) {
			return match(pattern, string);
		});
	};

	function match(pattern, string) {
		if (typeof string === 'string') {
			string = string.toLowerCase();
		}
		var patternIndex = 0;
		for (var index = 0; index < string.length; ++index) {
			if (string[index] === pattern[patternIndex]) {
				++patternIndex;
			}
		}
		return patternIndex === pattern.length;
	};

}());
