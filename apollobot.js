const Discord = require('discord.js');
const fs = require('fs');
const ytdl = require('ytdl-core');
const bot = new Discord.Client();
const token = require('./config/botLogin.js').token;

// command initializer
const CMDINIT = '.';
const localPath = './local/';

var adminRole = "admin";		// This can be changed to what ever 

try{
	var botVersion = require('./package.json').version;
}catch(error) {
	if(error) console.error(error);
	botVersion = "#?";
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
		console.log(roles[role].name);
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
}

// Attempt to join the very first voice Channel each time the client is started
function joinFirstVC(){
	var guilds = bot.guilds.array();
	for(var guild = 0; guild < guilds.length; guild++){
		var channels = guilds[guild].channels.array();
		for(var channel = 0; channel < channels.length; channel++){
			if(channels[channel].type === 'voice'){
				var VCS = bot.voiceConnections.array();
				VCS.forEach( (vc) => {
					if(vc === channels[channel])
						return;
				});
				channels[channel].join();
				break;
			}
		}
	}
}

bot.on('ready', () => {
	console.log("ApolloBot V" + botVersion)
	console.log(bot.user.username + " (" + bot.user.id + ")");
	console.log();

	joinFirstVC();

	// display servers
	var guilds = [];
	bot.guilds.array().forEach( (guild) =>{
		guilds.push(guild.name);
	});
	console.log("Servers:");
	console.log(guilds.join("\n"));	
	console.log();
});

bot.on('disconnect', (event) =>{
	console.log("Exited with code: " + event.code);
	if(event.reason) 
		console.log("Reason: " + event.reason);
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

});

bot.login(token);