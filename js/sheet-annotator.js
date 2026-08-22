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
  _dropMarker: null,    // 拖拽期间的落点箭头元素
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
            this._filePickerLabel('📷 添加照片', false) +
          '</div>' +
        '</div>'
      );
    }
    return (
      '<div class="sheet-annotator" id="sheetAnnotator">' +
        '<div class="sheet-photo-empty" id="sheetPhotoEmpty">' +
          '<div class="sheet-photo-empty-icon">📷</div>' +
          '<p class="sheet-photo-empty-text">上传曲谱照片<br><span class="text-xs" style="color:var(--text-4)">点击照片上老师画圈/写字的位置放图钉</span></p>' +
          '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
            this._filePickerLabel('📷 拍照', true) +
            this._filePickerLabel('🖼 相册选图', false) +
          '</div>' +
        '</div>' +
      '</div>'
    );
  },

  /**
   * 生成「拍照 / 选图」按钮（label 包裹 input）。
   * 用原生 label 激活文件输入，比 JS 手动 input.click() 在 iOS/Android 上更可靠。
   * 注意：input 不能 display:none（部分 iOS 版本 label 无法激活），改用视觉隐藏但保留在文档流中。
   * @param {string} label 按钮文案
   * @param {boolean} [capture] 是否直接用摄像头（capture="environment"）
   * @returns {string} HTML
   */
  _filePickerLabel(label, capture) {
    const captureAttr = capture ? ' capture="environment"' : '';
    const hiddenStyle = 'position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;padding:0';
    return (
      '<label class="btn ' + (capture ? 'btn-primary' : 'btn-secondary') + ' btn-sm" style="cursor:pointer;margin-top:14px">' + label +
        '<input type="file" class="sheet-photo-input" accept="image/*"' + captureAttr + ' style="' + hiddenStyle + '" onchange="SheetAnnotator._onFilePicked(event)">' +
      '</label>'
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
    // 拖拽态：放大上移（交给 .dragging），并在真实落点显示指向箭头
    pinEl.classList.add('dragging');
    this._dropMarker = this._ensureDropMarker(pinEl);
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
    if (this._dropMarker) {
      this._dropMarker.style.left = (newPinX * 100) + '%';
      this._dropMarker.style.top = (newPinY * 100) + '%';
    }
    ds.moved = true;
  },

  /**
   * 图钉拖拽结束
   */
  _onPinDragEnd(e) {
    if (!this._dragState) return;
    var ds = this._dragState;
    ds.pinEl.classList.remove('dragging');
    this._removeDropMarker();
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
   * 在真实落点处创建指向箭头（拖拽期间图钉头上移，箭头指示精确落点）
   * @param {HTMLElement} pinEl
   * @returns {HTMLElement}
   */
  _ensureDropMarker(pinEl) {
    var layer = pinEl.closest('.sheet-pins-layer');
    if (!layer) return null;
    var marker = layer.querySelector('.sheet-pin-drop-marker');
    if (!marker) {
      marker = document.createElement('div');
      marker.className = 'sheet-pin-drop-marker';
      layer.appendChild(marker);
    }
    var color = (getComputedStyle(pinEl).getPropertyValue('--pin-color') || '#ff5b6b').trim();
    marker.style.setProperty('--pin-color', color);
    marker.style.left = pinEl.style.left;
    marker.style.top = pinEl.style.top;
    return marker;
  },

  /**
   * 移除落点箭头
   */
  _removeDropMarker() {
    if (this._dropMarker && this._dropMarker.parentNode) {
      this._dropMarker.parentNode.removeChild(this._dropMarker);
    }
    this._dropMarker = null;
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
   * 渲染图钉层（按 photoPage 分到各页；编号用固定 pinNumber，不再按页动态重算）
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
    layers.forEach(function(layer) {
      var pageIdx = parseInt(layer.getAttribute('data-page'), 10);
      var pageNum = pageIdx + 1; // 1-based
      var pagePins = pinsByPage[pageNum] || [];
      if (pagePins.length === 0) return;
      layer.innerHTML = pagePins.map(function(p) {
        var num = p.pinNumber || 0;
        var cat = Feedback.CATEGORIES.find(function(c) { return c.key === p.category; });
        var icon = cat ? cat.icon : '📌';
        var pinResolved = (p.status === 'resolved');
        var cls = pinResolved ? 'pin-resolved' : 'pin-new';
        var tip = p.locationLabel ? Utils.escape(p.locationLabel) : ('#' + num);
        return (
          '<button type="button" class="sheet-pin ' + cls + '"' +
          ' data-pin-id="' + Utils.escape(p.id) + '"' +
          ' onmousedown="SheetAnnotator._onPinDragStart(event)"' +
          ' ontouchstart="SheetAnnotator._onPinDragStart(event)"' +
          ' style="left:' + (p.pinX * 100) + '%;top:' + (p.pinY * 100) + '%;"' +
          ' title="' + tip + '">' + num + '</button>'
        );
      }).join('');
    });
  },

  /**
   * 选图按钮（"换一张"复用；取第一个文件输入）
   */
  _pickPhoto() {
    var input = document.querySelector('.sheet-photo-input');
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
    // 部分手机摄像头/文件管理器返回空 type，此时不拦截，交给解码阶段判断
    if (file.type && !file.type.startsWith('image/')) {
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
      var msg = SheetAnnotator._photoErrorText(e);
      Utils.showToast('❌ 照片处理失败：' + msg, 'error', 5000);
    }
  },

  /**
   * 把处理失败的错误对象转成可读中文（DOMException 的 message 常为空，用 name 兜底）
   * @param {*} e
   * @returns {string}
   */
  _photoErrorText(e) {
    if (!e) return '可能是存储空间不足或浏览器不支持，请重试';
    if (e.message) {
      if (e.message.indexOf('图片加载失败') === 0) return '图片格式不受支持（可尝试用相册选择 JPG/PNG，或更换浏览器）';
      return e.message;
    }
    // message 为空时，用 DOMException.name 判断
    var nameMap = {
      'QuotaExceededError': '本地存储空间不足，请删除部分旧照片/录音后重试',
      'DataCloneError': '图片无法写入本地存储',
      'DataError': '图片数据异常',
      'NotSupportedError': '浏览器不支持该图片操作',
      'InvalidStateError': '浏览器状态异常，请重试',
      'SecurityError': '浏览器安全限制，请检查权限',
      'NotAllowedError': '权限被拒绝，请检查相册/文件权限',
      'NotFoundError': '找不到所选文件，请重试'
    };
    if (e.name && nameMap[e.name]) return nameMap[e.name];
    // 最后兜底：带上原始错误名，便于定位（DOMException 的 message 在 iOS 上常为空）
    if (e.name) return '浏览器错误(' + e.name + ')，请重试';
    return '可能是存储空间不足或浏览器不支持，请重试';
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
      var settled = false;
      // 兜底超时，避免 Safari 上图片加载/转码静默卡死
      var timeout = setTimeout(function() {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(url);
        reject(new Error('图片处理超时，请重试'));
      }, 20000);

      img.onload = function() {
        try {
          var w = img.naturalWidth;
          var h = img.naturalHeight;
          if (!w || !h) { throw new Error('图片尺寸无效'); }
          // 长边超过 maxWidth 时等比缩小（此前只限制宽度，竖长图可能产生超大 canvas）
          if (w > maxWidth || h > maxWidth) {
            var scale = Math.min(maxWidth / w, maxWidth / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          if (!ctx) { throw new Error('无法创建画布'); }
          ctx.drawImage(img, 0, 0, w, h);

          // 直接用 canvas.toDataURL（iOS Safari 上比 toBlob 更可靠，避免 Blob 转存失败）
          var dataURL = canvas.toDataURL('image/jpeg', quality);
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          resolve(SheetAnnotator._dataURLToBlob(dataURL));
        } catch (e) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          reject(e && e.message ? e : new Error('图片处理异常'));
        }
      };
      img.onerror = function() {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        reject(new Error('图片加载失败（格式可能不受支持）'));
      };
      img.src = url;
    });
  },

  /**
   * dataURL → Blob（canvas.toBlob 不可用或返回 null 时的降级方案）
   * @param {string} dataURL
   * @returns {Blob}
   */
  _dataURLToBlob(dataURL) {
    var parts = dataURL.split(',');
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    var bin = atob(parts[1]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
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
    this._dropMarker = null;
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