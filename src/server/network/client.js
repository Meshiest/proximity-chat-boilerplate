const EventEmitter = require('events');

// manages the peer and websocket client
module.exports = class Client extends EventEmitter {
  constructor(socket, info={}) {
    super();

    this.socket = socket;
    this.id = socket.id;
    this.info = info;
    this.peer = null;

    socket.emit('id', this.id);
    socket.on('disconnect', () => this.emit('disconnect', this));
  }

  // assign this client a peer
  setPeer(peer) {
    this.peer = peer;
    this.emit('connection', this);
  }

  // destroy this client
  destroy() {
    // prevent this from being 'destroyed' twice
    if (this.destroyed) return;

    // disconnect websocket
    this.socket.disconnect();

    // disconnect peer
    if (this.peer && this.peer.disconnect)
      this.peer.disconnect();

    this.destroyed = true;
  }
}