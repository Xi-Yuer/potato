<template>
  <view class="login-bg">
    <view class="login-container">
      <view class="logo-section">
        <view class="logo-box">
          <image
            class="logo-img"
            src="/static/logo.png"
            mode="aspectFit"
          ></image>
        </view>
        <view class="app-title">凯德溜冰土豆</view>
        <view class="app-subtitle">Kade Ice Cream Tomato</view>
      </view>

      <view class="form-section">
        <view class="input-group">
          <text class="input-label">手机号</text>
          <uni-easyinput
            v-model="formData.phone"
            placeholder="请输入手机号"
            :clearable="true"
            :maxlength="11"
            type="number"
            class="custom-input"
            :styles="inputStyles"
          ></uni-easyinput>
        </view>

        <view class="input-group">
          <text class="input-label">密码</text>
          <uni-easyinput
            v-model="formData.password"
            placeholder="请输入密码"
            :clearable="true"
            type="password"
            class="custom-input"
            :styles="inputStyles"
          ></uni-easyinput>
        </view>

        <button class="login-btn" @click="handleLogin">立即登录</button>
      </view>

      <view class="footer-link" @click="handleContact">
        <text>联系店长开通账号</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue";
import { userApi } from "../../utils/api.js";
import { storage } from "../../utils/storage.js";

const formData = ref({
  phone: "",
  password: "",
});

const inputStyles = {
  borderColor: "#e5e7eb",
  backgroundColor: "#f9fafb",
};

const isLoading = ref(false);

const handleLogin = async () => {
  // 表单验证
  if (!formData.value.phone) {
    uni.showToast({
      title: "请输入手机号",
      icon: "none",
    });
    return;
  }
  if (!formData.value.password) {
    uni.showToast({
      title: "请输入密码",
      icon: "none",
    });
    return;
  }
  if (formData.value.phone.length !== 11) {
    uni.showToast({
      title: "手机号格式不正确",
      icon: "none",
    });
    return;
  }

  if (isLoading.value) return;
  isLoading.value = true;

  try {
    uni.showLoading({
      title: "登录中...",
      mask: true,
    });

    // 调用登录接口
    const res = await userApi.login(
      formData.value.phone,
      formData.value.password
    );

    // 保存token和用户信息
    storage.setToken(res.access_token);
    storage.setUser(res.user);

    uni.hideLoading();
    uni.showToast({
      title: "登录成功",
      icon: "success",
    });

    // 跳转到首页（任务页）
    setTimeout(() => {
      uni.switchTab({
        url: "/pages/task/task",
      });
    }, 1500);
  } catch (error) {
    uni.hideLoading();
  } finally {
    isLoading.value = false;
  }
};

const handleContact = () => {
  uni.showToast({
    title: "请联系店长开通账号",
    icon: "none",
  });
};
</script>

<style lang="scss" scoped>
.login-bg {
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center center;
  padding: 100rpx 48rpx 60rpx;
  padding-top: 100rpx;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
}
.login-container {
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  padding: 100rpx 48rpx 60rpx;
  padding-top: 100rpx;
  display: flex;
  flex-direction: column;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 100rpx;
}

.logo-box {
  width: 100rpx;
  height: 100rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32rpx;
}

.logo-img {
  width: 70rpx;
  height: 70rpx;
}

.app-title {
  font-size: 40rpx;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 8rpx;
  letter-spacing: 0.5rpx;
}

.app-subtitle {
  font-size: 22rpx;
  color: #6b7280;
  font-weight: 400;
}

.input-group {
  margin-bottom: 32rpx;
}

.input-label {
  display: block;
  font-size: 28rpx;
  color: #374151;
  margin-bottom: 12rpx;
  font-weight: 400;
}

.custom-input {
  background-color: #f9fafb;
  border-radius: 8rpx;
  overflow: hidden;
}

.login-btn {
  width: 100%;
  height: 88rpx;
  background-color: #1f2937;
  border-radius: 8rpx;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 500;
  border: none;
  margin-top: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.login-btn::after {
  border: none;
}

.login-btn:active {
  background-color: #1f2937;
}

.footer-link {
  text-align: center;
  padding: 32rpx 0 20rpx;
}

.footer-link text {
  font-size: 24rpx;
  color: #9ca3af;
}
</style>
