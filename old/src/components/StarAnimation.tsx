<div>
  <h2>星星动画</h2>

  {stars.map((star, index) => (
    <Star key={index} x={star.x} y={star.y} />
  ))}

  <ProgressBar progress={progress} completed={allGamesCompleted} />
</div>