const colors = require('colors')
const feedparser = require('feedparser-promised')
const fs = require('fs')
const parseArgs = require('minimist')
const Player = require('player')
const ProgressBar = require('progress')
const request = require('request')
const requestProgress = require('request-progress')

const logErr = err => console.error(colors.red(err))

const args = parseArgs(process.argv.slice(2))

const feedUrl = "https://musicforprogramming.net/rss.php"
const tracksPath = (() => {
  if (args.tracksPath) {
    return args.tracksPath
  }
  else if (process.env.MFP_DOWNLOAD_PATH) {
    return process.env.MFP_DOWNLOAD_PATH
  } else if (process.env.HOME) {
    return process.env.HOME + "/.mfp/"
  } else {
    return ""
  }
})()

if (tracksPath === "") {
  logErr("Neither HOME nor MFP_TRACKS_PATH is set, cannot guess a"
         + " path to download tracks to.")
}

// ensure the download folder exists
if (!fs.existsSync(tracksPath)) {
  fs.mkdirSync(tracksPath, 0744)
}



//
// retrieving info
//

const getTracks = () =>
   feedparser.parse(feedUrl)
   .then(items => items.map(item => {
     return { title: item.title, url: item.guid }
   }))

const getTracksReversed = () =>
   getTracks()
   .then(items => items.reverse())



//
// filenames
//

const getFilename = url => url.split("/").pop();

const getTrackPath = track => tracksPath + getFilename(track.url)

const isTrackDownloaded = track => fs.existsSync(getTrackPath(track))



//
// displaying
//

const displayTitle = title => {
  const split = title.split(":").map(part => part.trim())
  const index = split[0].match(/Episode (.*)/)[1]

  return "[" + index + "] " + split[1];
}

const displayTrack = track => {
  if (isTrackDownloaded(track)) {
    return displayTitle(track.title).green
  } else {
    return displayTitle(track.title).red
  }
}



//
// commands
//

const interactivelyDownload = track => {
  const path = tracksPath + getFilename(track.url)
  const bar = new ProgressBar(':bar', { total: 100 })

  if (isTrackDownloaded(track)) {
    console.log(`Removing old file at ${path}`)
    fs.unlinkSync(getTrackPath(track))
  }

  console.log(`Downloading track to ${path}`)
  return new Promise((resolve, reject) => {
    requestProgress(request.get(track.url))
      .on('progress', state => {
        bar.update(state.percent)
      })
      .pipe(fs.createWriteStream(path))
      .on('close', () => {
        console.log("")
        resolve(track)
      })
  })
}

const commands = {
  help: () => console.log(`\
${"m".green}${"f".blue}${"p".red}: a scraper for ${"http://musicforprogramming.net".yellow}

Flags
--tracks-path     set a path to download tracks to (will be created if
                  it doesn't exist). can also be set with MFP_TRACKS_PATH.
                  Defaults to "$HOME/.mfp/" if not set.

Commands          Args   Description
list, l           -      (default) list all episodes
  --reverse, -r   -      list reversed

h, help           -      show this help text
dl, download      NUM    download episode NUM
path              NUM    get path of episode NUM ("mpg123 $(mfp p 20)" would play ep. 20)
play, p           NUM    play episode NUM (plays downloaded file if present, streams otherwise)\
  --save, s       NUM    play episode NUM (always downloads if file not present)
`),

  list: () => ((args.r || args.reverse) ? getTracks() : getTracksReversed())
    .then(items => items.map(displayTrack))
    .then(lines => lines.forEach(line => console.log(line)))
    .catch(err => console.error(err)),

  download: index => getTracks()
    .then(tracks => tracks[tracks.length - index])
    .then(interactivelyDownload)
    .catch(err => console.error(err)),

  path: index => getTracks()
    .then(tracks => tracks[tracks.length - index])
    .then(track => console.log(tracksPath + getFilename(track.url)))
    .catch(err => console.error(err)),

  play: index => {
    getTracks()
      .then(tracks => tracks[tracks.length - index])
      .then(track => (!isTrackDownloaded(track) && (args.save || args.s))
         ? interactivelyDownload(track)
         : track)
      .then(track => {
        if (isTrackDownloaded(track)) {
          const player = new Player(getTrackPath(track))
          console.log(`Playing ${getTrackPath(track)}...`)
          player.play()
        } else {
          const player = new Player(track.url)
          console.log(`Streaming ${track.url}`)
          player.play()
        }
      })
      .catch(err => console.error(err))
  }
}

// subcommands
let index = 0
switch (args._[0]) {
case undefined:
case "list":
case "l":
  commands.list()
  break;

case "help":
case "h":
  commands.help()
  break;

case "download":
case "dl":
  index = args._[1]
  commands.download(index)
  break;

case "path":
  index = args._[1]
  commands.path(index)
  break;

case "play":
case "p":
  index = args._[1] ? args._[1] : (args.s || args.save)
  commands.play(index)
  break;

default:
  console.error(`Command ${args._[0]} not found.`)
}
