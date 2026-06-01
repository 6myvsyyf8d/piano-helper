<div>
  <h2>符号游戏</h2>

  <svg width='100' height='100' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'>
    {symbols.map((symbol) => (
      <SymbolElement key={symbol.id} symbol={symbol}
        onClick={() => handleSymbolClick(symbol)} />
    ))}
  </svg>

  <div>
    <p>{t('symbol.game.instruction')}</p>
  </div>
</div>