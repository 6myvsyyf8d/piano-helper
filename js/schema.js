"use strict";

/* ==========================================
   📋 数据 Schema 版本管理
   ==========================================
   设计意图：
     未来迭代会扩展数据模型（LogEntry.metrics、Lesson.videoMarkers、
     FeedbackItem 集合等）。统一的版本号 + 自动迁移机制，
     确保旧用户升级时不丢数据、新字段有默认值。

   版本号说明：
     - 存于 localStorage key: piano_schema_version
     - 与应用版本号（RepertoireManager.VERSION 如 "v3.4"）独立
     - 每次数据模型变更必须递增 CURRENT_VERSION 并注册 migration

   迁移规则：
     - 从 current+1 顺序执行到 CURRENT_VERSION
     - migration 函数直接操作 localStorage（不依赖 DB 对象）
     - 必须幂等：重复执行不应产生副作用
   ========================================== */

const Schema = {
  VERSION_KEY: 'piano_schema_version',
  CURRENT_VERSION: 9,

  /**
   * 迁移函数注册表
   * key = 目标版本号，value = (localStorage 操作) => void
   */
  migrations: {
    /**
     * v3 → v4: 给 LogEntry 增加 metrics 字段（Phase 1 录音分析使用）
     * 数据结构：piano_logs = Log[]，Log.entries = LogEntry[]
     */
    4: () => {
      try {
        const raw = localStorage.getItem('piano_logs');
        if (!raw) return;
        const logs = JSON.parse(raw);
        if (!Array.isArray(logs)) return;

        logs.forEach(log => {
          if (!log || !Array.isArray(log.entries)) return;
          log.entries.forEach(entry => {
            if (entry && entry.metrics === undefined) {
              entry.metrics = null; // null 表示"未分析"，区别于分析失败的 {}
            }
          });
        });

        localStorage.setItem('piano_logs', JSON.stringify(logs));
      } catch (error) {
        console.error('Schema migration v4 failed:', error);
        // 不抛出，避免阻塞启动——旧数据仍可用，只是 metrics 缺失
      }
    },

    /**
     * v4 → v5: 给 Lesson 增加 videoMarkers 字段（Phase 1 课堂标记使用）
     * 数据结构：piano_lessons = Lesson[]
     */
    5: () => {
      try {
        const raw = localStorage.getItem('piano_lessons');
        if (!raw) return;
        const lessons = JSON.parse(raw);
        if (!Array.isArray(lessons)) return;

        lessons.forEach(lesson => {
          if (lesson && !Array.isArray(lesson.videoMarkers)) {
            lesson.videoMarkers = [];
          }
        });

        localStorage.setItem('piano_lessons', JSON.stringify(lessons));
      } catch (error) {
        console.error('Schema migration v5 failed:', error);
      }
    },

    /**
     * v5 → v6: 新增 piano_feedbacks 集合（FeedbackItem[]）
     * 旧用户无此 key，初始化为空数组
     */
    6: () => {
      try {
        if (localStorage.getItem('piano_feedbacks') === null) {
          localStorage.setItem('piano_feedbacks', '[]');
        }
      } catch (error) {
        console.error('Schema migration v6 failed:', error);
      }
    },

    /**
     * v6 → v7: VideoMarker 增加 audioBlobId/audioDuration 字段；
     * FeedbackItem 增加 audioBlobId/audioDuration 字段
     * 旧数据缺失时填充 null，保证字段一致
     */
    7: () => {
      try {
        // 1) Lesson.videoMarkers[*] → 音频字段
        const rawLessons = localStorage.getItem('piano_lessons');
        if (rawLessons) {
          const lessons = JSON.parse(rawLessons);
          if (Array.isArray(lessons)) {
            let changed = false;
            lessons.forEach(lesson => {
              if (!Array.isArray(lesson.videoMarkers)) return;
              lesson.videoMarkers.forEach(m => {
                if (m.audioBlobId === undefined) { m.audioBlobId = null; changed = true; }
                if (m.audioDuration === undefined) { m.audioDuration = null; changed = true; }
              });
            });
            if (changed) localStorage.setItem('piano_lessons', JSON.stringify(lessons));
          }
        }
        // 2) FeedbackItem[*] → 音频字段
        const rawFbs = localStorage.getItem('piano_feedbacks');
        if (rawFbs) {
          const fbs = JSON.parse(rawFbs);
          if (Array.isArray(fbs)) {
            let changed = false;
            fbs.forEach(f => {
              if (f.audioBlobId === undefined) { f.audioBlobId = null; changed = true; }
              if (f.audioDuration === undefined) { f.audioDuration = null; changed = true; }
            });
            if (changed) localStorage.setItem('piano_feedbacks', JSON.stringify(fbs));
          }
        }
      } catch (error) {
        console.error('Schema migration v7 failed:', error);
      }
    },

    /**
     * v7 → v8: 课堂标记升级为背景录音 + 书签
     * - Lesson: videoMarkers → audioMarkers，新增 lessonAudioId/audioDurationSec
     * - Marker: 移除 audioBlobId/audioDuration（不再按标记片段录音）
     * - FeedbackItem: 移除 audioBlobId/audioDuration（音频在 Lesson 级别）
     * - 旧的片段录音 blob 从 IndexedDB 删除（异步，不阻塞迁移）
     */
    8: () => {
      try {
        var oldBlobIds = [];

        // 1) Lesson: videoMarkers → audioMarkers + 新增字段
        var rawLessons = localStorage.getItem('piano_lessons');
        if (rawLessons) {
          var lessons = JSON.parse(rawLessons);
          if (Array.isArray(lessons)) {
            var changed = false;
            lessons.forEach(function(lesson) {
              if (!lesson) return;
              // 新增 lessonAudioId / audioDurationSec
              if (lesson.lessonAudioId === undefined) { lesson.lessonAudioId = null; changed = true; }
              if (lesson.audioDurationSec === undefined) { lesson.audioDurationSec = 0; changed = true; }
              // videoMarkers → audioMarkers
              if (Array.isArray(lesson.videoMarkers)) {
                lesson.audioMarkers = lesson.videoMarkers;
                delete lesson.videoMarkers;
                changed = true;
              }
              // marker 内移除 audioBlobId/audioDuration，收集旧 blob id
              var markers = lesson.audioMarkers || [];
              markers.forEach(function(m) {
                if (m.audioBlobId) {
                  oldBlobIds.push(m.audioBlobId);
                  delete m.audioBlobId;
                  changed = true;
                }
                if (m.audioDuration !== undefined) {
                  delete m.audioDuration;
                  changed = true;
                }
              });
            });
            if (changed) localStorage.setItem('piano_lessons', JSON.stringify(lessons));
          }
        }

        // 2) FeedbackItem: 移除 audioBlobId/audioDuration
        var rawFbs = localStorage.getItem('piano_feedbacks');
        if (rawFbs) {
          var fbs = JSON.parse(rawFbs);
          if (Array.isArray(fbs)) {
            var fbChanged = false;
            fbs.forEach(function(f) {
              if (f.audioBlobId) {
                oldBlobIds.push(f.audioBlobId);
                delete f.audioBlobId;
                fbChanged = true;
              }
              if (f.audioDuration !== undefined) {
                delete f.audioDuration;
                fbChanged = true;
              }
            });
            if (fbChanged) localStorage.setItem('piano_feedbacks', JSON.stringify(fbs));
          }
        }

        // 3) 异步删除旧的片段录音 blob（不阻塞迁移）
        if (oldBlobIds.length && typeof StorageAdapter !== 'undefined') {
          oldBlobIds.forEach(function(id) {
            StorageAdapter.remove(id).catch(function() {});
          });
          console.log('📋 Schema v8: cleaned ' + oldBlobIds.length + ' old segment audio blobs');
        }
      } catch (error) {
        console.error('Schema migration v8 failed:', error);
      }
    },

    /**
     * v8 → v9: 课堂录音支持多段
     * - 新增 lessonAudios: [{id, startSec, durationSec}] 数组
     * - 旧 lessonAudioId + audioDurationSec 转为 lessonAudios 的首段
     * - 保留 lessonAudioId/audioDurationSec 字段向后兼容（= 首段 id / 最后一段 endSec）
     */
    9: () => {
      try {
        var rawLessons = localStorage.getItem('piano_lessons');
        if (rawLessons) {
          var lessons = JSON.parse(rawLessons);
          if (Array.isArray(lessons)) {
            var changed = false;
            lessons.forEach(function(lesson) {
              if (!lesson) return;
              if (!Array.isArray(lesson.lessonAudios)) {
                if (lesson.lessonAudioId) {
                  // 旧单段录音 → 转为首段
                  lesson.lessonAudios = [{
                    id: lesson.lessonAudioId,
                    startSec: 0,
                    durationSec: lesson.audioDurationSec || 0
                  }];
                } else {
                  lesson.lessonAudios = [];
                }
                changed = true;
              }
            });
            if (changed) localStorage.setItem('piano_lessons', JSON.stringify(lessons));
          }
        }
      } catch (error) {
        console.error('Schema migration v9 failed:', error);
      }
    }
  },

  /**
   * 读取当前 schema 版本
   * @returns {number}
   */
  currentVersion() {
    return parseInt(localStorage.getItem(this.VERSION_KEY) || '3', 10);
  },

  /**
   * 执行迁移：从当前版本升级到 CURRENT_VERSION
   * 幂等——已是最新版本时直接返回。
   */
  migrate() {
    const current = this.currentVersion();
    if (current >= this.CURRENT_VERSION) {
      // 首次安装（无版本号）也写入，便于后续判断
      if (!localStorage.getItem(this.VERSION_KEY)) {
        localStorage.setItem(this.VERSION_KEY, String(this.CURRENT_VERSION));
      }
      return;
    }

    console.log(`📋 Schema migrating: v${current} → v${this.CURRENT_VERSION}`);
    for (let v = current + 1; v <= this.CURRENT_VERSION; v++) {
      const migration = this.migrations[v];
      if (migration) {
        console.log(`  ├─ running migration v${v}`);
        migration();
      }
    }
    localStorage.setItem(this.VERSION_KEY, String(this.CURRENT_VERSION));
    console.log(`✅ Schema migration done: v${this.CURRENT_VERSION}`);
  }
};

window.Schema = Schema;
