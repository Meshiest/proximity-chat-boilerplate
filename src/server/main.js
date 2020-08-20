const fs = require('fs');
const path = require('path');

const https = require('https');
const express = require('express');
const { ExpressPeerServer } = require('peer');

const throttle = require('../util/throttle.js');
const { GAME_SIZE } = require('../constants.js');

const Server = require('./network/server.js');

const GAME_RADIUS = GAME_SIZE / 2;

// setup ssl
const SSL_CONFIG = {
  cert: fs.readFileSync('./cert.pem'),
  key: fs.readFileSync('./key.pem'),
};

// setup express, socket io, and peerjs
const app = express();
const httpServer = https.createServer(SSL_CONFIG, app);
const io = require('socket.io')(httpServer);
const peerServer = ExpressPeerServer(httpServer, {debug: true});

// use peerjs with express
app.use('/peerjs', peerServer);
app.use('/public', express.static(path.join(__dirname, '/../../public')));

// send index file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/../../public/index.html'));
});

// create the peer/socket server
const server = new Server(io, peerServer);
server.getDefaultInfo = () => ({pos: {x: 0, y: 0}, avatar: 0, name: ''});

const userInfo = u => ({pos: u.pos, avatar: u.avatar, name: u.name});
const emitPos = throttle((x, y) => {
  io.volatile.emit('pos', server.clients.map(c => [c.id, c.info.pos]));
}, 25);

server.on('connect', client => {
  console.log('connection', client.id);
  // tell this user about other users
  client.socket.emit('players', server.clients.map(c => [c.id, userInfo(c.info)]));

  // tell the other users to connect to this user
  client.socket.broadcast.emit('join', client.id, userInfo(client.info));

  // handle name changes
  client.socket.on('name', name => {
    if (typeof name !== 'string' || !name.match(/^[a-z_\d-]{0,10}$/i)) {
      return;
    }

    client.info.name = name;
    console.log(client.id, 'name is', name);
    io.emit('name', client.id, name);
  });

  client.socket.on('pos', (x, y) => {
    // ignore non-number input
    if (typeof x !== 'number' || typeof y !== 'number') return;

    // clamp pos
    x = Math.max(Math.min(GAME_RADIUS, x), -GAME_RADIUS);
    y = Math.max(Math.min(GAME_RADIUS, y), -GAME_RADIUS);

    // update client position
    client.info.pos.x = x;
    client.info.pos.y = y;

    // emit the position, throttled
    emitPos();
  });

});

server.on('disconnect', client => {
  console.log('disconnect', client.id);
  client.socket.broadcast.emit('leave', client.id);
});


httpServer.listen(3000);
