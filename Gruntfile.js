module.exports = function(grunt) {

  grunt.initConfig({
		compress: {
		  main: {
		    options: {
		      archive: 'target.zip'
		    },
		    files: [
		      {src: ['*/**', '!node_modules/**', '!.DS_Store', '!archive/**'], dest: '/', filter: 'isFile'}
		    ]
		  }
		}
  });

	grunt.loadNpmTasks('grunt-contrib-compress');
	grunt.registerTask('default', ['compress']);
};