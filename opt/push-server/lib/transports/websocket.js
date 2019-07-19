var util = require("util");
var $ = require("../util");
var Connection = require("../connection");
var logger = require("../debug");

function WebSocket(request, wsocket, storage)
{
	WebSocket.super_.call(this, request);
	this.wsocket = wsocket;
	this.type = "websocket";

	this.timeoutId = null;
	this.buffer = null;

	this.pingAttemps = 0;
	this.pingTimeoutTimer = null;
	this.setPingTimeout();
	this.wsocket.on("pong", this.onpong.bind(this));

	this.wsocket.on("error", function(error, errorCode) {
		logger.error("Websocket Error:", error, errorCode);
	});
}

util.inherits(WebSocket, Connection);
module.exports = WebSocket;

WebSocket.prototype.send = function(data, callback)
{
	if (this.timeoutId)
	{
		this.buffer = this.buffer || { data: "", cbs: [] };
		this.buffer.data += data;
		this.buffer.cbs.push(callback);
	}
	else
	{
		this.wsocket.send(data, callback);
		this.timeoutId = setTimeout(this.onbuffer.bind(this), $.getRandomInt(250, 400));
	}
};

WebSocket.prototype.onbuffer = function()
{
	clearInterval(this.timeoutId);
	this.timeoutId = null;
	if (!this.buffer)
	{
		return;
	}

	var callbacks = this.buffer.cbs;
	this.wsocket.send(this.buffer.data, function(error) {

		for (var i = 0; i < callbacks.length; i++)
		{
			callbacks[i](error);
		}

	}.bind(this));

	this.buffer = null;
};

WebSocket.prototype.hold = function()
{
	this.wsocket.on("close", this.onclose.bind(this));
};

WebSocket.prototype.onclose = function()
{
	if (this.pingTimeoutTimer)
	{
		clearTimeout(this.pingTimeoutTimer);
	}

	this.active = false;
	this.emit("close");
};

WebSocket.prototype.close = function(status, data)
{
	this.active = false;
	this.wsocket.close(1000, data);
};


WebSocket.prototype.setPingTimeout = function()
{
	if (this.pingTimeoutTimer)
	{
		clearTimeout(this.pingTimeoutTimer);
	}

	this.pingTimeoutTimer = setTimeout(this.pingTimeout.bind(this), 120000);
};

WebSocket.prototype.pingTimeout = function()
{
	if (this.pingAttemps >= 2)
	{
		this.wsocket.terminate();
	}
	else
	{
		this.wsocket.ping("ws ping", {}, true);
		this.pingAttemps++;
		this.setPingTimeout();
	}
};

WebSocket.prototype.onpong = function()
{
	this.pingAttemps = 0;
};