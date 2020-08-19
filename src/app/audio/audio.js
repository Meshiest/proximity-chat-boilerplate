// get the current user's audio stream
export function getAudioStream() {
  return navigator.mediaDevices.getUserMedia({audio: true});
}

// play an audio stream
export function playAudioStream(stream, target) {
  // create the video element for the stream
  const elem = document.createElement('video');
  elem.srcObject = stream;

  // element must be muted for
  elem.muted = true;
  elem.setAttribute('data-peer', target);
  elem.onloadedmetadata = () => {
    elem.play();
  };

  return elem;
}