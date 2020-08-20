const $ = document.querySelector.bind(document);
const log = (...args) => logs.innerText += args.join(' ') + '\n';

const socket = io();

import { GAME_SIZE } from '../constants.js';
import throttle from '../util/throttle.js';
import { getVolume2D, SpatialStream } from './audio/spatial-audio.js';
import { playAudioStream, getAudioStream } from './audio/audio.js';
import Client from './network/client.js';
import initCanvas from './canvas/canvas.js';

let myName = '';
const myPos = {x: 0, y: 0};
const lastPos = {x: 0, y: 0};
const cursor = {down: false, x: 0, y: 0};
const players = [];

// mouse and touch events
const mouseUpEvent = e => {
  e.preventDefault();
  cursor.down = false;
};

$('#nameForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = e.target.name.value;
  if (name.match(/^[a-z_\d-]{0,10}$/i)) {
    socket.emit('name', name);
    e.target.name.value = '';
  }
});

$('#canvas').addEventListener('mousedown', e => {
  e.preventDefault();
  cursor.down = true;
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;
});

$('#canvas').addEventListener('mousemove', e => {
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;
})

$('#canvas').addEventListener('mouseup', mouseUpEvent);

$('#canvas').addEventListener('touchstart', e => {
  e.preventDefault();
  cursor.down = true;
  if (e.touches.length === 1) {
    const rect = e.target.getBoundingClientRect();
    cursor.x = e.touches[0].pageX - rect.left;
    cursor.y = e.touches[0].pageY - rect.top;
  }
});

$('#canvas').addEventListener('touchmove', e => {
  if (e.touches.length === 1) {
    const rect = e.target.getBoundingClientRect();
    cursor.x = e.touches[0].pageX - rect.left;
    cursor.y = e.touches[0].pageY - rect.top;
  }
})

$('#canvas').addEventListener('touchend', mouseUpEvent);
$('#canvas').addEventListener('touchcancel', mouseUpEvent);

// emit my position, throttled
const sendPos = throttle((x, y) => socket.emit('pos', x, y), 25);
function emitPos() {
  if (lastPos.x !== myPos.x && lastPos.y !== myPos.y) {
    sendPos(myPos.x, myPos.y);
    lastPos.x = myPos.x;
    lastPos.y = myPos.y;
  }
}

// render the canvas
initCanvas().then(render => render((ctx, {sheet, delta, now}) => {

  // where player should try to move to (cursor if mouse/touch is down)
  const goalX = !cursor.down ? myPos.x : (cursor.x - GAME_SIZE/2);
  const goalY = !cursor.down ? myPos.y : (cursor.y - GAME_SIZE/2);

  // move player towards cursor
  if (Math.hypot(goalX - myPos.x, goalY - myPos.y) > 1) {
    const theta = Math.atan2(goalY - myPos.y, goalX - myPos.x);
    myPos.x += Math.cos(theta) * 128 * delta;
    myPos.y += Math.sin(theta) * 128 * delta;
  } else {
    myPos.x = Math.round(myPos.x);
    myPos.y = Math.round(myPos.y);
  }

  // update position with server
  emitPos();

  // name font style
  ctx.font = '10px monospace';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  // render my player
  sheet(25, 0)(ctx, {x: myPos.x, y: myPos.y});
  ctx.fillText(myName, myPos.x, myPos.y + 20);

  // render cursor
  if (cursor.down)
    sheet(20, 14)(ctx, {x: goalX, y: goalY});

  if (!client) {
    ctx.fillText('...connecting to network', 0, 0);
    return;
  }

  // render other players
  for (const p of client.peers) {
    const { goal, pos, name } = p.info;

    // smoothly interpolate player position towards the goal position
    pos.x += (goal.x - pos.x) * 5 * delta;
    pos.y += (goal.y - pos.y) * 5 * delta;

    // render the player
    sheet(25, 0)(ctx, {
      x: pos.x,
      y: pos.y,
    });
    ctx.fillText(name, pos.x, pos.y + 20);

    // error messages
    if (!p.hasConnection()) {
      ctx.fillText('[no connection]', pos.x, pos.y + 30);
    } else if (!p.isConnected()) {
      ctx.fillText('[no stream]', pos.x, pos.y + 30);
    }

    if (p.isConnected() && p.info.stream) {
      // set spatial stream audio
      const [left, right] = getVolume2D(myPos, pos);
      p.info.stream.setVolume(left, right);

      // render the volumes per for both channels
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.strokeStyle = '#00f';
      ctx.moveTo(pos.x - 10, pos.y);
      ctx.lineTo(pos.x - 10,pos.y - 20 * left);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = '#f00';
      ctx.moveTo(pos.x + 10, pos.y);
      ctx.lineTo(pos.x + 10,pos.y - 20 * right);
      ctx.stroke();
    }
  }
}));

let client;

// setup peer when user receives id
socket.on('id', async id => {

  // destroy the client if it already exists
  if (client) {
    log('destroying old identity', client.id, 'and replacing with', id);
    client.destroy();
    client = undefined;
  }

  // create a new client
  client = new Client(id);
  client.init();

  // turn client streams into spatial
  client.onStream = ([peer, stream]) => {
    peer.info.stream = new SpatialStream(stream, {left: 1, right: 1});
    const elem = playAudioStream(stream, peer.id);
    peer.info.elem = elem;
    $('.audiostream-container').appendChild(elem);
    log('created stream for', peer.id);
  };

  // submit client name when peer server connects
  client.onConnect = () => {
    client.connected = true;
    if (localStorage.proximityName) {
      socket.emit('name', localStorage.proximityName);
      localStorage.proximityName = '';
    }
  }
  // run when peer is destroyed
  client.onPeerDestroy = peer => {
    const elem = $(`[data-peer="${peer.id}"]`);
    if (elem) elem.remove();

    if (peer.info.stream) {
      peer.info.stream.destroy();
    }
  };
});

// talk to any user who joins
socket.on('join', (id, info) => {
  log('calling', id);

  // add the peer to the network
  const peer = client.addPeer(id, info);

  // update info
  peer.info.goal = {...info.pos};

  // call the peer
  peer.startCall()
    .then(client.onStream);
});

// add existing players
socket.on('players', players => {
  for (const [id, info] of players) {
    if (id == client.id) continue;
    const peer = client.addPeer(id, info);
    peer.info.goal = {...info.pos};
  }
});

// set player positions
socket.on('pos', arr => {
  for (const [id, goal] of arr) {
    const peer = client.getPeer(id);
    if (peer)
      Object.assign(peer.info, { goal });
  }
});

// set player name
socket.on('name', (id, name) => {
  if (id === client.id) {
    myName = name;
    localStorage.proximityName = name;
    return;
  }

  const peer = client.getPeer(id);
  peer.info.name = name;
});

socket.on('leave', id => {
  log('call dropped from', id);

  // remove the peer from the client
  client.removePeer(id);
});
