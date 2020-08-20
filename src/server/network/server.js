const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

const Client = require('./client.js');

// manage peer and socket io clients
module.exports = class Server extends EventEmitter {
  constructor(io, peer) {
    super();

    this.io = io;
    this.peer = peer;

    // socket ids are uuid based
    io.engine.generateId = req => uuidv4();

    // list of clients
    this.clients = [];

    // default info that a client has
    this.defaultInfo = {};

    io.on('connection', this.onSocketConnect.bind(this));
    peer.on('connection', this.onPeerConnect.bind(this));
    peer.on('disconnect', this.onPeerDisconnect.bind(this));
  }

  // overwrite - default info of clients
  getDefaultInfo() { return {}; }

  // return ther client with this id
  getClient(id) {
    return this.clients.find(c => c.id === id);
  }

  // remove a client with this id
  removeClient(id) {
     // find the respective client
    const index = this.clients.findIndex(c => c.id === id);
    if (index === -1) return;

    // find the client and destroy it
    const [ client ] = this.clients.splice(index, 1);
    client.destroy();
    this.emit('disconnect', client);
  }

  // handle a new client connecting
  onSocketConnect(socket) {
    // create the client
    const client = new Client(socket, this.getDefaultInfo());

    client.on('disconnect', this.onSocketDisconnect.bind(this));

    // add it to the list
    this.clients.push(client);
  }

  // handle a client disconnecting
  onSocketDisconnect(client) {
    this.removeClient(client.id);
  }

  // handle a new peerjs peer connecting
  onPeerConnect(peer) {
    const client = this.getClient(peer.id);

    // ignore peers that do not have a socket.io connection
    if (!client) {
      peer.disconnect();
      return;
    }

    client.setPeer(peer);
    this.emit('connect', client);
  }

  // handle a new peerjs peer disconnecting
  onPeerDisconnect(peer) {
    this.removeClient(peer.id);
  }
}