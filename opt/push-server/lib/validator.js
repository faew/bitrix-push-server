var crypto = require("crypto");
var util = require("util");
var config = require("../config");
var HttpError = require("./error").HttpError;

function Validator()
{
	this.key = config.security && config.security.key ? config.security.key : null;
	this.algo = config.security && config.security.algo ? config.security.algo : "sha1";

	var algoLength = this.key ? this.getSignature("").length : 40;
	this.channelPattern = new RegExp("^([a-zA-Z0-9]{32})(?:\\.([a-zA-Z0-9]{" + algoLength+ "}))?$");
	this.messagePattern = /^[0-9]{26}$/;
}

/**
 *
 * @param channel
 * @param skipSign
 * @returns Boolean|Array
 */
Validator.prototype.parse = function(channel, skipSign)
{
	var match = util.isString(channel) && channel.match(this.channelPattern);
	if (!match)
	{
		return false;
	}

	var channelId = match[1];
	var signature = match[2];

	if (this.key && skipSign !== true && (!signature || this.getSignature(channelId) !== signature))
	{
		return false;
	}

	return channelId;
};

/**
 *
 * @param {String} query
 * @param {Boolean} skipSign
 * @returns HttpError|Array
 */
Validator.prototype.getChannels = function(query, skipSign)
{
	if (!query || query.length < 1)
	{
		return new HttpError(400, "No channel id provided.");
	}

	var channels = [];
	var channelParts = query.split("/");
	for (var i = 0; i < channelParts.length; i++)
	{
		var channel = this.parse(channelParts[i], skipSign);
		if (!channel)
		{
			return new HttpError(400, "Channel id is not correct.");
		}

		channels.push(channel);
	}

	return channels;
};

/**
 *
 * @param {String} query
 * @returns String|Null
 */
Validator.prototype.getMessageId = function(query)
{
	return util.isString(query) && query.match(this.messagePattern) ? query : null;
};

/**
 *
 * @param {String} value
 * @returns String
 */
Validator.prototype.getSignature = function(value)
{
	var hmac = crypto.createHmac(this.algo, this.key);
	hmac.update(value);
	return hmac.digest("hex");
};

module.exports = new Validator();