<div>
  <Tabs
    value={tabValue}
    onChange={(value) => setTabValue(value)}
  >
    <Tab label='魔法挑战' value='magic-challenge' />
    <Tab label='所有游戏' value='all-games' />
    <Tab label='家长看板' value='parent-board' />
  </Tabs>

  {tabValue === 'magic-challenge' && <MagicChallengePage />}
  {tabValue === 'all-games' && <AllGamesPage />}
  {tabValue === 'parent-board' && <ParentBoardPage />}
</div>