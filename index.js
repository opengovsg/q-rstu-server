const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const express = require('express')

const app = express()

app.set('view engine', 'ejs')

app.use(bodyParser.json())
app.use(cookieParser())

app.use('/assets', express.static('assets'))

app.use('/', require('./lib/routes'))

app.listen(process.env.PORT)
