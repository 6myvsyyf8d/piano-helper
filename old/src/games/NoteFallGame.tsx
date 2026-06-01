<div>
  <h2>五线谱游戏</h2>

  <CanvasBoard
    notes={notes}
    onKeyPress={(key) => handleKeyPress(key)}
    onNoteFall={() => handleNoteFall()} />

  <ProgressBar progress={progress} completed={allGamesCompleted} />
</div>