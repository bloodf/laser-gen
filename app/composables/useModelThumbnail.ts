/**
 * Offscreen 3D model thumbnails for uploaded GLB/STL files: parse the model,
 * frame it in a tiny WebGL scene, render once, and return a PNG data URL.
 * Best-effort — returns `undefined` when WebGL is unavailable or the model
 * fails to parse; everything (renderer, geometries, materials, textures) is
 * disposed before returning.
 */
import type { Object3D } from 'three'

/** Thumbnail canvas size in px (4:3). */
export const MODEL_THUMBNAIL_WIDTH_PX = 256
export const MODEL_THUMBNAIL_HEIGHT_PX = 192

/**
 * Render a GLB/STL model to a small PNG data URL.
 *
 * @param data - Raw file contents.
 * @param format - Model format (`'glb'` or `'stl'`).
 * @returns PNG data URL, or `undefined` when rendering is impossible.
 */
export async function renderModelThumbnail(data: ArrayBuffer, format: 'glb' | 'stl'): Promise<string | undefined> {
  if (!import.meta.client) return undefined
  try {
    const three = await import('three')
    let object: Object3D
    if (format === 'stl') {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js')
      const geometry = new STLLoader().parse(data)
      if (!geometry.attributes.normal) geometry.computeVertexNormals()
      geometry.rotateX(-Math.PI / 2) // STL Z-up → Y-up
      object = new three.Mesh(geometry, new three.MeshStandardMaterial({ color: '#9aa0aa', roughness: 0.6, metalness: 0.1 }))
    }
    else {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
      const gltf = await new Promise<{ scene: Object3D }>((resolve, reject) => {
        new GLTFLoader().parse(data, '', resolve, reject)
      })
      object = gltf.scene
    }

    const canvas = document.createElement('canvas')
    canvas.width = MODEL_THUMBNAIL_WIDTH_PX
    canvas.height = MODEL_THUMBNAIL_HEIGHT_PX
    const renderer = new three.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    const scene = new three.Scene()
    scene.background = new three.Color('#141419')
    scene.add(new three.AmbientLight('#ffffff', 0.9))
    const key = new three.DirectionalLight('#ffffff', 1.6)
    key.position.set(2, 3, 2)
    scene.add(key)
    scene.add(object)

    // Frame the whole model from a slightly elevated 3/4 view.
    const box = new three.Box3().setFromObject(object)
    const sphere = box.getBoundingSphere(new three.Sphere())
    const camera = new three.PerspectiveCamera(35, MODEL_THUMBNAIL_WIDTH_PX / MODEL_THUMBNAIL_HEIGHT_PX, 0.01, sphere.radius * 100)
    const distance = Math.max(sphere.radius, 1e-6) * 2.4
    camera.position.set(sphere.center.x + distance * 0.7, sphere.center.y + distance * 0.55, sphere.center.z + distance * 0.7)
    camera.lookAt(sphere.center)
    renderer.render(scene, camera)
    const dataUrl = canvas.toDataURL('image/png')

    // Dispose everything GPU-side.
    object.traverse((node) => {
      if (node instanceof three.Mesh) {
        node.geometry.dispose()
        const mats = Array.isArray(node.material) ? node.material : [node.material]
        for (const mat of mats) mat.dispose()
      }
    })
    renderer.dispose()
    return dataUrl
  }
  catch (error) {
    console.warn('[renderModelThumbnail] failed — saving without a thumbnail', error)
    return undefined
  }
}

export function useModelThumbnail(): typeof renderModelThumbnail {
  return renderModelThumbnail
}
