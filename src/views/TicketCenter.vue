<template>
  <div>
    <div class="tc-head">
      <div>
        <h1 class="page-title">处置工单</h1>
        <p class="page-subtitle">预警 → 工单 → 处置 → 闭环 全流程追踪</p>
      </div>
      <button class="btn" @click="refresh" :disabled="ticketStore.loading">
        {{ ticketStore.loading ? '刷新中...' : '刷新' }}
      </button>
    </div>

    <!-- 统计：以 /tickets/stats 为准，不受当前筛选影响 -->
    <div class="tc-stats" v-if="stats">
      <div class="tc-stat glass-card">
        <div class="tcs-label">工单总数</div>
        <div class="tcs-value">{{ stats.total }}</div>
      </div>
      <div class="tc-stat glass-card" v-for="s in statusList()" :key="s.key">
        <div class="tcs-label">{{ s.label }}</div>
        <div class="tcs-value">{{ stats.byStatus?.[s.key] ?? 0 }}</div>
      </div>
      <div class="tc-stat glass-card">
        <div class="tcs-label">待认领</div>
        <div class="tcs-value" :class="{ 'tcs-warn': stats.unassigned > 0 }">{{ stats.unassigned }}</div>
      </div>
      <div class="tc-stat glass-card">
        <div class="tcs-label">闭环率</div>
        <div class="tcs-value">{{ stats.closedRate }}%</div>
      </div>
    </div>

    <div v-if="ticketStore.error" class="state-wrap">
      <ErrorState title="工单加载失败" :description="ticketStore.error" @retry="refresh" />
    </div>

    <template v-else>
      <div class="filter-tabs" style="margin-bottom: 20px;">
        <button class="filter-tab" :class="{ active: !ticketStore.filters.status }" @click="setStatus('')">
          全部 ({{ ticketStore.tickets.length }})
        </button>
        <button
          class="filter-tab"
          v-for="s in statusList()"
          :key="s.key"
          :class="{ active: ticketStore.filters.status === s.key }"
          @click="setStatus(s.key)"
        >
          {{ s.label }} ({{ stats?.byStatus?.[s.key] ?? 0 }})
        </button>
      </div>

      <div v-if="ticketStore.loading && !ticketStore.tickets.length" class="empty-state" style="padding: 60px;">
        加载中...
      </div>

      <div v-else-if="!ticketStore.tickets.length" class="empty-state" style="padding: 60px;">
        暂无工单，可在预警中心一键生成
      </div>

      <div class="tc-list" v-else>
        <div
          class="tc-card glass-card warn-bar"
          :class="`warn-${t.level || 'blue'}`"
          v-for="t in ticketStore.tickets"
          :key="t.id"
        >
          <div class="tcc-main" @click="toggle(t.id)" role="button" tabindex="0"
               @keydown.enter.prevent="toggle(t.id)">
            <div class="tcc-left">
              <div class="tcc-title-row">
                <span class="warn-tag" :class="`warn-${t.level || 'blue'}`">{{ warningLabel(t.level) }}</span>
                <span class="badge" :class="statusBadge(t.status)">{{ statusLabel(t.status) }}</span>
                <span class="tcc-title">{{ t.title }}</span>
              </div>
              <div class="tcc-meta">
                <span>{{ t.city || '未指定城市' }}</span>
                <span class="tcc-dot">·</span>
                <span>负责人：{{ t.assignee || '待认领' }}</span>
                <span class="tcc-dot">·</span>
                <span>创建：{{ t.createdBy }}</span>
                <span class="tcc-dot">·</span>
                <span>{{ formatDateTime(t.updatedAt) }}</span>
              </div>
            </div>
            <div class="tcc-right">
              <router-link v-if="t.typhoonId" :to="`/typhoon/${t.typhoonId}`" class="tcc-link"
                           @click.stop>台风详情</router-link>
              <span class="tcc-caret" :class="{ 'is-open': expandedId === t.id }">▾</span>
            </div>
          </div>

          <div class="tcc-detail" v-if="expandedId === t.id">
            <div class="tcc-desc" v-if="t.description">{{ t.description }}</div>

            <div class="tcc-section">
              <div class="tcc-section-title">处置记录</div>
              <TicketTimeline :timeline="t.timeline || []" />
            </div>

            <div class="tcc-section">
              <div class="tcc-section-title">状态流转</div>
              <!-- 只渲染状态机允许的目标：非法目标不出现，而不是点了再报错 -->
              <div class="tcc-actions" v-if="nextStatuses(t.status).length">
                <button
                  class="btn tcc-btn"
                  v-for="s in nextStatuses(t.status)"
                  :key="s"
                  :disabled="ticketStore.submitting"
                  @click="changeStatus(t, s)"
                >
                  流转到「{{ statusLabel(s) }}」
                </button>
              </div>
              <div v-else class="tcc-hint">工单已闭环，不可再变更状态（仍可补充处置意见）</div>
            </div>

            <div class="tcc-section">
              <div class="tcc-section-title">补充处置意见</div>
              <div class="tcc-comment">
                <textarea
                  class="tcc-textarea"
                  v-model="commentDrafts[t.id]"
                  placeholder="记录处置进展、协调事项或复盘结论"
                ></textarea>
                <button
                  class="btn tcc-btn"
                  :disabled="ticketStore.submitting || !(commentDrafts[t.id] || '').trim()"
                  @click="submitComment(t)"
                >提交</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useTicketStore } from '../stores/ticket'
import { statusList, statusLabel, statusBadge, nextStatuses } from '../constants/ticket'
import { warningLabel } from '../constants/typhoon'
import { formatDateTime } from '../utils/format'
import { toast } from '../utils/toast'
import ErrorState from '../components/ErrorState.vue'
import TicketTimeline from '../components/TicketTimeline.vue'

const ticketStore = useTicketStore()
const expandedId = ref('')
const commentDrafts = reactive({})

const stats = computed(() => ticketStore.stats)

async function refresh() {
  try {
    await Promise.all([ticketStore.fetchTickets(), ticketStore.fetchStats()])
  } catch {
    /* 错误文案由 store 记录并展示 */
  }
}

async function setStatus(status) {
  ticketStore.setFilter('status', status)
  try { await ticketStore.fetchTickets() } catch { /* noop */ }
}

function toggle(id) {
  expandedId.value = expandedId.value === id ? '' : id
}

async function changeStatus(ticket, status) {
  try {
    await ticketStore.changeStatus(ticket.id, status)
    toast.success(`已流转到「${statusLabel(status)}」`)
  } catch {
    /* 请求层已提示 */
  }
}

async function submitComment(ticket) {
  const content = (commentDrafts[ticket.id] || '').trim()
  if (!content) return
  try {
    await ticketStore.addComment(ticket.id, content)
    commentDrafts[ticket.id] = ''
    toast.success('已记录处置意见')
  } catch {
    /* 请求层已提示 */
  }
}

onMounted(refresh)
</script>

<style scoped>
.tc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.tc-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}

.tc-stat { padding: 16px 18px; }
.tcs-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.tcs-value { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
.tcs-warn { color: #fbbf24; }

.tc-list { display: flex; flex-direction: column; gap: 12px; }

.tc-card { padding: 18px 20px; }

.tcc-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  cursor: pointer;
  outline: none;
}

.tcc-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tcc-title { font-size: 15px; font-weight: 600; }

.tcc-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tcc-dot { opacity: 0.5; }

.tcc-right { display: flex; align-items: center; gap: 10px; }
.tcc-link { font-size: 12px; color: var(--blue); text-decoration: none; white-space: nowrap; }
.tcc-link:hover { text-decoration: underline; }

.tcc-caret { color: var(--text-muted); font-size: 12px; transition: transform var(--transition); }
.tcc-caret.is-open { transform: rotate(180deg); }

.tcc-detail {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.tcc-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.7;
}

.tcc-section { margin-bottom: 18px; }
.tcc-section:last-child { margin-bottom: 0; }

.tcc-section-title {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tcc-actions { display: flex; gap: 10px; flex-wrap: wrap; }

.tcc-btn { padding: 6px 14px; font-size: 13px; }

.tcc-hint { font-size: 12px; color: var(--text-muted); }

.tcc-comment { display: flex; gap: 10px; align-items: flex-start; }

.tcc-textarea {
  flex: 1;
  min-height: 62px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  outline: none;
}
.tcc-textarea:focus { border-color: var(--blue); }

.empty-state, .state-wrap {
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
