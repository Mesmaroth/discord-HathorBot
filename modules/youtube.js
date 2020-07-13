const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const yts = require('yt-search')

module.exports.search = function(message) {
	return new Promise((resolve, reject) => {
		yts(message, (error, request) => {
			if (error) reject(error);			
			// console.log(typeof request)
			if(request != null) {
				var song = [];
				song.push({
					title: request.videos[0].title,
					id: request.videos[0].videoId,
					url: request.videos[0].url
				})
				resolve(song)
			} else {
				reject(new Error('No Results found'))
			}
		});
	});
}

var ytdl_options = {
	quality: 'highestaudio',
	filter: 'audioonly'
}

module.exports.getInfo = async function(opts){
	let results = await ytdl.getInfo(opts.url, ytdl_options);
	if(results != null) {
		var filePath;
		if("local" in opts){
			filePath = path.join(opts.local, results.videoDetails.title+'.mp3');
		} else
			filePath = path.join(opts.temp, results.videoDetails.videoId+'.mp3');
		return {
			path: filePath,
			url: opts.url,
			id: results.videoDetails.videoId,
			title: results.videoDetails.title,
			length: results.videoDetails.lengthSeconds
		}
	}
}

module.exports.getStream = function(url,callback){
	callback(ytdl(url, ytdl_options));
}

module.exports.getFile = function(opts){
	return new Promise((resolve, reject) => {
		try{
			ytdl(opts.url, ytdl_options).pipe(fs.createWriteStream(opts.path))
			setTimeout(resolve, 8000)
		}
		catch(error){
			if(error) reject(error)
		}
	});
}