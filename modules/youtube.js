const ytdl = require('ytdl-core');
const fs = require('fs');
const search = require('youtube-search')

module.exports.search = function(message, callback) {
	var opts = {
	  maxResults: 5,
	  key: 'AIzaSyC1fiH2ND47K3z4_sbYeogvPgM_gI2PaoU'
	};
	 
	search(message, opts, function(err, results) {
	 	if(err) callback(err);
		var firstResult = results[0];
		console.log(firstResult);
		callback(null, firstResult.id, firstResult.title, firstResult.link);
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