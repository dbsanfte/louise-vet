import * as THREE from 'three';
type Surface = 'grass' | 'road' | 'paving' | 'wood' | 'roof' | 'plaster';
/** Small original repeating textures, with world-scale UVs across curved ribbons. */
export class TownSurfaces {
  private textures = new Map<Surface, THREE.CanvasTexture>();
  private materials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  private ground: {
    material: THREE.MeshStandardMaterial;
    colour: THREE.Color;
    roughness: number;
    kind: Surface;
  }[] = [];
  private texture(kind: Surface) {
    const old = this.textures.get(kind);
    if (old) return old;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    let seed = 73;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    ctx.fillStyle = '#deded6';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 12000; i++) {
      const c = Math.floor(180 + random() * 70);
      ctx.fillStyle = `rgb(${c} ${c} ${kind === 'grass' ? Math.max(100, c - 18) : c})`;
      const x = random() * 256,
        y = random() * 256;
      ctx.fillRect(
        x,
        y,
        kind === 'grass' ? 1 : 1.5,
        kind === 'grass' ? 2 + random() * 5 : 1.5,
      );
    }
    if (kind === 'paving' || kind === 'roof') {
      const height = kind === 'roof' ? 32 : 64;
      ctx.strokeStyle = kind === 'roof' ? '#858585' : '#aaaaa2';
      ctx.lineWidth = kind === 'roof' ? 2 : 2.5;
      for (let y = 0; y <= 256; y += height) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
        for (let x = -((y / height) % 2) * 64; x <= 256; x += 128) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + height);
          ctx.stroke();
        }
      }
    }
    if (kind === 'wood') {
      ctx.strokeStyle = '#b5ac9e';
      ctx.lineWidth = 1;
      for (let y = 0; y < 256; y += 5) {
        ctx.beginPath();
        for (let x = 0; x <= 256; x += 4)
          ctx.lineTo(x, y + Math.sin(x * 0.055 + y) * 2);
        ctx.stroke();
      }
      for (let y = 0; y <= 256; y += 64) {
        ctx.fillStyle = '#8a8278';
        ctx.fillRect(0, y, 256, 2);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.textures.set(kind, texture);
    return texture;
  }
  apply(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (
        !(o instanceof THREE.Mesh) ||
        Array.isArray(o.material) ||
        !(o.material instanceof THREE.MeshStandardMaterial)
      )
        return;
      const original = o.material;
      const name = original.name.toLowerCase();
      const kind: Surface | undefined = /grass|lawn/.test(name)
        ? 'grass'
        : /road|asphalt/.test(name)
          ? 'road'
          : /path|pavement|stone/.test(name)
            ? 'paving'
            : /wood|bark/.test(name)
              ? 'wood'
              : /roof/.test(name)
                ? 'roof'
                : /cream|wall|plaster|facade/.test(name)
                  ? 'plaster'
                  : undefined;
      const paint = /paint/.test(name),
        glass = /glass|window/.test(name);
      if (!kind && !paint && !glass) return;
      let material = this.materials.get(original);
      if (!material) {
        material = paint
          ? new THREE.MeshPhysicalMaterial({
              color: original.color,
              metalness: 0.32,
              roughness: 0.21,
              clearcoat: 1,
              clearcoatRoughness: 0.12,
              envMapIntensity: 2.4,
            })
          : original.clone();
        material.name = original.name;
        if (glass) {
          material.metalness = 0.35;
          material.roughness = 0.12;
          material.envMapIntensity = 1.8;
        }
        if (kind) {
          material.map = this.texture(kind);
          material.bumpMap = material.map;
          material.bumpScale =
            kind === 'paving' ? 0.025 : kind === 'grass' ? 0.016 : 0.009;
          material.roughness =
            kind === 'road' ? 0.92 : kind === 'wood' ? 0.8 : 0.98;
          material.userData.surface = kind;
          if (['road', 'paving', 'grass'].includes(kind))
            this.ground.push({
              material,
              colour: material.color.clone(),
              roughness: material.roughness,
              kind,
            });
        }
        if (paint) material.userData.finish = 'glossy paint';
        this.materials.set(original, material);
      }
      o.material = material;
      if (!kind) return;
      const geometry = o.geometry.clone(),
        positions = geometry.getAttribute('position'),
        normals = geometry.getAttribute('normal');
      const uv = new Float32Array(positions.count * 2),
        p = new THREE.Vector3(),
        n = new THREE.Vector3();
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
      const scale =
        kind === 'grass'
          ? 0.35
          : kind === 'road'
            ? 0.65
            : kind === 'paving'
              ? 0.65
              : kind === 'wood'
                ? 0.9
                : 0.65;
      for (let i = 0; i < positions.count; i++) {
        p.fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld);
        n.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix);
        if (Math.abs(n.y) >= Math.max(Math.abs(n.x), Math.abs(n.z))) {
          uv[i * 2] = p.x * scale;
          uv[i * 2 + 1] = p.z * scale;
        } else if (Math.abs(n.x) > Math.abs(n.z)) {
          uv[i * 2] = p.z * scale;
          uv[i * 2 + 1] = p.y * scale;
        } else {
          uv[i * 2] = p.x * scale;
          uv[i * 2 + 1] = p.y * scale;
        }
      }
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      o.geometry = geometry;
    });
  }
  weather(wetness: number) {
    for (const g of this.ground) {
      g.material.color.copy(g.colour).multiplyScalar(1 - wetness * 0.16);
      g.material.roughness = THREE.MathUtils.lerp(
        g.roughness,
        g.kind === 'grass' ? 0.82 : 0.28,
        wetness,
      );
    }
  }
}
