var util = require("util");

function Message(id, channels, data)
{
	this.id = id;
	this.text = data.text;
	this.expiry = data.expiry;

	if (!util.isArray(channels))
	{
		channels = [channels];
	}
	this.channels = channels;
	this.dateCreated = new Date().getTime();
}

module.exports = Message;