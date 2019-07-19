var Storage = require("../storage");
var util = require("util");
var $ = require("../util");

function MemoryStorage(options)
{
	this.options = $.extend(MemoryStorage.defaultOptions, options.storage);
	this.messages = {};
	this.channels = {};

	this.startDate = Math.floor(new Date().getTime() / 1000);
	this.messageCounter = 0;

	this.cleanupIntervalId = null;
	if (this.options.cleanup)
	{
		this.cleanupIntervalId = setInterval(
			this.cleanup.bind(this),
			this.options.cleanupInterval
		);
	}
}

util.inherits(MemoryStorage, Storage);
module.exports = MemoryStorage;

MemoryStorage.defaultOptions = {
	messageTTL: 1000 * 60 * 60 * 12,
	cleanupInterval: 1000 * 60 * 5,
	cleanup: false
};

MemoryStorage.prototype.set = function(channels, data, callback)
{
	if (!util.isArray(channels))
	{
		channels = [channels];
	}

	var now = new Date().getTime();
	var message = {
		id : this.getNextMessageId(),
		text: data.text,
		dateCreated: now,
		dateExpiry: now + (data.expiry ? data.expiry : this.options.messageTTL) * 1000,
		channels: channels
	};

	this.messages[message.id] = message;

	channels.forEach(function(channelId) {

		if (!this.channels[channelId])
		{
			this.channels[channelId] = {
				id: channelId,
				messages: [],
				dateCreated: new Date().getTime(),
				published: 0
			};
		}

		this.channels[channelId].messages.push(message);
		this.channels[channelId].published++;

	}, this);

	process.nextTick(function() {
		//console.log("message:", channels, message.id, data);
		callback(null, message);
	});
};

MemoryStorage.prototype.get = function(channels, since, callback)
{
	var messages = [];
	since = since || 0;

	if (!util.isArray(channels))
	{
		channels = [channels];
	}

	channels.forEach(function(channelId) {
		var channel = this.channels[channelId];
		if (channel)
		{
			for (var i = channel.messages.length-1; i >= 0; i--)
			{
				var message = channel.messages[i];
				if (message.id <= since)
				{
					break;
				}

				message.channelId = channelId;
				messages.unshift(message);
			}
		}
		else
		{
			//console.log("Error: channel %s was not found", channelId);
		}
	}, this);

	process.nextTick(function() {
		//console.log("get messages:", channels, since);
		callback(null, messages);
	});
};

MemoryStorage.prototype.getLastMessage = function(channels, callback)
{
	if (!util.isArray(channels))
	{
		channels = [channels];
	}

	var lastMessage = null;
	channels.forEach(function(channelId) {

		var message = this.channels[channelId] && this.channels[channelId].messages > 0
						? this.channels[channelId].messages[this.channels[channelId].messages.length-1]
						: null;
		if (lastMessage === null || (message !== null && message.id > lastMessage.id))
		{
			lastMessage = message;
		}
	}, this);

	callback(null, lastMessage);
};

MemoryStorage.prototype.getMessageId = function()
{
	return this.startDate.toString() + $.addLeftPad(this.messageCounter.toString(), 16, "0");
};

MemoryStorage.prototype.getNextMessageId = function()
{
	this.messageCounter++;
	return this.getMessageId();
};

MemoryStorage.prototype.cleanup = function()
{
	var now = new Date().getTime();

	for (var id in this.messages)
	{
		if (this.messages[id].dateExpiry < now)
		{
			this.deleteMessage(id);
		}
	}
};

MemoryStorage.prototype.deleteMessage = function(messageId)
{
	var message = this.messages[messageId];
	if (!message)
	{
		return false;
	}

	message.channels.forEach(function(channelId) {
		var channel = this.channels[channelId];
		if (channel)
		{
			var index = channel.messages.indexOf(message);
			if (index !== -1)
			{
				channel.messages.splice(index, 1);
			}
		}
	}, this);

	delete this.messages[messageId];
	console.log("message %s has been deleted.", messageId);

	return true;
};