import { SnakeData, Position } from '../types/GameTypes';
import './Snake.css';

interface SnakeProps {
  snake: SnakeData;
  offset: Position;
  isMySnake?: boolean;
}

export default function Snake({ snake, offset, isMySnake = false }: SnakeProps) {
  return (
    <div className="snake-container">
      {snake.snakeBody.map((segment, index) => {
        const isHead = index === 0;
        const segmentSize = isHead ? 12 : 10;
        
        return (
          <div
            key={index}
            className={`snake-segment ${isHead ? 'snake-head' : ''} ${isMySnake ? 'my-snake' : 'other-snake'}`}
            style={{
              left: `${segment.x + offset.x - segmentSize / 2}px`,
              top: `${segment.y + offset.y - segmentSize / 2}px`,
              width: `${segmentSize}px`,
              height: `${segmentSize}px`,
              backgroundColor: snake.color,
              boxShadow: isMySnake ? `0 0 15px 3px ${snake.color}` : `0 0 8px 1px ${snake.color}`,
              zIndex: isHead ? 10 : 5,
            }}
          />
        );
      })}
      
      {/* Snake eyes for head */}
      {snake.snakeBody.length > 0 && (
        <div
          className="snake-eyes"
          style={{
            left: `${snake.snakeBody[0].x + offset.x - 6}px`,
            top: `${snake.snakeBody[0].y + offset.y - 6}px`,
          }}
        >
          <div className="eye left-eye" />
          <div className="eye right-eye" />
        </div>
      )}
    </div>
  );
}