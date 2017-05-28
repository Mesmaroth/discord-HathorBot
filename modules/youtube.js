const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const search = require('youtube-search')
const youtubeAPI = require(path.join(path.resolve(__dirname, '..'), 'config/botLogin')).youtubeAPI;

module.exports.search = function(message, callback) {
	var opts = {
	  maxResults: 5,
	  key: youtubeAPI
	};
	 
	search(message, opts, function(error, results) {
	 	if(error) callback(error);
	 		 	
	 	if(results){
	 		// console.log(results);
	 		var searchResults = [];
	 		for(var i = 0 ; i < results.length; i++){
	 			if(i === 5) break;
	 			searchResults.push({
	 				title: results[i].title,
	 				id: results[i].id,
	 				url: results[i].link
	 			});	
	 		}	 		
			callback(null, searchResults);
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