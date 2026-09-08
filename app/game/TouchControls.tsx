import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type PointerEvent,
} from 'react';
import { TouchState, type TouchAction } from './touch';
import { weapons, type CharacterId } from './simulation';

type Props = {
  onChange: (x: number, fire: boolean) => void;
  action: (key: 'jump' | 'dash' | 'grenade' | 'switchWeapon' | 'melee') => void;
  autoFire: boolean;
  toggleAutoFire: () => void;
  dash: number;
  grenades: number;
  weapon: number;
  character: CharacterId;
  melee: number;
};
export function TouchControls({
  onChange,
  action,
  autoFire,
  toggleAutoFire,
  dash,
  grenades,
  weapon,
  character,
  melee,
}: Props) {
  const fingers = useRef(new TouchState());
  const [pressed, setPressed] = useState<TouchAction[]>([]);
  const sync = () => {
    onChange(fingers.current.x, fingers.current.fire);
    setPressed([...fingers.current.held.values()]);
  };
  useEffect(() => {
    const state = fingers.current;
    const reset = () => {
      state.clear();
      onChange(0, false);
      setPressed([]);
    };
    window.addEventListener('blur', reset);
    window.addEventListener('resize', reset);
    return () => {
      window.removeEventListener('blur', reset);
      window.removeEventListener('resize', reset);
      state.clear();
      onChange(0, false);
    };
  }, [onChange]);
  const down = (e: PointerEvent<HTMLButtonElement>, key: TouchAction) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    fingers.current.press(e.pointerId, key);
    sync();
    if (key !== 'left' && key !== 'right' && key !== 'fire') action(key);
  };
  const up = (e: PointerEvent<HTMLButtonElement>) => {
    fingers.current.release(e.pointerId);
    sync();
  };
  const handlers = { onPress: down, onRelease: up, action };
  return (
    <nav className="touch-controls" aria-label="Phone game controls">
      <div className="touch-toolbar">
        <button
          className={`auto-fire ${autoFire ? 'enabled' : ''}`}
          aria-pressed={autoFire}
          onClick={toggleAutoFire}
        >
          <i /> AUTO FIRE <b>{autoFire ? 'ON' : 'OFF'}</b>
        </button>
        <TouchButton
          aria-label="Switch weapon"
          control="switchWeapon"
          pressed={pressed.includes('switchWeapon')}
          {...handlers}
        >
          {weapons[weapon].short} <b>↻</b>
        </TouchButton>
        <TouchButton
          aria-label={`Throw grenade, ${grenades} remaining`}
          disabled={grenades === 0}
          control="grenade"
          pressed={pressed.includes('grenade')}
          {...handlers}
        >
          BOMB <b>×{grenades}</b>
        </TouchButton>
      </div>
      <div className="touch-directions">
        <TouchButton
          aria-label="Move left"
          control="left"
          pressed={pressed.includes('left')}
          {...handlers}
        >
          ←
        </TouchButton>
        <TouchButton
          aria-label="Move right"
          control="right"
          pressed={pressed.includes('right')}
          {...handlers}
        >
          →
        </TouchButton>
        <span>MOVE</span>
      </div>
      {character === 'patrick' && (
        <TouchButton
          className="touch-saber"
          aria-label="Energy sword attack"
          control="melee"
          pressed={pressed.includes('melee')}
          {...handlers}
        >
          <b>╱</b>
          <span>{melee > 0 ? 'RECOVERY' : 'SABER'}</span>
        </TouchButton>
      )}
      <div className={`touch-abilities ${autoFire ? 'assisted' : 'manual'}`}>
        <TouchButton
          className="touch-dash"
          aria-label="Dash"
          disabled={dash > 0}
          control="dash"
          pressed={pressed.includes('dash')}
          {...handlers}
        >
          <b>»</b>
          <span>{dash > 0 ? `${dash.toFixed(1)}s` : 'DASH'}</span>
        </TouchButton>
        <TouchButton
          className="touch-jump"
          aria-label="Jump or double jump"
          control="jump"
          pressed={pressed.includes('jump')}
          {...handlers}
        >
          <b>↑</b>
          <span>JUMP ×2</span>
        </TouchButton>
        {!autoFire && (
          <TouchButton
            className="touch-fire"
            aria-label="Hold to fire"
            control="fire"
            pressed={pressed.includes('fire')}
            {...handlers}
          >
            FIRE
          </TouchButton>
        )}
      </div>
    </nav>
  );
}

function TouchButton({
  control,
  pressed,
  onPress,
  onRelease,
  action,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  control: TouchAction;
  pressed: boolean;
  onPress: (e: PointerEvent<HTMLButtonElement>, key: TouchAction) => void;
  onRelease: (e: PointerEvent<HTMLButtonElement>) => void;
  action: Props['action'];
}) {
  return (
    <button
      {...props}
      data-pressed={pressed}
      onPointerDown={(e) => onPress(e, control)}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onLostPointerCapture={onRelease}
      onClick={(e) => {
        if (
          e.detail === 0 &&
          control !== 'left' &&
          control !== 'right' &&
          control !== 'fire'
        )
          action(control);
      }}
    >
      {children}
    </button>
  );
}
