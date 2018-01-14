// The bot only requires a token if you have a bot account
// You can get a bot token at https://discordapp.com/developers/applications/me

// Youtube API is needed to use the search features
// otherwise you will keep getting bad request

// Owner id is required to use the admin commands
// you can get this id if you have developer options enabled
// in discord. Then just right click your username and copy id

// **WARNING** If you do not add a Owner ID or have a group that is in the "preference.json" file
// Then no one will be able to use the admin commands

module.exports = {
	token: "TOKEN_KEY",
	youtubeAPI: "YOUTUBE_API_KEY",
	owner_id: "OWNER_ID"
}
