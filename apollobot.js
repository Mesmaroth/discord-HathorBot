const Discord = require('discord.js');
const fs = require('fs');
const ytdl = require('ytdl-core');
const bot = new Discord.Client();
const token = require('./config/botLogin.js').token;

// command initializer
const CMDINIT = '-';
const localPath = './local/';

var adminRole = "admin";		// This can be changed to what ever 

var defaultChannels = [{}];
var defualtChannelsPath = './config/default_channels.json';

try{
	var botVersion = require('./package.json').version;
}catch(error) {
	if(error) console.error(error);
	var botVersion = "#?";
}


function checkDefaultChannels(){
	if(fs.existsSync(defualtChannelsPath)){
		try {
			defaultChannels = require(defualtChannelsPath);
		} catch(error){
			console.log("ERROR: reading file:\n" +  error.message);
			fs.rename(defualtChannelsPath, './config/default_channels_ERROR.json', () =>{
				fs.writeFile(fdefualtChannelsPath, JSON.stringify(defaultChannels, null, '\t'), error =>{
					if(error) return console.error(error);
					console.log("\nRESPONSE: Renamed config file with error and created new config file. Please revise and replace!\n");
				});
			});
		}
	} else{
		defaultChannels = [{}];
		fs.writeFile('./config/default_channels.json', JSON.stringify(defaultChannels, null, '\t'), error =>{
			if(error) return console.error(error);
			console.log("Default channel config file created");
		});
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
	console.log("DISCORD: Game set to " + game);
}


function joinDefaultChannels(){
	var botGuilds = bot.guilds.array();
		botGuilds.forEach( guild => {
			for(var i = 0; i < defaultChannels.length; i++){
				if(guild.id === defaultChannels[i].guildID){
					var voiceChannel = guild.channels.filterArray( channel =>{
						return channel.id === defaultChannels[i].voiceID;
					})[0];

					voiceChannel.join();
					console.log("DISCORD: Joined voice channel: " + defaultChannels[i].name + " at [" + defaultChannels[i].guild + "]");
				}
			}
		});
}


bot.on('ready', () => {
	console.log("ApolloBot V" + botVersion)
	console.log(bot.user.username + " (" + bot.user.id + ")");

	// display servers
	var guilds = [];
	bot.guilds.array().forEach( (guild) =>{
		guilds.push(guild.name);
	});
	console.log("Servers:");
	console.log(guilds.join("\n"));	
	console.log();

	checkDefaultChannels();
	joinDefaultChannels();
});

bot.on('disconnect', (event) =>{
	console.log("Exited with code: " + event.code);
	if(event.reason) 
		console.log("Reason: " + event.reason);
	process.exit(0);
});

bot.on('message', message => {
	// Admin commands
  	if(isCommand(message.content, 'exit')){
  		// Disconnect from voice channels first
  		if(!isDev(message)) return;
  		var connections = bot.voiceConnections.array();
			connections.forEach( (connection) =>{
			connection.disconnect();
		});
  		bot.destroy();
  	}
  	// ----

  	if(isCommand(message.content, 'invite')){
  		bot.generateInvite([ 
  			"CONNECT", "SPEAK", "READ_MESSAGES", "SEND_MESSAGES", "SEND_TTS_MESSAGES",
  			"ATTACH_FILES", "USE_VAD"
  		]).then( link => {
  			message.channel.sendMessage("**Invite:** "  + link);
  		});
  	}

  	if(isCommand(message.content, 'setvc')){
  		if(message.content.indexOf(" ") !== -1){
  			var voiceChannelName = message.content.split(" ")[1];

  			var guild = message.member.guild;
  			var channel = getChannelByString(guild, voiceChannelName);

  			function writeOutChannels(){
  				fs.writeFile(defualtChannelsPath, JSON.stringify(defaultChannels, null, '\t'), () =>{
		  			message.channel.sendMessage("Server default voice channel set to " + voiceChannelName);
		  		});
  			}

  			if(channel){
  				
  				for(var i = 0; i < defaultChannels.length; i++){
  					if(guild.id === defaultChannels[i].guildID){
  						defaultChannels[i].voiceID = channel.id;
  						defaultChannels[i].name = voiceChannelName;
  						writeOutChannels();
		  				return;
  					}
  				}

  				// Create a default voice channel if there are none.
  				defaultChannels.push({
					name: voiceChannelName,
					guild: guild.name,
					voiceID: channel.id,
					guildID: guild.id
				});
				writeOutChannels();
  			} else{
  				message.channel.sendMessage("No voice channel found");
  			}
  		}
  	}

  	if(isCommand(message.content, 'join')){
  		var userVoiceChannel = message.member.voiceChannel;
  		if(userVoiceChannel) 
  			userVoiceChannel.join();
  		else
  			message.channel.sendMessage("You are not in a voice channel.");
  	}

});

bot.login(token);