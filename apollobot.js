// Modules
var DiscordClient = require('discord.io'),
	fs = require('fs'),
	child_proc = require('child_process'),
	spawn = child_proc.spawn,
	uptimer = require('uptimer'),	
	ytdl = require('ytdl-core'),
	botLogin = require('./botLogin.json'),
	bot = new DiscordClient({token: botLogin.token, autorun: true});

// Music
var streamer = {},
	queue = [],
	saveToLocal = false,
	playing = false,
	stoppedAudio = false,
	keepFile = false,
	playingNotify = false,
	ffmpeg = {},
	volume = 1,
	allowVol = true,
	looping = false,
	maxLocalFiles = 15;		// Max amount of files that can be saved locally. Having alot can take up space.

try{
	var botVersion = require("./package.json").version
}
catch(error){
	var botVersion = "#?"; 
	if(error) console.error(error);
}

var defaultGame = (process.argv[2]) ? process.argv[2] + " v"  + botVersion : "Ready: .help";

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

function folderCheck(folderPath) {
	// Create a folder if it hasn't been created yet
	try{
		fs.accessSync(folderPath);		
	}
	catch(error){
		if(error){
			fs.mkdirSync(folderPath);			
		}
	}
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
	var options = {
		filter: 'audio',
		quality: 'highest'
	}

	var writeablePath = fs.createWriteStream('./tempFiles/' + video_id + '.mp3')
	try {
		var stream = ytdl(url).pipe(writeablePath, options);
	}
	catch(error){
		if(error) return callback(error);
	}

	stream.on('error', error => {
		return callback(error);
	});

	writeablePath.on('error', error => {
		return callback(error);
	});

	queue.push({
		title: title,
		video_id: video_id,
		url: url,
		user: user,
		local: false,
		file: './tempFiles/' + video_id + '.mp3'
	});

	return callback(null)
}

function removeSong(song){
	var inQueue = false;
	var songIndex = 0;
	for(var i = 0; i < queue.length; i++){
		if(queue[i] === song){
			inQueue = true;
			songIndex = i;
			break;
		}
	}

	if(inQueue){
		var filePath = song.file;
		var fileName = song.video_id+".mp3";
		var fileExist = false;
		var files = fs.readdirSync('./tempFiles/');
		for(var file of files){
			if(file === fileName){
				fileExist = true;
				break;
			}
		}

		if(fileExist){				
			fs.unlinkSync(filePath);
			queue.splice(songIndex, 1);							
		} else queue.splice(songIndex, 1);		
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

	ffmpeg.stdout.once('readable', () => {
		streamer.send(ffmpeg.stdout);
		playing = true;
		if(looping) setGame("[Looping] " + song.title);
		else setGame(song.title);
		if(playingNotify){
			bot.sendMessage({
				to: channelID,
				message: ":notes: **Now Playing:** *" + song.title + "*"
			});
		}
	});
			
	ffmpeg.stdout.once('end', () => {
		playing = false;
		ffmpeg.kill();

		if(saveToLocal){
			var filePath = song.file;
			var fileTitle = song.title;
			fileTitle = fileTitle.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g,'_');
			var newFilePath = './local/'+fileTitle+'.mp3';

			// Remove song from queue so that the next song can play
			queue.splice(0,1);

			fs.rename(filePath, newFilePath, () => {
				console.log("File saved to local");
				bot.sendMessage({
					to: channelID,
					message: ':file_folder: *"'  + fileTitle + '"* saved to local. Use `.local` to browse saved songs.'
				});
			});
				
			saveToLocal = false;
		}	
		// Delete file and remove song from queue.
		if(!keepFile) {
			// Remove song from queue if its a local file otherwise remove song from queue and delete file
			if(!song.local) removeSong(song);
			else queue.splice(0,1);
		}
		// If looping has been set then stay on queue
		if(!looping) keepFile = false;

		if(queue.length === 0){
			setGame(defaultGame);
			return;
		}
		
		if(!stoppedAudio) setTimeout(playSong, 600, channelID);
		stoppedAudio = false;
	});
	return;
}

function isInVoiceChannel(){
	for(var channel in bot.channels){
		if(bot.channels[channel].type === 'voice'){
			if(bot.id in bot.channels[channel].members){
				return true;
			}
		}
	}
	return false;
}

function getCurrentVoiceChannel(){
	if(isInVoiceChannel()){
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

// By default join the first channel in the server when the bot is ready.
function start_JoinVC() {
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

bot.on('disconnected', (errMsg, code) =>{
	if(errMsg) console.log(errMsg);
	console.log("Exited with code " + code);
	process.exit();
});

bot.on('ready', rawEvent => {
	console.log("\nDiscord.io - Version: " + bot.internals.version);
    console.log("Username: "+bot.username + " - (" + bot.id + ")");
    setGame(defaultGame);
    start_JoinVC();
    folderCheck('./tempFiles');
    folderCheck('./local');

    // Display connected Servers
    console.log("\nServers connected:");
    for(var i in bot.servers){
       console.log(bot.servers[i].name + " ID: (" + bot.servers[i].id + ")");
    }
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
			"\n**Avatar:** https://goo.gl/LN6BvU\n\n**Why:** This bot was created to replace the current shit musicbot that I got sick and tired of. " +
			"So I've decided to write this bot from the ground up."

		});
	}

	if(message.toLowerCase() === ".music" || message.toLowerCase() === ".help"){
		bot.sendMessage({
			to: channelID,
			message: '\n**Music**\n•`.about`: About this bot\n•`.play [URL or file name]`: Adds and plays the music from the queue\n'+
			'•`.play`: Plays song in queue after it has been stopped\n•`.stop`: Stop the song from playing\n'+
			'•`.skip`: Skip the currently playing song\n•`.replay`: Replay song\n•`.readd`: Re-Add the currently playing song to queue\n'+
			'•`.queue`: View the list of songs in queue\n•`.uptime`: How long this bot has been online for\n'+
			'•`.notify`: Turns on a "*now playing*" notifcation\n•`.loop`: Loops a song on or off. Continues looping until its off\n'+
			'•`.local`: List all local songs you can play instantly\n•`.save`: Save the current song to local.\n•`.remlocal [Song or Number]`: Removes a local song'
		});
	}

	if(message.toLowerCase() === ".uptime"){
		bot.sendMessage({
			to: channelID,
			message: botUptime()
		});
	}

	if(message.toLowerCase() === ".disconnect" || message.toLowerCase() === ".exit"){		
		if(playing){
			ffmpeg.kill();		
		}
		
		setTimeout(() => {
			// Remove all temp files
			fs.readdir('./tempFiles/', (error, files) => {
				for(var file of files){
					fs.unlinkSync('./tempFiles/'+file);
				}
				bot.disconnect();
			});

			
		},400);		
	}

	if(message.toLowerCase().indexOf(".volume") === 0){
		if(allowVol){
			if(message.indexOf(' ') !== -1){
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

	if(message.toLowerCase().indexOf(".join") === 0){
		if(playing){
			bot.sendMessage({
				to: channelID,
				message: ":warning: Can't do that while playing a song."
			});
			return;
		}

		if(getCurrentVoiceChannel()){
			bot.leaveVoiceChannel(getCurrentVoiceChannel());
		}

		if(message.indexOf(' ') !== -1){
			message = message.split(" ");
			var input = message[1].toLowerCase();

			for(var i in bot.channels){
				if(bot.channels[i].name.toLowerCase() === input && bot.channels[i].type === 'voice'){
					bot.joinVoiceChannel(bot.channels[i].id, () =>{
						bot.getAudioContext({channel: bot.channels[i].id, stero: true}, stream => {
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
					bot.getAudioContext({channel: bot.channels[i].id, stero: true}, stream => {
						streamer = stream;
					});	
				});
				return;
			}
		}
	}		

	if(message.toLowerCase() === ".stop"){
		if(isInVoiceChannel()){
			if(playing){				
				playing = false;
				setGame(defaultGame);
				keepFile = true;
				stoppedAudio = true;
				looping = false;
				ffmpeg.kill();
								
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
		if(isInVoiceChannel()){
			if(playing){
				keepFile = true;
				ffmpeg.kill();				
				bot.sendMessage({
					to: channelID,
					message: ":notes: **Replaying:** *" + queue[0].title + "*"
				});
			}
		}
	}

	if(message.toLowerCase() === '.loop'){
		if(playing){
			if(looping){
				looping = false;
				keepFile = false;		
				bot.sendMessage({
					to: channelID,
					message: ":arrows_counterclockwise: Stopped looping song."
				});
			} else {
				looping = true;
				keepFile = true;
				bot.sendMessage({
					to: channelID,
					message: ":arrows_counterclockwise: Looping started"
				});
			}
		}
	}

	if(message.toLowerCase() === ".skip" || message.toLowerCase() === ".next"){
		if(isInVoiceChannel()){
			if(playing){
				looping = false
				keepFile = false;
				saveToLocal = false;
				ffmpeg.kill();
				playing = false;								
				if(queue.length-1 === 0){
					bot.sendMessage({
						to: channelID,
						message: "Queue is now empty."
					});					
				}
			}
		}
	}

	// Re-add to queue
	if(message.toLowerCase() === ".readd"){
		if(isInVoiceChannel()){
			if(playing){
				// If the file is local than just add to queue
				if(queue[0].local) {
					queue.push(queue[0]);
				} else {
					var newVideoID = Math.floor(Math.random()*10)+queue[0].video_id;
					var newFilePath =  './tempFiles/'+newVideoID+".mp3";
					fs.createReadStream(queue[0].file).pipe(fs.createWriteStream(newFilePath));
					queue.push({
						title: queue[0].title,
						video_id: newVideoID,
						url: queue[0].url,
						user: queue[0].user,
						file: newFilePath
					});
				}			

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

	if(message.toLowerCase() === ".save"){
		if(queue.length > 0){
			fs.readdir('./local/', (error, files) => {
				if(files.length  > maxLocalFiles) {
					bot.sendMessage({
						to: channelID,
						message: ":warning: Max local files that can be saved is 15"
					});
					return
				}

				if(!queue[0].local){
					saveToLocal = true;
					// Keep file until after the saved file is done then delete
					keepFile = true;			
					bot.sendMessage({
						to: channelID,
						message: ":file_cabinet: File queued to be saved."
					});
				} else {
					bot.sendMessage({
						to: channelID,
						message: ":warning: This song is already local."
					});
				}
			});								
		} else {
			bot.sendMessage({
				to: channelID,
				message: ":warning: No songs in queue to save."
			});
		}
	}

	if(message.toLowerCase() === ".queue"){
		var songList = [];
		for(var i = 0; i < queue.length; i++){
			if(i==0) songList.push(queue[i].title);
			else songList.push("**"+i+".** " + queue[i].title);
		}

		if(songList.length === 1){
			bot.sendMessage({
				to: channelID,
				message: "**Music**\n**Currently Playing:** *" + songList[0] + "*"
			});
		} else if(songList.length > 1){
			var firstSong = songList.splice(0,1);
			bot.sendMessage({
				to: channelID,
				message: "**Music**\n**Currently Playing:** *" + firstSong + "*\n\n**Queue** \n" + songList.join("\n")
			});
		} else {
			bot.sendMessage({
				to: channelID,
				message: ":no_entry_sign: No songs in queue."
			})
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

	if(message.toLowerCase().indexOf('.local') === 0){
		fs.readdir('./local/', (error, fileList) => {
			var songs = [];
			fileList.forEach( (file, index) => {
				file = file.split(".")[0];
				songs.push("**" + (index+1)+"**. "+ file);
			});

			if(songs.length > 0){
				bot.sendMessage({
					to: channelID,
					message: "**Local Files** - *Max Amount: 15*\n"+ songs.join("\n")
				});
			} else {
				bot.sendMessage({
					to: channelID,
					message: "No local files stored"
				});
			}
		});
	}

	if(message.toLowerCase().indexOf(".remlocal") === 0){
		if(!playing){		
			if(message.indexOf(" ") !== -1){
				var location = './local/';
				var message = message.split(" ");
				message.splice(0, 1);
				var target = message;

				// Remove local file by index number
				if(!isNaN(target)){
					target = Math.floor(target);
					fs.readdir(location, (error, fileList) => {
						if(target > 0 && target <= fileList.length){
							fs.unlink(location  + fileList[target - 1], error => {
								if(error) return console.error(error);
								bot.sendMessage({
									to: channelID,
									message: ':fire: *"' + fileList[target - 1].split(".")[0] + '"*  was removed from local files.'
								});								
							});
						} else {
							bot.sendMessage({
								to: channelID,
								message: ":warning: No local song found with that index."
							});
						}	
					});
					return;
				} else {
					// Remove local file by name
					target = target.join(" ")
					var file = target + '.mp3';
					fs.readdir(location, (error, fileList) => {
						if(fileList.indexOf(file) === -1) {
							bot.sendMessage({
								to: channelID,
								message: ":warning: No local song found with that name."
							});
							return;
						}

						fs.unlink(location + file, error => {
							if(error) return console.error(error);
							bot.sendMessage({
								to: channelID,
								message: ':fire: *"' + target + '"*  was removed from local files.'
							});	
						});
					});
					return;
				}
			}
		} else {
			bot.sendMessage({
				to: channelID,
				message: ":warning: Can't do that while playing a song."
			});
		}		
	}

	if(message.toLowerCase().indexOf(".play") === 0){
		folderCheck('./tempFiles');
		folderCheck('./local');
		if(isInVoiceChannel()){
			if(message.indexOf(" ") !== -1){
				var message = message.split(" ");
				message.splice(0, 1);
				var song = message;
				

				// Request can only be made if the user is in the bots voice channel
				if( !(userID in bot.channels[getCurrentVoiceChannel()].members)){
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

				// Plays a local file if no http link is requested
				if(song[0].indexOf("http") !== 0){
					song = message.join(" ");

					fs.readdir('./local/', (error, fileList) => {
						function addPlay(song){
								queue.push({
									title: song.split('.')[0],
									local: true,
									user: user,
									file: './local/' + song
								});

								bot.sendMessage({
									to: channelID,
									message: ':radio: **Added to Queue:** *' + song.split('.')[0] + '*'
								});

								if(!playing) setTimeout(playSong, 300, channelID);
						}

						// Convert number to song name if searched by index
						if(!isNaN(song)){
							song = Math.floor(Number(song));
							if(song > 0 && song <= fileList.length){
								song = fileList[song-1];
								addPlay(song);	
							} else {
								bot.sendMessage({
									to: channelID,
									message: ":warning: No local song found with that index."
								});
							}					
						} else {
							// If no song is found
							if(fileList.indexOf(song + '.mp3') === -1) {
								bot.sendMessage({
									to: channelID,
									message: ":warning: No local song found with that name."
								});
								return;
							}
							addPlay(song + '.mp3');
						}						
					});
					return;
				} else {
					// download and play from url
					song = song[0];
					getTitleVideoID(song, (error, title, video_id, length_seconds) => {
						if(error) {
							bot.sendMessage({
								to: channelID,
								message: ":warning: **Error:**```js\n" + error + "\n```" 
							});
							return;
						}

						var seconds = length_seconds;					
						var hours = Math.trunc((seconds/60)/60);

						// Video can only be at max 3 hours long.
						if(hours < 3){						
							addSong(song, title, video_id, user, (error) => {
								if(error) {
									bot.sendMessage({
										to: channelID,
										message: ":warning: **Error:**```js\n" + error + "\n```"
									});
									return;
								}

								bot.sendMessage({
									to: channelID,
									message: ':radio: **Added to Queue:** *' + title + '*'
								});

								if(!playing){
									setTimeout(playSong, 2000, channelID);
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
				}
					
				return;
			}

			if(playing === false){
				if(queue.length > 0){
					playSong(channelID);
				} else{
					bot.sendMessage({
						to: channelID,
						message: ":warning: No songs in queue to play from."
					});
				}			
			}
		}		 				
	}
});
