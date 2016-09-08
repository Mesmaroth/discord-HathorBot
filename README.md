# discord-ApolloBot
Simple music bot for Discord, Written in Node.js.

Library: [Discord.io](https://github.com/izy521/discord.io)

## Installation:

### Windows
  - Install [Node.JS](https://nodejs.org/dist/v4.4.7/node-v4.4.7-x64.msi)
  - Install [Python v2.7.x](https://www.python.org/downloads/)
  - Install [Visual C++ Build Tools](http://landinghub.visualstudio.com/visual-cpp-build-tools) using **Default Install**
  - Install [node-gyp](https://github.com/nodejs/node-gyp) (Open command prompt and enter `npm install -g node-gyp`)
  - Install [FFMPEG static build](https://ffmpeg.zeranoe.com/builds/) to PATH. [Tutorial to install FFMPEG on Windows](http://www.wikihow.com/Install-FFmpeg-on-Windows)
  - Enter bot token or email+pass in `botLogin.js`
  - Run `install_modules.bat`
  - Run `Start_Bot.bat` or `Start_Bot_Loop.bat` if you aren't using another program to handle the bot restarting itself.


## Commands
- `.about`: About this bot
- `.help`: Display bot commands
- `.play [URL]`: Adds and plays the music from the queue
- `.play [local song name or index number]`: Plays songs that were saved locally
- `.play`: Plays the song after a song has been stopped
- `.queue`: View the list of songs in queue
- `.local`: List all songs that are saved locally
- `.stop`: Stop the song
- `.skip` or `.next`: Skip the currently playing song
- `.replay`: Stops and replays the song playing
- `.readd`: Readds the currently playing song back to queue
- `.uptime`: How long this bot has been online for
- `.join [voice channel name]`: Tells the bot to join the voice channel specified
- `.join`: If nothing is specified it will join the first voice channel in the server
- `.notify`: Turns on a "*now playing*" notifcation
- `.volume [number]`: Set the volume anywhere between 1-100. *Only for FFMPEG
