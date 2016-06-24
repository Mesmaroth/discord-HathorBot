var DiscordClient = require('discord.io');
var uptimer = require('uptimer');
var fs = require('fs');
var ytdl = require('ytdl-core');
var botLogin = require('./botLogin.json');
var bot = new DiscordClient({token: botLogin.token, autorun: true});
var reboot = false;
var queue = [];
var playing = false;
var streamer = {};
var stayOnQueue = false;
var stoppedAudio = false;
var playingNotify = false;
try{
	var botVersion = require("./package.json").version
}
catch(error){
	var botVersion = "#?"; 
	if(error) console.error(error);
}

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
	try{
		ytdl.getInfo(url, function (error, data) {
			if(error) return callback(error);
			video_id = data.video_id;
			title = data.title;
			for(var i = 0; i < queue.length; i++){
				if(queue[i].video_id === video_id){
					video_id = Math.floor(Math.random()*1000)+video_id;
				}
			}
			callback(null, title, video_id, Number(data.length_seconds));
		});
	}
	catch(error) {return callback(error)};
}

function addSong(url, title, video_id, user, callback){
	// Create a folder if it hasn't been created yet
	try{
		fs.accessSync('./tempFiles', fs.F_OK)
	}
	catch(error){
		if(error){
			fs.mkdirSync('./tempFiles');
		}
	}

	ytdl(url).pipe(fs.createWriteStream('./tempFiles/'+video_id+'.mp3'));
	queue.push({
		title: title,
		video_id: video_id,
		url: url,
		user: user,
		file: './tempFiles/' + video_id+  '.mp3'
	});
	callback(null);
}

function isInVC(channelID){
	var serverID = bot.serverFromChannel(channelID);
	for(var channel in bot.servers[serverID].channels){
		if(bot.servers[serverID].channels[channel].type === "voice"){
			if(bot.id in bot.servers[serverID].channels[channel].members) return true;
			break;
		}
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
			fs.unlink(filePath, function(error){
				if(error) console.error(error);	
			});
			queue.splice(songIndex, 1);
			
		} else{
			queue.splice(songIndex, 1);
		}

	}
	return;
}

function playSong(channelID){
	var song = queue[0];
	streamer.playAudioFile(song.file);	
	playing = true;
	setGame(song.title);
	if(playingNotify){
		bot.sendMessage({
			to: channelID,
			message: ":notes: **Now Playing:** *" + song.title + "*"
		});
	}

	streamer.once('fileEnd', function() {
		// Delete file and remove song from queue.
		if(!stayOnQueue) removeSong(song);
		stayOnQueue = false;
		
		if(queue.length === 0) {
			playing = false;			
			setGame(null);
			console.log("End of queued songs");
			return;
		}
		if(!stoppedAudio) setTimeout(playSong, 500, channelID);
		stoppedAudio = false;
	});
}

// Get the first voice ID in the server
function getVoiceID(channelID){
	var serverID = bot.serverFromChannel(channelID);
	for(var i in bot.servers[serverID].channels){					
		if(bot.servers[serverID].channels[i].type === "voice"){
			return bot.servers[serverID].channels[i].id;			
		}
	}
}

function joinVC () {
	for (var server in bot.servers){
		for(var channel in bot.servers[server].channels){
			if(bot.servers[server].channels[channel].type === "voice"){
				var channelID = bot.servers[server].channels[channel].id;
				bot.joinVoiceChannel(channelID, function(){
					bot.getAudioContext({channel: channelID, stero: true}, function(stream){
				 		streamer = stream;
				 	});	
				});
				return;
			}
		}
	}
}


bot.on('disconnected', function() {
	if(reboot){
		reboot = false;
		console.log("Connecting...");
		setTimeout(bot.connect, 3000);
		return;
	}
	process.exit();
});

bot.on('ready', function (rawEvent) {
	console.log("\nDiscord.io - Version: " + bot.internals.version);
    console.log("Username: "+bot.username + " - (" + bot.id + ")");
    console.log('\n');
    if(process.argv[2]) setGame(process.argv[2]+ " Apbot v"  + botVersion);
    else setGame("Apbot v" + botVersion);
    joinVC();
});

bot.on('message', function (user, userID, channelID, message, rawEvent){
	if(channelID in bot.directMessages){
		bot.sendMessage({
			to: userID,
			message: ":warning: DMs have been disabled for this bot."
		});
		setTimeout(bot.deleteChannel, 300, channelID);
		return;
	}

	if(message === ".writeout"){		
		fs.writeFile(bot.username+".json", JSON.stringify(bot, null, '\t'), 'utf8', function(error){
			if(error) return console.error(error);
			console.log("Logged bot properties.");
		});
	}

	if(message.toLowerCase() === ".about"){
		bot.sendMessage({
			to: channelID,
			message: "\n**Username:** "+bot.username+"\n**Author:** Mesmaroth\n**Written in:** Node.js\n**Version:** " +botVersion+ "\n**Library:** Discord.io\n**Library Version:** "+bot.internals.version+
			"\n**Avatar:** https://goo.gl/LN6BvU"+"\n\n**Why:** This bot was created to replace the current shit musicbot that I got sick and tired of, a shitty bot written by shitty people."+
			" So I've decided to write this bot from the ground up."

		});
	}

	if(message.toLowerCase() === ".music" || message.toLowerCase() === ".help"){
		bot.sendMessage({
			to: channelID,
			message: '\n**Music**\n•`.play [URL]`: Adds and plays the music from the queue\n•`.play`: If a song is in queue after it has been stopped before\n•`.stop`: Stop song\n•`.skip`: Skip the currently playing song\n•`.replay`: Replay song\n•`.readd`: Re-Add the currently playing song to queue\n•`.about`: About this bot\n'+
			'•`.queue`: View the list of songs in queue\n•`.reboot`: Reboot the bot if something is wrong\n•`.uptime`: How long this bot has been online for\n•`.notify`: Turns on a "*now playing*" notifcation'
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
		if(!isInVC(channelID)){
			var voiceID = getVoiceID(channelID);
			bot.joinVoiceChannel(voiceID, function(){
				bot.getAudioContext({channel: voiceID, stero: true}, function(stream){
				streamer = stream;
				});	
			});

		} else {
			bot.sendMessage({
				to: channelID,
				message: ":warning: Already in voice channel."
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
			} else{
				if(queue.length < 1){
					bot.sendMessage({
						to: channelID,
						message: ":warning: Nothing to stop."
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
					message: ":notes: **Replaying:** *" + queue[0].title + "*"
				});
			}
		}
	}

	if(message.toLowerCase() === ".skip"){
		if(isInVC(channelID)){
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
					},1000);
				} else{
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
					message: ":radio_button: **Re-Added to Queue:** *" + queue[0].title + "*"
				});
			} else{
				if(queue.length < 1){
					bot.sendMessage({
						to: channelID,
						message: ":warning: No song to re-add."
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
			if(i === 0) songList[i] = ':bookmark_tabs: **Music**\n**Currently Playing**: *"' + songList[i]+ '"*\n';
			else songList[i] = i + ". *"+songList[i]+"*";
		}

		if(songList.length === 1){
			bot.sendMessage({
				to: channelID,
				message: songList[0] + "\n**Queued Songs**\nNo songs are queued."
			})
		} else if(songList.length >= 2) {
			var queuedSongs = [];
			for(var i = 1; i<songList.length; i++){
				queuedSongs.push(songList[i]);
			}
			bot.sendMessage({
				to: channelID,
				message: songList[0]+"\n**Queued Songs**\n"+queuedSongs.join('\n')
			});
		} else{
			bot.sendMessage({
				to: channelID,
				message: ":warning: No songs are queued."
			});
		}
	}

	if(message.toLowerCase() === ".notify"){
		if(playingNotify){
			playingNotify = false;
		} else {
			playingNotify = true;
		}

		bot.sendMessage({
			to: channelID,
			message: ":bell: Song notifications set to " + playingNotify
		});
	}

	if(message.toLowerCase().search(/[.]play/) === 0){
		if(isInVC(channelID)){
			if(message.search(' ') !== -1){
				var message = message.split(' ');
				var url = message[1];
				var voiceID = getVoiceID(channelID);
				
				// Request can only be made if the user is in the voice channel
				if( !(userID in bot.servers[bot.serverFromChannel(channelID)].channels[voiceID].members) ){
					bot.deleteMessage({
						channel: channelID,
						messageID: rawEvent.d.id
					});

					bot.sendMessage({
						to: channelID,
						message: ":warning: <@"+userID+"> you aren't in the voice channel."
					});
					return;
				}
				
				getTitleVideoID(url, function (error, title, video_id, length_seconds){
					if(error) {
						bot.sendMessage({
							to: channelID,
							message: ":warning: **Error:**```js\n" + error + "\n```" 
						});
						return;
					}

					var seconds = length_seconds;
					var hours = Math.trunc((seconds/60)/60);

					// Video can only be 3 hours long.
					if(hours < 3){
						bot.sendMessage({
							to: channelID,
							message: ':radio_button: **Added to Queue:** *' + title + '*'
						});
						addSong(url, title, video_id, user, () => {
							if(playing === false){
								setTimeout(playSong, 1300, channelID);							
							}
						});

					} else {
						bot.deleteMessage({
							channel: channelID,
							messageID: rawEvent.d.id
						});

						bot.sendMessage({
							to: channelID,
							message: ':warning: **Error:** *'+title+'* is too long.'
						});
					}						
				});			
				return;
			}

			if(playing === false){
				if(queue.length > 0){
					playSong(channelID);
				} else{
					bot.sendMessage({
						to: channelID,
						message: ":warning: No songs curretly in queue."
					});
				}			
			}
		}		 				
	}
});
