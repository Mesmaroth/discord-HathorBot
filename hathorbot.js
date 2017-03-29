const Discord = require('discord.js');
const fs = require('fs');
const bot = new Discord.Client();
const token = require('./config/botLogin.js').token;
const yt = require('./modules/youtube.js');

// command initializer
const CMDINIT = '.';
const localPath = './local/';
const adminRole = "admin";		// This can be changed to what ever 

var defaultChannel = {};	// The object guild details of the defualt server
var currentVoiceChannel;	// The object voice channel the bot is in
var defaultChannelPath = './config/default_channel.json';

var queue = [];
var botPlayback;	// stream dispatcher
var voiceConnection;	// voice Connection object
var playing = false;
var stopped = false;
var stayOnQueue = false;

try{
	var botVersion = require('./package.json').version;
}catch(error) {
	if(error) console.error(error);
	var botVersion = "#?";
}

function checkDefaultChannel(){
	if(fs.existsSync(defaultChannelPath)){
		try {
			defaultChannel = require(defaultChannelPath);
		} catch(error){
			console.log("ERROR: reading file:\n" +  error.message);
			fs.rename(defaultChannelPath, './config/default_channel_ERROR.json', () =>{
				fs.writeFile(defaultChannelPath, JSON.stringify(defaultChannel, null, '\t'), error =>{
					if(error) return console.error(error);
					console.log("\nRESPONSE: Renamed config file with error and created new config file. Please revise and replace!\n");
				});
			});
		}
	} else{
		fs.writeFile(defaultChannelPath, JSON.stringify(defaultChannel, null, '\t'), error =>{
			if(error) return console.error(error);
			console.log("Default channel config file created");
		});
	}
}

function joinDefaultChannel(){
	var botGuilds = bot.guilds.array();
	if(botGuilds.length > 0){
		for(var i = 0; i < botGuilds.length; i++){
			if(defaultChannel.guildID === botGuilds[i].id){
				var channel = botGuilds[i].channels.filterArray( channel =>{
					return channel.id === defaultChannel.voiceID;
				})[0];

				channel.join();
				console.log("DISCORD: Joined voice channel " + channel.name + "\n");
				currentVoiceChannel = channel;
			}
		} 
	} else{
		console.log("NO SERVERS FOUND\n");
	}
}


function isCommand(message, command){
	if(message[0] === CMDINIT && (message.toLowerCase().slice(1) === command.toLowerCase() || message.toLowerCase().slice(1, message.indexOf(" ")) === command.toLowerCase()) ){
		return true;
	}
	return false;
}

function isDev(message){
	var roles = message.member.roles.array();
	for(var role = 0; role < roles.length; role++){
		if(roles[role].name.toLowerCase() === adminRole)			
			return true;
	}
	message.channel.sendMessage("You aren't admin for this command.");
	return false;
}


function getGuildByString(guildName){
	return bot.guilds.filterArray( (guild) =>{
		return guild.name === guildName;
	})[0];
}

function getChannelByString(guild, channelName){
	return guild.channels.filterArray( (channel) =>{
		return channel.name === channelName;
	})[0];
}

function setGame(game){
	bot.user.setGame(game);
	if(game)
		console.log("DISCORD: GAME SET: " + game)
}

function removeTempFiles(){
	var tempPath = './tempFiles/';
	fs.readdir(tempPath, (error, files) =>{
		if(error) return console.error(error);

		for(var i = 0; i < files.length; i++){
			fs.unlinkSync(tempPath+files[i]);
		}
	});
}

function play(connection, message) {	
	botPlayback = connection.playFile(queue[0].file)
		.on('end', ()=>{
			playing = false;

			if(!stopped){
				if(!stayOnQueue){
					queue.shift();
				} else
					stayOnQueue = false;

				if(queue.length > 0){
					play(connection, message);
				} else{
					setGame();
					setTimeout(()=>{
						removeTempFiles();
					}, 1000);
				}
			} else{
				stopped = false;
				setGame();
			}
		})
		.on('error', ()=>{
			console.error(error);
		});

	playing = true;
	setGame(queue[0].title);
	message.channel.sendMessage("**Playing:**\n" + queue[0].title);
}

// If this bot isn't connected to any servers, then display a invite link in console
function outputInviteLink(){
	if(bot.guilds.array().length === 0){
		bot.generateInvite([ 
  			"CONNECT", "SPEAK", "READ_MESSAGES", "SEND_MESSAGES", "SEND_TTS_MESSAGES",
  			"ATTACH_FILES", "USE_VAD"
  		]).then( link => {
  			console.log("Invite this bot to your server using this link:\n"  + link);
  		});
	}
}

bot.on('ready', () => {
	console.log("HathorBot V" + botVersion)
	console.log(bot.user.username + " (" + bot.user.id + ")");

	// display servers
	var guilds = [];
	bot.guilds.array().forEach( (guild) =>{
		guilds.push(guild.name);
	});

	if(guilds.length > 0){
		console.log("Servers:");
		console.log(guilds.join("\n"));	
		console.log();
	}
	
	setGame("HathorBot v" + botVersion);

	checkDefaultChannel();
	joinDefaultChannel();
	outputInviteLink()

	
});

bot.on('disconnect', (event) =>{
	console.log("Exited with code: " + event.code);
	if(event.reason) 
		console.log("Reason: " + event.reason);

	removeTempFiles();
	process.exit(0);
});

bot.on('message', message => {
	// Admin commands
	if(isCommand(message.content, 'setusername')){
		if(message.content.indexOf(' ') !== -1){
			var username = message.content.split(' ')[1];
			bot.user.setUsername(username);
			console.log("DISCORD: Username set to " + username);
		}
	}

	if(isCommand(message.content, 'setavatar')){
		if(message.content.indexOf(' ') !== -1){
			var url = message.content.split(' ')[1];
			bot.user.setAvatar(url);
			console.log("DISCORD: Avatar changed");
		}
	}

  	if(isCommand(message.content, 'exit')){
  		if(!isDev(message)) return;
  		if(voiceConnection)
  			voiceConnection.disconnect();
  		bot.destroy();
  	}
  	// ----

  	if(isCommand(message.content, 'source')){
  		message.channel.sendMessage("**Source:** https://github.com/Mesmaroth/discord-HathorBot");
  	}

  	if(isCommand(message.content, 'about')){
  		var content = "**About**\n" + "**Bot Version:** HathorBot v" + botVersion +
  			"\n**Bot Username:** " + bot.user.username +
  			"\n**Author:** Mesmaroth" +
  			"\n**Library:** Discord.js" +  			
  			"\n**Source:** <https://github.com/Mesmaroth/discord-HathorBot>" 

  		message.channel.sendFile( bot.user.displayAvatarURL, 'botAvatar.jpg', content);
  	}

  	if(isCommand(message.content, 'help')){
  		message.channel.sendMessage("**Bot Commands**\n" +
			"\n__**Admin Commands**__\n" + 
			"`" + CMDINIT+ "setUsername [name]`: Sets the username of bot\n" +
			"`" + CMDINIT+ "setAvatar [URL]`: Sets the avatar of the bot\n" + 
			"`" + CMDINIT+ "exit`: Disconnects the bot\n" + 
			"\n__**General**__\n" +
			"`" + CMDINIT+ "about`: About this bot\n" +
			"`" + CMDINIT+ "source`: Source link\n" +
			"`" + CMDINIT+ "invite`: Get invite link to your bot\n" + 
			"`" + CMDINIT+ "setVC`: Set the defualt channel your bot joins when ever the bot connects\n" + 
			"`" + CMDINIT+ "join`: Bot will attempt to join your channel\n" +
			"\n__**Music**__\n" + 
			"`" + CMDINIT+ "queue or playing`: To view all songs in queue\n" +
			"`" + CMDINIT+ "play [YT_URL]`: Plays a song from a youtube link\n" +
			"`" + CMDINIT+ "play [index_number]`: Plays a song from a file that has been saved to the bot\n" +
			"`" + CMDINIT+ "play [search key term]`: Plays the first result of youtube search\n" +
			"`" + CMDINIT+ "play`: Plays song in queue if it has been stopped\n" +
			"`" + CMDINIT+ "stop`: Stops the song from playing\n" +
			"`" + CMDINIT+ "skip`: To skip the currently playing song\n" +
			"`" + CMDINIT+ "replay`: Stops and replays song from the start\n" +
			"`" + CMDINIT+ "local`: Displays all the songs saved by the bot\n" +
			"`" + CMDINIT+ "remove [index_number]`: Removes a specific song from queue\n" +
			"`" + CMDINIT+ "save [YT_URL]`: Saves a song from youtube and stores it\n" +
			"`" + CMDINIT+ "save`: Saves current song that's playing\n" +
			"`" + CMDINIT+ "remlocal [index_number]`: Removes a song that has been saved locally\n" +
			"`" + CMDINIT+ "readd`: Re-adds the currently playing song at the bottom of the queue\n")
  	}

  	if(isCommand(message.content, 'invite')){
  		bot.generateInvite([ 
  			"CONNECT", "SPEAK", "READ_MESSAGES", "SEND_MESSAGES", "SEND_TTS_MESSAGES",
  			"ATTACH_FILES", "USE_VAD"
  		]).then( link => {
  			message.channel.sendMessage("**Invite:** "  + link);
  		});
  	}

  	if(isCommand(message.content, 'uptime')){
  		message.channel.sendMessage("**Uptime:** " + bot.uptime);
  	}

  	if(isCommand(message.content, 'setvc')){
  		if(message.content.indexOf(" ") !== -1){
  			var voiceChannelName = message.content.split(" ")[1];

  			var guild = message.member.guild;
  			var channel = getChannelByString(guild, voiceChannelName);

  			function writeOutChannels(){
  				fs.writeFile(defaultChannelPath, JSON.stringify(defaultChannel, null, '\t'), () =>{
		  			message.channel.sendMessage("Server default voice channel set to " + voiceChannelName);
		  		});
  			}

  			if(channel){  				
  				defaultChannel.name = voiceChannelName;
				defaultChannel.guild = guild.name;
				defaultChannel.voiceID = channel.id;
				defaultChannel.guildID = guild.id;
				writeOutChannels();
  			} else
  			  	message.channel.sendMessage("No voice channel found");
  		}
  	}

  	if(isCommand(message.content, 'join')){
  		var userVoiceChannel = message.member.voiceChannel;
  		if(userVoiceChannel){ 
  			if(currentVoiceChannel){
  			  	currentVoiceChannel.leave();
  			  }
  			userVoiceChannel.join();
  			currentVoiceChannel = userVoiceChannel;
  		}
  		else
  			message.channel.sendMessage("You are not in a voice channel.");
  	}

  	if(isCommand(message.content, 'queue' || isCommand(message.content, 'playing'))){
  		var songs = [];
  		for (var i = 0; i < queue.length; i++) {
  			songs.push(queue[i].title);
  		}

  		if(songs.length > 0){
  			if(songs.length === 1){
  				message.channel.sendMessage("**Queue - Playlist**\n**Playing:** " + songs[0]);
  			} else{
  				var firstSong = songs.shift();
  				for (var i = 0; i < songs.length; i++) {
  					songs[i] = "**" + (i+1) + ". **"+ songs[i];
  				}
  				message.channel.sendMessage("**Queue - Playlist**\n**Playing:** " + firstSong + "\n\n" + songs.join("\n"));
  			}
  		} else
  			message.channel.sendMessage("No songs queued");
  	}

  	if(isCommand(message.content, 'local')){
  		fs.readdir('./local/', (error, files) =>{
  			for(var i = 0; i < files.length; i++){
  				files[i] = "**" + (i+1) + ".** " + files[i].split(".")[0];
  			}

  			message.channel.sendMessage("**Local Songs**\n" + files.join("\n"));
  		});
  	}

  	if(isCommand(message.content, 'play')){
  		if(message.content.indexOf(' ') !== -1){
  			var song = message.content.split(' ')[1];
  			var tempPath = './tempFiles/';
  			var localPath = './local/';

  			/* YT REGEX : https://stackoverflow.com/questions/3717115/regular-expression-for-youtube-links
			*	by Adrei Zisu
			*/
			var isLink = /http(?:s?):\/\/(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-\_]*)(&(amp;)?‌​[\w\?‌​=]*)?/

  			if( currentVoiceChannel === message.member.voiceChannel){
  				currentVoiceChannel.join().then( connection =>{
  					voiceConnection = connection;
	  				if(isLink.test(song)){
	  					var url = song;
	  					yt.getInfo(url, (error, rawData, id, title, length_seconds) => {
	  						if(error) {
	  							message.channel.sendMessage("An Error has a occured and has been reported");
	  							console.error(error);
	  							return;
	  						}

	  						yt.getFile(url, tempPath + id + '.mp3', (error) =>{
	  							if(error) return console.error(error);
	  							queue.push({
	  								title: title,
	  								id: id,
	  								file: tempPath + id + '.mp3',
	  								local: false,
	  								url: url
	  							});

	  							if(!playing && !stopped) 
	  								play(voiceConnection, message);
	  							else {
	  								message.channel.sendMessage("**Added to Queue:**\n" + title);
	  							}
	  						});
	  					});
	  				} else{	
	  					var song = message.content.split(' ')[1];

	  					//	Credit: https://stackoverflow.com/questions/1303646/check-whether-variable-is-number-or-string-in-javascript#1303650
	  					function isNumber(obj) {	
	  						return !isNaN(parseFloat(obj))
	  					}
	  					
	  					if(isNumber(song)){
	  						fs.readdir(localPath, (error, files) =>{
		  						if(error) return console.error(error);
		  						for(var i = 0; i < files.length; i++){
		  							if( Number(song) === (i+1)){
		  								var title = files[i].split('.')[0];
		  								var file = localPath + files[i];
		  								queue.push({
		  									title: title,
		  									file: file,
		  									local: true
		  								});

		  								if(!playing && !stopped){ 
			  								play(voiceConnection, message);
			  								return;
			  							} else {
			  								message.channel.sendMessage("**Added to Queue:**\n" + title);
			  								return;
			  							}
		  							}
		  						}
		  						message.channel.sendMessage("No local song found with that index.");
		  					});
	  					} 
	  					else{
	  						var song = message.content.slice(message.content.indexOf(' ')+1);
	  						yt.search(song, (error, id, title, URL) =>{
	  							if(error) return message.channel.sendMessage("**Youtube Search Error**:```" + error.message + "```");
	  							yt.getFile(URL, tempPath + id + '.mp3', error =>{
	  								if(error) return console.error(error);
	  								queue.push({
		  								title: title,
		  								id: id,
		  								file: tempPath + id + '.mp3',
		  								local: false,
		  								url: URL
	  								});

	  								if(!playing && !stopped) 
		  								play(voiceConnection, message);
		  							else {
		  								message.channel.sendMessage("**Added to Queue:**\n" + title);
		  							}
	  							});
	  						});
	  					}
	  				}
  				});
  			} else
  				message.channel.sendMessage("You're not in the voice channel.");
  		} else{
  			if(queue.length > 0)
  				play(voiceConnection, message);
  			else
  				message.channel.sendMessage("No songs queued");
  		}
  	}

  	if(isCommand(message.content, 'stop')){
  		if(playing){
  			playing = false;
  			stayOnQueue = true;
  			stopped = true;
  			botPlayback.end();  			  			
  		}
  	}

  	if(isCommand(message.content, 'skip')){
  		if (playing){
  			playing = false;  
  			botPlayback.end();						
  		} else{
  			queue.shift();
  		}
  	}

  	if(isCommand(message.content, 'replay')){
  		if(playing){
  			playing = false;
  			stayOnQueue = true;
  			botPlayback.end();  			
  		}
  	}

  	if(isCommand(message.content, 'remove')){
  		if(message.content.indexOf(' ') !== -1){
  			var index = message.content.split(' ')[1];
  			index = Number(index);

  			for(var i = 1; i < queue.length; i++){
  				if(index === i){
  					var title = queue[i].title;
  					queue.splice(i, 1);
  					message.channel.sendMessage("**Removed:** " + title + " from queue");
  					return;
  				}
  			}
  			message.channel.sendMessage("No queued song found with that index number found");
  		}
  	}

  	if(isCommand(message.content, 'save')){
	  	if(message.content.indexOf(' ') !== -1){
	  		var url = message.content.split(' ')[1];
	  		yt.getInfo(url, (error, rawData, id, title, length_seconds) =>{
	  			var title = title.replace(/[&\/\\#,+()$~%.'":*?<>{}|]/g,'');
	  			console.log(title);
	  			yt.getFile(url, './local/' + title + '.mp3', () =>{
	  				message.channel.sendMessage("**Saved:** *" + title + "*");
	  			});
	  		});

	  	}
	  	else{
	  		var song = queue[0];
	  		var title = song.title.replace(/[&\/\\#,+()$~%.'":*?<>{}|]/g,'');
		  	var output = './local/' + title + '.mp3';
	  		if(playing){
	  			if(!song.local){  			
		  		
	  			if(!fs.existsSync(output)){
	  				fs.createReadStream(song.file).pipe(fs.createWriteStream(output));
	  				message.channel.sendMessage("**Saved:** *" + title + "*");
	  			} else{
	  				message.channel.sendMessage("You already saved this song")
	  			}
		  		} else{
		  			message.channel.sendMessage("You already saved this song");
		  		}
	  		}
	  	}
  	}

  	if(isCommand(message.content, 'remlocal')){
  		var path = './local/';
  		var index = Number(message.content.split(' ')[1]);

  		fs.readdir(path, (error, files) =>{
  			if(error) return console.error(error);
  			
  			for (var i = 0; i < files.length; i++) {
	  			if((i+1) === index){
	  				if(!playing){
	  					fs.unlinkSync(path + files[i]);
	  					message.channel.sendMessage("Removed " + files[i].split('.')[0]);
	  				} else{
	  					if(files[i] !== queue[0].title + '.mp3'){
	  						fs.unlinkSync(path + files[i]);
	  						message.channel.sendMessage("Removed " + files[i].split('.')[0]);
	  					}
	  				}

	  			}
  			}
  		});
  	}

  	if(isCommand(message.content, 'readd')){
  		if(playing){
  			var newSong = queue[0];
  			queue.push(newSong);
  			message.channel.sendMessage("**Readded to Queue** " + newSong.title);
  		}
  	}

});

bot.login(token);