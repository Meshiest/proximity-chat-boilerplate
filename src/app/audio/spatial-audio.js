import { SOUND_CUTOFF_RANGE, SOUND_FAR_RANGE, SOUND_NEAR_RANGE } from '../../constants.js';

// split an audio stream into left and right channels
export class SpatialStream {
  constructor(stream, {left=1, right=1}={}) {
    this.stream = stream;

    // create audio context using the stream as a source
    const track = stream.getAudioTracks()[0];
    this.context = new AudioContext();
    this.source = this.context.createMediaStreamSource(new MediaStream([track]));

    // create a channel for each ear (left, right)
    this.channels = {
      left: this.context.createGain(),
      right: this.context.createGain(),
    };

    // connect the gains
    this.source.connect(this.channels.left);
    this.source.connect(this.channels.right);

    // create a merger to join the two gains
    const merger = this.context.createChannelMerger(2);
    this.channels.left.connect(merger, 0, 0);
    this.channels.right.connect(merger, 0, 1);

    // set the volume for each side
    this.setVolume(left, right);

    // connect the merger to the audio context
    merger.connect(this.context.destination);

    this.destination = this.context.createMediaStreamDestination();
  }

  // set the volume
  setVolume(left=0, right=0) {
    // clamp volumes between 0 and 1
    left = Math.max(Math.min(left, 1), 0);
    right = Math.max(Math.min(right, 1), 0);

    // disable the stream if the volume is 0
    this.stream.enabled = left !== 0 && right !== 0;

    // set the volumes for each channel's gain
    this.channels.left.gain.value = left;
    this.channels.right.gain.value = right;
  }

  // close the context, stop the audio
  close() {
    return this.context.close();
  }
};

export function getVolume2D(listenerPos, soundPos) {
  // calulate angle and distance from listener to sound
  const theta = Math.atan2(soundPos.y - listenerPos.y, soundPos.x - listenerPos.x);
  const dist = Math.hypot(soundPos.y - listenerPos.y, soundPos.x - listenerPos.x);

  // target is too far away, no volume
  if (dist > SOUND_CUTOFF_RANGE)
    return [0, 0];

  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  // spatial volumes for the given angle
  const left = (Math.pow((cos < 0 ? cos : 0), 2) + Math.pow(sin, 2));
  const right = (Math.pow((cos > 0 ? cos : 0), 2) + Math.pow(sin, 2));

  // target is very close, max volume
  if (dist < SOUND_NEAR_RANGE)
    return [1, 1];

  // target is close-ish, lerp between max volume and regular left/right volume
  if (dist < SOUND_FAR_RANGE) {
    const nearScale = (dist - SOUND_NEAR_RANGE) / (SOUND_FAR_RANGE - SOUND_NEAR_RANGE);
    return [
      nearScale * left + 1 - nearScale,
      nearScale * right + 1 - nearScale,
    ];
  }

  // the volume for distance when not very close
  const farScale = 1 - (dist - SOUND_FAR_RANGE) / (SOUND_CUTOFF_RANGE - SOUND_FAR_RANGE);
  return [
    left * farScale,
    right * farScale,
  ];
}