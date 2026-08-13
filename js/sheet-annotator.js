"use strict";

/* ==========================================
   📷 曲谱标注 - 照片上传 + 图钉标注组件
   ==========================================
   spec 5.3: 课后反馈整理的核心组件
   - 上传曲谱照片（拍照/相册，自动压缩到 1920px 宽 JPEG 80%）
   - 在照片上点击位置放图钉（pinX/pinY 用 0-1 相对坐标）
   - 已有图钉按状态显示颜色（🔴新 / 🟡练习中 / 🟢已搞定）
   - 点击已有图钉触发回调（编辑）

   被 FeedbackOrganizer 调用，不直接挂到 window
   ========================================== */

const SheetAnnotator = {
  /**
   * @typedef {Object} PinForRender
   * @property {string} id          FeedbackItem id
   * @property {number} pinX        0-1
   * @property {number} pinY        0-1
   * @property {string} status      new|working|resolved
   * @property {string} category    technique|dynamics|rhythm|notes|expression|other
   * @property {string} [locationLabel]
   */

  _photoBlobId: null,
  _photoUrl: '',
  _photoEl: null,
  _onPlacePin: null,    // 点击照片放新图钉的回调 (pinX, pinY) => void
  _onPinClick: null,    // 点击已有图钉的回调 (pinId) => void
  _pins: [],            // PinForRender[]

  /**
   * 初始化组件
   * @param {Object} opts
   * @param {string} [opts.photoBlobId]   已有照片的 blob id
   * @param {Function} opts.onPlacePin    (pinX, pinY) => void
   * @param {Function} opts.onPinClick    (pinId) => void
   */
  async init(opts) {
    this._onPlacePin = opts.onPlacePin || function() {};
    this._onPinClick = opts.onPinClick || function() {};
    this._pins = [];
    this._photoBlobId = opts.photoBlobId || null;
    this._photoUrl = '';
    if (this._photoBlobId) {
      try {
        const rec = await StorageAdapter.get(this._photoBlobId);
        if (rec && rec.blob) {
          this._photoUrl = URL.createObjectURL(rec.blob);
        }
      } catch (e) {
        console.warn('SheetAnnotator: 读取已有曲谱照片失败', e);
      }
    }
  },

  /**
   * 设置图钉列表（外部数据变化时调用）
   * @param {PinForRender[]} pins
   */
  setPins(pins) {
    this._pins = pins || [];
    this._renderPins();
  },

  /**
   * 渲染组件 HTML
   * @returns {string}
   */
  render() {
    if (this._photoUrl) {
      return (
        '<div class="sheet-annotator" id="sheetAnnotator">' +
          '<div class="sheet-photo-wrap" id="sheetPhotoWrap">' +
            '<img class="sheet-photo" id="sheetPhotoImg" src="' + this._photoUrl + '" alt="曲谱照片">' +
            '<div class="sheet-pins-layer" id="sheetPinsLayer"></div>' +
          '</div>' +
          '<div class="sheet-photo-actions">' +
            '<button type="button" class="btn btn-secondary btn-sm" onclick="SheetAnnotator._replacePhoto()">📷 换一张</button>' +
            '<input type="file" id="sheetPhotoInput" accept="image/*" style="display:none" onchange="SheetAnnotator._onFilePicked(event)">' +
          '</div>' +
        '</div>'
      );
    }
    return (
      '<div class="sheet-annotator" id="sheetAnnotator">' +
        '<div class="sheet-photo-empty" id="sheetPhotoEmpty">' +
          '<div class="sheet-photo-empty-icon">📷</div>' +
          '<p class="sheet-photo-empty-text">上传曲谱照片<br><span class="text-xs" style="color:var(--text-4)">点击照片上老师画圈/写字的位置放图钉</span></p>' +
          '<button type="button" class="btn btn-primary btn-sm" onclick="SheetAnnotator._pickPhoto()">拍照 / 选图</button>' +
          '<input type="file" id="sheetPhotoInput" accept="image/*" style="display:none" onchange="SheetAnnotator._onFilePicked(event)">' +
        '</div>' +
      '</div>'
    );
  },

  /**
   * 渲染后挂载事件（HTML 注入 DOM 后调用）
   */
  mount() {
    if (this._photoUrl) {
      const wrap = document.getElementById('sheetPhotoWrap');
      if (wrap) {
        wrap.addEventListener('click', this._handlePhotoClick.bind(this));
      }
      this._renderPins();
    }
  },

  /**
   * 照片点击：计算相对坐标，触发 onPlacePin
   */
  _handlePhotoClick(e) {
    // 如果点的是图钉本身，不触发放新图钉
    if (e.target.closest('.sheet-pin')) {
      const pinEl = e.target.closest('.sheet-pin');
      const pinId = pinEl && pinEl.dataset && pinEl.dataset.pinId;
      if (pinId) {
        e.stopPropagation();
        this._onPinClick(pinId);
        return;
      }
    }
    const img = document.getElementById('sheetPhotoImg');
    if (!img) return;
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pinX = (e.clientX - rect.left) / rect.width;
    const pinY = (e.clientY - rect.top) / rect.height;
    if (pinX < 0 || pinX > 1 || pinY < 0 || pinY > 1) return;
    this._onPlacePin(pinX, pinY);
  },

  /**
   * 渲染图钉层
   */
  _renderPins() {
    const layer = document.getElementById('sheetPinsLayer');
    if (!layer) return;
    if (!this._pins || this._pins.length === 0) {
      layer.innerHTML = '';
      return;
    }
    layer.innerHTML = this._pins.map((p, idx) => {
      const colorClass = 'pin-' + (p.status || 'new');
      const cat = Feedback.CATEGORIES.find(c => c.key === p.category);
      const icon = cat ? cat.icon : '📌';
      const tip = p.locationLabel ? Utils.escape(p.locationLabel) : ('#' + (idx + 1));
      return (
        '<button type="button" class="sheet-pin ' + colorClass + '"' +
        ' data-pin-id="' + Utils.escape(p.id) + '"' +
        ' style="left:' + (p.pinX * 100) + '%;top:' + (p.pinY * 100) + '%"' +
        ' title="' + tip + '">' + icon + '</button>'
      );
    }).join('');
  },

  /**
   * 选图按钮
   */
  _pickPhoto() {
    const input = document.getElementById('sheetPhotoInput');
    if (input) input.click();
  },

  _replacePhoto() {
    this._pickPhoto();
  },

  /**
   * 文件选中后：压缩 + 保存到 IndexedDB + 刷新视图
   */
  async _onFilePicked(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';  // 允许重复选同一文件
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      Utils.showToast('⚠️ 请选择图片文件', 'warning');
      return;
    }
    Utils.showToast('📷 正在处理照片...', 'info');
    try {
      const compressed = await this._compressImage(file, 1920, 0.8);
      const blobId = 'sheet_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      await StorageAdapter.set(blobId, compressed, 'sheet_photo');
      // 释放旧 URL
      if (this._photoUrl) {
        try { URL.revokeObjectURL(this._photoUrl); } catch (e) {}
      }
      // 如果换照片，删除旧 blob（避免孤儿数据）
      if (this._photoBlobId && this._photoBlobId !== blobId) {
        try { await StorageAdapter.remove(this._photoBlobId); } catch (e) {}
      }
      this._photoBlobId = blobId;
      this._photoUrl = URL.createObjectURL(compressed);
      // 重新渲染整个 annotator
      const root = document.getElementById('sheetAnnotator');
      if (root) {
        root.outerHTML = this.render();
        this.mount();
      }
      Utils.showToast('✅ 照片已上传', 'success');
      // 通知外部（让 organizer 把 photoBlobId 存起来）
      if (typeof this._onPhotoUploaded === 'function') {
        this._onPhotoUploaded(blobId);
      }
    } catch (e) {
      console.error('照片处理失败:', e);
      Utils.showToast('❌ 照片处理失败：' + (e.message || e), 'error');
    }
  },

  /**
   * 图片压缩（maxWidth=1920, JPEG 80%）
   * @param {File} file
   * @param {number} maxWidth
   * @param {number} quality
   * @returns {Promise<Blob>}
   */
  _compressImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          URL.revokeObjectURL(url);
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w > maxWidth) {
            h = Math.round(h * (maxWidth / w));
            w = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('canvas.toBlob 返回 null'));
            },
            'image/jpeg',
            quality
          );
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片加载失败'));
      };
      img.src = url;
    });
  },

  /**
   * 释放资源（关闭模态时调用）
   */
  destroy() {
    if (this._photoUrl) {
      try { URL.revokeObjectURL(this._photoUrl); } catch (e) {}
    }
    this._photoUrl = '';
    this._photoBlobId = null;
    this._pins = [];
    this._onPlacePin = null;
    this._onPinClick = null;
    this._onPhotoUploaded = null;
  },

  /**
   * 当前照片 blob id（外部读取用于保存）
   * @returns {string|null}
   */
  getPhotoBlobId() {
    return this._photoBlobId;
  },

  /**
   * 设置外部回调：照片上传成功
   * @param {Function} fn
   */
  onPhotoUploaded(fn) {
    this._onPhotoUploaded = fn;
  }
};

window.SheetAnnotator = SheetAnnotator;
