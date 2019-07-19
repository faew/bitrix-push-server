function Storage() {}

module.exports = Storage;

Storage.prototype.set = function(channels, data, fn)
{
	throw new Error("The method is not implemented");
};

Storage.prototype.get = function(since, fn)
{
	throw new Error("The method is not implemented");
};

Storage.prototype.getLastMessage = function(channels, callback)
{
	throw new Error("The method is not implemented");
};
