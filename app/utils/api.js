import { storage } from "./storage.js";

// API基础地址 - 根据实际情况修改
export const BASE_URL = "https://typing.xiyuer.club/tomato";

// 请求拦截器 - 添加token
const requestInterceptor = (options) => {
  const token = storage.getToken();
  if (token) {
    options.header = options.header || {};
    options.header["Authorization"] = `Bearer ${token}`;
  }
  return options;
};

// 响应拦截器 - 处理token过期和统一响应格式
const responseInterceptor = (res) => {
  // 统一响应格式处理
  const responseData = res.data;

  // 检查是否为401未授权（HTTP状态码或响应体中的code）
  const isUnauthorized =
    res.statusCode === 401 ||
    (responseData &&
      typeof responseData === "object" &&
      responseData.code === 401);

  if (isUnauthorized) {
    // 清除本地存储的token和用户信息
    storage.clearAuth();

    // 延迟执行，避免在请求回调中直接跳转
    setTimeout(() => {
      // 获取当前页面路径
      const pages = uni.getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const currentRoute = currentPage ? currentPage.route : "";

      // 如果当前不在登录页，则跳转到登录页
      if (currentRoute !== "pages/login/login") {
        uni.reLaunch({
          url: "/pages/login/login",
        });
      }

      // 统一响应格式：{ code, message, data }
      const errorMsg = responseData?.message || "登录已过期，请重新登录";
      uni.showToast({
        title: errorMsg,
        icon: "none",
        duration: 2000,
      });
    }, 100);

    return Promise.reject(new Error("Token expired"));
  }

  // 如果后端返回的是统一格式 { code, message, data }
  if (
    responseData &&
    typeof responseData === "object" &&
    "code" in responseData
  ) {
    // 成功响应
    if (responseData.code === 200) {
      return responseData.data;
    }

    // 业务错误（非200状态码）
    const errorMsg = responseData.message || "请求失败";
    uni.showToast({
      title: errorMsg,
      icon: "none",
    });
    return Promise.reject(new Error(errorMsg));
  }

  // HTTP错误处理（非200状态码）
  if (res.statusCode && res.statusCode !== 200) {
    const errorMsg = responseData?.message || responseData?.error || "请求失败";
    uni.showToast({
      title: errorMsg,
      icon: "none",
    });
    return Promise.reject(new Error(errorMsg));
  }

  // 兼容旧格式（直接返回数据）
  return responseData;
};

// 通用请求方法
const request = (options) => {
  return new Promise((resolve, reject) => {
    let url = options.url;
    let data = options.data || {};

    // 对于GET请求，将参数拼接到URL中
    if (options.method === "GET" && Object.keys(data).length > 0) {
      const queryString = Object.keys(data)
        .filter(
          (key) =>
            data[key] !== undefined && data[key] !== null && data[key] !== ""
        )
        .map((key) => {
          const value = data[key];
          return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        })
        .join("&");

      if (queryString) {
        url = url.includes("?")
          ? `${url}&${queryString}`
          : `${url}?${queryString}`;
      }
      data = {}; // GET请求不需要body数据
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = url.startsWith("/") ? `${BASE_URL}${url}` : `${BASE_URL}/${url}`;
    }

    const requestOptions = {
      method: options.method || "GET",
      data: data,
      header: {
        "Content-Type": "application/json",
        ...options.header,
      },
      ...options,
      url: url, // 最后设置url，确保不会被覆盖
    };

    const finalOptions = requestInterceptor(requestOptions);
    uni.request({
      ...finalOptions,
      success: (res) => {
        try {
          const data = responseInterceptor(res);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      },
      fail: (error) => {
        let errorMsg = "网络请求失败";
        if (error.errMsg) {
          if (error.errMsg.includes("invalid url")) {
            errorMsg = `请求地址无效: ${finalOptions.url}`;
          } else if (error.errMsg.includes("timeout")) {
            errorMsg = "请求超时，请检查网络连接";
          } else {
            errorMsg = error.errMsg;
          }
        }
        uni.showToast({
          title: errorMsg,
          icon: "none",
          duration: 2000,
        });
        reject(error);
      },
    });
  });
};

// API方法封装
export const api = {
  // GET请求
  get(url, data = {}) {
    return request({
      url,
      method: "GET",
      data,
    });
  },

  // POST请求
  post(url, data = {}, params = {}) {
    // 构建查询字符串
    const queryString = Object.keys(params)
      .filter(
        (key) =>
          params[key] !== undefined &&
          params[key] !== null &&
          params[key] !== ""
      )
      .map((key) => {
        const value = params[key];
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .join("&");

    const finalUrl = queryString ? `${url}?${queryString}` : url;

    return request({
      url: finalUrl,
      method: "POST",
      data,
    });
  },

  // PUT请求
  put(url, data = {}) {
    return request({
      url,
      method: "PUT",
      data,
    });
  },

  // PATCH请求
  patch(url, data = {}) {
    return request({
      url,
      method: "PATCH",
      data,
    });
  },

  // DELETE请求
  delete(url, data = {}) {
    return request({
      url,
      method: "DELETE",
      data,
    });
  },
};

// 用户相关API
export const userApi = {
  // 登录
  login(phone, password) {
    return api.post("/users/login", {
      phone,
      password,
    });
  },

  // 获取用户信息
  getUserInfo() {
    return api.get("/users/profile/me");
  },

  // 更新用户信息
  updateProfile(data) {
    return api.patch("/users/profile/me", data);
  },

  // 上传用户头像
  uploadAvatar(filePath) {
    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url: `${BASE_URL}/users/profile/avatar`,
        filePath: filePath,
        name: "avatar",
        header: {
          Authorization: `Bearer ${storage.getToken()}`,
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (res.statusCode === 200 || res.statusCode === 201) {
              resolve(data);
            } else {
              const errorMsg = data?.message || "上传失败";
              uni.showToast({
                title: errorMsg,
                icon: "none",
              });
              reject(new Error(errorMsg));
            }
          } catch (error) {
            reject(error);
          }
        },
        fail: (error) => {
          let errorMsg = "上传失败";
          if (error.errMsg) {
            errorMsg = error.errMsg;
          }
          uni.showToast({
            title: errorMsg,
            icon: "none",
          });
          reject(error);
        },
      });
    });
  },
};

// 任务相关API
export const taskApi = {
  // 任务模块
  getModules() {
    return api.get("/task-modules");
  },
  getModulesByTime(params) {
    return api.post("/task-modules/by-time", params);
  },
  createModule(data) {
    return api.post("/task-modules", data);
  },
  updateModule(id, data) {
    return api.patch(`/task-modules/${id}`, data);
  },
  deleteModule(id) {
    return api.delete(`/task-modules/${id}`);
  },

  // 任务模板
  getTasks(moduleId) {
    const params = moduleId ? { moduleId } : {};
    return api.get("/tasks", params);
  },
  getTaskDetail(id) {
    return api.get(`/tasks/${id}`);
  },
  createTask(data) {
    return api.post("/tasks", data);
  },
  updateTask(id, data) {
    return api.patch(`/tasks/${id}`, data);
  },
  deleteTask(id) {
    return api.delete(`/tasks/${id}`);
  },
  getDailyCompletion(date) {
    return api.get("/task-executions/daily-completion", { date });
  },
  getTodayTasksByTimeRange() {
    return api.get("/task-modules/today-tasks");
  },

  // 任务执行记录
  getDailyModulesByTime(params) {
    return api.post("/task-executions/daily-modules", params);
  },
  getTaskExecutions(params) {
    return api.post("/task-executions/query", params);
  },
  getTaskExecutionDetail(id) {
    return api.get(`/task-executions/${id}`);
  },
  createTaskExecution(data) {
    return api.post("/task-executions", data);
  },
  submitTaskExecution(id, data) {
    return api.post(`/task-executions/${id}/submit`, data);
  },
  generateDailyTaskExecutions(date) {
    return api.post("/task-executions/generate-daily", {}, { date });
  },
  uploadFiles(files) {
    return api.post("/task-executions/upload", files);
  },
};

// 打卡相关API
export const attendanceApi = {
  // 获取当前打卡状态
  getClockStatus(latitude, longitude) {
    const params = {};
    if (latitude !== undefined && longitude !== undefined) {
      params.latitude = latitude;
      params.longitude = longitude;
    }
    return api.get("/attendances/status", params);
  },

  // 上班打卡
  clockIn(latitude, longitude) {
    return api.post("/attendances/clock-in", {
      latitude,
      longitude,
    });
  },

  // 下班打卡
  clockOut(latitude, longitude) {
    return api.post("/attendances/clock-out", {
      latitude,
      longitude,
    });
  },

  // 查询当前员工的月度打卡记录
  getMyAttendanceRecords(year, month) {
    return api.get("/attendances/my", { year, month });
  },

  // 管理员查询所有员工的打卡记录
  getAllAttendanceRecords(year, month, userId) {
    const params = { year, month };
    if (userId) {
      params.userId = userId;
    }
    return api.get("/attendances", params);
  },
};
