const ytdl = require('ytdl-core');
const fs = require('fs');


var options = {
	quality: 'highest',
	filter: 'audioonly'
}

module.exports.getInfo = function(url, callback){
	ytdl.getInfo(url, options, (error, rawData) =>{
		if(error) return callback(error);
		callback(null, rawData, rawData.video_id, rawData.title, rawData.length_seconds);
	});
}

	
module.exports.getStream = function(url,callback){
	callback(ytdl(url, options));
}

module.exports.getFile = function(url, path, callback){
	if(fs.existsSync(path)){
		console.log("File exist, not downloading\n");
		callback();
	}else{
		ytdl(url, options).pipe(fs.createWriteStream(path))
			.on('finish', ()=>{
				callback();
			});
	}	
}