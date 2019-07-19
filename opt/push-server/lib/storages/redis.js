var Storage = require("../storage");
var Message = require("../message");
var util = require("util");
var $ = require("../util");
var redis = require("redis");
var logger = require("../debug");

function RedisStorage(options)
{
	this.options = $.extend(RedisStorage.defaultOptions, options.storage);
	this.client = this.options.socket ? redis.createClient(this.options.socket) : redis.createClient(this.options.port, this.options.host);

	this.client.on("error", function (error) {
		logger.error("Redis Storage Client Error:" + error);
	});

	this.startDate = null;
	this.messageCounter = 0;
}

util.inherits(RedisStorage, Storage);
module.exports = RedisStorage;

RedisStorage.defaultOptions = {
	port: 6379,
	host: "127.0.0.1",
	messageTTL: 60 * 60 * 24,
	channelTTL: 60 * 60 * 24
};

RedisStorage.prototype.set = function(channels, data, callback)
{
	this.createMessage(channels, data, function(error, message) {

		if (error)
		{
			callback(error, null);
			return;
		}

		this.saveMessage(message, callback);

	}.bind(this));
};

RedisStorage.prototype.createMessage = function(channels, data, callback)
{
	this.client.incr("server:messagecounter", function(error, messageCounter) {

		if (error)
		{
			callback(error, null);
			return;
		}

		this.getStartDate(function(error, startDate) {
			if (error)
			{
				callback(error, null);
				return;
			}

			var id = startDate + $.addLeftPad(messageCounter.toString(), 16, "0");
			callback(null, new Message(id, channels, data));
		});

	}.bind(this));
};

RedisStorage.prototype.saveMessage = function(message, callback)
{
	var expiry = message.expiry > 0 ? Math.min(message.expiry, this.options.messageTTL) : this.options.messageTTL;
	var multi = this.client.multi();
	multi.setex(this.getMessageKey(message.id), expiry, JSON.stringify(message));
	for (var i = 0; i < message.channels.length; i++)
	{
		multi.zadd(this.getChannelKey(message.channels[i]), 0, message.id);
	}

	multi.exec(function(error, result) {
		//console.log("======= post messages", $.reduceLog(message.channels), error, result);
		process.nextTick(function() {
			//console.log("message:", channels, message.id, data);
			callback(error, message);
		});

		if (!error)
		{
			this.setChannelsTTL(message.channels);
		}

	}.bind(this));
};

RedisStorage.prototype.setChannelsTTL = function(channels)
{
	var multi = this.client.multi();
	for (var i = 0; i < channels.length; i++)
	{
		multi.ttl(this.getChannelKey(channels[i]));
	}

	multi.exec(function(error, result) {
		if (error || !util.isArray(result))
		{
			logger.error("Redis: Set Channels TTL Error:" + error);
			return;
		}

		for (var i = 0; i < result.length; i++)
		{
			if (result[i] === -1)
			{
				this.client.expire(this.getChannelKey(channels[i]), this.options.channelTTL, function(error, result) {
					if (error)
					{
						return logger.error("Error expire:" + error);
					}
				});
			}
		}

	}.bind(this));
};

RedisStorage.prototype.get = function(channels, since, callback)
{
	if (!util.isArray(channels))
	{
		channels = [channels];
	}

	var multi = this.client.multi();
	for (var i = 0; i < channels.length; i++)
	{
		multi.zrangebylex([this.getChannelKey(channels[i]), "(" + since, "+"]);
	}

	//console.log("======= get messages", $.reduceLog(channels), "since", since);
	multi.exec(function(error, result) {

		if (error)
		{
			callback(error, []);
		}
		else
		{
			this.getMessages(this.flatten(result), callback);
		}

	}.bind(this));
};

RedisStorage.prototype.flatten = function(array)
{
	var sortMap = {};
	for (var i = 0; i < array.length; i++)
	{
		for (var j = 0, length = array[i].length; j < length; j++)
		{
			sortMap[parseInt(array[i][j].substring(10), 10)] = this.getMessageKey(array[i][j]);
		}
	}

	var result = [];
	for (var key in sortMap)
	{
		result.push(sortMap[key]);
	}

	return result;
};

RedisStorage.prototype.getMessages = function(ids, callback)
{
	if (!util.isArray(ids) || ids.length < 1)
	{
		callback(null, []);
		return;
	}

	this.client.mget(ids, function(error, result) {

		if (error)
		{
			//console.log("error", ids, error, result);
			callback(error, []);
			return;
		}

		var messages = [];
		if (util.isArray(result))
		{
			for (var i = 0, len = result.length; i < len; i++)
			{
				if ($.isString(result[i]))
				{
					messages.push(JSON.parse(result[i]));
				}
			}
		}

		process.nextTick(function() {
			callback(error, messages);
		});

	});
};

RedisStorage.prototype.getMessageKey = function(messageId)
{
	return "message:" + messageId;
};

RedisStorage.prototype.getChannelKey = function(channelId)
{
	return "channel:" + channelId + ":messages";
};

RedisStorage.prototype.getStartDate = function(callback)
{
	if (this.startDate !== null)
	{
		callback(null, this.startDate);
		return;
	}

	var startDate = Math.floor(new Date().getTime() / 1000);
	var multi = this.client.multi();
	multi.setnx("server:startdate", startDate);
	multi.get("server:startdate");
	multi.exec(function(error, result) {
		if (error || (!util.isArray(result) && result.length !== 2))
		{
			logger.error("Redis: Get Start Date Error:" + error);
			callback(error, null);
		}
		else
		{
			this.startDate = result[1];
			callback(null, this.startDate);
		}

	}.bind(this));
};

RedisStorage.prototype.getLastMessage = function(channels, callback)
{
	if (!util.isArray(channels))
	{
		channels = [channels];
	}

	var multi = this.client.multi();
	for (var i = 0; i < channels.length; i++)
	{
		multi.zrevrange(this.getChannelKey(channels[i]), 0, 0); //last element in a ordered set
	}

	multi.exec(function(error, result) {
		if (error)
		{
			callback(error, null);
			return;
		}

		var ids = $.flatten(result);
		var lastMessageId = ids.reduce(function(prev, cur) {
			return cur > prev ? cur : prev;
		}, "");

		if (lastMessageId.length > 0)
		{
			this.getMessages([this.getMessageKey(lastMessageId)], function(error, messages) {
				if (error)
				{
					callback(error, null);
				}
				else
				{
					callback(null, util.isArray(messages) && messages.length ? messages[0] : null);
				}
			});
		}
		else
		{
			callback(null, null);
		}

	}.bind(this));
};