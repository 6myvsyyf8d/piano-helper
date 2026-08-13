"use strict";

/* ==========================================
   📡 事件总线 - 模块间解耦通信
   ==========================================
   使用方式：
     Events.on('practice:completed', handler);
     Events.emit('practice:completed', { pieceId, durationMin });
     Events.off('practice:completed', handler);

   预定义事件（Phase 1 起使用）：
     - practice:completed       练习日志提交后
     - practice:recording_done  练习录音完成
     - feedback:added           新增反馈
     - feedback:resolved        反馈标记为已解决
     - lesson:created           新增课程记录
   ========================================== */

const Events = {
  _handlers: {},

  /**
   * 注册事件监听
   * @param {string} event 事件名
   * @param {Function} handler 处理函数
   */
  on(event, handler) {
    if (typeof handler !== 'function') return;
    (this._handlers[event] = this._handlers[event] || []).push(handler);
  },

  /**
   * 取消事件监听
   * @param {string} event 事件名
   * @param {Function} handler 处理函数
   */
  off(event, handler) {
    if (!this._handlers[event]) return;
    this._handlers[event] = this._handlers[event].filter(h => h !== handler);
    if (this._handlers[event].length === 0) delete this._handlers[event];
  },

  /**
   * 触发事件
   * @param {string} event 事件名
   * @param {*} [data] 携带数据
   */
  emit(event, data) {
    const handlers = this._handlers[event];
    if (!handlers) return;
    // 复制一份，防止 handler 内部 off 导致迭代异常
    handlers.slice().forEach(h => {
      try {
        h(data);
      } catch (error) {
        console.error(`Events handler error for "${event}":`, error);
      }
    });
  }
};

// 暴露到全局（保持与现有代码风格一致）
window.Events = Events;
