// Hero background: a laser beam tracing glowing vector-like rosette curves on
// dark brushed metal. Layered rhodonea (rose) curves are evaluated in polar
// space — each pixel measures its radial distance to the curve r = R·|cos(kθ)|,
// which is cheap and produces crisp "vector path" lines. A bright head travels
// along the main curve leaving an exponential ember trail behind it; halo +
// tight core give a bloom-ish falloff without post-processing. The pointer
// gently displaces the pattern origin and lifts intensity near the cursor.

uniform float uTime;      // seconds
uniform vec2 uResolution; // px
uniform vec2 uPointer;    // normalized [-1, 1], aspect-corrected
uniform float uStatic;    // 1.0 = frozen frame (reduced motion), no beam sweep

varying vec2 vUv;

#define PI 3.14159265359
#define TWO_PI 6.28318530718

// Cheap hash noise for grain / brushed metal.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Radial glow profile for a rose curve with petal count k, radius R.
float rose(vec2 p, float k, float R, float width) {
  float a = atan(p.y, p.x);
  float r = length(p);
  float target = R * abs(cos(a * k * 0.5));
  float d = (r - target) / width;
  return exp(-d * d);
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uResolution.x / uResolution.y;

  // Pointer parallax: shift the origin a few percent toward the cursor.
  vec2 origin = uPointer * 0.08;
  vec2 p = uv - origin;

  // --- Background: dark metal with a faint vertical gradient + brushing ----
  vec3 base = mix(vec3(0.048, 0.050, 0.066), vec3(0.075, 0.078, 0.100), vUv.y);
  float brush = hash(vec2(floor(vUv.y * uResolution.y * 0.5), 7.0)) * 0.02;
  float grain = (hash(vUv * uResolution + fract(uTime) * 61.7) - 0.5) * 0.028;
  vec3 color = base + brush + grain;

  vec3 laserHot = vec3(1.0, 0.42, 0.13);  // laser orange
  vec3 laserCore = vec3(1.0, 0.86, 0.70); // near-white core
  vec3 ember = vec3(0.85, 0.16, 0.06);    // deep red ember

  float t = uTime * 0.12;
  float slowSpin = t * 0.6;

  // --- Layer 1: large, dim 5-petal rosette, slowly rotating -----------------
  mat2 rot1 = mat2(cos(slowSpin), -sin(slowSpin), sin(slowSpin), cos(slowSpin));
  float rose1 = rose(rot1 * p, 5.0, 0.85, 0.012);
  color += ember * rose1 * 0.16;

  // --- Layer 2: medium 7-petal rosette, counter-rotating --------------------
  mat2 rot2 = mat2(cos(-slowSpin * 0.7), -sin(-slowSpin * 0.7), sin(-slowSpin * 0.7), cos(-slowSpin * 0.7));
  float rose2 = rose(rot2 * p, 7.0, 0.55, 0.010);
  color += laserHot * rose2 * 0.14;

  // --- Layer 3: the active trace — beam head + ember trail on a 3-petal ----
  float headAngle = uTime * 0.45;              // beam position along the curve
  float a = atan(p.y, p.x);
  // Angular distance *behind* the head (trail), wrapped to [0, TWO_PI].
  float behind = mod(headAngle - a, TWO_PI);
  float trail = exp(-behind * 1.1);            // bright at the head, fades back
  float trace = rose(p, 6.0, 0.72, 0.008);
  float traceGlow = rose(p, 6.0, 0.72, 0.035);

  // In static mode, show the whole curve evenly lit instead of a moving beam.
  float beam = mix(trail, 0.45, uStatic);
  color += laserHot * traceGlow * beam * 0.35; // wide halo
  color += mix(laserHot, laserCore, 0.6) * trace * beam;

  // White-hot head dot (hidden in static mode).
  vec2 headPos = vec2(cos(headAngle), sin(headAngle)) * (0.72 * abs(cos(headAngle * 3.0)));
  float head = exp(-dot(p - headPos, p - headPos) * 900.0);
  color += laserCore * head * (1.0 - uStatic) * 1.4;

  // --- Pointer lift: soft radial highlight following the cursor -------------
  float lift = exp(-dot(uv - uPointer, uv - uPointer) * 2.5);
  color += laserHot * lift * 0.05;

  // Vignette to seat the pattern into the page edges.
  float vig = smoothstep(1.9, 0.7, length(uv));
  color *= mix(0.55, 1.0, vig);

  gl_FragColor = vec4(color, 1.0);
}
