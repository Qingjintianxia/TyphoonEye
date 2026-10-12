<template>
  <div class="dialog-mask" v-if="open" @click.self="close">
    <div class="dialog glass-card" role="dialog" aria-modal="true" aria-label="生成处置工单">
      <div class="dialog-head">
        <h3 class="dialog-title">生成处置工单</h3>
        <button class="dialog-close" @click="close" aria-label="关闭">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- 来源信息只读：用户需要确认"我在为哪条预警建单" -->
      <div class="dialog-alert warn-bar" :class="`warn-${alert?.level || 'blue'}`">
        <div class="da-row">
          <span class="warn-tag" :class="`warn-${alert?.level || 'blue'}`">{{ warningLabel(alert?.level) }}</span>
          <span class="badge" :class="alertSourceMeta(alert?.source).badge">{{ alertSourceMeta(alert?.source).label }}</span>
        </div>
        <div class="da-title">{{ alert?.title || '未命名预警' }}</div>
        <div class="da-meta">
          {{ alert?.city || '未指定城市' }}<template v-if="alert?.typhoonName"> · {{ alert.typhoonName }}</template>
        </div>
      </div>

      <label class="field">
        <span class="field-label">工单标题</span>
        <input class="field-input" v-model="form.title" placeholder="例如：珠海 台风预警处置" />
      </label>

      <label class="field">
        <span class="field-label">负责人</span>
        <select class="field-input" v-model="form.assignee">
          <option value="">暂不指派</option>
          <option v-for="u in users" :key="u.id || u.username" :value="u.username">{{ u.username }}</option>
        </select>
        <span class="field-hint">不指派时，工单将停留在「待处置」等待认领。</span>
      </label>

      <label class="field">
        <span class="field-label">处置说明</span>
        <textarea class="field-input field-textarea" v-model="form.description"
                  placeholder="补充处置要求、联系人、时限等（选填）"></textarea>
      </label>

      <div class="dialog-actions">
        <button class="btn" @click="close" :disabled="ticketStore.submitting">取消</button>
        <button class="btn btn-primary" @click="submit" :disabled="ticketStore.submitting">
          {{ ticketStore.submitting ? '提交中...' : '创建工单' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { useTicketStore } from '../stores/ticket'
import { warningLabel } from '../constants/typhoon'
import { alertSourceMeta } from '../constants/ticket'
import { toast } from '../utils/toast'

const props = defineProps({
  open: { type: Boolean, default: false },
  alert: { type: Object, default: null },
  users: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'created'])

const ticketStore = useTicketStore()
const form = reactive({ title: '', assignee: '', description: '' })

// 每次打开都以当前预警重新预填
watch(
  () => [props.open, props.alert],
  ([isOpen, alert]) => {
    if (!isOpen || !alert) return
    form.title = `${alert.city || alert.typhoonName || '预警'} 处置工单`
    form.assignee = ''
    form.description = alert.content || ''
  },
  { immediate: true }
)

function close() {
  if (ticketStore.submitting) return
  emit('close')
}

async function submit() {
  const alert = props.alert
  if (!alert) return
  try {
    const ticket = await ticketStore.createTicket({
      alertId: alert.id,
      typhoonId: alert.typhoonId || '',
      typhoonName: alert.typhoonName || '',
      city: alert.city || '',
      level: alert.level || '',
      title: form.title.trim() || `${alert.typhoonName || ''} 预警处置`.trim(),
      description: form.description.trim(),
      assignee: form.assignee
    })
    toast.success('工单已创建')
    emit('created', ticket)
    emit('close')
  } catch (e) {
    // 失败时弹窗保持打开，用户可修正后重试
    console.warn('[ticket] 建单失败：', e)
  }
}
</script>

<style scoped>
.dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.dialog {
  width: 100%;
  max-width: 480px;
  padding: 24px;
  background: var(--bg-secondary);
  box-shadow: var(--shadow-lg);
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.dialog-title { font-size: 17px; font-weight: 600; }

.dialog-close {
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
}
.dialog-close:hover { color: var(--text-primary); }

.dialog-alert {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);
  margin-bottom: 18px;
}

.da-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.da-title { font-size: 14px; font-weight: 600; }
.da-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.field { display: block; margin-bottom: 14px; }

.field-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.field-input {
  width: 100%;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color var(--transition);
}

.field-input:focus { border-color: var(--blue); }

.field-textarea { min-height: 84px; resize: vertical; line-height: 1.6; }

.field-hint {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 5px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
</style>
