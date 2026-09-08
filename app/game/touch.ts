export type TouchAction =
  | 'left'
  | 'right'
  | 'fire'
  | 'melee'
  | 'jump'
  | 'dash'
  | 'grenade'
  | 'switchWeapon';

// Track each finger independently. Releasing one thumb must never cancel the
// other, and cancellation/rotation must never leave movement or firing held.
export class TouchState {
  held = new Map<number, TouchAction>();
  press(id: number, action: TouchAction) {
    this.held.set(id, action);
  }
  release(id: number) {
    this.held.delete(id);
  }
  clear() {
    this.held.clear();
  }
  has(action: TouchAction) {
    return [...this.held.values()].includes(action);
  }
  get x() {
    return Number(this.has('right')) - Number(this.has('left'));
  }
  get fire() {
    return this.has('fire');
  }
}
