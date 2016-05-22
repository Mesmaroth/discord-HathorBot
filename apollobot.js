var DiscordClient = require('discord.io');
var uptimer = require('uptimer');
var botLogin = require('./botLogin.json');
var fs = require('fs');
var ytdl = require('ytdl-core');
var bot = new DiscordClient({token: botLogin.token, autorun: true})
var reboot = false;
var queue = [];
var playing = false;
var streamer = {};
var stayOnQueue = false;
var stoppedAudio = false;
var botVersion = "Apbot"
try{botVersion = "Apbot "+ require("./package.json").version}
catch(error){
	if(error) return error
};


function botUptime(){
	var upSeconds = Math.floor( uptimer.getAppUptime());
	var upMinutes = 0;
	var upHours = 0;

	if(upSeconds > 60){
		upMinutes = Math.floor(upSeconds / 60);
		upSeconds = Math.floor(upSeconds % 60);
	}

	if(upMinutes > 60){
		upHours = Math.floor(upMinutes / 60);
		upMinutes = Math.floor(upMinutes % 60);
	}

	return "**Uptime:** *" + upHours + " hour(s) : " + upMinutes + " minute(s) : " + upSeconds + " second(s)*"; 
}

function setGame(game) {
	bot.setPresence({game: game});
}

function getTitleVideoID(url, callback){
	ytdl.getInfo(url, function (error, data) {
		if(error) return console.error(error);
		video_id = data.video_id;
		title = data.title;
		for(var i = 0; i < queue.length; i++){
			if(queue[i].video_id === video_id){
				video_id = Math.floor(Math.random()*1000)+video_id;
			}
		}
		callback(title, video_id);
	});	
}

function addSong(url, title, video_id, user, callback){
	ytdl(url).pipe(fs.createWriteStream('./tempFiles/'+video_id+'.mp3'));
	queue.push({
		title: title,
		video_id: video_id,
		url: url,
		user: user,
		file: './tempFiles/'+video_id+'.mp3'
	});

	setTimeout(callback, 2500);	
}

function isInVC(channelID){
	var serverID = bot.serverFromChannel(channelID);
	if(bot.servers[serverID].members[bot.id].hasOwnProperty('voice_channel_id')){
		if(bot.servers[serverID].members[bot.id].voice_channel_id !== null) return true;
	}

	return false;
}

function removeSong(song){
	if(typeof song !== 'object') return;

	var isInQueue = false;
	var songIndex = 0;
	for(var i = 0; i < queue.length; i++){
		if(queue[i] === song){
			isInQueue = true;
			songIndex = i;
			break;
		}
	}

	if(isInQueue){
		var filePath = song.file;
		var fileName = song.video_id+".mp3";
		var tempDir = fs.readdirSync('./tempFiles/');
		var fileExist = false;

		for(var i = 0; i < tempDir.length; i++){
			if(tempDir[i] === fileName){
				fileExist = true;
				break;
			}
		}

		if(fileExist){
			fs.unlinkSync(filePath);
			queue.splice(songIndex, 1);
		}
		else{
			queue.splice(songIndex, 1);
		}

	}
	return;
}

function playSong(){
	var song = queue[0];
	streamer.playAudioFile(song.file);	
	playing = true;
	setGame(song.title);

	streamer.once('fileEnd', function() {
		// Delete File and Remove song from queue.			
		if(!stayOnQueue) removeSong(song);
		stayOnQueue = false;
		
		if(queue.length === 0) {
			playing = false;			
			setGame(null);
			console.log("End of queued songs");
			return;
		}
		if(!stoppedAudio) setTimeout(playSong, 500);
		stoppedAudio = false;
	});
}

function getVoiceID(channelID){
	var serverID = bot.serverFromChannel(channelID);
	var voiceID = "";
	for(var i in bot.servers[serverID].channels){					// Get the first voice ID in the server
		if(bot.servers[serverID].channels[i].type === "voice"){
			voiceID = bot.servers[serverID].channels[i].id;
			break;
		}
	}	
	return voiceID;
}


bot.on('disconnected', function() {
	if(reboot){
		reboot = false;
		console.log("Connecting...");
		setTimeout(bot.connect, 3000);
	}
	process.exit();
});

bot.on('ready', function (rawEvent) {
	console.log("\nDiscord.io - Version: " + bot.internals.version);
    console.log("Username: "+bot.username + " - (" + bot.id + ")");
    console.log('\n');
    setGame(botVersion);

    bot.joinVoiceChannel("102910652766519296", function(){
		bot.getAudioContext({channel: "102910652766519296", stero: true}, function(stream){
			streamer = stream;
		});	
	});

});

bot.on('message', function (user, userID, channelID, message, rawEvent){
	if(channelID in bot.directMessages){
		bot.sendMessage({
			to: userID,
			message: "DMs have been disabled for this bot."
		});
		setTimeout(bot.deleteChannel, 300, channelID);
		return;
	}

	if(message === ".writeout"){
		fs.writeFileSync(bot.username+".json", JSON.stringify(bot, null, '\t'), 'utf8');
	}

	if(message.toLowerCase() === ".about"){
		bot.sendMessage({
			to: channelID,
			message: "\n**Username:** "+bot.username+"\n**Author:** Mesmaroth\n**Written in:** Node.js\n**Version:**" +botVersion+ "\n**Library:** Discord.io\n**Library Version:** "+bot.internals.version+
			"\n**Avatar:** https://goo.gl/LN6BvU"+"\n\n**Why:** This bot was created to replace the current shit musicbot that I got sick and tired of, a shitty bot written by shitty people."+
			" So I've decided to write this bot from the ground up."

		});
	}

	if(message.toLowerCase() === ".music" || message === ".help"){
		bot.sendMessage({
			to: channelID,
			message: '\n**Music**\n•`.play [URL]`: Adds and plays the music from the queue\n•`.stop`: Stop song\n•`.skip`: Skip song (Still Needs Work)\n•`.replay`: Replay song\n•`.readd`: Re-Add the currently playing song to queue\n•`.about`: About this bot\n'+
			'•`.queue`: View the list of songs in queue\n•`.reboot`: Reboot the bot if something is wrong\n•`.uptime`: Up time of bot'
		});
	}

	if(message.toLowerCase() === ".uptime"){
		bot.sendMessage({
			to: channelID,
			message: botUptime()
		});
	}

	if(message.toLowerCase() === ".disconnect"){
		console.log("[Disconnecting]");
		var voiceID = getVoiceID(channelID);
		if(playing){
			streamer.stopAudioFile();			
		}		
		setTimeout(function(){
			var folder = fs.readdirSync('./tempFiles');
			for(var i = 0; i < folder.length; i++){
				fs.unlinkSync('./tempFiles/'+folder[i]);
			}
			bot.leaveVoiceChannel(voiceID);
			bot.disconnect();
		},400);		
	}

	if(message.toLowerCase() === ".reboot"){
		console.log("[Rebooting]")
		var voiceID = getVoiceID(channelID);
		reboot = true;
		bot.sendMessage({
			to: channelID,
			message: "Rebooting..."
		})
		bot.leaveVoiceChannel(voiceID);
		bot.disconnect();		
	}

	if(message.toLowerCase() === ".join"){
		if(!(isInVC(channelID))){
			var voiceID = getVoiceID("102910652766519296");
		    bot.joinVoiceChannel(voiceID, function(){
				bot.getAudioContext({channel: voiceID, stero: true}, function(stream){
					streamer = stream;
				});	
			});
		}
		else{
			bot.sendMessage({
				to: channelID,
				message: "*Already joined voice channel.*"
			});
		}		
	}

		

	if(message.toLowerCase() === ".stop"){
		if(isInVC(channelID)){
			if(playing){				
				playing = false;
				setGame(null);
				streamer.stopAudioFile();
				stayOnQueue = true;
				stoppedAudio = true;				
			}
			else{
				if(queue.length < 1){
					bot.sendMessage({
						to: channelID,
						message: "Nothing to stop."
					});
				}
			}
		}
	}

	
	if(message.toLowerCase() === ".replay"){
		if(isInVC(channelID)){
			if(playing){
				streamer.stopAudioFile();
				stayOnQueue = true;
				setTimeout(streamer.playAudioFile, 300, queue[0].file);
				bot.sendMessage({
					to: channelID,
					message: "*Replaying* " + queue[0].title
				});
			}
		}
	}

	if(message.toLowerCase() === ".skip"){
		if(isInVC){
			if(playing){
				var song = queue[0];
				streamer.stopAudioFile();
				playing = false;
				setGame(null);
				setTimeout(function (){
					fs.unlinkSync(song.file);
				}, 200)
				queue.splice(0, 1);
				if(queue.length > 0){
					setTimeout(function(){
						song = queue[0];
						playing = true;
						setGame(song.title);
						streamer.playAudioFile(song);
						bot.sendMessage({
							to: channelID,
							message: 'Playing *"' + song.title + '"*'
						});
					},1000);
				}
				else{
					bot.sendMessage({
						to: channelID,
						message: "Queue is now empty."
					});
				}
			}
		}
	}

	if(message.toLowerCase() === ".readd"){
		if(isInVC(channelID)){
			if(playing){
				var newVideoID = Math.floor(Math.random()*1000)+queue[0].video_id;
				var newFilePath =  './tempFiles/'+newVideoID+".mp3";
				var songFBuffer = fs.createReadStream(queue[0].file);
				songFBuffer.pipe(fs.createWriteStream(newFilePath));
				queue.push({
					title: queue[0].title,
					video_id: newVideoID,
					url: queue[0].url,
					user: queue[0].user,
					file: newFilePath
				});

				bot.sendMessage({
					to: channelID,
					message: '*"'+queue[0].title+'"* has been re-added back to queue.'
				});
			}
			else{
				if(queue.length < 1){
					bot.sendMessage({
						to: channelID,
						message: "No song to re-add."
					});
				}
			}
		}
	}

	if(message.toLowerCase() === ".queue"){
		var songList = [];
		for(var i = 0; i < queue.length; i++){
			songList.push(queue[i].title);
		}

		for(var i = 0; i < songList.length; i++){
			if(i === 0) songList[i] = '**Music**\n**Currently Playing**: *"' + songList[i]+ '"*\n';
			else songList[i] = i + ". *"+songList[i]+"*";
		}

		if(songList.length === 1){
			bot.sendMessage({
				to: channelID,
				message: songList[0] + "\n**Queued Songs**\nNo songs are queued."
			})
		}
		else if(songList.length >= 2) {
			var queuedSongs = [];
			for(var i = 1; i<songList.length; i++){
				queuedSongs.push(songList[i]);
			}
			bot.sendMessage({
				to: channelID,
				message: songList[0]+"\n**Queued Songs**\n"+queuedSongs.join('\n')
			});
		}
		else{
			bot.sendMessage({
				to: channelID,
				message: "No songs are queued."
			});
		}
	}

	if(message.toLowerCase().search(".play") === 0){
		if(message.search(' ') !== -1){
			var message = message.split(' ');
			var url = message[1];
			try {
				getTitleVideoID(url, function (title, video_id){
					bot.sendMessage({
						to: channelID,
						message: '*"'+title+'"*  has been added to queue.'
					});
					addSong(url, title, video_id, user, function(){
						if(playing === false){
							var voiceID = getVoiceID(channelID);
							setTimeout(playSong, 250);
						}						
					});

				});							
			}
			catch(error){
				bot.sendMessage({
					to: channelID,
					message: "```javascript\n" + error + "\n```"
				});
			};
			return;			
		}		

		if(isInVC(channelID)){
			if(playing === false){
				if(queue.length > 0){

					bot.sendMessage({
						to: channelID,
						message: "Now playing *"+queue[0].title+"*"
					});
					var voiceID = getVoiceID(channelID);
					playSong();
				}
				else{
					bot.sendMessage({
						to: channelID,
						message: "No songs curretly in queue."
					});
				}			
			}
		} 				
	}

});
