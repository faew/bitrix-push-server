var cluster = require("cluster");

cluster.setupMaster({
	exec: "server.js"
});

for (var i = 0; i < 4; i++)
{
	cluster.fork();
}
