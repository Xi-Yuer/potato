<template>
  <view class="scheduling-container">
    <!-- 顶部标题和年月选择 -->
    <view class="header-section">
      <text class="page-title">打卡情况统计</text>
      <picker
        mode="date"
        fields="month"
        :value="selectedYearMonth"
        @change="handleMonthChange"
        class="month-picker"
      >
        <view class="picker-display">
          <text class="picker-text">{{ displayYearMonth }}</text>
          <uni-icons type="arrowdown" size="14" color="#8c8c8c"></uni-icons>
        </view>
      </picker>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-section">
      <view class="stat-card">
        <text class="stat-value">{{ attendanceDays }}</text>
        <text class="stat-label">打卡天数</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ totalWorkHours }}</text>
        <text class="stat-label">总工作时长</text>
      </view>
    </view>

    <!-- 日历视图 -->
    <view class="calendar-section">
      <view class="calendar-weekdays">
        <text
          v-for="(weekday, index) in weekdays"
          :key="index"
          class="weekday-text"
        >
          {{ weekday }}
        </text>
      </view>
      <view class="calendar-grid">
        <view
          v-for="(day, index) in calendarDays"
          :key="index"
          :class="[
            'calendar-day',
            {
              'not-current-month': !day.isCurrentMonth,
              'is-today': day.isToday,
              'has-attendance': day.hasAttendance,
              selected: selectedDate === day.date,
            },
          ]"
          @click="handleDayClick(day)"
        >
          <text class="day-number">{{ day.day }}</text>
          <view v-if="day.hasAttendance" class="attendance-indicator">
            <view class="indicator-dot"></view>
            <text v-if="day.duration" class="duration-text">{{
              day.durationText
            }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 详细记录列表 -->
    <view class="details-section">
      <uni-collapse>
        <uni-collapse-item
          v-for="(group, index) in groupedRecords"
          :key="index"
          :title="formatGroupDate(group.date)"
          :data-date="group.date"
          :border="false"
        >
          <view class="records-list">
            <view
              v-for="(record, recordIndex) in group.records"
              :key="recordIndex"
              class="record-item"
              :data-date="group.date"
            >
              <!-- 管理员视图显示员工姓名 -->
              <view v-if="isAdmin" class="employee-name">
                {{ record.userName }}
              </view>
              <!-- 班次列表 -->
              <view class="sessions-list">
                <view
                  v-for="(session, sessionIndex) in record.sessions"
                  :key="sessionIndex"
                  class="session-item"
                >
                  <view class="session-time">
                    <text class="time-text">{{
                      formatTimeOnly(session.startTime)
                    }}</text>
                    <text class="time-separator">-</text>
                    <text class="time-text">{{
                      formatTimeOnly(session.endTime)
                    }}</text>
                  </view>
                  <text class="session-duration">{{
                    formatDuration(session.duration)
                  }}</text>
                </view>
              </view>
              <!-- 当日总时长 -->
              <view class="daily-total">
                <text class="total-label">当日总计：</text>
                <text class="total-value">{{
                  formatDuration(record.totalDuration)
                }}</text>
              </view>
            </view>
          </view>
        </uni-collapse-item>
      </uni-collapse>

      <!-- 空状态 -->
      <view
        v-if="groupedRecords.length === 0 && !isLoading"
        class="empty-state"
      >
        <text class="empty-text">暂无打卡记录</text>
      </view>
    </view>

    <!-- 员工工作时长统计（仅管理员可见） -->
    <view
      v-if="isAdmin && employeeStats.length > 0"
      class="employee-stats-section"
    >
      <uni-collapse>
        <uni-collapse-item
          :title="`${displayYearMonth}员工工作时长统计`"
          :open="false"
          :border="false"
        >
          <view class="employee-stats-list">
            <view
              v-for="(employee, index) in employeeStats"
              :key="employee.userId"
              class="employee-stat-item"
            >
              <text class="employee-name-text">{{ employee.userName }}</text>
              <text class="employee-duration-text">{{
                formatDuration(employee.totalMinutes)
              }}</text>
            </view>
          </view>
        </uni-collapse-item>
      </uni-collapse>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { attendanceApi, userApi } from "@/utils/api";
import { storage } from "@/utils/storage";
import { formatTimeOnly, formatDuration, getCalendarDays } from "@/utils/date";

// 响应式数据
const userInfo = ref(null);
const isAdmin = ref(false);
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);
const attendanceRecords = ref([]);
const isLoading = ref(false);
const selectedDate = ref(null);

// 周几标签
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

// 计算属性：选中的年月字符串（用于picker）
const selectedYearMonth = computed(() => {
  return `${selectedYear.value}-${String(selectedMonth.value).padStart(
    2,
    "0"
  )}-01`;
});

// 计算属性：显示的年月文本
const displayYearMonth = computed(() => {
  return `${selectedYear.value}年${selectedMonth.value}月`;
});

// 计算属性：日历天数数组
const calendarDays = computed(() => {
  const days = getCalendarDays(selectedYear.value, selectedMonth.value);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // 创建日期到记录的映射
  const dateMap = new Map();
  if (isAdmin.value) {
    // 管理员视图：按日期分组
    attendanceRecords.value.forEach((record) => {
      if (!dateMap.has(record.date)) {
        dateMap.set(record.date, {
          hasAttendance: true,
          duration: 0,
          records: [],
        });
      }
      const dayData = dateMap.get(record.date);
      dayData.duration += record.totalDuration;
      dayData.records.push(record);
    });
  } else {
    // 员工视图：直接映射
    attendanceRecords.value.forEach((record) => {
      dateMap.set(record.date, {
        hasAttendance: true,
        duration: record.totalDuration,
        records: [record],
      });
    });
  }

  return days.map((day) => {
    const dayData = dateMap.get(day.date);
    const isToday = day.date === todayStr;
    return {
      ...day,
      isToday,
      hasAttendance: !!dayData,
      duration: dayData?.duration || 0,
      durationText: dayData?.duration ? formatDuration(dayData.duration) : "",
    };
  });
});

// 计算属性：打卡天数
const attendanceDays = computed(() => {
  if (isAdmin.value) {
    // 管理员视图：统计有多少个不同的日期
    const uniqueDates = new Set(attendanceRecords.value.map((r) => r.date));
    return uniqueDates.size;
  } else {
    // 员工视图：直接返回记录数量（每个记录代表一天）
    return attendanceRecords.value.length;
  }
});

// 计算属性：总工作时长
const totalWorkHours = computed(() => {
  const totalMinutes = attendanceRecords.value.reduce((sum, record) => {
    return sum + (record.totalDuration || 0);
  }, 0);
  return formatDuration(totalMinutes);
});

// 计算属性：员工工作时长统计（仅管理员）
const employeeStats = computed(() => {
  if (!isAdmin.value) return [];

  const statsMap = new Map();
  attendanceRecords.value.forEach((record) => {
    const userId = record.userId;
    const userName = record.userName;

    if (!statsMap.has(userId)) {
      statsMap.set(userId, {
        userId,
        userName,
        totalMinutes: 0,
      });
    }

    statsMap.get(userId).totalMinutes += record.totalDuration || 0;
  });

  return Array.from(statsMap.values()).sort(
    (a, b) => b.totalMinutes - a.totalMinutes
  );
});

// 计算属性：按日期分组的记录（管理员视图）
const groupedRecords = computed(() => {
  if (isAdmin.value) {
    // 管理员视图：按日期分组
    const groups = new Map();
    attendanceRecords.value.forEach((record) => {
      if (!groups.has(record.date)) {
        groups.set(record.date, {
          date: record.date,
          records: [],
        });
      }
      groups.get(record.date).records.push(record);
    });
    return Array.from(groups.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  } else {
    // 员工视图：直接返回记录
    return attendanceRecords.value.map((record) => ({
      date: record.date,
      records: [record],
    }));
  }
});

// 方法：获取用户信息
const getUserInfo = async () => {
  try {
    // 先从本地存储获取
    const localUser = storage.getUser();
    if (localUser) {
      userInfo.value = localUser;
      isAdmin.value = localUser.isAdmin || false;
    }

    // 从服务器获取最新信息
    const res = await userApi.getUserInfo();
    if (res) {
      userInfo.value = res;
      isAdmin.value = res.isAdmin || false;
      storage.setUser(res);
    }
  } catch (error) {
    console.error("获取用户信息失败:", error);
  }
};

// 方法：加载打卡记录
const loadAttendanceRecords = async () => {
  isLoading.value = true;
  try {
    let records;
    if (isAdmin.value) {
      records = await attendanceApi.getAllAttendanceRecords(
        selectedYear.value,
        selectedMonth.value
      );
    } else {
      records = await attendanceApi.getMyAttendanceRecords(
        selectedYear.value,
        selectedMonth.value
      );
    }
    attendanceRecords.value = records || [];
  } catch (error) {
    console.error("加载打卡记录失败:", error);
    attendanceRecords.value = [];
    uni.showToast({
      title: "加载失败，请重试",
      icon: "none",
      duration: 2000,
    });
  } finally {
    isLoading.value = false;
  }
};

// 方法：处理年月选择
const handleMonthChange = (e) => {
  const value = e.detail.value;
  const [year, month] = value.split("-").map(Number);
  selectedYear.value = year;
  selectedMonth.value = month;
  selectedDate.value = null;
  loadAttendanceRecords();
};

// 方法：处理日期点击
const handleDayClick = (day) => {
  if (!day.hasAttendance) return;
  selectedDate.value = day.date;
  // 滚动到该日期
  setTimeout(() => {
    uni
      .createSelectorQuery()
      .select(`.date-group[data-date="${day.date}"]`)
      .boundingClientRect((rect) => {
        if (rect) {
          uni.pageScrollTo({
            scrollTop: rect.top - 100,
            duration: 300,
          });
        }
      })
      .exec();
  }, 100);
};

// 方法：格式化分组日期
const formatGroupDate = (dateStr) => {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = weekdays[date.getDay()];
  return `${month}月${day}日 星期${weekday}`;
};

onMounted(async () => {
  await getUserInfo();
  await loadAttendanceRecords();
});
</script>

<style lang="scss" scoped>
.scheduling-container {
  min-height: 100vh;
  padding: 24rpx;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx;
  background-color: #ffffff50;
  border-radius: 12rpx;
}

.page-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.month-picker {
  display: flex;
  align-items: center;
}

.picker-display {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.picker-text {
  font-size: 28rpx;
  color: #1a1a1a;
}

.stats-section {
  display: flex;
  gap: 24rpx;
  padding: 32rpx;
  background-color: #ffffff50;
  margin-top: 16rpx;
  border-radius: 12rpx;
}

.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx;
  background-color: #ffffff;
  border-radius: 12rpx;
}

.stat-value {
  font-size: 48rpx;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 8rpx;
}

.stat-label {
  font-size: 24rpx;
  color: #8c8c8c;
}

.employee-stats-section {
  background-color: #ffffff50;
  margin-top: 16rpx;
  border-radius: 12rpx;
  overflow: hidden;
}

.employee-stats-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 24rpx 32rpx 32rpx;
}

.employee-stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
  background-color: #ffffff;
  border-radius: 8rpx;
}

.employee-name-text {
  font-size: 28rpx;
  color: #1a1a1a;
  font-weight: 500;
}

.employee-duration-text {
  font-size: 28rpx;
  color: #1a1a1a;
  font-weight: 600;
}

.calendar-section {
  background-color: #ffffff50;
  margin-top: 16rpx;
  padding: 32rpx 24rpx;
  border-radius: 12rpx;
}

.calendar-weekdays {
  display: flex;
  margin-bottom: 16rpx;
}

.weekday-text {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: #8c8c8c;
  font-weight: 500;
}

.calendar-grid {
  display: flex;
  flex-wrap: wrap;
}

.calendar-day {
  width: calc(100% / 7);
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 8rpx;
  box-sizing: border-box;
}

.day-number {
  font-size: 28rpx;
  color: #1a1a1a;
  margin-bottom: 4rpx;
}

.calendar-day.not-current-month .day-number {
  color: #d0d0d0;
}

.calendar-day.is-today {
  background-color: #000000;
  border-radius: 8rpx;
}
.calendar-day.is-today .day-number {
  color: #ffffff !important;
}

.calendar-day.selected {
  background-color: #1a1a1a;
  border-radius: 8rpx;
}

.calendar-day.selected .day-number {
  color: #ffffff50;
}

.attendance-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
}

.indicator-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background-color: #1a1a1a;
}

.calendar-day.selected .indicator-dot {
  background-color: #ffffff50;
}

.duration-text {
  font-size: 18rpx;
  color: #8c8c8c;
  line-height: 1.2;
}

.calendar-day.selected .duration-text {
  color: #ffffff50;
}

.details-section {
  margin-top: 16rpx;
  border-radius: 12rpx;
}

.records-list {
  padding: 16rpx 24rpx 24rpx;
}

.record-item {
  padding: 16rpx 0;
}

.record-item:last-child {
  border-bottom: none;
}

.employee-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 12rpx;
}

.sessions-list {
  margin-bottom: 12rpx;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0;
}

.session-time {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.time-text {
  font-size: 26rpx;
  color: #1a1a1a;
}

.time-separator {
  font-size: 26rpx;
  color: #8c8c8c;
}

.session-duration {
  font-size: 26rpx;
  color: #8c8c8c;
}

.daily-total {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8rpx;
  padding-top: 8rpx;
  margin-top: 8rpx;
}

.total-label {
  font-size: 24rpx;
  color: #8c8c8c;
}

.total-value {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 80rpx 0;
  background-color: #ffffff50;
  border-radius: 12rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #8c8c8c;
}
</style>
