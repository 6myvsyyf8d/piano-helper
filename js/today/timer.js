/* ==========================================
   🏠 今日练琴 - 整体练习计时器
   ========================================== */
"use strict";

var totalTimerSeconds = 0;
var totalTimerRunning = false;
var totalTimerInterval = null;

function initTotalTimer() {
  console.log('[initTotalTimer] 初始化计时器');
  totalTimerRunning = false;
  if (totalTimerInterval) {
    clearInterval(totalTimerInterval);
    totalTimerInterval = null;
  }
  updateTotalTimerDisplay();

  var startBtn = document.getElementById('totalTimerStart');
  var pauseBtn = document.getElementById('totalTimerPause');
  var stopBtn = document.getElementById('totalTimerStop');

  console.log('[initTotalTimer] 按钮元素:', { startBtn: !!startBtn, pauseBtn: !!pauseBtn, stopBtn: !!stopBtn });

  if (startBtn) {
    startBtn.style.display = '';
    startBtn.onclick = startTotalTimer;
    console.log('[initTotalTimer] 开始按钮事件已绑定');
  }
  if (pauseBtn) {
    pauseBtn.style.display = 'none';
    pauseBtn.onclick = pauseTotalTimer;
  }
  if (stopBtn) {
    stopBtn.style.display = 'none';
    stopBtn.onclick = stopTotalTimer;
  }
}

function startTotalTimer() {
  console.log('[startTotalTimer] 开始计时');
  if (totalTimerRunning) return;

  totalTimerRunning = true;

  var startBtn = document.getElementById('totalTimerStart');
  var pauseBtn = document.getElementById('totalTimerPause');
  var stopBtn = document.getElementById('totalTimerStop');

  if (startBtn) startBtn.style.display = 'none';
  if (pauseBtn) pauseBtn.style.display = '';
  if (stopBtn) stopBtn.style.display = '';

  totalTimerInterval = setInterval(function() {
    totalTimerSeconds++;
    updateTotalTimerDisplay();
  }, 1000);
}

function pauseTotalTimer() {
  console.log('[pauseTotalTimer] 暂停计时');
  if (!totalTimerRunning) return;

  clearInterval(totalTimerInterval);
  totalTimerInterval = null;
  totalTimerRunning = false;

  var startBtn = document.getElementById('totalTimerStart');
  var pauseBtn = document.getElementById('totalTimerPause');

  if (startBtn) startBtn.style.display = '';
  if (pauseBtn) pauseBtn.style.display = 'none';
}

function stopTotalTimer() {
  console.log('[stopTotalTimer] 停止计时');
  if (totalTimerInterval) {
    clearInterval(totalTimerInterval);
    totalTimerInterval = null;
  }
  totalTimerRunning = false;

  var startBtn = document.getElementById('totalTimerStart');
  var pauseBtn = document.getElementById('totalTimerPause');
  var stopBtn = document.getElementById('totalTimerStop');

  if (startBtn) startBtn.style.display = '';
  if (pauseBtn) pauseBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'none';
}

function updateTotalTimerDisplay() {
  var mins = Math.floor(totalTimerSeconds / 60);
  var secs = totalTimerSeconds % 60;
  var timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

  var display = document.getElementById('totalTimerDisplay');
  if (display) display.textContent = timeStr;
}

function getTotalTimerMinutes() {
  return Math.ceil(totalTimerSeconds / 60);
}

function getTotalTimerSeconds() {
  return totalTimerSeconds;
}

function setTotalTimerSeconds(seconds) {
  totalTimerSeconds = seconds;
  updateTotalTimerDisplay();
}

console.log('✅ Timer module loaded');
