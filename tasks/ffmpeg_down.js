module.exports = function(grunt){
	grunt.registerMultiTask('ffmpeg_down', 'Download ffmpeg.dll in nwjs', function(){
		var path = require('path'),
			fs = require('fs'),
			temp = require('temp'),
			request = require('request'),
			_colors = require('colors'),
			DecompressZip = require('decompress-zip'),
			del = require('del'),
			done = this.async(),
			options = this.options(),
			platforms = [],
			transform = [],
			error = false,
			filesArr = [];
			
		const cliProgress = require('cli-progress');
		
		temp.track();
		if(!options.platforms){
			options.platforms = ["win32", "win64", "linux32", "linux64", "osx"];
		}
		transform = options.platforms.map(function(val){
			switch(val){
				case "win32":
					platforms["win32"] = "-win-ia32.zip";
					break;
				case "win64":
					platforms["win64"] = "-win-x64.zip";
					break;
				case "linux32":
					platforms["linux32"] = "-linux-ia32.zip";
					break;
				case "linux64":
					platforms["linux64"] = "-linux-x64.zip";
					break;
				case "osx":
					platforms["osx"] = "-osx-x64.zip";
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
					reject(err);
				});
				rq.on('response', function (res) {
					len = parseInt(res.headers['content-length'], 10);
					if (res.statusCode !== 200) {
						reject('Recieved status code ' + res.statusCode);
					}
				});
				rq.on('data', function(chunk) {});
				var stream = temp.createWriteStream();
				stream.on('close', function() {
					var latest = JSON.parse(fs.readFileSync(stream.path, 'utf-8')),
						tmpArr = [];
					for (var key in platforms) {
						let name = latest.tag_name + platforms[key],
							objTmp = latest.assets.filter(function(obj){
								return (obj.name == name);
							});
						if(objTmp.length){
							tmpArr.push({
								url: objTmp[0].browser_download_url,
								name: objTmp[0].name,
								platform: key
							})
						}
					}
					fs.unlinkSync(stream.path);
					resolve(tmpArr);
				});
				rq.pipe(stream);
			});
		}
		function getZipFIle(obj){
			return new Promise(function(resolve, reject){
				grunt.log.writeln('\nDownload: ' + obj.name);
				var rq = request(obj.url, {
						headers: {
							"User-Agent": "Awesome-Octocat-App"
						}
					}),
					len = 0,
					tick = 0,
					bar = new cliProgress.SingleBar({
						stopOnComplete: true,
						hideCursor: true,
						barsize: 50
					},{
						format: _colors.white('|') + _colors.cyan('{bar}') + _colors.white('|  {percentage}% {value}/{total} bytes'),
						barCompleteChar: '\u2588',
						barIncompleteChar: '\u2592'
					});
				rq.on('error', function(err) {
					reject(err);
				});
				rq.on('response', function (res) {
					if (res.statusCode !== 200) {
						reject('Recieved status code ' + res.statusCode);
					}
					len = parseInt(res.headers['content-length'], 10);
					bar.start(len, 0);
				});
				rq.on('data', function(chunk) {
					tick += chunk.length;
					bar.update(tick);
				});
				var stream = temp.createWriteStream();
				stream.on('close', function() {
					bar.update(len);
					var files = [];
					let dest = path.normalize(path.join(options.dest, obj.platform)),
						zipFile = stream.path;
					new DecompressZip(zipFile).on('error', function(err){
						reject(err);
					}).on('extract', function(log) {
						files.forEach(function(file) {
							fs.chmodSync(path.join(dest, file.path), file.mode);
						});
						grunt.log.writeln("Unzip: " + obj.name + " to " + dest + "\n");
						try{fs.unlinkSync(zipFile);}catch(e){}
						resolve();
					}).extract({
						path: dest,
						filter: function(entry) {
							files.push({
								path: entry.path,
								mode: entry.mode.toString(8)
							});
							return true;
						}
					});
				});
				rq.pipe(stream);
			})
		}
		async function getAmazons(arr) {
			var arrs = [];
			(async () => {
				try {
					let dir = path.normalize(options.dest);
					await del(dir);
				} catch (err) {
					console.error(`Error while deleting ${dir}.`);
				}
			})();
			for (let i = 0; i < arr.length; i++) {
				let res = await getZipFIle(arr[i]);
				arrs.push(res);
			}
			return arrs;
		}
		
		downloadJSON()
		.then(getAmazons)
		.then(done).catch(function(e){
			grunt.log.error(e);
			done();
		})
	})
}