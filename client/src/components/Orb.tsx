import { OrbData, OrbSize, Position } from '../types/GameTypes';
import './Orb.css';

interface OrbProps {
  orb: OrbData;
  offset: Position;
}

export default function Orb({ orb, offset }: OrbProps) {
  const size = orb.size === OrbSize.SMALL ? 8 : 16;
  
  return (
    <div
      className="orb"
      style={{
        left: `${orb.position.x + offset.x}px`,
        top: `${orb.position.y + offset.y}px`,
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: orb.color,
        boxShadow: `0 0 10px 2px ${orb.color}`,
      }}
    />
  );
}