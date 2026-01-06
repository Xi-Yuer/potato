<template>
  <view class="today-tasks-header" v-if="show">
    <uni-datetime-picker
      type="date"
      :value="modelValue"
      @change="handleDateChange"
      :start="minDate"
      :end="maxDate"
      class="today-tasks-title-section"
    >
      <text class="today-tasks-title">今日任务</text>
      <view class="today-date">
        {{ formattedDate }}
        <uni-icons type="forward" size="12" color="#8c8c8c"></uni-icons>
      </view>
    </uni-datetime-picker>
    <view class="today-stats">
      <text class="today-completion-text">
        完成度 {{ completionText }}
      </text>
    </view>
  </view>
</template>

<script setup>
import { computed } from "vue";
import { formatDate, getMinDate, getMaxDate, parseDatePickerValue } from "@/utils/date";

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  completionText: {
    type: String,
    default: "0/0",
  },
  show: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["update:modelValue", "change"]);

const formattedDate = computed(() => formatDate(props.modelValue));
const minDate = getMinDate();
const maxDate = getMaxDate();

const handleDateChange = (e) => {
  const dateStr = parseDatePickerValue(e);
  if (dateStr) {
    emit("update:modelValue", dateStr);
    emit("change", dateStr);
  }
};
</script>

<style lang="scss" scoped>
.today-tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0 16px 12px 16px;
  margin-top: 40rpx;
}

.today-tasks-title-section {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.today-tasks-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.5;
  margin-bottom: 4px;
}

.today-date {
  font-size: 12px;
  color: #8c8c8c;
  font-weight: 400;
  line-height: 1.4;
}

.today-stats {
  flex-shrink: 0;
  margin-left: 16px;
  margin-top: 2px;
}

.today-completion-text {
  font-size: 14px;
  color: #1a1a1a;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
}
</style>

