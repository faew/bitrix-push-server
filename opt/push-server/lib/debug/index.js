var winston = require("winston");
var $ = require("../util");
var config = require("../../config");
var util = require("util");
var path = require("path");

var allowedIPs = false;
var logFolder = "logs";
if (config.debug)
{
	if (util.isString(config.debug.folderName))
	{
		logFolder = config.debug.folderName;
	}

	if (Array.isArray(config.debug.ip))
	{
		allowedIPs = config.debug.ip;
	}
}

var infoLogger = new winston.Logger({
	transports: [
		new winston.transports.Console({
			name: "console",
			level: "info",
			showLevel: false,
			timestamp: timestamp,
			formatter: formatter
		}),
		new winston.transports.File({
			name: "info-log",
			level: "info",
			maxsize: 1024 * 1024 * 10,
			filename: path.join(logFolder, "/info.log"),
			showLevel: false,
			json: false,
			silent: false,
			colorize: true,
			timestamp: timestamp,
			formatter: formatter
		})
	],
	levels: {
		info: 0
	},
	colors: {
		info: "green"
	}
});
var debugLogger = new winston.Logger({
	transports: [
		new winston.transports.DailyRotateFile({
			name: "debug-log",
			level: "debug",
			maxsize: 1024 * 1024 * 10,
			filename: path.join(logFolder, "/debug"),
			datePattern: ".yyyy-MM-dd.log",
			showLevel: false,
			json: false,
			timestamp: timestamp,
			formatter: formatter
		})
	],
	levels: {
		debug: 0
	},
	colors: {
		debug: "blue"
	}
});

var errorLogger = new winston.Logger({
	transports: [
		new winston.transports.DailyRotateFile({
			name: "error-log",
			level: "error",
			maxsize: 1024 * 1024 * 10,
			filename: path.join(logFolder, "/error"),
			datePattern: ".yyyy-MM-dd.log",
			showLevel: false,
			json: false,
			handleExceptions: true,
			timestamp: timestamp,
			formatter: formatter
		}),
		new winston.transports.Console({
			name: "error-console",
			level: "error",
			showLevel: false,
			timestamp: timestamp,
			formatter: formatter,
			handleExceptions: true,
			colorize: true,
			prettyPrint: true,
			humanReadableUnhandledException: true
		})
	],
	levels: {
		error: 0
	},
	colors: {
		error: "red"
	}
});

var logger = {

	info: function()
	{
		infoLogger.info.apply(infoLogger, arguments);
	},

	debug: function()
	{
		debugLogger.debug.apply(debugLogger, arguments);
	},

	error: function()
	{
		errorLogger.error.apply(errorLogger, arguments);
	},

	initSocket: function(socket)
	{
		if (allowedIPs === false || !isValidIp(socket.remoteAddress, allowedIPs))
		{
			return;
		}

		socket.bxDebugId = getUniqueId();
		socket.bxDebugStart = new Date();
		debugLogger.debug(socket.bxDebugId, "[TCP-CONNECTION]", socket.remoteAddress + ":" + socket.remotePort);
	},


	initTLSSocket: function(tlsSocket)
	{
		if (!tlsSocket || !tlsSocket._parent || !tlsSocket._parent.bxDebugId)
		{
			return;
		}

		tlsSocket.bxDebugId = tlsSocket._parent.bxDebugId;
		tlsSocket.bxDebugStart = tlsSocket._parent.bxDebugStart;
		debugLogger.debug(tlsSocket.bxDebugId, "[TLS-CONNECTION]", tlsSocket.remoteAddress + ":" + tlsSocket.remotePort);
	},

	debugSocket: function(socket)
	{
		if (!socket || !socket.bxDebugId)
		{
			return;
		}

		arguments[0] = socket.bxDebugId;
		debugLogger.debug.apply(debugLogger, arguments);
	},

	debugRequest: function(request, response)
	{
		if (!request || !request.socket || !request.socket.bxDebugId)
		{
			return;
		}

		var id = request.socket.bxDebugId;
		var startTime = request.socket.bxDebugStart;

		debugLogger.debug(id, "[" + request.method + "]", request.url, request.socket.remoteAddress + ":" + request.socket.remotePort);

		response.on("close", function() {
			debugLogger.debug(id, "[CLOSED]", (Date.now() - startTime) + "ms", this.statusCode);
		});

		response.on("finish", function() {
			debugLogger.debug(id, "[FINISHED]", (Date.now() - startTime) + "ms", this.statusCode);
		});

		request.on("close", function() {
			debugLogger.debug(id, "[CLOSED-BY-CLIENT]", (Date.now() - startTime) + "ms");
		});
	},

	debugWebsocket: function(request, socket)
	{
		if (!request || !request.socket || !request.socket.bxDebugId)
		{
			return;
		}

		var id = request.socket.bxDebugId;
		var startTime = request.socket.bxDebugStart;

		debugLogger.debug(id, "[WS-" + request.method + "]", request.url, request.socket.remoteAddress + ":" + request.socket.remotePort);

		socket.on("close", function(code, message) {
			debugLogger.debug(id, "[WS-CLOSED]", code, message, (Date.now() - startTime) + "ms");
		});
	},

	profileStart: function(socket)
	{
		if (!socket || !socket.bxDebugId)
		{
			return;
		}

		socket.bxDebugProfile = Date.now();
	},

	profileEnd: function(socket)
	{
		if (!socket || !socket.bxDebugId || !socket.bxDebugProfile)
		{
			return;
		}
		Array.prototype.push.call(arguments, (Date.now() - socket.bxDebugProfile) + "ms");
		arguments[0] = socket.bxDebugId;

		debugLogger.debug.apply(debugLogger, arguments);
	}
};

module.exports = logger;

function isValidIp(ip, allowed)
{
	if (!util.isString(ip))
	{
		return false;
	}

	for (var i = 0, len = allowed.length; i < len; i++)
	{
		if (ip.indexOf(allowed[i]) !== -1)
		{
			return true;
		}
	}

	return false;
}

function timestamp()
{
	return formatDate(new Date());
}

function formatter(options)
{
	return options.timestamp() + " " + (options.message !== undefined ? options.message : "") +
		(options.meta && Object.keys(options.meta).length ? " "+ JSON.stringify(options.meta) : "");
}

function padding(number)
{
	if (number < 10)
	{
		return "0" + number;
	}

	return number;
}

function formatDate(date)
{
	return date.getUTCFullYear() +
		'-' + padding(date.getUTCMonth() + 1) +
		'-' + padding(date.getUTCDate()) +
		' ' + padding(date.getUTCHours()) +
		':' + padding(date.getUTCMinutes()) +
		':' + padding(date.getUTCSeconds()) +
		'.' + (date.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5);
}

var requestId = 0;
function getUniqueId()
{
	return process.pid + "T" + $.addLeftPad(++requestId + "", 8, "0");
}