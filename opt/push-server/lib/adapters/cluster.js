var util = require("util");
var redis = require("redis");
var $ = require("../util");
var Adapter = require("./adapter");
var WebSocket = require("../transports/websocket");
var logger = require("../debug");

/* Connection Manager */
function ClusterAdapter(options)
{
	Adapter.call(this, options);

	this.uid = $.randString(8);

	var storage = this.options.storage;
	var host = storage.host || "127.0.0.1";
	var port = Number(storage.port || 6379);
	var socket = $.isString(storage.socket) && storage.socket.length > 0 ? storage.socket : null;
	this.client = socket ? redis.createClient(socket) : redis.createClient(port, host);
	this.client.on("error", function (error) {
		logger.error("Redis Pub Client Error:" + error);
	});

	if (!this.options.publishMode)
	{
		this.subClient = socket ? redis.createClient(socket) : redis.createClient(port, host);

		this.subClient.on("error", function (error) {
			logger.error("Redis Sub Client Error:" + error);
		});

		this.subClient.psubscribe("pushserver:*", function onPsubscribe(error) {
			if (error)
			{
				logger.error("Redis Psubscribe Error:" + error);
			}
		});

		this.subClient.on("pmessage", this.onmessage.bind(this));
	}

	this.onlineTTL = storage.onlineTTL || 120;
	this.onlineDelta = storage.onlineDelta || 10;
	this.statTLLMsec = storage.statTLLMsec || 30000;
	this.statDeltaMsec = storage.statDeltaMsec || 10000;

	this.setStat();
	setInterval(this.setStat.bind(this), this.statTLLMsec);
}

util.inherits(ClusterAdapter, Adapter);
module.exports = ClusterAdapter;

ClusterAdapter.prototype.add = function(connection)
{
	Adapter.prototype.add.call(this, connection);
	this.setOnline(connection);
};

ClusterAdapter.prototype.setOnline = function(connection)
{
	var privateChannelId = connection.getChannels()[0];
	this.client.setex(
		"online:" + privateChannelId,
		this.onlineTTL + this.onlineDelta,
		privateChannelId,
		function(error, result) {
			if (error)
			{
				return logger.error("Redis Set Online Error:" + error);
			}
		}
	);

	if (!connection.tm && connection instanceof WebSocket)
	{
		connection.tm = setInterval(this.setOnline.bind(this, connection), this.onlineTTL * 1000);
	}
};

ClusterAdapter.prototype.delete = function(connection)
{
	if (connection.tm)
	{
		clearInterval(connection.tm);
	}

	Adapter.prototype.delete.call(this, connection);
};

ClusterAdapter.prototype.broadcast = function(message)
{
	if (!this.options.publishMode)
	{
		Adapter.prototype.broadcast.call(this, message);
	}

	this.client.publish("pushserver:" + this.uid, JSON.stringify(message));
};

ClusterAdapter.prototype.onmessage = function(pattern, channel, message)
{
	var pieces = channel.split(":");
	if (this.uid !== pieces.pop())
	{
		Adapter.prototype.broadcast.call(this, JSON.parse(message));
	}
};

ClusterAdapter.prototype.getOnline = function(channels, callback)
{
	var ids = channels.map(function(id) {
		return "online:" + id;
	});

	this.client.mget(ids, function onMgetOnline(error, result) {

		if (error)
		{
			callback(error, []);
			return;
		}

		var stats = [];
		if (util.isArray(result))
		{
			for (var i = 0, len = result.length; i < len; i++)
			{
				if ($.isString(result[i]))
				{
					stats.push({ channel: result[i], subscribers: 1 });
				}
			}
		}

		process.nextTick(function() {
			callback(error, stats);
		});

	});
};

ClusterAdapter.prototype.getStat = function(callback)
{
	//callback(null, $.extend({ pid: process.pid, date: Date.now()}, this.stat) );
	this.client.hgetall("stats", function (error, result) {

		if (error)
		{
			return callback(error, []);

		}

		var stats = [];
		var wrongFields = [];
		for (var field in result) {
			var item = JSON.parse(result[field]);
			if (!item.date || (Date.now() - item.date) > (this.statTLLMsec + this.statDeltaMsec))
			{
				wrongFields.push(field);
			}
			else
			{
				stats.push(item)
			}
		}

		this.delStat(wrongFields);
		callback(error, stats);

	}.bind(this));
};

ClusterAdapter.prototype.setStat = function()
{
	Adapter.prototype.getStat.call(this, function(error, stat) {

		var hash = {};
		hash[stat.processUniqueId] = JSON.stringify(stat);
		this.client.hmset("stats", hash, function(error, result) {
			if (error)
			{
				return logger.error("Redis Set Stat Error:" + error);
			}
		});

	}.bind(this));
};


ClusterAdapter.prototype.delStat = function(fields)
{
	if (!util.isArray(fields) || fields.length < 1)
	{
		return;
	}

	fields.unshift("stats");
	this.client.hdel(fields, function(error, result) {
		if (error)
		{
			return logger.error("Redis Delete Stat Error:" + error);
		}
	});
};