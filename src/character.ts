import * as THREE from 'three';

/** Plays the character's authored Blender clips on its own cloned hierarchy. */
export class Character {
  readonly root: THREE.Group;
  private mixer: THREE.AnimationMixer;
  private actions: Record<'Idle' | 'Walk', THREE.AnimationAction>;
  private state: 'Idle' | 'Walk' = 'Idle';

  constructor(root: THREE.Group, offset = 0) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    const action = (name: 'Idle' | 'Walk') => {
      const clip = root.animations.find((clip) => clip.name === name);
      if (!clip) throw new Error(`Missing ${name} animation on ${root.name}`);
      return this.mixer.clipAction(clip);
    };
    this.actions = { Idle: action('Idle'), Walk: action('Walk') };
    this.actions.Idle.play();
    this.mixer.update(offset);
  }

  setWalking(walking: boolean) {
    const state = walking ? 'Walk' : 'Idle';
    if (state === this.state) return;
    const previous = this.actions[this.state];
    const next = this.actions[state].reset().play();
    previous.crossFadeTo(next, 0.2, false);
    this.state = state;
  }

  update(dt: number) {
    this.mixer.update(dt);
  }

  holdStill() {
    this.mixer.setTime(0);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}
