var Connection = require("./connection");
var $ = require("./util");
var validator = require("./validator");
var url = require("url");
var logger = require("./debug");

var http = require("http");
var Buffer = require("buffer").Buffer;
var HttpError = require("./error").HttpError;

function Application(options)
{
	this.options = $.extend(Application.defaultOptions, options);

	/**
	 * @type {Storage}
	 */
	var StorageClass = require("./storages/" + this.options.storage.type);
	this.storage = new StorageClass(this.options);

	var AdapterClass = require("./adapters/" + (this.options.clusterMode ? "cluster" : "adapter"));
	this.adapter = new AdapterClass(this.options);
}

module.exports = Application;

Application.defaultOptions = {
	storage: {
		type: "redis"
	}
};

/**
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 */
Application.prototype.subscribe = function(request, response)
{
	var connection = Connection.create(request, response, this.storage);
	if (connection.getError() !== null)
	{
		var err = connection.getError();
		connection.close(err.getStatus(), err.getMessage());
		return;
	}

	var mid = connection.getMid();
	if (mid === null)
	{
		this.adapter.add(connection);
	}
	else
	{
		logger.profileStart(connection.socket);
		this.storage.get(connection.getChannels(), mid, function onGetMessages(error, messages) {
			if (error)
			{
				connection.close(400);
				return;
			}

			logger.profileEnd(request.socket, "[MESSAGE-GET]", messages.length);

			if (messages.length > 0)
			{
				connection.sendMessages(messages);
			}

			this.adapter.add(connection);

		}.bind(this));
	}
};

/**
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 */
Application.prototype.publish = function(request, response)
{
	var uri = url.parse(request.url, true);
	var result = validator.getChannels(uri.query.CHANNEL_ID, true);
	if (result instanceof Error)
	{
		response.writeHead(result.getStatus(), { "Content-Type": "text/plain" });
		response.end(result.getMessage());
		return;
	}

	if (!request.body || request.body.length < 1)
	{
		response.writeHead(400, { "Content-Type": "text/plain" });
		response.end("Empty post requests are not allowed.");
		return;
	}

	response.writeHead(200, { "Content-Type": "text/plain" });
	response.end();

	var expiry = request.headers["message-expiry"] && parseInt(request.headers["message-expiry"], 10);
	expiry = (expiry && !isNaN(expiry) && expiry > 0) ? expiry : 0;

	var data = {
		text: request.body,
		expiry: expiry
	};

	logger.profileStart(request.socket);
	this.storage.set(result, data, function onSetMessage(error, message) {
		if (error || !message)
		{
			logger.error("Storage: Publishing Error:", error);
			return;
		}
		logger.profileEnd(request.socket, "[MESSAGE-SET]", message.id);

		this.adapter.broadcast(message);
	}.bind(this));

	if (this.options.duplicatePub)
	{
		this.duplicatePub(request);
	}
};

Application.prototype.duplicatePub = function(request)
{
	var uri = url.parse(request.url);
	var req = http.request({
		hostname: this.options.duplicatePub.hostname || "localhost",
		port: this.options.duplicatePub.port || 8895,
		path: uri.path,
		method: "POST",
		headers: {
			"Content-Length": Buffer.byteLength(request.body)
		},
		agent: new http.Agent({
			keepAlive: true,
			keepAliveMsecs: 75000
		})
	});

	req.on("error", function(error) {});
	req.write(request.body);
	req.end();
};

Application.prototype.getChannelsStat = function(request, response)
{
	var uri = url.parse(request.url, true);
	var result = validator.getChannels(uri.query.CHANNEL_ID, true);
	if (result instanceof Error)
	{
		response.writeHead(result.getStatus(), { "Content-Type": "text/plain" });
		response.end(result.getMessage());
		return;
	}

	this.adapter.getOnline(result, function onGetOnline(error, stats) {
		if (error)
		{
			logger.error("Adapter: Get Online Error", error);
			stats = [];
		}

		response.writeHead(200, { "Content-Type": "text/plain" });
		response.end("{ \"infos\": " + JSON.stringify(stats) +"}");
	});
};

Application.prototype.getStat = function(request, response)
{
	this.adapter.getStat(function onGetStat(error, stats) {
		if (error)
		{
			logger.error("Adapter: Get Stat Error", error);
		}

		if (!Array.isArray(stats))
		{
			stats = [stats];
		}

		response.writeHead(200, { "Content-Type": "text/plain" });
		response.end(JSON.stringify(stats));
	});
};

Application.prototype.handleUpgrade = function(request, socket, upgradeHead, cb)
{
	var uri = url.parse(request.url, true);
	var error = validator.getChannels(uri.query.CHANNEL_ID);
	if (error instanceof HttpError)
	{
		if (socket.writable)
		{
			socket.write(
				"HTTP/1.1 400 Bad Request\r\n" +
				"Connection: close\r\n" +
				"Content-type: text/html\r\n" +
				"Access-Control-Allow-Origin: *\r\n" +
				"Access-Control-Expose-Headers: Last-Message-Id\r\n" +
				"Content-Length: 11\r\n" +
				"\r\n" +
				"Bad Request"
			);
		}

		socket.destroy();

		return true;
	}

	return false;
};