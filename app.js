require('dotenv').config();
const express = require('express');
const indexRoutes = require('./routes/index');

const app = express();

app.use(express.json());
app.use('/', indexRoutes);

module.exports = app;