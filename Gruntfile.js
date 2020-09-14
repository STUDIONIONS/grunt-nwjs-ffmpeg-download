module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		ffmpeg_down: {
			start: {
				options: {
					platforms: ["win32", "win64"],
					dest: "src/ffmpeg"
				}
			}
		}
	});
	grunt.loadTasks("tasks");
	grunt.registerTask('default', ['ffmpeg_down']);
}