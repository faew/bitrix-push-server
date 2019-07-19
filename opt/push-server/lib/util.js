var util = require("util");

exports.extend = function(origin, ext) {
	if (!ext || typeof ext !== "object")
	{
		return origin;
	}

	var keys = Object.keys(ext);
	var i = keys.length;
	while (i--)
	{
		origin[keys[i]] = ext[keys[i]];
	}

	return origin;
};

exports.addLeftPad = function(input, paddingLen, paddingStr) {
	var i = input.length;
	var q = paddingStr.length;

	if (i >= paddingLen)
	{
		return input;
	}

	for (; i < paddingLen; i+=q)
	{
		input = paddingStr + input;
	}

	return input;
};

exports.unique = function(array) {

	if (typeof(Set) !== "undefined")
	{
		var out = [];
		var uniqueSet = new Set(array);

		uniqueSet.forEach(function(el) {
			out.push(el);
		});

		return out;
	}
	else
	{
		return array.reduce(function(p, c) {
			if (p.indexOf(c) < 0) p.push(c);
			return p;
		}, []);
	}
};

exports.flatten = function flatten(array) {
	var push = Array.prototype.push;
	return array.reduce(function(a, b) {
		if (!(a instanceof Array)) {
			a = [a];
		}
		if (!(b instanceof Array)) {
			b = [b];
		}
		push.apply(a, b);
		return a;
	});
};

exports.reduceLog = function(array) {
	if (!util.isArray(array))
	{
		return array;
	}

	return array.map(function(element) {

		if (isString(element))
		{
			return element.substring(0, 5) + "...";
		}
	});
};

exports.isEmptyObject = function(obj)
{
	for (var key in obj)
	{
		return false;
	}

	return true;
};

function isString(arg)
{
	return typeof arg === "string";
}

exports.isString = isString;

exports.randString = function(length)
{
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghiklmnopqrstuvwxyz";
	length = length || 8;

	var string = "";

	for (var i = 0; i < length; i++)
	{
		var randomNumber = Math.floor(Math.random() * chars.length);
		string += chars.substring(randomNumber, randomNumber + 1);
	}

	return string;
};

exports.getRandomInt = function(min, max)
{
	return Math.floor(Math.random() * (max - min + 1)) + min;
};