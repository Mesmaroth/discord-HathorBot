# discord-HathorBot
User-friendly and easy to use music bot for your discord server.

Library: [Discord.js](https://discord.js.org)

## Installation:

### Windows
  - Install [Node.JS](https://nodejs.org/en/) 6.0 or greater
  - Install [Python v2.7.x](https://www.python.org/downloads/)
  - Install [Visual C++ Build Tools](http://landinghub.visualstudio.com/visual-cpp-build-tools) using **Default Install**
  - Install [node-gyp](https://github.com/nodejs/node-gyp) (Open command prompt and enter `npm install -g node-gyp`)
  - Install [FFMPEG static build](https://ffmpeg.zeranoe.com/builds/) to PATH. [Tutorial to install FFMPEG on Windows](http://www.wikihow.com/Install-FFmpeg-on-Windows)
  - Enter bot token in `botLogin.js`
  - Run `npm install` to install required modules for this bot
  - Run `Start_Bot.bat` or `Start_Bot_Loop.bat` if you aren't using another program to handle the bot restarting itself.


## Commands:

### Admin Commands
  - `setusername [NAME]`: Sets the username of bot
  - `setavatar [URL]`: Sets the avatar of the bot
  - `exit`: disconnects bot from discord

### General
  - `invite`: Get invite link for your bot
  - `setvc`: set the default voice channel this bot joins when ever the bot connects
  - `join`: Bot joins your voice channel

### Music
  - `queue` or `playing`: To view all songs in queue
  - `play [YT_URL]`: Plays a song from a youtube link
  - `play [index_number]` : Plays a song from a file that has been saved to the bot
  - `play`: Plays song in queue if it has been stopped
  - `local`: Displays all the songs saved by the bot
  - `stop`: Stops the song from playing
  - `skip`: To skip the currently playing song
  - `replay`: Stops and replays song from the start
  - `remove [index_number]`: Removes a specific song from queue
  - `save [YT_URL]`: Saves a song from youtube and stores it
  - `save`: Saves current song that's playing
  - `remlocal [index_number]`: Removes a song that has been saved locally
  - `readd`: Re-adds the currently playing song at the bottom of the queue