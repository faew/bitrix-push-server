var Connection = require("../connection");
var $ = require("../util");
var util = require("util");

/* Connection Manager */
function Adapter(options)
{
	this.options = $.extend({}, options);
	this.connections = {};
	this.stat = {
		websockets: 0,
		pollings: 0,
		channels: 0
	}
}

module.exports = Adapter;

Adapter.prototype.add = function(connection)
{
	if (!connection.isActive())
	{
		return;
	}

	connection.isWebsocket() ? this.stat.websockets++ : this.stat.pollings++;

	var channels = connection.getChannels();
	for (var i = 0; i < channels.length; i++)
	{
		var channelId = channels[i];
		if (!this.connections[channelId])
		{
			this.connections[channelId] = {};
			this.stat.channels++;
		}

		this.connections[channelId][connection.id] = connection;
	}

	connection.hold();
	connection.on("close", this.delete.bind(this, connection));
};

Adapter.prototype.delete = function(connection)
{
	var success = false;
	var channels = connection.getChannels();
	for (var i = 0; i < channels.length; i++)
	{
		if (!this.connections[channels[i]])
		{
			continue;
		}

		delete this.connections[channels[i]][connection.id];
		success = true;

		if ($.isEmptyObject(this.connections[channels[i]]))
		{
			delete this.connections[channels[i]];
			this.stat.channels--;
		}
	}

	if (success)
	{
		connection.isWebsocket() ? this.stat.websockets-- : this.stat.pollings--;
	}
};

Adapter.prototype.broadcast = function(message)
{
	var channels = message.channels;
	for (var i = 0; i < channels.length; i++)
	{
		var channelId = channels[i];
		if (!this.connections[channelId])
		{
			continue;
		}

		var data = Connection.stringifyMessage(message);
		for (var requestId in this.connections[channelId])
		{
			var connection = this.connections[channelId][requestId];
			connection.sendData(data);
		}
	}
};

Adapter.prototype.getOnline = function(channels, callback)
{
	var stats = [];
	for (var i = 0, length = channels.length; i < length; i++)
	{
		if (this.connections[channels[i]])
		{
			stats.push({ channel: channels[i], subscribers: 1 });
		}
	}

	callback(null, stats);
};

Adapter.prototype.getStat = function(callback)
{
	var fields = {
		pid: process.pid,
		date: Date.now(),
		processUniqueId:
			util.isString(this.options.processUniqueId) && this.options.processUniqueId.length > 0
			? this.options.processUniqueId
			: process.pid
	};

	callback(null, $.extend(fields, this.stat));
};