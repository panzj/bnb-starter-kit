const async         = require('async')
const bodyParser    = require('body-parser')
const compress      = require('compression')
const fs            = require('fs')
const cookieParser  = require('cookie-parser')
const cors          = require('cors')
const nodemailer    = require('nodemailer')
const express       = require('express')
const http          = require('http')
const path          = require('path')
const mongoose      = require('mongoose')
const { Geocoder }  = require('./lib')
const debug         = require('debug')('app:main')
const mongoSanitize = require('express-mongo-sanitize')

const { handleEnd }      = require('./middleware')
const log                = require('./lib/log')()
const pckg               = require('../package.json')
const config             = require('./config')
const { jobs, CronTask } = require('./lib')

const { mongoUri } = require('./lib/utils')

const __apibase__     = `/api/v${config.apiVersion}`
const __authbase__    = `/auth/v${config.authVersion}`
const { corsOptions } = config
const { reaper }      = jobs
const app             = express()
const logsPath        = path.join(__dirname, '../logs')

const {
	REACT_APP_API_HOST,
	REACT_APP_API_PORT,
	NODE_ENV,
	SEED
} = process.env

if(!fs.existsSync(logsPath)) fs.mkdir(logsPath)

process.on('unhandledRejection', (error, promise) => {
	log.error('Unhandled Rejection: \nPromise:', promise, '\Error:', error)

	// TODO Do we need to resolve the promise? Are we handling it by `catching` it here?
	// promise.resolve is not a function!
	// promise.resolve()
})

mongoose.Promise = global.Promise

log.info(`Registering Mongoose models`)
require('./models')

app.set('mongoUri', mongoUri)

app.set('Geocoder', Geocoder)

app.set('mailTransporter', nodemailer.createTransport({
		host: process.env.EMAIL_HOST,
		port: process.env.EMAIL_PORT,
		secure: true, // secure:true for port 465, secure:false for port 587
		auth: {
				user: process.env.EMAIL_ADDRESS,
				pass: process.env.EMAIL_PASS
		}
	})
)

app.disable('x-powered-by')

app.use(cors(corsOptions))
	.use(bodyParser.json())
	.use(bodyParser.urlencoded({ extended: false }))
	.use(cookieParser(config.cookieSecret))
	.use(mongoSanitize())
	.use(compress())
	.use(__apibase__, require('./routes/api'))
	.use(__authbase__, require('./routes/auth'))
	.use(handleEnd)

// TODO Do we need this?
// app.use(express.static(project.paths.public()))
// Serve static assets from ~/public since Webpack is unaware of
// these files. This middleware doesn't need to be enabled outside
// of development since this directory will be copied into ~/dist
// when the application is compiled.

app.use((error, req, res, next) => {

	debug('Error middleware recieved error:', error)

	res.status(error.status || 500)
		.json({
			message: error.message,
			code:    error.status || 500,
			name:    error.name || error.status || 500,
			version: pckg.version
		})
})

// TODO rewrite this flow using async
const server = http.createServer(app)

async.series([
	(cb) => {
		log.info('Connecting Mongoose to: ', mongoUri)
		mongoose.connect(mongoUri, cb)
	},

	(cb) => {

		server.on('listening', () => {
			log.info(`Server is running:`)
			log.info(`API running on:  http://${REACT_APP_API_HOST}:${REACT_APP_API_PORT}${__apibase__}`)
			log.info(`AUTH running on: http://${REACT_APP_API_HOST}:${REACT_APP_API_PORT}${__authbase__}`)
		})

		server.on('error', (error) => log.error('Server error', error))

		server.listen(REACT_APP_API_PORT, REACT_APP_API_HOST, cb)
	},

	(cb) => {
		new CronTask('Reaper', config.reaperInterval, reaper).start(cb)
	},

], (error) => { if(error) throw error })
