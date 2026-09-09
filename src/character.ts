import * as THREE from 'three';

export type Motion = 'Idle' | 'Walk' | 'Sit' | 'Read' | 'Play' | 'Fly';

/** Plays the character's authored Blender clips on its own cloned hierarchy. */
export class Character {
  readonly root: THREE.Group;
  private mixer: THREE.AnimationMixer;
  private actions: Partial<Record<Motion, THREE.AnimationAction>>;
  private state: Motion = 'Idle';
  private requestedMotion: Motion = 'Idle';
  private stride = 0.85;

  constructor(root: THREE.Group, offset = 0) {
    this.root = root;
    root.traverse((node) => {
      if (node.userData.strideLength) this.stride = node.userData.strideLength;
    });
    this.mixer = new THREE.AnimationMixer(root);
    const action = (name: 'Idle' | 'Walk') => {
      const clip = root.animations.find((clip) => clip.name === name);
      if (!clip) throw new Error(`Missing ${name} animation on ${root.name}`);
      return this.mixer.clipAction(clip);
    };
    this.actions = { Idle: action('Idle'), Walk: action('Walk') };
    for (const name of ['Sit', 'Read', 'Play', 'Fly'] as const) {
      const clip = root.animations.find((c) => c.name === name);
      if (clip) this.actions[name] = this.mixer.clipAction(clip);
    }
    this.actions.Idle!.play();
    this.mixer.update(offset);
  }

  setWalking(walking: boolean) {
    this.setMotion(walking ? 'Walk' : 'Idle');
  }

  setMotion(state: Motion) {
    // Routing, activities and species can all choose a pose during one frame.
    // Commit only the final choice so overrides do not keep restarting a clip.
    this.requestedMotion = this.actions[state] ? state : 'Idle';
  }

  /** Match the authored stride to ground speed instead of skating at fixed cadence. */
  setWalkSpeed(speed: number, scale = 1) {
    this.actions.Walk?.setEffectiveTimeScale(
      THREE.MathUtils.clamp(speed / (this.stride * scale), 0.25, 3.5),
    );
  }

  update(dt: number) {
    if (this.requestedMotion !== this.state) {
      const previous = this.actions[this.state]!;
      const next = this.actions[this.requestedMotion]!.reset().play();
      previous.crossFadeTo(next, 0.2, false);
      this.state = this.requestedMotion;
    }
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
