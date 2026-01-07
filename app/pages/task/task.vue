<template>
  <view class="task-container">
    <!-- 用户信息和问候语 -->
    <user-header :user-info="userInfo" :location-info="locationInfo" />

    <!-- 打卡信息 -->
    <attendances />

    <!-- 今日任务标题区域 -->
    <date-picker-header
      v-model="selectedDate"
      :completion-text="`${totalCompletedCount}/${totalTasksCount}`"
      :show="modules.length > 0"
      @change="handleDateChange"
    />

    <!-- Tab 切换栏 -->
    <view class="tab-section" v-if="modules.length > 0">
      <scroll-view
        class="tab-scroll-view"
        scroll-x
        :scroll-left="scrollLeft"
        :scroll-with-animation="true"
        :show-scrollbar="false"
      >
        <uni-segmented-control
          :current="currentModuleIndex"
          :values="moduleNames"
          :activeColor="'#000000'"
          :inActiveColor="'#000000'"
          styleType="text"
          @clickItem="onTabClick"
          class="segmented-control-wrapper"
        ></uni-segmented-control>
      </scroll-view>
    </view>

    <!-- 任务列表 -->
    <view class="tasks-content" v-if="currentModule && currentModule.tasks">
      <!-- 顶部标题和完成度 -->
      <view class="tasks-header">
        <text class="completion-rate"
          >{{ currentModule.startTime }} - {{ currentModule.endTime }}</text
        >
        <text class="completion-rate">
          完成度 {{ completedCount }}/{{ totalCount }}
        </text>
      </view>
      <!-- 任务时间线列表 -->
      <view class="tasks-timeline">
        <task-timeline
          v-for="(task, index) in currentModule.tasks"
          :key="task.id"
          :task="task"
          :index="index"
          :is-last="index === currentModule.tasks.length - 1"
          :module-start-time="currentModule.startTime"
          @task-click="handleTaskClick"
          @take-photo="handleTakePhoto"
        />
      </view>

      <view v-if="currentModule.tasks.length === 0" class="empty-tasks">
        <text>该模块暂无任务</text>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="modules.length === 0" class="empty-state">
      <text>暂无可用模块</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { taskApi, userApi } from "@/utils/api";
import { storage } from "@/utils/storage.js";
import { getTodayDate } from "@/utils/date";
import {
  calculateModuleCompletion,
  calculateTotalCompletion,
} from "@/utils/task";
import UserHeader from "@/components/user-header/user-header.vue";
import Attendances from "@/components/attendances/attendances.vue";
import DatePickerHeader from "@/components/date-picker-header/date-picker-header.vue";
import TaskTimeline from "@/components/task-timeline/task-timeline.vue";

// 响应式数据
const modules = ref([]);
const currentModuleIndex = ref(0);
const userInfo = ref(null);
const locationInfo = ref("凯德溜冰土豆旗舰店");
const selectedDate = ref(getTodayDate());
const scrollLeft = ref(0);
const lastLoadedDate = ref(null); // 记录上次加载的日期

// 计算属性
const currentModule = computed(() => {
  if (
    modules.value.length > 0 &&
    currentModuleIndex.value < modules.value.length
  ) {
    return modules.value[currentModuleIndex.value];
  }
  return null;
});

const moduleNames = computed(() => {
  return modules.value.map((module) => {
    if (module.startTime && module.endTime) {
      return `${module.name}`;
    }
    return module.name;
  });
});

const completedCount = computed(() => {
  const result = calculateModuleCompletion(currentModule.value);
  return result.completed;
});

const totalCount = computed(() => {
  const result = calculateModuleCompletion(currentModule.value);
  return result.total;
});

const totalCompletedCount = computed(() => {
  const result = calculateTotalCompletion(modules.value);
  return result.completed;
});

const totalTasksCount = computed(() => {
  const result = calculateTotalCompletion(modules.value);
  return result.total;
});

// 方法
const getUserInfo = async () => {
  // 先从本地存储获取
  const localUser = storage.getUser();
  if (localUser) {
    userInfo.value = localUser;
  }

  // 从服务器获取最新信息
  try {
    const res = await userApi.getUserInfo();
    if (res) {
      userInfo.value = res;
      // 更新本地存储
      storage.setUser(res);
    }
  } catch (error) {
    console.error("获取用户信息失败:", error);
  }
};

const getModules = async (date) => {
  try {
    const dateStr = date || getTodayDate();
    // 每次重新请求数据，不使用缓存
    const res = await taskApi.getDailyModulesByTime({
      date: dateStr,
    });
    if (res) {
      modules.value = res;
      // 如果有模块，根据日期决定是否使用缓存的 tab index
      if (res.length > 0) {
        // 如果日期改变了，重置为第一个 tab
        if (lastLoadedDate.value && lastLoadedDate.value !== dateStr) {
          currentModuleIndex.value = 0;
          setCachedTabIndex(0);
        } else {
          // 同一日期，尝试恢复缓存的 tab index
          const cachedIndex = getCachedTabIndex();
          // 确保缓存的索引在有效范围内
          if (cachedIndex >= 0 && cachedIndex < res.length) {
            currentModuleIndex.value = cachedIndex;
          } else {
            currentModuleIndex.value = 0;
          }
        }
        lastLoadedDate.value = dateStr;
      }
    } else {
      modules.value = [];
    }
  } catch (error) {
    console.error("获取任务模块失败:", error);
  }
};

// 获取缓存的 tab index
const getCachedTabIndex = () => {
  try {
    const cached = storage.getItem("task_tab_index");
    return cached !== null ? parseInt(cached, 10) : 0;
  } catch (error) {
    return 0;
  }
};

// 保存 tab index 到缓存
const setCachedTabIndex = (index) => {
  try {
    storage.setItem("task_tab_index", index.toString());
  } catch (error) {
    console.error("保存 tab index 失败:", error);
  }
};

const handleDateChange = (dateStr) => {
  selectedDate.value = dateStr;
  getModules(dateStr);
};

const handleTaskClick = (task) => {
  // 检查任务执行记录是否存在
  if (!task.execution || !task.execution.id) {
    uni.showToast({
      title: "任务执行记录不存在",
      icon: "none",
    });
    return;
  }

  // 使用任务执行记录的ID，而不是任务模板的ID
  uni.navigateTo({
    url: `/pages/task/execution-detail?id=${task.execution.id}`,
  });
};

const handleTakePhoto = (task) => {
  // 检查任务执行记录是否存在
  if (!task.execution || !task.execution.id) {
    uni.showToast({
      title: "任务执行记录不存在",
      icon: "none",
    });
    return;
  }

  // 跳转到任务完成页面，传递任务执行记录ID
  uni.navigateTo({
    url: `/pages/task/execution-submit?id=${task.execution.id}`,
  });
};

const onTabClick = (e) => {
  currentModuleIndex.value = e.currentIndex;
  // 保存到缓存
  setCachedTabIndex(e.currentIndex);
  // 计算滚动位置，使选中的 tab 居中显示
  scrollToTab(e.currentIndex);
};

// 滚动到指定的 tab
const scrollToTab = (index) => {
  // 估算每个 tab 的宽度（可以根据实际情况调整）
  const tabWidth = 80; // 每个 tab 大约 80px
  const screenWidth = uni.getDeviceInfo().windowWidth || 375;
  const targetScrollLeft = index * tabWidth - (screenWidth / 2 - tabWidth / 2);
  scrollLeft.value = Math.max(0, targetScrollLeft);
};

// 加载数据
const loadData = async () => {
  await getUserInfo();
  await getModules();
};

// 每次页面显示时重新加载数据
onShow(() => {
  loadData();
});
</script>

<style lang="scss" scoped>
.task-container {
  min-height: 100vh;
}

.tab-section {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 5px 0;
}

.tab-scroll-view {
  width: 100%;
  white-space: nowrap;
}

.segmented-control-wrapper {
  display: inline-flex;
  min-width: 100%;
  flex-wrap: nowrap;
}

// 覆盖 uni-segmented-control 的样式，使其支持横向滚动
:deep(.segmented-control) {
  display: inline-flex;
  flex-wrap: nowrap;
  overflow-x: visible;
  overflow-y: hidden;
  min-width: max-content;
}

:deep(.segmented-control__item) {
  flex: 0 0 auto;
  padding: 0 12px;
  white-space: nowrap;
}

.tasks-content {
  padding: 20px 16px;
}

.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 20px;
  padding: 0 2px;
}

.completion-rate {
  font-size: 14px;
  color: #8c8c8c;
  font-weight: 400;
}

.tasks-timeline {
  position: relative;
  padding-left: 8px;
}

.empty-tasks {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 14px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60vh;
  color: #999;
  font-size: 16px;
}
</style>
