var util = require("util");
var Connection = require("../connection");
var $ = require("../util");
var logger = require("../debug");

function Polling(request, response, storage)
{
	Polling.super_.call(this, request);
	this.response = response;
	this.storage = storage;
	this.type = "polling";
}

util.inherits(Polling, Connection);
module.exports = Polling;

Polling.prototype.send = function(data, callback)
{
	this.close(200, data);
	callback(null);
};

Polling.prototype.hold = function()
{
	this.response.setTimeout(40 * 1000, this.ontimeout.bind(this));
	this.response.on("close", this.onclose.bind(this));
};

Polling.prototype.ontimeout = function()
{
	if (this.getMid() !== null)
	{
		this.close(304, null, {
			"Last-Message-Id" : this.getMid(),
			"Expires": "Thu, 01 Jan 1973 11:11:01 GMT"
		});
	}
	else
	{
		logger.profileStart(this.socket);
		this.storage.getLastMessage(this.getChannels(), function onGetLastMessage(error, message) {

			logger.profileEnd(this.socket, "[MESSAGE-LAST]", message !== null ? message.id : "none");

			this.close(304, null, {
				"Last-Message-Id" : message !== null ? message.id : "",
				"Expires": "Thu, 01 Jan 1973 11:11:01 GMT"
			});

		}.bind(this));
	}
};

Polling.prototype.onclose = function()
{
	this.active = false;
	this.emit("close");
};

Polling.prototype.close = function(status, data, headers)
{
	this.active = false;
	var defaultHeaders = {
		"Content-Type": "text/plain",
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Expose-Headers": "Last-Message-Id"
	};

	if (headers)
	{
		defaultHeaders = $.extend(defaultHeaders, headers);
	}

	this.response.writeHead(status, defaultHeaders);
	this.response.end(data);
	this.emit("close");
};
