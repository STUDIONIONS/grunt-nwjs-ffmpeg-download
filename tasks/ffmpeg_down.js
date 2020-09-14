module.exports = function(grunt){
	grunt.registerMultiTask('ffmpeg_down', 'Download ffmpeg.dll in nwjs', function(){
		var path = require('path'),
			fs = require('fs'),
			temp = require('temp'),
			request = require('request'),
			progress = require('progress'),
			https = require('https'),
			http = require('http');
			done = this.async(),
			options = this.options(),
			platforms = {},
			transform = [],
			error = false,
			bar = null,
			filesArr;
		if(!options.platforms){
			options.platforms = ["win32", "win64", "linux32", "linux64", "osx"];
		}
		platforms = options.platforms;
		transform = options.platforms.map(function(val){
			switch(val){
				case "win32":
					platforms.win32 = {};
					val = "-win-ia32.zip";
					platforms.win32.name = val;
					break;
				case "win64":
					platforms.win64 = {};
					val = "-win-x64.zip";
					platforms.win64.name = val;
					break;
				case "linux32":
					platforms.linux32 = {};
					val = "-linux-ia32.zip";
					platforms.linux32.name = val;
					break;
				case "linux64":
					platforms.linux64 = {};
					val = "-linux-x64.zip";
					platforms.linux64.name = val;
					break;
				case "osx":
					platforms.osx = {};
					val = "-osx-x64.zip";
					platforms.osx.name = val;
					break;
				default:
					grunt.fail.fatal("Платформа " + val + " не поддерживается!");
					break;
			}
			return val;
		});
		function downloadJSON(){
			return new Promise(function(resolve, reject){
				var rq = request("https://api.github.com/repos/iteufel/nwjs-ffmpeg-prebuilt/releases/latest", {
					headers: {
						"Accept": "application/vnd.github.v3+json",
						"User-Agent": "Awesome-Octocat-App"
					}
				}),
					len;
				rq.proxy = true;
				rq.on('error', function(err) {
					if(bar){
						bar.terminate();
					}
					bar = null;
					reject(err);
				});
				rq.on('response', function (res) {
					len = parseInt(res.headers['content-length'], 10);
					if (res.statusCode !== 200) {
						reject('Recieved status code ' + res.statusCode);
					} else if (len) {
						if (!bar) {
							bar = new progress('  downloading [:bar] :percent :etas', {
								complete: '=',
								incomplete: '-',
								width: 20,
								total: len
							});
						} else {
							bar.total += len;
						}
					}
				});
				rq.on('data', function(chunk) {
					if(len && bar)
						bar.tick(chunk.length);
				});
				stream = temp.createWriteStream();
				stream.on('close', function() {
					var latest = grunt.file.readJSON(stream.path),
						ff = [];
					transform = transform.map(function(val){
						let n = latest.tag_name + val;
						latest.assets.map(function(value){
							let name = value.name;
							if(n == name){
								ff.push(value.browser_download_url);
							}
						})
						return n;
					});
					console.log(ff);
					resolve();
				});
				rq.pipe(stream);
			});
		}
		downloadJSON().then(function(){
			done()
		}).catch(function(e){
			console.log(e);
			done();
		})
	})
}