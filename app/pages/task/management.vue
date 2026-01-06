<template>
  <view class="management-container">
    <view class="content">
      <!-- 任务模块管理 -->
      <view class="section">
        <view v-if="modules.length === 0" class="empty-state">
          <uni-icons type="info" size="40" color="#9ca3af"></uni-icons>
          <text class="empty-text">暂无任务模块</text>
        </view>

        <view v-else class="module-list">
          <uni-collapse
            v-model="expandedModuleId"
            @change="handleCollapseChange"
            accordion
          >
            <uni-collapse-item
              v-for="module in modules"
              :key="module.id"
              :name="String(module.id)"
              :show-arrow="false"
              :border="false"
            >
              <!-- 自定义标题 -->
              <template #title>
                <view class="module-item">
                  <view class="module-info">
                    <uni-icons
                      :type="
                        expandedModuleId === String(module.id)
                          ? 'up'
                          : 'arrowright'
                      "
                      size="16"
                      color="#6b7280"
                      class="expand-icon"
                    ></uni-icons>
                    <text class="module-name">{{ module.name }}</text>
                    <text
                      v-if="module.startTime || module.endTime"
                      class="module-time"
                    >
                      {{ getTimeRange(module) }}
                    </text>
                  </view>
                  <view class="module-actions">
                    <view
                      class="action-btn add-task-btn"
                      @click.stop="handleAddTask(module)"
                    >
                      <uni-icons
                        type="plus"
                        size="14"
                        color="#ffffff"
                      ></uni-icons>
                      <text class="action-btn-text">任务</text>
                    </view>
                    <view
                      class="action-icon"
                      @click.stop="handleEditModule(module)"
                    >
                      <uni-icons
                        type="compose"
                        size="20"
                        color="#1a1a1a"
                      ></uni-icons>
                    </view>
                    <view
                      class="action-icon"
                      @click.stop="handleDeleteModule(module)"
                    >
                      <uni-icons
                        type="trash"
                        size="20"
                        color="#ef4444"
                      ></uni-icons>
                    </view>
                  </view>
                </view>
              </template>

              <!-- 任务列表 -->
              <view class="task-list">
                <view
                  v-if="
                    !moduleTasks[module.id] ||
                    moduleTasks[module.id].length === 0
                  "
                  class="task-empty"
                >
                  <text class="task-empty-text">暂无任务</text>
                </view>
                <view
                  v-else
                  v-for="task in moduleTasks[module.id]"
                  :key="task.id"
                  class="task-item"
                >
                  <view class="task-info">
                    <text class="task-name">{{ task.name }}</text>
                    <text v-if="task.description" class="task-desc">
                      {{ task.description }}
                    </text>
                  </view>
                  <view class="task-actions">
                    <view
                      class="action-icon"
                      @click.stop="handleEditTask(task)"
                    >
                      <uni-icons
                        type="compose"
                        size="18"
                        color="#1a1a1a"
                      ></uni-icons>
                    </view>
                    <view
                      class="action-icon"
                      @click.stop="handleDeleteTask(task)"
                    >
                      <uni-icons
                        type="trash"
                        size="18"
                        color="#ef4444"
                      ></uni-icons>
                    </view>
                  </view>
                </view>
              </view>
            </uni-collapse-item>
          </uni-collapse>
        </view>
      </view>
    </view>
    <!-- 右下角悬浮按钮 -->
    <view class="fab-button" @click="handleAddModule">
      <uni-icons type="plusempty" size="28" color="#ffffff"></uni-icons>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { taskApi } from "../../utils/api.js";

const modules = ref([]);
const expandedModuleId = ref(null); // 手风琴模式：当前展开的模块ID（字符串类型）
const moduleTasks = ref({});

// 获取任务模块列表
const getModules = async () => {
  try {
    const res = await taskApi.getModules();
    if (res) {
      modules.value = res;
    }
  } catch (error) {
    console.error("获取任务模块失败:", error);
    uni.showToast({
      title: "获取任务模块失败",
      icon: "none",
    });
  }
};

// 获取模块下的任务模板
const getModuleTasks = async (moduleId) => {
  try {
    const res = await taskApi.getTasks(moduleId);
    // 后端返回任务模板列表
    if (res && Array.isArray(res)) {
      moduleTasks.value[moduleId] = res;
    } else {
      moduleTasks.value[moduleId] = [];
    }
  } catch (error) {
    console.error("获取任务失败:", error);
    uni.showToast({
      title: "获取任务失败",
      icon: "none",
    });
    moduleTasks.value[moduleId] = [];
  }
};

// 获取时间段显示
const getTimeRange = (module) => {
  if (module.startTime && module.endTime) {
    return `${module.startTime.substring(0, 5)} - ${module.endTime.substring(
      0,
      5
    )}`;
  } else if (module.startTime) {
    return `${module.startTime.substring(0, 5)} 开始`;
  } else if (module.endTime) {
    return `${module.endTime.substring(0, 5)} 结束`;
  }
  return "";
};

// 处理折叠面板展开/收起事件（手风琴模式）
const handleCollapseChange = async (value) => {
  // accordion 模式下，value 是当前展开的面板 ID（字符串类型）
  expandedModuleId.value = value;
  // 如果展开了一个模块，且还没有加载任务，则加载任务
  if (value) {
    const moduleId = Number(value); // 转换为数字用于查询任务
    if (!moduleTasks.value[moduleId]) {
      await getModuleTasks(moduleId);
    }
  }
};

// 添加模块
const handleAddModule = () => {
  uni.navigateTo({
    url: "/pages/task/module-edit",
  });
};

// 编辑模块
const handleEditModule = (module) => {
  uni.navigateTo({
    url: `/pages/task/module-edit?id=${module.id}`,
  });
};

// 删除模块
const handleDeleteModule = (module) => {
  uni.showModal({
    title: "确认删除",
    content: `确定要删除模块"${module.name}"吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await taskApi.deleteModule(module.id);
          uni.showToast({
            title: "删除成功",
            icon: "success",
          });
          // 如果删除的是当前展开的模块，清空展开状态
          if (expandedModuleId.value === String(module.id)) {
            expandedModuleId.value = null;
          }
          // 删除该模块的任务缓存
          delete moduleTasks.value[module.id];
          getModules();
        } catch (error) {
          console.error("删除模块失败:", error);
          uni.showToast({
            title: "删除失败",
            icon: "none",
          });
        }
      }
    },
  });
};

// 添加任务
const handleAddTask = (module) => {
  uni.navigateTo({
    url: `/pages/task/task-edit?moduleId=${
      module.id
    }&moduleName=${encodeURIComponent(module.name)}`,
  });
};

// 编辑任务
const handleEditTask = (task) => {
  uni.navigateTo({
    url: `/pages/task/task-edit?id=${task.id}`,
  });
};

// 删除任务
const handleDeleteTask = (task) => {
  uni.showModal({
    title: "确认删除",
    content: `确定要删除任务"${task.name}"吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await taskApi.deleteTask(task.id);
          uni.showToast({
            title: "删除成功",
            icon: "success",
          });
          // 重新加载该模块的任务
          await getModuleTasks(task.moduleId);
        } catch (error) {
          console.error("删除任务失败:", error);
          uni.showToast({
            title: "删除失败",
            icon: "none",
          });
        }
      }
    },
  });
};

onMounted(() => {
  getModules();
});
</script>

<style lang="scss" scoped>
.management-container {
  min-height: 100vh;
  width: 100%;
  background-color: #ffffff;
}

/* 顶部导航栏 */
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 32rpx;
  background-color: #ffffff;
  border-bottom: 1rpx solid #f0f0f0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-left {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a1a;
  letter-spacing: -0.5rpx;
}

.nav-right {
  width: 60rpx;
}

.content {
  padding: 0;
}

.section {
  width: 100%;
  background-color: #ffffff;
  padding: 0;
  margin-bottom: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.empty-text {
  margin-top: 20rpx;
  font-size: 28rpx;
  color: #999999;
}

.module-list {
  display: flex;
  flex-direction: column;
}

/* uni-collapse 样式覆盖 */
.module-list :deep(.uni-collapse-item) {
  border-bottom: 1rpx solid #f0f0f0;
}

.module-list :deep(.uni-collapse-item:last-child) {
  border-bottom: none;
}

.module-list :deep(.uni-collapse-item__title) {
  padding: 0;
  border: none;
}

.module-list :deep(.uni-collapse-item__wrap) {
  border: none;
}

.module-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx;
  background-color: #ffffff;
  cursor: pointer;
  transition: background-color 0.2s;
}

.module-item:active {
  background-color: #fafafa;
}

.module-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.expand-icon {
  flex-shrink: 0;
  transition: transform 0.2s;
}

.module-name {
  font-size: 30rpx;
  font-weight: 500;
  color: #1a1a1a;
  letter-spacing: -0.3rpx;
}

.module-time {
  font-size: 24rpx;
  color: #999999;
  margin-left: 12rpx;
}

.module-actions {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 10rpx 16rpx;
  background-color: #1a1a1a;
  border-radius: 0;
  line-height: 1;
}

.action-btn-text {
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 500;
}

.action-icon {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 任务列表 */
.task-list {
  background-color: #fafafa;
  padding: 0;
  display: flex;
  flex-direction: column;
  margin-left: 50rpx;
}

.task-empty {
  padding: 60rpx 32rpx;
  text-align: center;
}

.task-empty-text {
  font-size: 26rpx;
  color: #999999;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  background-color: #ffffff;
  border-bottom: 1rpx solid #f0f0f0;
}

.task-item:last-child {
  border-bottom: none;
}

.task-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.task-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #1a1a1a;
  letter-spacing: -0.3rpx;
}

.task-desc {
  font-size: 24rpx;
  color: #666666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  margin-top: 4rpx;
}

.task-actions {
  display: flex;
  gap: 24rpx;
  align-items: center;
}

.action-icon {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 悬浮按钮 */
.fab-button {
  position: fixed;
  right: 32rpx;
  bottom: 32rpx;
  width: 112rpx;
  height: 112rpx;
  background-color: #1a1a1a;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
  z-index: 999;
  transition: transform 0.2s, box-shadow 0.2s;
}

.fab-button:active {
  transform: scale(0.95);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
}
</style>
