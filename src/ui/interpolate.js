// Draw-time interpolation: physics runs at a fixed 60 steps per second, screens refresh at 60, 120
// or 144 Hz. Drawing each car between its previous and current step keeps motion smooth instead of
// jumping one step on some frames and none on others. Pure (no DOM), shared by both renderers.

/**
 * The car's pose `alpha` of the way from its previous step to its current one (0..1).
 * Stopped cars (crashed, finished) are drawn where they are.
 * @param {{ x: number, y: number, angle: number, prevX: number, prevY: number, prevAngle: number,
 *           alive: boolean, finished: boolean }} car
 * @param {{ x: number, y: number, angle: number }} out reused result object
 */
export function carPose(car, alpha, out) {
  if (!car.alive || car.finished || !(alpha < 1)) {
    out.x = car.x;
    out.y = car.y;
    out.angle = car.angle;
    return out;
  }
  const a = alpha > 0 ? alpha : 0;
  out.x = car.prevX + (car.x - car.prevX) * a;
  out.y = car.prevY + (car.y - car.prevY) * a;
  out.angle = car.prevAngle + (car.angle - car.prevAngle) * a; // angles are never wrapped by Car
  return out;
}
