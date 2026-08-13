"use strict";

/* ==========================================
   🗄️ 存储适配器 - IndexedDB 二进制数据封装
   ==========================================
   设计意图：
     localStorage 只能存字符串，无法存音频/图片 Blob。
     本模块封装 IndexedDB，提供 Promise 风格的 blob CRUD 接口。
     DB 对象通过此模块处理二进制数据（Phase 1 起使用）。

   数据库结构：
     DB 名:    piano-helper-db
     仓库:     blobs (主键 id)
     记录结构: { id: string, blob: Blob, type: string, createdAt: number }

   预留仓库（Phase 3 起使用）：
     - referenceAudios    老师示范录音
     - practiceRecordings 练习录音

   降级策略：
     浏览器不支持 IndexedDB 时，所有方法 reject，
     调用方应捕获并降级（如隐藏录音/拍照按钮）。
   ========================================== */

const StorageAdapter = {
  DB_NAME: 'piano-helper-db',
  DB_VERSION: 1,
  STORE_BLOBS: 'blobs',

  _db: null,

  /**
   * 打开/初始化 IndexedDB
   * @returns {Promise<IDBDatabase>}
   */
  _open() {
    if (this._db) return Promise.resolve(this._db);

    if (!('indexedDB' in window)) {
      return Promise.reject(new Error('IndexedDB not supported'));
    }

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // blobs 仓库：存储所有二进制数据（曲谱照片、家长语音、练习录音）
        if (!db.objectStoreNames.contains(this.STORE_BLOBS)) {
          const store = db.createObjectStore(this.STORE_BLOBS, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        // 预留仓库（Phase 3 使用，提前创建避免版本升级）
        if (!db.objectStoreNames.contains('referenceAudios')) {
          db.createObjectStore('referenceAudios', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('practiceRecordings')) {
          db.createObjectStore('practiceRecordings', { keyPath: 'id' });
        }
      };

      req.onsuccess = (e) => {
        this._db = e.target.result;
        // 连接意外断开时清理引用，下次调用重新打开
        this._db.onclose = () => { this._db = null; };
        this._db.onversionchange = () => {
          this._db.close();
          this._db = null;
        };
        resolve(this._db);
      };

      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB open blocked'));
    });
  },

  /**
   * 通用事务封装
   * @param {string} storeName 仓库名
   * @param {string} mode 'readonly' | 'readwrite'
   * @param {Function} fn (store) => IDBRequest
   * @returns {Promise}
   */
  _tx(storeName, mode, fn) {
    return this._open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = fn(store);
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  },

  /**
   * 读取 blob
   * @param {string} id
   * @returns {Promise<{id:string,blob:Blob,type:string,createdAt:number}|null>}
   */
  get(id) {
    return this._tx(this.STORE_BLOBS, 'readonly', store => store.get(id))
      .then(result => result || null);
  },

  /**
   * 写入 blob
   * @param {string} id
   * @param {Blob} blob
   * @param {string} [type=''] 类型标签（如 'sheet_photo'/'parent_voice'/'practice_recording'）
   * @returns {Promise<string>} id
   */
  set(id, blob, type = '') {
    const record = { id, blob, type, createdAt: Date.now() };
    return this._tx(this.STORE_BLOBS, 'readwrite', store => store.put(record))
      .then(() => id);
  },

  /**
   * 删除 blob
   * @param {string} id
   * @returns {Promise<void>}
   */
  remove(id) {
    return this._tx(this.STORE_BLOBS, 'readwrite', store => store.delete(id));
  },

  /**
   * 列出指定前缀的所有 blob id
   * @param {string} [prefix=''] 为空时列出全部
   * @returns {Promise<string[]>}
   */
  list(prefix = '') {
    return this._tx(this.STORE_BLOBS, 'readonly', store => store.getAllKeys())
      .then(keys => (keys || []).filter(k => !prefix || String(k).startsWith(prefix)));
  },

  /**
   * 查询存储用量（曲谱照片/语音/录音的总数与字节数）
   * @returns {Promise<{count:number, bytes:number}>}
   */
  usage() {
    return this._tx(this.STORE_BLOBS, 'readonly', store => store.getAll())
      .then(records => {
        let bytes = 0;
        for (const r of records || []) {
          bytes += (r.blob && r.blob.size) || 0;
        }
        return { count: (records || []).length, bytes };
      });
  }
};

window.StorageAdapter = StorageAdapter;
