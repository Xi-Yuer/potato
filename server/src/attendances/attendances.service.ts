import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not, IsNull, FindOptionsWhere } from 'typeorm';
import { Attendance, AttendanceType } from '../entities/attendance.entity';
import { WorkSession } from '../entities/work-session.entity';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';

export interface WorkSessionItem {
  id: number;
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
}

export interface DailyAttendanceRecord {
  date: string;
  sessions: WorkSessionItem[];
  totalDuration: number;
}

export interface AdminDailyAttendanceRecord {
  userId: number;
  userName: string;
  userAvatar: string | null;
  date: string;
  sessions: WorkSessionItem[];
  totalDuration: number;
}

@Injectable()
export class AttendancesService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    @InjectRepository(WorkSession)
    private workSessionRepository: Repository<WorkSession>,
  ) {}

  /**
   * 计算两点之间的距离（米）
   * @param lat1 纬度1
   * @param lon1 经度1
   * @param lat2 纬度2
   * @param lon2 经度2
   * @returns 距离（米）
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // 地球半径（米）
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 角度转弧度
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * 验证位置是否在允许范围内
   * @param latitude 纬度
   * @param longitude 经度
   * @returns 是否在范围内
   */
  private validateLocation(
    latitude: number,
    longitude: number,
  ): { isValid: boolean; distance?: number; message?: string } {
    // 从环境变量获取允许打卡的中心位置和范围
    const centerLat =
      parseFloat(process.env.ATTENDANCE_CENTER_LAT || '') || 39.9042; // 默认北京
    const centerLon =
      parseFloat(process.env.ATTENDANCE_CENTER_LON || '') || 116.4074;
    const allowedRadius =
      parseFloat(process.env.ATTENDANCE_ALLOWED_RADIUS || '') || 100; // 默认100米

    const distance = this.calculateDistance(
      latitude,
      longitude,
      centerLat,
      centerLon,
    );

    if (distance > allowedRadius) {
      return {
        isValid: false,
        distance: Math.round(distance),
        message: `超出允许范围（${allowedRadius} 米）`,
      };
    }

    return {
      isValid: true,
      distance: Math.round(distance),
    };
  }

  /**
   * 上班打卡
   * @param userId 用户ID
   * @param clockInDto 上班打卡DTO
   * @returns 打卡记录和工作班次信息
   */
  async clockIn(
    userId: number,
    clockInDto: ClockInDto,
  ): Promise<{ attendance: Attendance; workSession: WorkSession }> {
    // 验证位置
    const locationValidation = this.validateLocation(
      clockInDto.latitude,
      clockInDto.longitude,
    );
    if (!locationValidation.isValid) {
      throw new BadRequestException(locationValidation.message);
    }

    // 检查是否有未完成的工作班次
    // 如果有未完成的班次，必须先完成下班打卡才能开始新的班次（确保班次完整性）
    const unfinishedSession = await this.workSessionRepository.findOne({
      where: {
        userId,
        endTime: IsNull(), // 没有结束时间表示未完成
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (unfinishedSession) {
      throw new BadRequestException('请先完成上次的下班打卡');
    }

    const clockTime = new Date();

    // 创建上班打卡记录
    const attendance = this.attendanceRepository.create({
      userId,
      type: AttendanceType.CLOCK_IN,
      clockTime,
    });

    const savedAttendance = await this.attendanceRepository.save(attendance);

    // 计算工作日期（基于打卡时间）
    const workDate = new Date(clockTime);
    workDate.setHours(0, 0, 0, 0);

    // 创建新的工作班次记录
    const workSession = this.workSessionRepository.create({
      userId,
      clockInId: savedAttendance.id,
      startTime: clockTime,
      workDate,
    });

    const savedWorkSession = await this.workSessionRepository.save(workSession);

    // 更新打卡记录的workSessionId
    savedAttendance.workSessionId = savedWorkSession.id;
    await this.attendanceRepository.save(savedAttendance);

    return {
      attendance: savedAttendance,
      workSession: savedWorkSession,
    };
  }

  /**
   * 下班打卡
   * @param userId 用户ID
   * @param clockOutDto 下班打卡DTO
   * @returns 打卡记录和更新的工作班次信息
   */
  async clockOut(
    userId: number,
    clockOutDto: ClockOutDto,
  ): Promise<{ attendance: Attendance; workSession: WorkSession }> {
    // 验证位置
    const locationValidation = this.validateLocation(
      clockOutDto.latitude,
      clockOutDto.longitude,
    );
    if (!locationValidation.isValid) {
      throw new BadRequestException(locationValidation.message);
    }

    // 查找未完成的工作班次
    const unfinishedSession = await this.workSessionRepository.findOne({
      where: {
        userId,
        endTime: IsNull(), // 没有结束时间表示未完成
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!unfinishedSession) {
      throw new BadRequestException('请先进行上班打卡');
    }

    const clockTime = new Date();

    // 创建下班打卡记录
    const attendance = this.attendanceRepository.create({
      userId,
      type: AttendanceType.CLOCK_OUT,
      clockTime,
      workSessionId: unfinishedSession.id,
    });

    const savedAttendance = await this.attendanceRepository.save(attendance);

    // 更新工作班次记录
    unfinishedSession.clockOutId = savedAttendance.id;
    unfinishedSession.endTime = clockTime;

    // 计算工作时长（分钟数）
    const durationMs =
      clockTime.getTime() - unfinishedSession.startTime.getTime();
    unfinishedSession.duration = Math.floor(durationMs / (1000 * 60));

    const updatedWorkSession =
      await this.workSessionRepository.save(unfinishedSession);

    return {
      attendance: savedAttendance,
      workSession: updatedWorkSession,
    };
  }

  /**
   * 获取当前打卡状态
   * @param userId 用户ID
   * @param latitude 可选：当前纬度（用于计算距离）
   * @param longitude 可选：当前经度（用于计算距离）
   * @returns 打卡状态信息
   */
  async getClockStatus(
    userId: number,
    latitude?: number,
    longitude?: number,
  ): Promise<{
    canClockIn: boolean; // 是否可以上班打卡
    canClockOut: boolean; // 是否可以下班打卡
    currentSession: WorkSession | null; // 当前未完成的工作班次
    lastClockTime: Date | null; // 最后一次打卡时间
    lastClockType: AttendanceType | null; // 最后一次打卡类型
    distance?: number; // 距离打卡地点的距离（米）
    isInRange?: boolean; // 是否在允许范围内
  }> {
    // 查找未完成的工作班次
    const unfinishedSession = await this.workSessionRepository.findOne({
      where: {
        userId,
        endTime: IsNull(), // 没有结束时间表示未完成
      },
      relations: ['clockIn'],
      order: {
        createdAt: 'DESC',
      },
    });

    // 计算距离（如果提供了位置信息）
    let distance: number | undefined;
    let isInRange: boolean | undefined;
    if (latitude !== undefined && longitude !== undefined) {
      const centerLat =
        parseFloat(process.env.ATTENDANCE_CENTER_LAT || '') || 39.9042;
      const centerLon =
        parseFloat(process.env.ATTENDANCE_CENTER_LON || '') || 116.4074;
      const allowedRadius =
        parseFloat(process.env.ATTENDANCE_ALLOWED_RADIUS || '') || 100;
      distance = Math.round(
        this.calculateDistance(latitude, longitude, centerLat, centerLon),
      );
      isInRange = distance <= allowedRadius;
    }

    if (unfinishedSession) {
      // 有未完成的班次，可以下班打卡
      return {
        canClockIn: false,
        canClockOut: true,
        currentSession: unfinishedSession,
        lastClockTime: unfinishedSession.startTime,
        lastClockType: AttendanceType.CLOCK_IN,
        distance,
        isInRange,
      };
    }

    // 没有未完成的班次，可以上班打卡
    // 查找最后一次打卡记录用于显示
    const lastAttendance = await this.attendanceRepository.findOne({
      where: {
        userId,
      },
      order: {
        clockTime: 'DESC',
      },
    });

    // 允许一天内多个班次：只要没有未完成的班次，就可以进行新的上班打卡
    return {
      canClockIn: true,
      canClockOut: false,
      currentSession: null,
      lastClockTime: lastAttendance?.clockTime || null,
      lastClockType: lastAttendance?.type || null,
      distance,
      isInRange,
    };
  }

  /**
   * 查询员工的月度打卡记录（按天汇总）
   * @param userId 用户ID
   * @param queryDto 查询DTO
   * @returns 按天汇总的打卡记录
   */
  async getMyAttendanceRecords(
    userId: number,
    queryDto: QueryAttendanceDto,
  ): Promise<DailyAttendanceRecord[]> {
    // 计算查询的日期范围
    const startDate = new Date(queryDto.year, queryDto.month - 1, 1);
    const lastDay = new Date(queryDto.year, queryDto.month, 0).getDate();
    const endDate = new Date(
      queryDto.year,
      queryDto.month - 1,
      lastDay,
      23,
      59,
      59,
    );

    // 查询该月所有完成的工作班次
    const workSessions = await this.workSessionRepository.find({
      where: {
        userId,
        workDate: Between(startDate, endDate),
        endTime: Not(IsNull()), // 只查询已完成的班次
      },
      relations: ['clockIn', 'clockOut'],
      order: {
        workDate: 'ASC',
        startTime: 'ASC',
      },
    });

    // 按天汇总
    const dailyRecords = new Map<string, DailyAttendanceRecord>();

    for (const session of workSessions) {
      // 确保 workDate 是 Date 对象
      const workDate =
        session.workDate instanceof Date
          ? session.workDate
          : new Date(session.workDate);
      const dateKey = workDate.toISOString().split('T')[0];

      if (!dailyRecords.has(dateKey)) {
        dailyRecords.set(dateKey, {
          date: dateKey,
          sessions: [],
          totalDuration: 0,
        });
      }

      const dailyRecord = dailyRecords.get(dateKey);
      if (dailyRecord) {
        dailyRecord.sessions.push({
          id: session.id,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
        });
        dailyRecord.totalDuration += session.duration || 0;
      }
    }

    // 转换为数组并按日期排序
    return Array.from(dailyRecords.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  /**
   * 管理员查询所有员工的打卡记录
   * @param queryDto 查询DTO
   * @returns 所有员工或指定员工的打卡记录
   */
  async getAllAttendanceRecords(
    queryDto: QueryAttendanceDto,
  ): Promise<AdminDailyAttendanceRecord[]> {
    // 计算查询的日期范围
    const startDate = new Date(queryDto.year, queryDto.month - 1, 1);
    const lastDay = new Date(queryDto.year, queryDto.month, 0).getDate();
    const endDate = new Date(
      queryDto.year,
      queryDto.month - 1,
      lastDay,
      23,
      59,
      59,
    );

    // 构建查询条件
    const whereCondition: FindOptionsWhere<WorkSession> = {
      workDate: Between(startDate, endDate),
      endTime: Not(IsNull()), // 只查询已完成的班次
    };

    if (queryDto.userId) {
      whereCondition.userId = queryDto.userId;
    }

    // 查询工作班次
    const workSessions = await this.workSessionRepository.find({
      where: whereCondition,
      relations: ['user', 'clockIn', 'clockOut'],
      order: {
        userId: 'ASC',
        workDate: 'ASC',
        startTime: 'ASC',
      },
    });

    // 按用户和日期汇总
    const userRecords = new Map<
      number,
      Map<string, AdminDailyAttendanceRecord>
    >();

    for (const session of workSessions) {
      const userId = session.userId;
      // 确保 workDate 是 Date 对象
      const workDate =
        session.workDate instanceof Date
          ? session.workDate
          : new Date(session.workDate);
      const dateKey = workDate.toISOString().split('T')[0];

      if (!userRecords.has(userId)) {
        userRecords.set(userId, new Map());
      }

      const userDailyRecords = userRecords.get(userId);
      if (!userDailyRecords) {
        continue;
      }

      if (!userDailyRecords.has(dateKey)) {
        userDailyRecords.set(dateKey, {
          userId,
          userName: session.user.name,
          userAvatar: session.user.avatar || null,
          date: dateKey,
          sessions: [],
          totalDuration: 0,
        });
      }

      const dailyRecord = userDailyRecords.get(dateKey);
      if (dailyRecord) {
        dailyRecord.sessions.push({
          id: session.id,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
        });
        dailyRecord.totalDuration += session.duration || 0;
      }
    }

    // 转换为数组格式
    const result: AdminDailyAttendanceRecord[] = [];
    for (const [, dailyRecords] of userRecords.entries()) {
      for (const [, record] of dailyRecords.entries()) {
        result.push(record);
      }
    }

    // 按用户ID和日期排序
    return result.sort((a, b) => {
      if (a.userId !== b.userId) {
        return a.userId - b.userId;
      }
      return a.date.localeCompare(b.date);
    });
  }
}
