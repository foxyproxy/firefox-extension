module.exports = function(grunt) {

  grunt.initConfig({
		compress: {
		  main: {
		    options: {
		      archive: 'archive.zip'
		    },
		    files: [
		      {src: ['*/**', '!node_modules/**'], dest: '/', filter: 'isFile'}
		    ]
		  }
		}
  });

	grunt.loadNpmTasks('grunt-contrib-compress');
	grunt.registerTask('default', ['compress']);
};