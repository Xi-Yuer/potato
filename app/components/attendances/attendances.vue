<template>
  <view class="attendances-container">
    <view class="attendance-card">
      <!-- 内容区域 -->
      <view class="card-content">
        <!-- 标题 -->
        <view class="card-title">
          {{ clockTitle }}
          <view class="refresh-button" @click="handleRefresh">
            <uni-icons
              type="reload"
              size="14"
              class="reload-icon"
              color="#8c8c8c"
            ></uni-icons>
          </view>
        </view>

        <!-- 时间范围 -->
        <text class="time-range">
          {{ formatTime(Date.now(), "MM/DD HH:mm") }}
        </text>

        <!-- 位置信息 -->
        <view class="location-info" @click="handleLocation">
          <uni-icons
            type="location"
            size="14"
            color="#8c8c8c"
            class="location-icon"
          ></uni-icons>
          <text class="location-text">{{ displayLocationText }}</text>
        </view>
      </view>

      <!-- 打卡按钮 -->
      <view class="clock-button-wrapper">
        <view
          class="clock-button"
          :class="{ disabled: isClockDisabled || isLoading }"
          @click="handleClock"
        >
          <uni-icons type="calendar" size="32" color="#ffffff"></uni-icons>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { attendanceApi } from "@/utils/api";
import { formatTime, formatDistance } from "@/utils/date";

const props = defineProps({
  // 位置信息
  locationText: {
    type: String,
    default: "距离店中心 0 m",
  },
});

const emit = defineEmits(["clock-success", "clock-error"]);
const isClockDisabled = ref(false);
const clockStatusData = ref(null); // 打卡状态数据
const isLoading = ref(true);
const isRefreshing = ref(false); // 是否正在刷新
const currentLocation = ref(null); // 当前位置信息

// 计算属性：打卡标题
const clockTitle = computed(() => {
  if (!clockStatusData.value) {
    return "加载中...";
  }
  return clockStatusData.value.canClockOut ? "下班打卡" : "上班打卡";
});

// 计算属性：位置信息显示
const displayLocationText = computed(() => {
  if (clockStatusData.value?.distance !== undefined) {
    const distance = clockStatusData.value.distance;
    const isInRange = clockStatusData.value.isInRange;
    if (isInRange) {
      return `距离店中心 ${formatDistance(distance)}`;
    } else {
      return `距离店中心 ${formatDistance(distance)}`;
    }
  }
  return props.locationText;
});

// 获取当前位置
const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    // 先检查授权状态
    uni.getSetting({
      success: (settingRes) => {
        if (!settingRes.authSetting["scope.userLocation"]) {
          // 未授权，请求授权
          uni.authorize({
            scope: "scope.userLocation",
            success: () => {
              // 授权成功，获取位置
              uni.getLocation({
                type: "gcj02",
                geocode: false,
                isHighAccuracy: true, // 请求高精度定位，适用于需要精确位置的场景
                success: (res) => {
                  currentLocation.value = {
                    latitude: res.latitude,
                    longitude: res.longitude,
                  };
                  resolve(res);
                },
                fail: (err) => {
                  console.error("获取位置失败:", err);
                  reject(err);
                },
              });
            },
            fail: () => {
              // 授权失败，提示用户
              uni.showModal({
                title: "需要位置权限",
                content: "打卡功能需要使用您的位置信息，请在设置中开启位置权限",
                confirmText: "去设置",
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    uni.openSetting();
                  }
                },
              });
              reject(new Error("用户拒绝授权"));
            },
          });
        } else {
          // 已授权，直接获取位置
          uni.getLocation({
            type: "gcj02",
            geocode: false,
            success: (res) => {
              currentLocation.value = {
                latitude: res.latitude,
                longitude: res.longitude,
              };
              resolve(res);
            },
            fail: (err) => {
              console.error("获取位置失败:", err);
              // 如果是权限问题，提示用户
              if (err.errMsg && err.errMsg.includes("requiredPrivateInfos")) {
                uni.showModal({
                  title: "配置错误",
                  content:
                    "请在 manifest.json 中配置 requiredPrivateInfos，然后重新编译项目",
                  showCancel: false,
                });
              } else if (err.errMsg && err.errMsg.includes("auth deny")) {
                uni.showModal({
                  title: "位置权限被拒绝",
                  content:
                    "您拒绝了位置权限，无法使用打卡功能。请在设置中开启位置权限",
                  confirmText: "去设置",
                  success: (modalRes) => {
                    if (modalRes.confirm) {
                      uni.openSetting();
                    }
                  },
                });
              }
              reject(err);
            },
          });
        }
      },
      fail: (err) => {
        console.error("获取设置失败:", err);
        reject(err);
      },
    });
  });
};

const handleLocation = async () => {
  try {
    const centerLocation = await attendanceApi.getClockCenter();
    uni.openLocation({
      latitude: centerLocation.centerLat,
      longitude: centerLocation.centerLon,
      name: "打卡中心",
      address: "凯德广场溜冰土豆小屋",
    });
  } catch (error) {
    uni.showToast({
      title: "获取打卡中心失败",
      icon: "none",
      duration: 2000,
    });
  }
};

// 检查当前打卡状态
const checkClockStatus = async () => {
  try {
    isLoading.value = true;

    // 尝试获取当前位置
    try {
      await getCurrentLocation();
    } catch (error) {
      console.warn("获取位置失败，将不显示距离信息:", error);
    }

    // 调用API获取打卡状态（如果已获取位置，则传递位置信息）
    const status = await attendanceApi.getClockStatus(
      currentLocation.value?.latitude,
      currentLocation.value?.longitude
    );
    clockStatusData.value = status;
  } catch (error) {
    console.error("检查打卡状态失败:", error);
    // 默认状态：可以上班打卡
    clockStatusData.value = {
      canClockIn: true,
      canClockOut: false,
      currentSession: null,
      lastClockTime: null,
      lastClockType: null,
    };
  } finally {
    isLoading.value = false;
  }
};

// 处理打卡
const handleClock = async () => {
  if (isClockDisabled.value || !clockStatusData.value) {
    return;
  }

  isClockDisabled.value = true;

  try {
    // 获取当前位置
    await getCurrentLocation();

    if (!currentLocation.value) {
      throw new Error("无法获取当前位置，请检查GPS权限");
    }

    let result;
    if (clockStatusData.value.canClockIn) {
      // 上班打卡
      result = await attendanceApi.clockIn(
        currentLocation.value.latitude,
        currentLocation.value.longitude
      );
      uni.showToast({
        title: "上班打卡成功",
        icon: "success",
        duration: 2000,
      });
    } else if (clockStatusData.value.canClockOut) {
      // 下班打卡
      result = await attendanceApi.clockOut(
        currentLocation.value.latitude,
        currentLocation.value.longitude
      );
      uni.showToast({
        title: "下班打卡成功",
        icon: "success",
        duration: 2000,
      });
    } else {
      throw new Error("当前无法打卡");
    }

    // 重新获取打卡状态
    await checkClockStatus();

    emit("clock-success", result);
  } catch (error) {
    const errorMsg = error?.message || "打卡失败，请重试";
    uni.showToast({
      title: errorMsg,
      icon: "none",
      duration: 2000,
    });
    emit("clock-error", error);
  } finally {
    isClockDisabled.value = false;
  }
};

// 刷新位置和距离
const handleRefresh = async () => {
  if (isRefreshing.value || isLoading.value) {
    return;
  }

  isRefreshing.value = true;

  try {
    // 重新获取位置
    await getCurrentLocation();

    // 重新获取打卡状态（包含距离信息）
    const status = await attendanceApi.getClockStatus(
      currentLocation.value?.latitude,
      currentLocation.value?.longitude
    );
    clockStatusData.value = status;
    uni.showToast({
      title: "刷新成功",
      icon: "none",
      duration: 2000,
    });
  } catch (error) {
    uni.showToast({
      title: "刷新失败，请重试",
      icon: "none",
      duration: 2000,
    });
  } finally {
    isRefreshing.value = false;
  }
};

onMounted(() => {
  checkClockStatus();
});
</script>

<style lang="scss" scoped>
.attendances-container {
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
}

.attendance-card {
  position: relative;
  display: flex;
  align-items: center;
  background-color: #ffffff80;
  border-radius: 12px;
  overflow: hidden;
  min-height: 120px;
}

.card-accent {
  width: 6px;
  height: 100%;
  background-color: #1a1a1a;
  border-radius: 12px 0 0 12px;
  flex-shrink: 0;
}

.card-content {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.card-title {
  position: relative;
  width: fit-content;
  position: relative;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
}
.time-range {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 8px;
  line-height: 1.2;
}

.location-info {
  display: flex;
  align-items: center;
  margin-top: 4px;
  position: relative;
}

.location-icon {
  margin-right: 4px;
  margin-top: -6rpx;
  transform-origin: center center;
}

.location-text {
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.4;
  flex: 1;
}

.refresh-button {
  position: absolute;
  right: -25rpx;
  top: -20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clock-button-wrapper {
  flex-shrink: 0;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clock-button {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;

  &:active {
    transform: scale(0.95);
  }

  &.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

.clock-icon-text {
  font-size: 14px;
  color: #ffffff;
  font-weight: 600;
  letter-spacing: 0.5px;
}
</style>
