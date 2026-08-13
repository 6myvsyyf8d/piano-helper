"use strict";

/* ==========================================
   📷 曲谱标注 - 照片上传 + 图钉标注组件（多照片支持）
   ==========================================
   spec 5.3: 课后反馈整理的核心组件
   - 支持多张曲谱照片，上下拼接显示
   - 上传照片追加到末尾，不替换已有
   - 每张照片独立图钉层，图钉绑定到具体页码
   - 点击已有图钉触发回调（编辑）

   被 FeedbackOrganizer 调用，不直接挂到 window
   ========================================== */

const SheetAnnotator = {
  /**
   * @typedef {Object} PinForRender
   * @property {string} id          FeedbackItem id
   * @property {number} pinX        0-1
   * @property {number} pinY        0-1
   * @property {number} [photoPage] 页码（1-based），默认 1
   * @property {string} status      new|resolved
   * @property {string} category    technique|dynamics|rhythm|notes|expression|other
   * @property {string} [locationLabel]
   */

  _photos: [],          // [{blobId, url}]
  _onPlacePin: null,    // 点击照片放新图钉的回调 (pinX, pinY, photoPage) => void
  _onPinClick: null,    // 点击已有图钉的回调 (pinId) => void
  _onPinMoved: null,    // 图钉拖拽移动后的回调 (pinId, pinX, pinY) => void
  _pins: [],            // PinForRender[]
  _dragState: null,     // {pinId, pinEl, pageEl, imgEl, startX, startY, startPinX, startPinY, moved}
  _dragBound: false,    // 全局 drag 事件是否已绑定

  /**
   * 初始化组件
   * @param {Object} opts
   * @param {string[]} [opts.photoBlobIds]  已有照片的 blob id 数组（去重排序）
   * @param {Function} opts.onPlacePin    (pinX, pinY, photoPage) => void
   * @param {Function} opts.onPinClick    (pinId) => void
   */
  async init(opts) {
    this._onPlacePin = opts.onPlacePin || function() {};
    this._onPinClick = opts.onPinClick || function() {};
    this._onPinMoved = opts.onPinMoved || function() {};
    this._pins = [];
    this._photos = [];
    this._dragState = null;

    const ids = (opts.photoBlobIds && opts.photoBlobIds.length) ? opts.photoBlobIds : [];
    for (const blobId of ids) {
      try {
        const rec = await StorageAdapter.get(blobId);
        if (rec && rec.blob) {
          this._photos.push({ blobId: blobId, url: URL.createObjectURL(rec.blob) });
        }
      } catch (e) {
        console.warn('SheetAnnotator: 读取曲谱照片失败', blobId, e);
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
    if (this._photos.length > 0) {
      var photosHtml = this._photos.map(function(photo, idx) {
        var pageNum = idx + 1;
        var isOnly = this._photos.length === 1;
        var delBtn = isOnly
          ? '<button type="button" class="btn btn-secondary btn-sm" onclick="SheetAnnotator._replacePhoto(' + idx + ')">📷 换一张</button>'
          : '<button type="button" class="btn btn-secondary btn-sm" style="font-size:0.7rem;padding:2px 8px" onclick="SheetAnnotator._deletePhoto(' + idx + ')">🗑 删除</button>';
        return (
          '<div class="sheet-photo-wrap" data-page="' + idx + '" style="position:relative;display:inline-block;margin-bottom:8px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden">' +
            '<img class="sheet-photo" src="' + photo.url + '" alt="曲谱照片 第' + pageNum + '页" style="display:block;max-width:100%;height:auto">' +
            '<div class="sheet-pins-layer" data-page="' + idx + '" style="position:absolute;inset:0;pointer-events:auto"></div>' +
            '<div style="position:absolute;top:4px;right:4px;display:flex;gap:4px;align-items:center">' +
              '<span style="font-size:0.65rem;color:rgba(255,255,255,0.7);background:rgba(0,0,0,0.5);padding:1px 6px;border-radius:4px">第' + pageNum + '页</span>' +
              delBtn +
            '</div>' +
          '</div>'
        );
      }.bind(this)).join('');

      return (
        '<div class="sheet-annotator" id="sheetAnnotator">' +
          '<div class="sheet-photos-container" id="sheetPhotosContainer" style="display:flex;flex-direction:column;align-items:center;gap:4px">' +
            photosHtml +
          '</div>' +
          '<div class="sheet-photo-actions" style="margin-top:10px;display:flex;gap:8px;justify-content:center">' +
            '<button type="button" class="btn btn-primary btn-sm" onclick="SheetAnnotator._pickPhoto()">📷 添加照片</button>' +
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
    if (this._photos.length > 0) {
      var wraps = document.querySelectorAll('#sheetPhotosContainer .sheet-photo-wrap');
      var self = this;
      wraps.forEach(function(wrap) {
        wrap.addEventListener('click', self._handlePhotoClick.bind(self));
      });
      this._renderPins();
      this._ensureDragBound();
    }
  },

  /**
   * 确保全局 drag 事件只绑定一次（事件委托在容器上）
   */
  _ensureDragBound() {
    if (this._dragBound) return;
    this._dragBound = true;
    var self = this;
    // 全局 move/up 绑定在 document 上，确保拖出 pin 也能跟踪
    document.addEventListener('mousemove', function(e) { self._onPinDragMove(e); });
    document.addEventListener('touchmove', function(e) { self._onPinDragMove(e); }, { passive: false });
    document.addEventListener('mouseup', function(e) { self._onPinDragEnd(e); });
    document.addEventListener('touchend', function(e) { self._onPinDragEnd(e); });
    document.addEventListener('touchcancel', function(e) { self._onPinDragEnd(e); });
  },

  /**
   * 图钉拖拽开始
   */
  _onPinDragStart(e) {
    var pinEl = e.target.closest('.sheet-pin');
    if (!pinEl) return;
    e.preventDefault();
    e.stopPropagation();
    var pinId = pinEl.getAttribute('data-pin-id');
    var pageEl = pinEl.closest('.sheet-photo-wrap');
    var imgEl = pageEl ? pageEl.querySelector('img') : null;
    if (!imgEl) return;
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    this._dragState = {
      pinId: pinId,
      pinEl: pinEl,
      pageEl: pageEl,
      imgEl: imgEl,
      startX: clientX,
      startY: clientY,
      startPinX: parseFloat(pinEl.style.left) / 100,
      startPinY: parseFloat(pinEl.style.top) / 100,
      moved: false
    };
    pinEl.style.cursor = 'grabbing';
    pinEl.style.zIndex = '10';
  },

  /**
   * 图钉拖拽移动
   */
  _onPinDragMove(e) {
    if (!this._dragState) return;
    e.preventDefault();
    var ds = this._dragState;
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var rect = ds.imgEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var newPinX = (clientX - rect.left) / rect.width;
    var newPinY = (clientY - rect.top) / rect.height;
    // clamp 到图片内
    newPinX = Math.max(0, Math.min(1, newPinX));
    newPinY = Math.max(0, Math.min(1, newPinY));
    ds.pinEl.style.left = (newPinX * 100) + '%';
    ds.pinEl.style.top = (newPinY * 100) + '%';
    ds.moved = true;
  },

  /**
   * 图钉拖拽结束
   */
  _onPinDragEnd(e) {
    if (!this._dragState) return;
    var ds = this._dragState;
    ds.pinEl.style.cursor = 'grab';
    ds.pinEl.style.zIndex = '';
    if (ds.moved) {
      var newPinX = parseFloat(ds.pinEl.style.left) / 100;
      var newPinY = parseFloat(ds.pinEl.style.top) / 100;
      this._onPinMoved(ds.pinId, newPinX, newPinY);
    } else {
      // 没有移动 = 点击，触发编辑
      this._onPinClick(ds.pinId);
    }
    this._dragState = null;
  },

  /**
   * 照片点击：计算相对坐标 + 所属页码，触发 onPlacePin
   */
  _handlePhotoClick(e) {
    // 如果点的是图钉本身，交给 drag 逻辑处理（点击=编辑，拖拽=移动）
    if (e.target.closest('.sheet-pin')) {
      return;
    }
    var wrap = e.target.closest('.sheet-photo-wrap');
    if (!wrap) return;
    var pageIdx = parseInt(wrap.getAttribute('data-page'), 10);
    if (isNaN(pageIdx)) return;
    var img = wrap.querySelector('img');
    if (!img) return;
    var rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var pinX = (e.clientX - rect.left) / rect.width;
    var pinY = (e.clientY - rect.top) / rect.height;
    if (pinX < 0 || pinX > 1 || pinY < 0 || pinY > 1) return;
    // photoPage 是 1-based
    this._onPlacePin(pinX, pinY, pageIdx + 1);
  },

  /**
   * 渲染图钉层（按 photoPage 分到各页）
   */
  _renderPins() {
    var layers = document.querySelectorAll('#sheetPhotosContainer .sheet-pins-layer');
    var self = this;
    layers.forEach(function(layer) {
      layer.innerHTML = '';
    });
    if (!this._pins || this._pins.length === 0) return;
    // 按 photoPage 分组
    var pinsByPage = {};
    this._pins.forEach(function(p) {
      var page = (p.photoPage != null) ? p.photoPage : 1;
      if (!pinsByPage[page]) pinsByPage[page] = [];
      pinsByPage[page].push(p);
    });
    // 全局序号：按页码从小到大累加
    var globalIdx = 0;
    layers.forEach(function(layer) {
      var pageIdx = parseInt(layer.getAttribute('data-page'), 10);
      var pageNum = pageIdx + 1; // 1-based
      var pagePins = pinsByPage[pageNum] || [];
      if (pagePins.length === 0) return;
      layer.innerHTML = pagePins.map(function(p) {
        globalIdx++;
        var cat = Feedback.CATEGORIES.find(function(c) { return c.key === p.category; });
        var icon = cat ? cat.icon : '📌';
        var pinResolved = (p.status === 'resolved');
        var bg = pinResolved ? '#4caf7d' : '#5E6AD2';
        var tip = p.locationLabel ? Utils.escape(p.locationLabel) : ('#' + globalIdx);
        return (
          '<button type="button" class="sheet-pin"' +
          ' data-pin-id="' + Utils.escape(p.id) + '"' +
          ' onmousedown="SheetAnnotator._onPinDragStart(event)"' +
          ' ontouchstart="SheetAnnotator._onPinDragStart(event)"' +
          ' style="position:absolute;left:' + (p.pinX * 100) + '%;top:' + (p.pinY * 100) + '%;transform:translate(-50%,-50%);' +
          'width:26px;height:26px;border-radius:50%;background:' + bg + ';border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);' +
          'display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.75rem;font-weight:700;cursor:grab"' +
          ' title="' + tip + '">' + globalIdx + '</button>'
        );
      }).join('');
    });
  },

  /**
   * 选图按钮
   */
  _pickPhoto() {
    var input = document.getElementById('sheetPhotoInput');
    if (input) input.click();
  },

  /**
   * 替换某张照片（单张模式下的"换一张"）
   */
  _replacePhoto(idx) {
    this._pickPhoto();
    this._replaceTargetIdx = idx;
  },

  /**
   * 删除某张照片
   */
  async _deletePhoto(idx) {
    if (this._photos.length <= 1) {
      Utils.showToast('⚠️ 至少保留一张照片', 'warning');
      return;
    }
    if (!confirm('确定删除第' + (idx + 1) + '页照片？此页上的图钉将保留但不再显示在照片上。')) return;
    var photo = this._photos[idx];
    if (photo) {
      try { await StorageAdapter.remove(photo.blobId); } catch (e) {}
      try { URL.revokeObjectURL(photo.url); } catch (e) {}
    }
    this._photos.splice(idx, 1);
    // 重新渲染
    var root = document.getElementById('sheetAnnotator');
    if (root) {
      root.outerHTML = this.render();
      this.mount();
    }
    // 通知外部照片列表变化
    if (typeof this._onPhotosChanged === 'function') {
      this._onPhotosChanged(this._photos.map(function(p) { return p.blobId; }));
    }
    Utils.showToast('已删除照片', 'info');
  },

  /**
   * 文件选中后：压缩 + 保存到 IndexedDB + 追加到数组 + 刷新视图
   */
  async _onFilePicked(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = '';  // 允许重复选同一文件
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      Utils.showToast('⚠️ 请选择图片文件', 'warning');
      return;
    }
    Utils.showToast('📷 正在处理照片...', 'info');
    try {
      var compressed = await this._compressImage(file, 1920, 0.8);
      var blobId = 'sheet_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      await StorageAdapter.set(blobId, compressed, 'sheet_photo');

      var isReplace = (this._replaceTargetIdx != null);
      if (isReplace) {
        // 替换模式：换掉指定索引的照片
        var oldPhoto = this._photos[this._replaceTargetIdx];
        if (oldPhoto) {
          try { await StorageAdapter.remove(oldPhoto.blobId); } catch (e) {}
          try { URL.revokeObjectURL(oldPhoto.url); } catch (e) {}
        }
        this._photos[this._replaceTargetIdx] = { blobId: blobId, url: URL.createObjectURL(compressed) };
        this._replaceTargetIdx = null;
        Utils.showToast('✅ 照片已替换', 'success');
      } else {
        // 追加模式：添加到末尾
        this._photos.push({ blobId: blobId, url: URL.createObjectURL(compressed) });
        Utils.showToast('✅ 照片已添加（第' + this._photos.length + '页）', 'success');
      }

      // 重新渲染整个 annotator
      var root = document.getElementById('sheetAnnotator');
      if (root) {
        root.outerHTML = this.render();
        this.mount();
      }
      // 通知外部
      if (typeof this._onPhotoUploaded === 'function') {
        this._onPhotoUploaded(blobId, isReplace ? this._replaceTargetIdx + 1 : this._photos.length);
      }
      if (typeof this._onPhotosChanged === 'function') {
        this._onPhotosChanged(this._photos.map(function(p) { return p.blobId; }));
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
    return new Promise(function(resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function() {
        try {
          URL.revokeObjectURL(url);
          var w = img.naturalWidth;
          var h = img.naturalHeight;
          if (w > maxWidth) {
            h = Math.round(h * (maxWidth / w));
            w = maxWidth;
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            function(blob) {
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
      img.onerror = function() {
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
    this._photos.forEach(function(photo) {
      try { URL.revokeObjectURL(photo.url); } catch (e) {}
    });
    this._photos = [];
    this._pins = [];
    this._dragState = null;
    this._dragBound = false;
    this._onPlacePin = null;
    this._onPinClick = null;
    this._onPinMoved = null;
    this._onPhotoUploaded = null;
    this._onPhotosChanged = null;
    this._replaceTargetIdx = null;
  },

  /**
   * 所有照片 blob id 数组（外部读取用于保存）
   * @returns {string[]}
   */
  getPhotoBlobIds() {
    return this._photos.map(function(p) { return p.blobId; });
  },

  /**
   * 第一张照片 blob id（向后兼容）
   * @returns {string|null}
   */
  getPhotoBlobId() {
    return this._photos.length > 0 ? this._photos[0].blobId : null;
  },

  /**
   * 设置外部回调：照片上传成功
   * @param {Function} fn  (blobId, pageNum) => void
   */
  onPhotoUploaded(fn) {
    this._onPhotoUploaded = fn;
  },

  /**
   * 设置外部回调：照片列表变化（增删）
   * @param {Function} fn  (blobIds) => void
   */
  onPhotosChanged(fn) {
    this._onPhotosChanged = fn;
  },

  /**
   * 设置外部回调：图钉拖拽移动
   * @param {Function} fn  (pinId, pinX, pinY) => void
   */
  onPinMoved(fn) {
    this._onPinMoved = fn;
  }
};

window.SheetAnnotator = SheetAnnotator;