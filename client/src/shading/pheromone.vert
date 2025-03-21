uniform float time;
attribute float width;
attribute vec3 color;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = color;
  
  // Calculate alpha based on position along the line
  float linePosition = position.y;
  vAlpha = sin(linePosition * 3.14159);
  
  // Add time-based animation
  vAlpha *= 0.7 + 0.3 * sin(time * 2.0 + linePosition * 10.0);
  
  // Calculate the normal - assume it's a line strip along z-axis
  vec4 worldPosition = modelViewMatrix * vec4(position, 1.0);
  
  // Set the final position
  gl_Position = projectionMatrix * worldPosition;
  
  // Set the point size based on width and distance
  gl_PointSize = width * (1.0 / -worldPosition.z) * 100.0;
}
