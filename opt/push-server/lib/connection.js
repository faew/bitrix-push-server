var util = require("util");
var url = require("url");
var EventEmitter = require("events").EventEmitter;
var ServerResponse = require("http").ServerResponse;
var validator = require("./validator");
var logger = require("./debug");

var requestGlobalId = 0;

function Connection(request)
{
	this.id = ++requestGlobalId;
	var uri = url.parse(request.url, true);

	var result = validator.getChannels(uri.query.CHANNEL_ID);
	this.error = result instanceof Error ? result : null;
	this.channels = util.isArray(result) ? result : [];

	this.socket = request.socket;
	this.mid = validator.getMessageId(uri.query.mid);
	this.dateCreated = new Date().getTime();
	this.active = true;

	this.type = null;
}

util.inherits(Connection, EventEmitter);
module.exports = Connection;

var Polling = require("./transports/polling");
var WebSocket = require("./transports/websocket");
/**
 *
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 * @param {Storage} storage
 * @returns {Connection}
 */
Connection.create = function(request, response, storage)
{
	return response instanceof ServerResponse ? new Polling(request, response, storage) : new WebSocket(request, response, storage);
};

Connection.prototype.sendMessages = function(messages)
{
	if (!util.isArray(messages) || messages.length < 1)
	{
		return;
	}

	var data = "";
	for (var i = 0, len = messages.length; i < len; i++)
	{
		var message = Connection.stringifyMessage(messages[i]);
		if (message !== null)
		{
			data += message;
		}
	}

	this.sendData(data);
};

Connection.prototype.sendData = function(data)
{
	logger.debugSocket(this.socket, "[SEND]", (data && data.length) + "B");

	this.send(data, function onSendMessage(error)
	{
		//if (error)
		//{
		//	console.log("Sending error", new Date(), this.constructor.name, error);
		//}
	});
};

Connection.stringifyMessage = function(message)
{
	if (!message)
	{
		return null;
	}

	var tag = message.dateCreated.toString();
	tag = tag.substring(tag.length - 3);

	var json = {
		"id": parseInt(message.id.substring(10), 10),
		"mid": message.id,
		"channel": message.channels[0],
		"tag": tag,
		"time": new Date(message.dateCreated).toUTCString(),
		"text": "---replace---" //hack for Bitrix json format
	};

	return "#!NGINXNMS!#" +
			JSON.stringify(json).replace('"---replace---"', function() { return message.text; }) +
			"#!NGINXNME!#";
};

Connection.prototype.getMid = function()
{
	return this.mid;
};

Connection.prototype.getChannels = function()
{
	return this.channels;
};

Connection.prototype.getError = function()
{
	return this.error;
};

Connection.prototype.isActive = function()
{
	return this.active;
};

Connection.prototype.getType = function()
{
	return this.type;
};

Connection.prototype.isWebsocket = function()
{
	return this.type === "websocket";
};

Connection.prototype.isPolling = function()
{
	return this.type === "polling";
};

Connection.prototype.send = function(data, callback)
{
	throw new Error("The method is not implemented");
};

Connection.prototype.hold = function()
{
	throw new Error("The method is not implemented");
};

Connection.prototype.close = function(status, data)
{
	throw new Error("The method is not implemented");
};