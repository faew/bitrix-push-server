var http = require("http");
var https = require("https");
var WebSocket = require("ws");
var fs = require("fs");
var util = require("util");
var path = require("path");

var Application = require("./lib/application");
var Routing = require("./lib/routing");
var config = require("./config");
var logger = require("./lib/debug");

var app = new Application(config);

config.servers.forEach(function(serverConfig) {

	var routing = new Routing(app, serverConfig);
	var server;
	if (serverConfig.ssl)
	{
		server = https.createServer({
			key: fs.readFileSync(path.resolve(serverConfig.ssl.key)),
			cert: fs.readFileSync(path.resolve(serverConfig.ssl.cert)),
			ciphers: serverConfig.ssl.ciphers,
			dhparam: serverConfig.ssl.dhparam,
			honorCipherOrder: serverConfig.ssl.honorCipherOrder
		});
		
		server.on("secureConnection", logger.initTLSSocket);
	}
	else
	{
		server = http.createServer();
	}

	server.listen(serverConfig.port, serverConfig.hostname, serverConfig.backlog);
	server.on("connection", logger.initSocket);
	server.on("request", routing.processRequest.bind(routing));
	server.on("listening", function onListening() {
		logger.info("%s listening at %s://%s:%s PID: %s",
			serverConfig.name,
			serverConfig.ssl ? "https" : "http",
			server.address().address,
			server.address().port,
			process.pid
		);
	});

	if (serverConfig.routes && serverConfig.routes.sub)
	{
		var wsServer = WebSocket.createServer({
				server: server,
				clientTracking: false,
				perMessageDeflate: false,
				disableHixie: true,
				path: serverConfig.routes.sub
			},
			function onWsConnection(socket) {
				logger.debugWebsocket(socket.upgradeReq, socket);
				app.subscribe(socket.upgradeReq, socket);
			}
		);

		//use shouldHandle function in ws > 2.0.0
		wsServer.handleUpgrade = function() {
			if (!app.handleUpgrade.apply(app, arguments))
			{
				Object.getPrototypeOf(this).handleUpgrade.apply(this, arguments);
			}
		};

	}

});

//Debug
process.stdin.on("data", function (data) {
	data = (data + "").trim().toLowerCase();
	if (data === "cc")
	{
		console.log(util.inspect(app.adapter.connections, { colors: true, depth: 2 }));
	}
	else if (data === "heap")
	{
		var heapdump = require("heapdump");
		var file = path.resolve("logs/" + Date.now() + ".heapsnapshot");
		heapdump.writeSnapshot(file, function(err) {
			if (err)
			{
				console.error(err);
			}
			else
			{
				console.error("Wrote snapshot: " + file);
			}
		});
	}
	else if (data === "memory")
	{
		var memory = process.memoryUsage();
		for (var key in memory)
		{
			console.log(key, (memory[key] / 1024 / 1024) + "Mb");
		}
	}
	else if (data === "gc" && typeof(gc) !== "undefined")
	{
		gc(); //requires --expose-gc parameter
	}
	else if (data === "cnt")
	{
		console.log("pub", global.pushCnt, "onmessage", global.onmessageCnt);
	}

	console.log("PID", process.pid);

});