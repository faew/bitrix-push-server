var Router = require("./router");
var logger = require("../lib/debug");

function Routing(app, serverConfig)
{
	this.router = new Router();

	if (serverConfig.routes && serverConfig.routes.pub)
	{
		this.router.post(serverConfig.routes.pub, function onPubPost(request, response) {
			Routing.processBody(request, response, app.publish.bind(app));
		});

		this.router.get(serverConfig.routes.pub, function onPubGet(request, response) {
			app.getChannelsStat(request, response);
		});
	}

	if (serverConfig.routes && serverConfig.routes.sub)
	{
		this.router.get(serverConfig.routes.sub, function onSubGet(request, response) {
			app.subscribe(request, response);
		});

		this.router.options(serverConfig.routes.sub, function onSubOptions(request, response) {
			response.writeHead(200, {
				"Content-Type": "text/plain",
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
				"Access-Control-Allow-Headers": "If-Modified-Since, If-None-Match"
			});
			response.end();
		});
	}

	if (serverConfig.routes && serverConfig.routes.stat)
	{
		this.router.get(serverConfig.routes.stat, function onStatGet(request, response) {
			app.getStat(request, response);
		});
	}
}

module.exports = Routing;

Routing.prototype.processRequest = function(request, response)
{
	logger.debugRequest(request, response);
	var route = this.router.process(request, response);
	if (!route)
	{
		response.writeHead(404, {
			"Content-Type": "text/plain",
			"Access-Control-Allow-Origin": "*"
		});
		response.end();
	}
};

Routing.processBody = function(request, response, callback)
{
	var queryData = "";
	request.on("data", function onProcessBodyData(data) {
		queryData += data;
		if (queryData.length > 1000000)
		{
			queryData = "";
			response.writeHead(413, {
				"Content-Type": "text/plain",
				"Access-Control-Allow-Origin": "*"
			});
			response.end();
			request.connection.destroy();
		}
	});

	request.on("end", function onEndBodyData() {
		request.body = queryData;
		callback(request, response);
	});
};
