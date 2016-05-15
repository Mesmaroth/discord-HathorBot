var DiscordClient = require('discord.io');
var botLogin = require('./botLogin.json');
var fs = require('fs');
var ytdl = require('ytdl-core');
var bot = new DiscordClient({token: botLogin.token, autorun: true})
var reboot = false;
var queue = [];
var playing = false;
var streamer;
var replay = false;

function setGame(game) {
	bot.setPresence({game: game});
}

function getTitleVideoID(url, callback){
	
		ytdl.getInfo(url, function (error, data) {
			if(error) return error;
			video_id = data.video_id;
			title = data.title;
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

	setTimeout(function(){
		callback();
	}, 2500);	
}

function isInVC(channelID){
	var serverID = bot.serverFromChannel(channelID);
	if(bot.servers[serverID].members[bot.id].hasOwnProperty('voice_channel_id')){
		if(bot.servers[serverID].members[bot.id].voice_channel_id !== null) return true;
	}

	return false;
}

function playSong(voiceID, stream){
	stream.playAudioFile(queue[0].file);
	playing = true;
	setGame(queue[0].title);
	stream.once('fileEnd', function() {
		//if(!replay){
			setTimeout(fs.unlinkSync, 500, queue[0].file);
			queue.shift();
		//}
		replay = false;					
		if(queue.length === 0) {
			playing = false;
			console.log("End of Queued songs")
			setGame(null);	
			return;
		}		
		setTimeout(playSong, 100, voiceID, stream);		
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
});

bot.on('ready', function (rawEvent) {
	console.log("\nDiscord.io - Version: " + bot.internals.version);
    console.log("Username: "+bot.username + " - (" + bot.id + ")");
    setGame("[Alpha Build]");
    console.log('\n');


    var voiceID = getVoiceID("102910652766519296");
    bot.joinVoiceChannel(voiceID, function(){
		bot.getAudioContext({channel: voiceID, stero: true}, function(stream){
			streamer = stream;
		});	
	});

});

bot.on('message', function (user, userID, channelID, message, rawEvent){

	if(message.toLowerCase() === ".about"){
		bot.sendMessage({
			to: channelID,
			message: "**Username**: "+bot.username+"\n**Author**: Mesmaroth\n**Written in**: Node.js\n**Library**: Discord.io\n**Library Version**: "+bot.internals.version+
			"\n**Avatar**: https://goo.gl/LN6BvU"+"\n\n**Why**: This bot was created to replace the current shit musicbot that I got sick and tired of, a shitty bot written by shitty people."+
			" So I've decided to write this bot from the ground up."

		});
	}

	if(message.toLowerCase() === ".music" || message === ".help"){
		bot.sendMessage({
			to: channelID,
			message: '\n**Music**\n•`.play [URL]`: Adds and plays the music from the queue\n•`.skip`: Skip song\n•`.about`: About this bot\n'+
			'•`.queue`: View the list of songs in queue\n•`.reboot`: Reboot the bot if something is wrong\n'
		});
	}

	if(message.toLowerCase() === ".disconnect"){
		var voiceID = getVoiceID(channelID);
		if(playing){
			streamer.stopAudioFile();
		}
		bot.leaveVoiceChannel(voiceID);
		bot.disconnect();
	}

	if(message.toLowerCase() === ".reboot"){
		var voiceID = getVoiceID(channelID);
		reboot = true;
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
				message: "*Already joined the voice channel.*"
			});
		}		
	}

	if(message.toLowerCase() === ".skip"){
		if(isInVC(channelID)){
			if(playing){
				streamer.stopAudioFile();
				playing = false;
				setGame(null);
				setTimeout(fs.unlinkSync, 1000, queue[0].file);		
				queue.shift();
				if(queue.length > 0){
					setTimeout(function(){						
						var voiceID = getVoiceID(channelID);
						setTimeout(playSong, 500, voiceID, streamer);
						bot.sendMessage({
							to: channelID,
							message: "Now playing *" + queue[0].title +"*"
						});						
					}, 1000);
				}
				else{
					bot.sendMessage({
						to: channelID,
						message: "*No more songs left in the queue.*"
						});
				}					
			}
		}
	}

	if(message.toLowerCase() === ".stop"){
		if(isInVC(channelID)){
			if(playing){
				streamer.stopAudioFile();
				playing = false;
			}
		}
	}

	/*
	if(message.toLowerCase() === ".replay"){			// Needs re-work
		if(isInVC(channelID)){
			if(playing){
				streamer.stopAudioFile();
				playing = false;
				replay = true;
				var voiceID = getVoiceID(channelID); 
				setTimeout(playSong, 500, voiceID, streamer);
				bot.sendMessage({
					to: channelID,
					message: "Replaying *"+queue[0].title+"*"
				});
			}
		}
	}
	*/

	if(message.toLowerCase() === ".queue"){
		var songList = [];
		for(var i = 0; i < queue.length; i++){
			songList.push(queue[i].title);
		}

		for(var i = 0; i < songList.length; i++){
			if(i === 0) songList[i] = "**Music**\n**Currently Playing**: *" + songList[i]+ "*\n";
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
				message: "No songs are currently playing and/or queued"
			});
		}
	}

	if(message.toLowerCase().search(".play") === 0){
		if(message.search(' ') !== -1){
			var message = message.split(' ');
			var url = message[1];
			try {
				getTitleVideoID(url, function(title, video_id){
					for(var i = 0; i < queue.length; i++){
						if(queue[i].video_id === video_id){
							video_id = Math.floor(Math.random()*1000)+video_id;
						}
					}

					bot.sendMessage({
						to: channelID,
						message: "*"+title+"*  has been added to queue."
					});

					addSong(url, title, video_id, user, function(){
						if(playing === false){
							var voiceID = getVoiceID(channelID);
							playSong(voiceID, streamer);
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
						message: "Now Playing *"+queue[0].title+"*"
					});
					var voiceID = getVoiceID(channelID);
					playSong(voiceID, streamer);
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










