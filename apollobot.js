var DiscordClient = require('discord.io');
var child_proc = require('child_process');
var spawn = child_proc.spawn;
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
var ffmpeg = {};
var volume = 1;
var allowVol = true;

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
		ytdl.getInfo(url, (error, data) => {
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
		fs.accessSync('./tempFiles', fs.F_OK);
	}
	catch(error){
		if(error){
			fs.mkdirSync('./tempFiles');
		}
	}
	var options = {
		filter: 'audio',
		quality: 'highest'
	}
	ytdl(url).pipe(fs.createWriteStream('./tempFiles/' + video_id + '.mp3'), options);

	queue.push({
		title: title,
		video_id: video_id,
		url: url,
		user: user,
		file: './tempFiles/' + video_id + '.mp3'
	});
	callback();
}

function isInVC(channelID){
	var serverID = bot.serverFromChannel(channelID);
	for(var channel in bot.servers[serverID].channels){
		if(bot.servers[serverID].channels[channel].type === "voice"){
			if(bot.id in bot.servers[serverID].channels[channel].members) return true;			
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
			fs.unlink(filePath, (error) => {
				if(error) console.error(error);	
			});
			queue.splice(songIndex, 1);
			
		} else{
			queue.splice(songIndex, 1);
		}
	} else{ 
		console.log("Song is not in queue.");
	}
	return;
}

function playSong(channelID){
	var song = queue[0],
		players =['ffmpeg', 'avconv'], 
		player = choosePlayer(players);

	// Thanks to izy521 for this method
	function choosePlayer(players){
		if (!players[0]) return console.log("You need either need 'ffmpeg' or 'avconv' and they need to be added to PATH");
		var n = players.shift();
		var s = child_proc.spawnSync(n);
		if (s.error) return choosePlayer(players);
		console.log("Using " + n);
		return n;
	}
	if(!player) return;
	var options = [
		'-i', song.file,
		'-f', 's16le',		
		'-ar', '48000',
		'-ac', '2',
		'pipe:1'
	]

	if(player === 'ffmpeg') {
		options.splice(2, 0, '-af', 'volume=' + volume);
		allowVol = true;
	} else allowVol = false;

	ffmpeg = spawn(player , options, {stdio: ['pipe', 'pipe', 'ignore']});

	ffmpeg.stdout.once('readable', function() {
		streamer.send(ffmpeg.stdout);
		playing = true;
		setGame(song.title);
		if(playingNotify){
			bot.sendMessage({
				to: channelID,
				message: ":notes: **Now Playing:** *" + song.title + "*"
			});
		}
	});	
			
	ffmpeg.stdout.once('end', function() {
		playing = false;
		ffmpeg.kill();
		setGame(null);

		// Delete file and remove song from queue.
		if(!stayOnQueue) removeSong(song);		
		stayOnQueue = false;

		if(queue.length === 0) return;

		if(!stoppedAudio) setTimeout(playSong, 500, channelID);
		stoppedAudio = false;
	});
	return;
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

function getCurrentVC(channelID){
	if(isInVC(channelID)){
		for(var i in bot.channels){
			if(bot.channels[i].type === "voice"){
				if(bot.id in bot.channels[i].members){
					return bot.channels[i].id;
				}
			}
		}
	}
	return null;
}

function joinVC() {
	for (var server in bot.servers){
		for(var channel in bot.servers[server].channels){
			if(bot.servers[server].channels[channel].type === "voice"){
				var channelID = bot.servers[server].channels[channel].id;
				bot.joinVoiceChannel(channelID, () =>{
					bot.getAudioContext({channel: channelID, stero: true}, (stream) =>{
				 		streamer = stream;
				 	});	
				});
				return;
			}
		}
	}
}

bot.on('disconnected', () =>{
	if(reboot){
		reboot = false;
		console.log("Connecting...");
		setTimeout(bot.connect, 3000);
		return;
	}
	process.exit();
});

bot.on('ready', (rawEvent) => {
	console.log("\nDiscord.io - Version: " + bot.internals.version);
    console.log("Username: "+bot.username + " - (" + bot.id + ")");
    console.log('\n');
    if(process.argv[2]) setGame(process.argv[2]+ " Apbot v"  + botVersion);
    else setGame("ApBot v" + botVersion);
    joinVC();
});

bot.on('message', (user, userID, channelID, message, rawEvent) => {
	if(channelID in bot.directMessages){
		bot.sendMessage({
			to: userID,
			message: ":warning: DMs have been disabled for this bot."
		});
		setTimeout(bot.deleteChannel, 300, channelID);
		return;
	}

	if(message === ".writeout"){		
		fs.writeFile(bot.username+".json", JSON.stringify(bot, null, '\t'), 'utf8', (error) => {
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
		if(playing){
			ffmpeg.kill();		
		}
		
		setTimeout(() => {
			var folder = fs.readdirSync('./tempFiles');
			for(var i = 0; i < folder.length; i++){
				fs.unlinkSync('./tempFiles/'+folder[i]);
			}

			if(isInVC){
				var voiceID = null;
				voiceID = getCurrentVC(channelID);
				bot.leaveVoiceChannel(voiceID);
			}

			bot.disconnect();
		},300);		
	}

	if(message.toLowerCase() === ".reboot"){
		console.log("[Rebooting]")
		var voiceID = getVoiceID(channelID);
		reboot = true;
		bot.sendMessage({
			to: channelID,
			message: "Rebooting..."
		});

		if(playing) ffmpeg.kill();

		var folder = fs.readdirSync('./tempFiles');
		for(var i = 0; i < folder.length; i++){
			fs.unlinkSync('./tempFiles/'+folder[i]);
		}
		bot.leaveVoiceChannel(voiceID);
		bot.disconnect();		
	}

	if(message.toLowerCase().search(".volume") === 0){
		if(allowVol){
			if(message.search(" ") !== -1){
				var msg = message.split(' ');			
				var vol = Number(msg[1]);
				if(isNaN(vol)) vol = null;			

				if(vol >= 1 && vol <= 100){
					volume = vol / 100;
					bot.sendMessage({
						to: channelID,
						message: ":loud_sound: Volume set to " + vol
					});
				} else {
					bot.sendMessage({
						to: channelID,
						message: ":warning: Volume is either not a number or is not between 1 - 100"
					});
				}
			}
		} else{
			bot.sendMessage({
				to: channelID,
				message: ":warning: Volume has been disabled for avconv"
			});
		}
	}

	if(message.toLowerCase().search(".join") === 0){
		if(playing){
			bot.sendMessage({
				to: channelID,
				message: ":warning: Can't do that while playing a song."
			});
			return;
		}

		var currentVC = getCurrentVC(channelID);
		if(currentVC !== null){
			bot.leaveVoiceChannel(currentVC);
		}

		if(message.search(" ") !== -1){
			message = message.split(" ");
			var input = message[1].toLowerCase();

			for(var i in bot.channels){
				if(bot.channels[i].name.toLowerCase() === input && bot.channels[i].type === 'voice'){
					bot.joinVoiceChannel(bot.channels[i].id, () =>{
						bot.getAudioContext({channel: bot.channels[i].id, stero: true}, function(stream){
							streamer = stream;
						});	
					});
					return;
				}
			}

			bot.sendMessage({
				to: channelID,
				message: ":warning: No voice channel found"
			});
			return;
		}

		for(var i in bot.channels){
			if(bot.channels[i].type === 'voice'){
				bot.joinVoiceChannel(bot.channels[i].id, () =>{
					bot.getAudioContext({channel: bot.channels[i].id, stero: true}, function(stream){
						streamer = stream;
					});	
				});
				return;
			}
		}
	}		

	if(message.toLowerCase() === ".stop"){
		if(isInVC(channelID)){
			if(playing){				
				playing = false;
				setGame(null);
				ffmpeg.kill();
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
				ffmpeg.kill();
				stayOnQueue = true;
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
				ffmpeg.kill();
				playing = false;
				setGame(null);

				if(queue.length-1 === 0){
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
					message: ":radio: **Re-Added to Queue:** *" + queue[0].title + "*"
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
				message: ":no_entry_sign: No songs currently in queue."
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
				var voiceID = getCurrentVC(channelID);
				
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
				
				getTitleVideoID(url, (error, title, video_id, length_seconds) => {
					if(error) {
						bot.sendMessage({
							to: channelID,
							message: ":warning: **Error:**```js\n" + error + "\n```" 
						});
						return;
					}

					var seconds = length_seconds;					
					var hours = Math.trunc((seconds/60)/60);
					var delay = 2000;

					// Video can only be at max 3 hours long.
					if(hours < 3){						
						addSong(url, title, video_id, user, function () {
							bot.sendMessage({
								to: channelID,
								message: ':radio: **Added to Queue:** *' + title + '*'
							});

							if(playing === false){
								setTimeout(playSong, delay, channelID);
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
