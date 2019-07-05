module.exports = function(grunt) {

  grunt.initConfig({
		compress: {
		  main: {
		    options: {
		      archive: 'foxyproxy.zip'
		    },
		    files: [
		      {src: ['**', '!node_modules/**', '!.DS_Store', '!archive/**'],
					cwd: 'src',
					expand: true}
		    ]
		  }
		}
  });

	grunt.loadNpmTasks('grunt-contrib-compress');
	grunt.registerTask('default', ['compress']);
};