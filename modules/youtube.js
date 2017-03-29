const ytdl = require('ytdl-core');
const fs = require('fs');
const search = require('youtube-search')
const youtubeAPI = require('../config/botLogin').youtubeAPI;

module.exports.search = function(message, callback) {
	var opts = {
	  maxResults: 5,
	  key: youtubeAPI
	};
	 
	search(message, opts, function(err, results) {
	 	if(err) callback(err);
	 		 	
	 	if(results){
			var firstResult = results[0];
			callback(null, firstResult.id, firstResult.title, firstResult.link);
	 	}
	});
	
}

var ytdl_options = {
	quality: 'highest',
	filter: 'audioonly'
}

module.exports.getInfo = function(url, callback){
	ytdl.getInfo(url, ytdl_options, (error, rawData) =>{
		if(error) return callback(error);
		callback(null, rawData, rawData.video_id, rawData.title, rawData.length_seconds);
	});
}

	
module.exports.getStream = function(url,callback){
	callback(ytdl(url, ytdl_options));
}

module.exports.getFile = function(url, path, callback){
	if(fs.existsSync(path)){
		callback();
	}else{
		ytdl(url, ytdl_options).pipe(fs.createWriteStream(path))
			.on('finish', ()=>{
				callback();
			});
	}	
}