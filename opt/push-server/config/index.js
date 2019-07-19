var path = require("path");
var argv = require("minimist")(process.argv.slice(2));

if (argv.config && argv.config.length > 1)
{
	if (!argv.config.match(/\.json/))
	{
		console.log("Error: config file must have .json extension.");
		process.exit();
	}

	module.exports = require(path.resolve(argv.config));
}
else
{
	module.exports = require("./config.json");
}

if (!module.exports.processUniqueId)
{
	module.exports.processUniqueId = require("os").hostname() + "-" + process.pid;
}

module.exports.clusterMode = module.exports.clusterMode === true ||  module.exports.publishMode === true || require("cluster").isWorker;