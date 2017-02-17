const colors = require('colors')
const feedparser = require('feedparser-promised')
const fs = require('fs')
const parseArgs = require('minimist')
const ProgressBar = require('progress')
const request = require('request')
const requestProgress = require('request-progress')

const feedUrl = "http://musicforprogramming.net/rss.php"
const tracksLocation = "/home/benaiah/Music/mfp/"

const args = parseArgs(process.argv.slice(2))

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



//
// displaying
//

const displayTitle = title => {
  const split = title.split(":").map(part => part.trim())
  const index = split[0].match(/Episode (.*)/)[1]

  return "[" + index + "] " + split[1];
}

const displayItem = item =>
   displayTitle(item.title)



//
// commands
//

const commands = {
  help: () => console.log(`
${"m".green}${"f".blue}${"p".red}: a scraper for ${"http://musicforprogramming.net".yellow}

Commands         Args   Description
list, l          -      (default) list all episodes
h, help          -      show this help text
dl, download     NUM    download episode NUM
path, p          NUM    get path of episode NUM ("mpg123 $(mfp p 20)" would play ep. 20)
`),

  list: () =>
    getTracksReversed()
    .then(items => items.map(displayItem))
    .then(lines => lines.forEach(line => console.log(line)))
    .catch(err => console.err(err)),

  download: index =>
    getTracks()
    .then(tracks => tracks[tracks.length - index])
    .then(track => {
      const path = tracksLocation + getFilename(track.url)
      const bar = new ProgressBar(':bar', { total: 100 })

      console.log(`Downloading `)

      requestProgress(request.get(track.url))
        .on('progress', state => {
          bar.update(state.percent)
        })
        .pipe(fs.createWriteStream(path))
    })
    .catch(err => console.log(err)),

  path: index =>
    getTracks()
    .then(tracks => tracks[tracks.length - index])
    .then(track => console.log(tracksLocation + getFilename(track.url)))
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
case "p":
  index = args._[1]
  commands.path(index)
  break;

default:
  console.error(`Command ${args._[0]} not found.`)
}
