varying vec3 vColor;
varying float vAlpha;

void main() {
  // Calculate distance from center of point (for rounded points)
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  
  // Discard pixels outside of circle
  if (dist > 0.5) {
    discard;
  }
  
  // Calculate glow effect
  float glow = 1.0 - (dist * 2.0);
  glow = pow(glow, 1.5);
  
  // Set final color with glow and alpha
  gl_FragColor = vec4(vColor, vAlpha * glow);
}
