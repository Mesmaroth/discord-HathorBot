// Modules
var Discord = require('discord.io'),
	fs = require('fs'),
	child_proc = require('child_process'),
	spawn = child_proc.spawn,
	uptimer = require('uptimer'),	
	ytdl = require('ytdl-core'),
	botLogin = require('./config/botLogin.json'),
	bot = new Discord.Client({token: botLogin.token, autorun: true});

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
	loopCounter = 0,
	loopQueue = false;
	maxLocalFiles = 15;		// Max amount of files that can be saved locally. Having alot can take up space.	

try{
	var botVersion = require("./package.json").version
}
catch(error){
	var botVersion = "#?"; 
	if(error) console.error(error);
}

// command initializer to execute bot commands
const CMD_INIT = ".";
const DEV_INIT = "$";
const DEFAULT_GAME = (process.argv[2]) ? process.argv[2] + " v"  + botVersion : "v"  +botVersion;

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
	bot.setPresence({
		game: {
			name: game
		}
	});
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

	if(looping && (loopCounter-1) === 0){
		looping = false;
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
		if(looping) ((loopCounter + 1) > 0) ? setGame("[Looping " + (loopCounter+1) + "t] " + song.title) : setGame("[Looping] " + song.title);
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

			fs.rename(filePath, newFilePath, () => {
				console.log("File saved to local");
				bot.sendMessage({
					to: channelID,
					message: ":file_folder: *"  + fileTitle + "* saved to local. Use `" + CMD_INIT + "local` to browse saved songs."
				});
			});

			if(keepFile) queue[0].file = newFilePath;
			saveToLocal = false;			
		}

		// Keep file and readd song into the back of the queue if looping the entire queue
		if(loopQueue){
			keepFile = true;
			queue.push(song);
			queue.shift(song);
		}

		// Delete file and remove song from queue.
		if(!keepFile) {
			// Remove song from queue if its a local file otherwise remove song from queue and delete file
			if(!song.local) removeSong(song);
			else queue.splice(0,1);
		}
		// If looping has been set then stay on queue
		if(!looping) keepFile = false;
		// Removing 1 from loop counter
		if(looping && loopCounter > 0){
			loopCounter = loopCounter - 1;
		}

				

		if(queue.length === 0){
			setGame(DEFAULT_GAME);
			return;
		}
		
		if(!stoppedAudio) setTimeout(playSong, 600, channelID);
		stoppedAudio = false;
	});
	return;
}

// Returns voice ID if bot is in a voice channel
function getCurrentVoiceChannel(){
	for(var i in bot.channels){
		if(bot.channels[i].type === "voice"){
			if(bot.id in bot.channels[i].members){
				return bot.channels[i].id;
			}
		}
	}
	return null;
}

// joins the first voice channel of the first server it's connected too
function start_JoinVC() {
	for(var channel in bot.channels){
		if(bot.channels[channel].type === "voice"){
			bot.joinVoiceChannel(bot.channels[channel].id, error => {
				if(error) return console.error(error);
				bot.getAudioContext(bot.channels[channel].id, (error, stream) =>{
					if(error) return console.log(error);
					streamer = stream
				});

			});
			return;
		}		
	}
}

function matchStr(string1, string2){
	if(string1[0] === CMD_INIT && (string1.slice(1, string1.indexOf(" ")).toLowerCase() === string2 || string1.slice(1).toLowerCase() === string2) ){
		return true;
	} else return false;
}

bot.on('disconnect', (errMsg, code) => {
	if(errMsg) console.log(errMsg);
	console.log("Exited with code " + code);
	process.exit();
})

bot.on('ready', rawEvent => {
	console.log("\nDiscord.io - Version: " + bot.internals.version);
    console.log("Username: "+bot.username + " - (" + bot.id + ")");
    setGame(DEFAULT_GAME);
    start_JoinVC();

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

	//developer Commands
	if(message.toLowerCase() === DEV_INIT + "writeout"){		
		fs.writeFile(bot.username+".json", JSON.stringify(bot, null, '\t'), 'utf8', (error) => {
			if(error) return console.error(error);
			console.log("Logged bot properties.");
		});
	}

	if(message.toLowerCase() === DEV_INIT + "disconnect" || message.toLowerCase() === DEV_INIT + "exit"){
		// Remove all temp files
		fs.readdir('./tempFiles/', (error, files) => {
			if(error) return console.error(error);
			if(playing) ffmpeg.kill();

			for(var file of files){
				fs.unlinkSync('./tempFiles/'+file);
			}
			bot.disconnect();
		});
	}

	// -----

	if(message.toLowerCase() === CMD_INIT+"about"){
		var botAvatarURL = "https://cdn.discordapp.com/avatars/" + bot.id + "/" + bot.avatar + ".jpg";
		bot.sendMessage({
			to: channelID,
			message: "\n**Username:** "+bot.username+"\n**Author:** Mesmaroth\n**Written in:** Node.js"+
			"\n**Version:** " +botVersion+ "\n**Library:** Discord.io\n**Library Version:** "+bot.internals.version+
			"\n**Avatar:** " + botAvatarURL +"\n\n"+
			"**Why:** This bot was created to replace the current shit musicbot that I got sick and tired of. " +
			"So I've decided to write this bot from the ground up."

		});
	}

	if(message.toLowerCase() === CMD_INIT+"help"){
		bot.sendMessage({
			to: channelID,
			message: "\n**Music**\n"+
			"•`" +CMD_INIT+ "about`: About this bot\n"+
			"•`" +CMD_INIT+ "play`: Without parameter, plays a song in the queue if it has been stopped.\n"+
			"•`" +CMD_INIT+ "play [URL or file index/name]`: Adds song to queue. Plays if it's first up in queue. \n"+			
			"•`" +CMD_INIT+ "stop`: Stop the song from playing.\n"+
			"•`" +CMD_INIT+ "queue`: View the list of songs in queue\n"+
			"•`" +CMD_INIT+ "skip` or `" + CMD_INIT + "next`: Skip the currently playing song\n"+
			"•`" +CMD_INIT+ "replay`: Stops and replays song\n"+
			"•`" +CMD_INIT+ "readd`: Re-Add the currently playing song to queue\n"+			
			"•`" +CMD_INIT+ "uptime`: How long this bot has been online for\n"+
			"•`" +CMD_INIT+ "notify`: Turns on a \'*now playing*\' notifcation\n"+
			"•`" +CMD_INIT+ "loop` or `" +CMD_INIT+ "loop [number of times]`: Loops a song on or off. Continues looping until its off\n"+
			"•`" +CMD_INIT+ "loop queue`: Loops entire queue ON or OFF\n"+
			"•`" +CMD_INIT+ "local`: List all local songs you can play instantly\n"+
			"•`" +CMD_INIT+ "save`: Save the current song to locally play.\n"+
			"•`" +CMD_INIT+ "remove [index or name]`: Removes a song from the queue.\n"+
			"•`" +CMD_INIT+ "remlocal [Song or Number]`: Removes a local song\n"+
			"•`" +CMD_INIT+ "playlist`: List available playlist\n"+
			"•`" +CMD_INIT+ "playlist [song or number]`: List songs from a playlist\n"+
			"•`" +CMD_INIT+ "playlist save [name of playlist]`: Save a playlist from what is in queue\n"+
			"•`" +CMD_INIT+ "playlist play [playlist name or number]`: Plays and loads songs from a playlist\n"+
			"•`" +CMD_INIT+ "playlist remove [song or number]` or `playlist delete [song or number]`: Removes a playlist"
		});
	}

	if(message.toLowerCase() === CMD_INIT+"uptime"){
		bot.sendMessage({
			to: channelID,
			message: botUptime()
		});
	}	

	// Optional volume controls for ffmpeg players
	if(matchStr(message,"volume")){
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

	if(matchStr(message, "join")){
		if(playing){
			bot.sendMessage({
				to: channelID,
				message: ":warning: Can't do that while playing a song."
			});
			return;
		}		

		if(message.indexOf(' ') !== -1){
			message = message.split(" ");
			var input = message[1].toLowerCase();

			for(var i in bot.channels){
				if(bot.channels[i].name.toLowerCase() === input && bot.channels[i].type === 'voice'){
					if(getCurrentVoiceChannel() === bot.channels[i].id) {
						bot.sendMessage({
							to: channelID,
							message: ":warning: Already in channel!"
						});
						return;
					}					
					else{
						bot.joinVoiceChannel(bot.channels[i].id, (error, events) =>{
							if(error) return console.error(error);
							bot.getAudioContext({channel: bot.channels[i].id, stero: true}, (error, stream) => {
								if(error) return console.error(error);
								streamer = stream;
							});	
						});
						return;
					}
				}
			}

			bot.sendMessage({
				to: channelID,
				message: ":warning: No voice channel found"
			});
			return;
		} else {
			for(var member in bot.servers[bot.channels[channelID].guild_id].members){
				if(userID === bot.servers[bot.channels[channelID].guild_id].members[member].id){
					if(bot.servers[bot.channels[channelID].guild_id].members[member].voice_channel_id){
						var voiceID = bot.servers[bot.channels[channelID].guild_id].members[member].voice_channel_id;
						if(getCurrentVoiceChannel() === voiceID) {
							bot.sendMessage({
								to: channelID,
								message: ":warning: Already in channel!"
							});
							return;
						}

						bot.joinVoiceChannel(voiceID, error => {
							if(error) return console.error(error);
							bot.getAudioContext(voiceID, (error, stream) => {
								if(error) return console.error(error);
								streamer = stream;
							});
						})
						return;
					}
				}
			}
		}
	}		

	if(message.toLowerCase() === CMD_INIT+"stop"){
		if(getCurrentVoiceChannel()){
			if(playing){				
				playing = false;
				keepFile = true;
				stoppedAudio = true;
				looping = false;
				loopCounter = 0;
				ffmpeg.kill();
				(queue.length > 0) ? setGame("Stopped: "+queue.length +" song(s) in queue") : setGame(DEFAULT_GAME);								
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

	if(matchStr(message, "remove")){
		if(message.indexOf(" ") === -1) return;
		var song = message.slice(message.indexOf(" ")+1);
		if(!isNaN(song)){
			song = Number(song);
			if( !(song > 0)|| !(song < queue.length)){
				bot.sendMessage({
					to: channelID,
					message: "No song queued with that index."
				});
				return;
			}	
			var songName = queue[song].title;
			var filePath = queue[song].file;
			if(queue[song].local){
				queue.splice(song, 1);
			} else if(queue[song].local === false){
				fs.unlinkSync(filePath);
				queue.splice(song, 1);
			}

			bot.sendMessage({
				to: channelID,
				message: "Removed *" + songName	+ "* from queue."
			});
			return;
		} else{
			for(var i = 1; i < queue.length; i++){
				if(queue[i].title.toLowerCase() === song.toLowerCase()){
					var songName = queue[i].title;
					var filePath = queue[i].file;
					if(queue[i].local){
						queue.splice(i, 1);
					} else if(queue[i].local === false){
						fs.unlinkSync(filePath);
						queue.splice(i, 1);
					}

					bot.sendMessage({
						to: channelID,
						message: "Removed *" + songName	+ "* from queue."
					});
					return;
				}
			}

			bot.sendMessage({
				to: channelID,
				message: "No song with that name found."
			});
			return;
		}		
	}

	
	if(message.toLowerCase() === CMD_INIT+"replay"){
		if(getCurrentVoiceChannel()){
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

	if(matchStr(message, "loop")){
		if(playing){
			if(message.indexOf(' ') !== -1){
				message = message.split(' ');
				if( !(isNaN(message[1])) ){
					loopCounter = Number(message[1]);
				}
				else if(message[1] === "queue" && !looping){
					if(!loopQueue){
						loopQueue = true
					} else loopQueue = false;
					bot.sendMessage({
						to: channelID,
						message: (loopQueue) ? ":arrows_counterclockwise: Loop queue `ON`" : ":arrows_counterclockwise: Loop queue `OFF`"
					});
					return;
				} else if(message[1] === "queue" && loooping){
					bot.sendMessage("A song is already looping. Can not loop queue.");
					return;
				}
			}

			if(looping){
				looping = false;
				keepFile = false;
				loopCounter = 0;
				bot.sendMessage({
					to: channelID,
					message: ":arrows_counterclockwise: Stopped looping song."
				});
			} else {
				looping = true;
				keepFile = true;
				if(loopCounter > 0){
					bot.sendMessage({
						to: channelID,
						message: ":arrows_counterclockwise: Looping song for `" + loopCounter + "` times."
					})
				} else{
					bot.sendMessage({
						to: channelID,
						message: ":arrows_counterclockwise: Looping started"
					});
				}
				
			}
		}
	}

	if(matchStr(message, "playlist")){
		var playlistLocation = "./playlist/";
		folderCheck(playlistLocation);
		if(message.indexOf(" ") !== -1){
			message = message.split(" ");
			var queuedSongs = queue;
			if(message.length < 2) return;

			// Saving playlist from the queue
			if(message[1] === "save" && queue.length > 0){
				if(!message[2]) return;
				fs.readdir(playlistLocation, (error, files) =>{
					if(error) return console.error(error);

					for(var i = 0; i < files.length; i++){
						if(files[i] === message[2] + ".json"){
							bot.sendMessage({
								to: channelID,
								message: "Playlist already set with that name."
							});
							return;
						}
					}					
					fs.writeFile(playlistLocation + message[2] + '.json', JSON.stringify(queuedSongs, null, '\t'), 'utf8', (error) => {
						if(error) return console.error(error);
						bot.sendMessage({
							to:channelID,
							message: "Playlist saved as `" + message[2] + "`"
						});
					});
				});
				return;
			}

			// Playing and loading songs from a playlist to queue
			if(message[1] === "play") {
				var playList = [];
				if(!message[2]) return;
				fs.readdir(playlistLocation, (error, files) =>{
					if(error) return console.error(error);
					for(var i = 0; i < files.length; i++){
						if(files[i] === message[2] + ".json" || (i+1) === Number(message[2])){
							var playlistFileName = files[i].split(".")[0];
							playList = require(playlistLocation + files[i]);
							if(playList.length > 0){
								for(var i = 0; i < playList.length; i++){
									// Load song to queue if the file is local							
									if(playList[i].local){
										queue.push(playList[i]);
									} else if(!(playList[i].local)){
										addSong(playList[i].url, playList[i].title, playList[i].video_id, bot.user, (error) =>{
											if(error) return console.error(error);											
										});
									}
								}
								// Play if nothing is playing
								if(!playing){
									setTimeout(() =>{
										playSong(channelID);
										bot.sendMessage({
											to: channelID,
											message: "Playing playlist `" + playlistFileName + "`"
										});
									}, 2500)
								} else{
									bot.sendMessage({
										to: channelID,
										message: "Added playlist `" + playlistFileName + "` to queue."
									});
								}
							}								
							return;							
						}
					}
				});
				return;				
			}

			// Deleting playlist file
			if(message[1] === "delete" || message[1] === "remove"){
				if(!message[2]) return;
				fs.readdir(playlistLocation, (error, files) => {
					if(error) return console.error(error);
					for(var i = 0; i < files.length; i++){
						if(files[i] === message[2] + ".json" || (i+1) === Number(message[2])){
							fs.unlinkSync(playlistLocation + files[i]);
							bot.sendMessage({
								to: channelID,
								message: "Playlist `" + files[i].split(".")[0] + "` deleted." 
							})
							return;
						}
					}

					bot.sendMessage({
						to: channelID,
						message: "Playlist not found."
					});
				});
			}

			// List songs from a playlist
			fs.readdir(playlistLocation, (error, files) =>{
				if(error) return console.error(error);
				for(var i = 0; i < files.length; i++){
					if(files[i] === message[1]+".json" || (i+1) === Number(message[1])){
						var playList = require(playlistLocation + files[i]);
						var songList = [];
						var playListName = files[i].split(".")[0];

						for(var i = 0; i < playList.length; i++){
							songList.push("**" + (i+1) + "**. " + playList[i].title);
						}

						bot.sendMessage({
							to: channelID,
							message: "**" + playListName + " playlist**\n"+songList.join("\n")
						});
					}
				}
			});
		} else {
			// List playlist
			fs.readdir(playlistLocation, (error, files) => {
				if(error) return console.error(error);
				if(files.length === 0){
					bot.sendMessage({
						to: channelID,
						message: "No playlist available."
					});
					return;
				}
				for(var i = 0; i < files.length; i++){
					files[i] = "**"+(i+1)+"**. "+files[i].split(".")[0];
				}
				bot.sendMessage({
					to:channelID,
					message: "**Playlist**\n" + files.join("\n")
				});
			});
		}
		return;
	}

	if(message.toLowerCase() === CMD_INIT+"skip" || message.toLowerCase() === CMD_INIT+"next"){
		if(getCurrentVoiceChannel()){
			looping = false;
			loopCounter = 0;
			keepFile = false;
			saveToLocal = false;

			ffmpeg.kill();
			playing = false;	

			bot.sendMessage({
				to: channelID,
				message: ":arrow_forward: **Skipping:** *" + queue[0].title +"*"
			});
			
			if(queue.length-1 === 0){
				bot.sendMessage({
					to: channelID,
					message: "Queue is now empty."
				});					
			}			
		}
	}

	// Re-add to queue
	if(message.toLowerCase() === CMD_INIT+"readd"){
		if(getCurrentVoiceChannel()){
			if(playing){
				// If the file is local than just add to queue
				if(queue[0].local) {
					queue.push(queue[0]);
				} else {
					var newVideoID = Math.floor(Math.random()*10)+queue[0].video_id;
					var newFilePath =  './tempFiles/'+newVideoID+".mp3";
					folderCheck('./tempFiles/');
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

	if(message.toLowerCase() === CMD_INIT+"save"){
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

	if(message.toLowerCase() === CMD_INIT+"queue" || message.toLowerCase() === CMD_INIT+"playing"){
		var songList = [];
		for(var i = 0; i < queue.length; i++){
			if(i==0) songList.push(queue[i].title);
			else songList.push("**"+i+".** " + queue[i].title);
		}

		if(songList.length === 1){
			if(loopQueue){
				bot.sendMessage({
					to: channelID,
					message: "**Music - Looping Queue**\n**Currently Playing:** *" + songList[0] + "*"
				});
			} else {
				bot.sendMessage({
					to: channelID,
					message: "**Music**\n**Currently Playing:** *" + songList[0] + "*"
				});
			}
		} else if(songList.length > 1){
			var firstSong = songList.splice(0,1);
			if(loopQueue){
				bot.sendMessage({
					to: channelID,
					message: "**Music - Looping Queue**\n**Currently Playing:** *" + firstSong + "*\n\n**Queue** \n" + songList.join("\n")
				});
			} else {
				bot.sendMessage({
					to: channelID,
					message: "**Music**\n**Currently Playing:** *" + firstSong + "*\n\n**Queue** \n" + songList.join("\n")
				});
			}
		} else {
			bot.sendMessage({
				to: channelID,
				message: ":no_entry_sign: No songs in queue."
			})
		}
	}

	if(message.toLowerCase() === CMD_INIT+"notify"){
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

	if(message.toLowerCase() === CMD_INIT + "local"){
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

	if(matchStr(message, "remlocal")){				
		if(message.indexOf(" ") !== -1){
			var location = './local/';
			var message = message.split(" ");
			message.splice(0, 1);
			var target = message;
			folderCheck('./local/');

			// Remove local file by index number
			if(!isNaN(target)){
				target = Math.floor(target);
				fs.readdir(location, (error, fileList) => {
					if(target > 0 && target <= fileList.length){

						fs.unlink(location + fileList[target - 1], error => {
							if(error) {
								if(error.code === 'EBUSY'){
									bot.sendMessage({
										to: channelID,
										message: ":warning: Can not delete local song while playing it."
									});
									return;
								}
							}
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
			} else {	// Remove local file by name					
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

					if(playing && queue[0].title === file){
						bot.sendMessage({
							to: channelID,
							message: ":warning: Can not remove a local song that is currently playing."
						});
						return;
					}

					fs.unlink(location + file, error => {
						if(error.code === 'EBUSY'){
							bot.sendMessage({
								to: channelID,
								message: ":warning: Can not delete local song while playing it."
							});
							return;
						}

						bot.sendMessage({
							to: channelID,
							message: ':fire: *"' + target + '"*  was removed from local files.'
						});	
					});
				});
				return;
			}
		}			
	}

	if(matchStr(message,"play")){
		folderCheck('./tempFiles');
		folderCheck('./local');
		if(getCurrentVoiceChannel()){
			if(message.indexOf(" ") !== -1){
				var message = message.split(" ");
				message.splice(0, 1);
				var song = message;			

				// Request can only be made if the user is in the bots voice channel
				if(!(userID in bot.channels[getCurrentVoiceChannel()].members)){
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
				var isLink = /http(?:s?):\/\/(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-\_]*)(&(amp;)?‌​[\w\?‌​=]*)?/

				// Plays a local file if no http link is requested
				if( !(isLink.test(song[0])) ){
					if(/http(?:s?):/.test(song[0])){
						bot.sendMessage({
							to: channelID,
							message: ":warning: Not a valid youtube link"
						});
						return;
					}
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
				} else{
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

						// Video can only be at max 2 hours long.
						if(hours < 2){						
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
									if(!(queue.length > 1)){
										setTimeout(playSong, 2000, channelID);
									}
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
