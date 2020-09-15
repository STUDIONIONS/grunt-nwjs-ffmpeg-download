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
			
		const cliProgress = require('cli-progress'),
			formatTime = function(value){

				// leading zero padding
				function autopadding(v){
					return ("0" + v).slice(-2);
				}
				var s = autopadding(Math.round(value % 60));
				var m = autopadding(Math.round((value / 60) % 60));
				var h  = autopadding(Math.round((value / 360) % 24));
				return h + ":" + m + ":" + s
			},
			autopaddingVal = function (value, length, opt){
				return (opt.autopaddingChar + value).slice(-length);
			},
			formatBytes = function(bytes, decimals = 2) {
				if (bytes === 0) return '0 Bt';
				const k = 1024;
				const dm = decimals < 0 ? 0 : decimals;
				const sizes = ['Bt', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
				const i = Math.floor(Math.log(bytes) / Math.log(k));
				return parseFloat(bytes / Math.pow(k, i)).toFixed(dm) + ' ' + sizes[i];
			},
			formatBar = function(optionsBar, paramsBar, payloadBar){
				function autopadding(value, length){
					return (optionsBar.autopaddingChar + value).slice(-length);
				}
				const completeSize = Math.round(paramsBar.progress * optionsBar.barsize);
				const incompleteSize = optionsBar.barsize - completeSize;
				const bar = optionsBar.barCompleteString.substr(0, completeSize) +
						optionsBar.barGlue +
						optionsBar.barIncompleteString.substr(0, incompleteSize);
				const percentage =  Math.floor(paramsBar.progress * 100) + '';
				const formatValue = formatBytes(paramsBar.value);
				const formatTotal = formatBytes(paramsBar.total);
				const total = formatTotal.length;// params
				const stopTime = paramsBar.stopTime || Date.now();
				const elapsedTime = formatTime(Math.round((stopTime - paramsBar.startTime)/1000));
				
				var barStr = _colors.white('|') + _colors.cyan(bar + ' ' + autopadding(percentage, 3) + '%') + _colors.white('|') +  _colors.bgCyan(_colors.white(" " + autopaddingVal(formatValue, total, optionsBar) + '/' + formatTotal + ' ')) + _colors.white('|') + "  " + elapsedTime;
				return barStr;
				//+ _colors.yellow(' {percentage}% ') +  _colors.blue('{value}/{total} bytes'),
			};
		
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
						autopadding: true,
						barsize: 20
					},{
						format: formatBar,
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
					grunt.log.writeln("Unzip: " + obj.name + " to " + dest);
					new DecompressZip(zipFile).on('error', function(err){
						reject(err);
					}).on('extract', function(log) {
						files.forEach(function(file) {
							var pth = path.join(dest, file.path);
							fs.chmodSync(pth, file.mode);
						});
						try{fs.unlinkSync(zipFile);}catch(e){}
						resolve();
					}).on('progress', function(index, length){
						//console.log(index, length);
					}).extract({
						path: dest,
						filter: function(entry) {
							var pth = path.join(dest, entry.path),
								mode = entry.mode.toString(8);
							grunt.log.writeln("Extract: " + pth);
							grunt.log.writeln("Change mode file: " + entry.path + " -> " + mode);
							files.push({
								path: entry.path,
								mode: mode
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