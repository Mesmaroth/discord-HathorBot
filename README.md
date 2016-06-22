# discord-ApolloBot
Music bot for Discord, Written in Node.js.

Library: [Discord.io](https://github.com/izy521/discord.io)

Prerequisite: 
	- Have Visual Studio Community 2015 and make sure C++ version is installed. [Visual Studio](https://www.visualstudio.com/)
	- Have Python 2.7 installed: [Python 2.7](https://www.python.org/download/releases/2.7/)
	- Having a bot account, create one at [Discord](https://discordapp.com/developers/applications/me)

## Installation
Absoulute beginners guide:
 - Install [Node.js](https://nodejs.org/en/) (preffered LTS)
 - Install node-gyp, type `npm install node-gyp` in your command prompt. [Node-gyp Docs](https://www.npmjs.com/package/node-gyp)
 - `cd` to your project folder in command promt and type `npm install`. The required modules will then be downloaded and saved.
 - Enter your bot token in the `botLogin.json` file
 - Double click `start.bat` to start
 - To invite your bot to your server replace "CLIENT-ID" with your client ID from the [applications page](https://discordapp.com/developers/applications/me) `https://discordapp.com/oauth2/authorize?client_id=CLIENT-ID&scope=bot&permissions=0`


## Commands
- `.play [URL]`: Adds and plays the music from the queue
- `.play`: Plays the song after a song has been stopped
- `.stop`: Stop the song
- `.skip`: Skip the currently playing song
- `.replay`: Stops and replays the song
- `.readd`: Re-Add the currently playing song back to queue
- `.about`: About this bot
- `.queue`: View the list of songs in queue
- `.reboot`: Reboot the bot if something is wrong
- `.uptime`: How long this bot has been online for
- `.join`: If the bot is disconnected from voice server
