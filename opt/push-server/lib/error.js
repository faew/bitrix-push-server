var util = require("util");
var http = require("http");

function HttpError(status, message)
{
	Error.apply(this, arguments);
	Error.captureStackTrace(this, HttpError);

	this.status = status;
	this.message = message || http.STATUS_CODES[status] || "Error";
}

util.inherits(HttpError, Error);

HttpError.prototype.name = "HttpError";

HttpError.prototype.getMessage = function()
{
	return this.message;
};

HttpError.prototype.getStatus = function()
{
	return this.status;
};

exports.HttpError = HttpError;