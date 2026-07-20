// Laser sweep: a bright band that travels around the vessel (uAngle), with a
// hot white core and a wider colored glow, faded at the top/bottom edges.
// Rendered additively on an open cylinder shell around the engrave zone.

uniform float uAngle; // current sweep angle, radians
uniform vec3 uColor;  // glow color (hot orange)

varying vec2 vUv;

#define TWO_PI 6.28318530718
#define PI 3.14159265359

void main() {
  float fragAngle = vUv.x * TWO_PI;
  // Shortest angular distance to the sweep position, in [0, PI].
  float d = abs(mod(fragAngle - uAngle + PI, TWO_PI) - PI);

  float glow = exp(-d * d / 0.03);   // wide halo
  float core = exp(-d * d / 0.002);  // tight burn line
  float vFade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);

  float intensity = (glow * 0.55 + core) * vFade;
  vec3 color = mix(uColor, vec3(1.0), core * 0.85);
  gl_FragColor = vec4(color * intensity, intensity);
}
