const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const search = require('youtube-search')
const youtubeAPI = require(path.join(path.resolve(__dirname, '..'), 'config/botLogin')).youtubeAPI;

// const readline = require('readline');

module.exports.search = function(message, callback) {
	var opts = {
	  maxResults: 5,
	  key: youtubeAPI
	};

	search(message, opts, function(error, results) {
	 	if(error) callback(error);

	 	if(results){
	 		var searchResults = [];
	 		for(var i = 0 ; i < results.length; i++){
	 			if(i === 5) break;
	 			if(results[i].kind === 'youtube#video'){
	 				searchResults.push({
		 				title: results[i].title,
		 				id: results[i].id,
		 				url: results[i].link
		 			});
	 			}
	 		}
			callback(null, searchResults);
	 	}
	});
}

var ytdl_options = {
	quality: 'lowest',
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

module.exports.getFile = function(url, filePath, callback){
	if(fs.existsSync(filePath)){
		callback();
	}else{
		var audioOut = fs.createWriteStream(filePath);
		var stream = ytdl(url, ytdl_options);

		// var starttime;

		stream.pipe(audioOut);

		// stream.once('response', (res) =>{
			// starttime = Date.now();
		// });

		// stream.on('progress', (chunkLength, downloaded, total) => {
			// Progress output
			// const floatDownloaded = downloaded / total;
		  // const downloadedMinutes = (Date.now() - starttime) / 1000 / 60;
			// readline.cursorTo(process.stdout, 0);
		  // process.stdout.write(`${(floatDownloaded * 100).toFixed(2)}% downloaded`);
		  // process.stdout.write(`(${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(total / 1024 / 1024).toFixed(2)}MB)\n`);
		  // process.stdout.write(`running for: ${downloadedMinutes.toFixed(2)}minutes`);
		  // process.stdout.write(`, estimated time left: ${(downloadedMinutes / floatDownloaded - downloadedMinutes).toFixed(2)}minutes `);
			// readline.moveCursor(process.stdout, 0, -1);
		// });

		stream.on('error', err => {
			if(err) return callback(err);
		});

		stream.on('finish', ()=>{
			callback();
		});
	}
}
