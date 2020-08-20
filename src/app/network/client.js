import NetworkPeer from './peer.js';

// p2p network client, keeps other peers connected and synchronized
export default class Client {
  constructor(id) {
    this.id = id;

    // list of peers this client should be talking to
    this.peers = [];

    // this client's peer and connection status
    this.peer = null;
    this.connected = false;
  }

  // setup the peer and listeners
  init() {
    this.peer = new Peer(this.id, {host: location.hostname, port: location.port, path: '/peerjs'});
    this.peer.on('open', () => this.onConnect());
    this.peer.on('disconnected', this.onDisconnect.bind(this));
    this.peer.on('close', this.onDisconnect.bind(this));
    this.peer.on('error', this.onError.bind(this));
    this.peer.on('call', this.onCall.bind(this));
  }

  // add a new peer id to the network
  addPeer(id, info={}) {
    let peer = this.getPeer(id);

    // check if this peer was already added
    if (peer) return peer;

    // create a new peer
    peer = new NetworkPeer(this.peer, id, info);
    this.peers.push(peer);

    return peer;
  }

  // get a peer by id
  getPeer(id) {
    return this.peers.find(p => p.id === id);
  }

  // remove a peer from the peer list
  removePeer(id) {
    const index = this.peers.findIndex(p => p.id === id);
    // make sure the peer is in the list of peers
    if (index > -1) {
      // remove the peer
      const [peer] = this.peers.splice(index, 1);
      // destroy it
      peer.destroy();
      return peer;
    }
  }

  // automatically call all peers who are not connected
  // TODO: add interval to run this periodically
  autoDial() {
    for (const peer of this.peers) {
      // call a peer if it is not connected
      if (!peer.hasConnection()) {
        peer.startCall()
        .then(this.onStream.bind(this));
      }
    }
  }

  // destroy this peer
  destroy() {
    if (!this.peer) return;

    this.peer.destroy();
  }

  // handler for when the client connects
  onConnect() {
    this.connected = true;
  }

  // handler for when a call goes through
  onStream([peer, stream]) {

  }

  // handler for when the client disconnects
  onDisconnect() {
    this.connected = false;
    for (const p of this.peers) {
      p.destroy();
    }
    this.peers = [];
  }

  // handler for when client errors
  onError(err) {
    console.error('Client peer error', err);
  }

  // handler for when client is called
  onCall(call) {
    // find the peer that this call is from
    const peer = this.getPeer(call.peer);

    // ignore calls from peers not managed by this client or if the peer is already conected
    if (!peer || peer.isConnected()) return;

    // answer the call, deal with the stream
    peer.answerCall(call)
      .then(this.onStream.bind(this));
  }
}
