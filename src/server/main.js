const fs = require('fs');
const path = require('path');

const https = require('https');
const express = require('express');
const { ExpressPeerServer } = require('peer');
const { v4: uuidv4 } = require('uuid');

const throttle = require('../util/throttle.js');
const { GAME_SIZE } = require('../constants.js');
const GAME_RADIUS = GAME_SIZE / 2;

// setup ssl
const SSL_CONFIG = {
  cert: fs.readFileSync('./cert.pem'),
  key: fs.readFileSync('./key.pem'),
};

// setup express, socket io, and peerjs
const app = express();
const server = https.createServer(SSL_CONFIG, app);
const io = require('socket.io')(server);
const peerServer = ExpressPeerServer(server, {debug: true});

// use peerjs with express
app.use('/peerjs', peerServer);
app.use('/public', express.static(path.join(__dirname, '/../../public')));

// send index file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/../../public/index.html'));
});

// track which users are connected
const users = [];

const userInfo = u => ({pos: u.pos, avatar: u.avatar, name: u.name});

const emitPos = throttle((x, y) => {
  io.emit('pos', users.map(u => [u.id, u.pos]));
}, 25);

// handle socket connection
io.on('connection', socket => {
  const id = uuidv4();
  const pos = {x: 0, y: 0};
  const user = { id, socket, pos, avatar: 0, name: '' };
  users.push(user);
  console.log('user connected', id);

  // tell user his or her id
  socket.emit('id', id);

  // tell this user about other users
  socket.emit('players', users
    .filter(u => u.id !== id)
    .map(u => [u.id, userInfo(u)])
  );

  // tell the other users to connect to this user
  socket.broadcast.emit('join', id, userInfo(user));

  // handle name changes
  socket.on('name', name => {
    if (typeof name !== 'string' || !name.match(/^[a-z_\d-]{0,10}$/i)) {
      return;
    }

    user.name = name;
    console.log('name is', name);
    io.emit('name', id, name);
  });

  socket.on('pos', (x, y) => {
    // ignore non-number input
    if (typeof x !== 'number' || typeof y !== 'number') return;

    // clamp pos
    x = Math.max(Math.min(GAME_RADIUS, x), -GAME_RADIUS);
    y = Math.max(Math.min(GAME_RADIUS, y), -GAME_RADIUS);
    pos.x = x;
    pos.y = y;

    // emit the position, throttled
    emitPos();
  });

  // user disconnected
  socket.on('disconnect', () => {
    console.log('user disconnected', id);
    // let other users know to disconnect this client
    socket.broadcast.emit('leave', id);

    // remove the user from the users list
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users.splice(index, 1);
    }
  });
});

peerServer.on('connection', peer => {
  console.log('peer connected', peer.id);
});

peerServer.on('disconnect', peer => {
  // disconnect the player if their peer leaves
  const player = users.find(p => p.id === peer.id);
  if (player) {
    player.socket.disconnect();
  }

  console.log('peer disconnected', peer.id);
});

server.listen(3000);
