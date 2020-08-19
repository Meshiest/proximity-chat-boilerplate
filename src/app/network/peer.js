import { getAudioStream } from '../audio/audio.js';

// p2p network peer, stores information pertaining to a specific peer
export default class Peer {
  constructor(peer, id, info={}) {
    this.peer = peer;

    // peer info
    this.id = id;
    this.info = info;

    this.connection = null;

    // audio streams
    this.localStream = null;
    this.remoteStream = null;
  }

  // handle a media connection
  processConnection(connection) {
    this.connection = connection;

    // handle when the connection closes
    connection.on('close', () => {
      // cleanup from peer
      this.onDestroy && this.onDestroy();
      // cleanup from client
      this.peer.onPeerDestroy && this.peer.onPeerDestroy(this);
      // default the fields
      this.connection = null;
      this.info = {};
      this.remoteStream = null;
      this.localStream = null;
    });

    connection.on('error', err => {
      console.error('Peer connection error', err);
    });

    // resolve promise on stream success
    return new Promise((resolve, reject) => {
      connection.on('stream', stream => {
        this.remoteStream = stream;
        resolve([this, stream]);
      });
      connection.on('error', reject);
    })
  }

  // create a connection
  async startCall() {
    // create local audio stream
    this.localStream = await getAudioStream();

    // start outgoing call
    const connection = this.peer.call(this.id, this.localStream);
    return this.processConnection(connection);
  }

  // answer a connection
  async answerCall(connection) {
    if (connection.peer !== this.id) return;

    // create the local stream
    this.localStream = await getAudioStream();

    // answer the call,
    connection.answer(this.localStream);
    return this.processConnection(connection);
  }

  // true if this peer is trying to connect or is connected
  hasConnection() {
    return !!this.connection;
  }

  // true if this has a connection to the remote stream
  isConnected() {
    return !!this.remoteStream;
  }

  // destroy this connection
  destroy() {
    if (!this.connection) return;
    this.connection.close();
  }
}