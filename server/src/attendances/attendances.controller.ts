import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AttendancesService } from './attendances.service';
import {
  DailyAttendanceRecord,
  AdminDailyAttendanceRecord,
  ClockCenter,
} from './attendances.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { QueryAttendanceByDateDto } from './dto/query-attendance-by-date.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * 打卡管理控制器
 * 提供员工打卡和查询相关的所有 API 接口
 */
@Controller('attendances')
@UseGuards(JwtAuthGuard)
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  /**
   * 上班打卡
   * @param req 请求对象（包含当前登录用户信息）
   * @param clockInDto 上班打卡DTO
   * @returns 打卡记录和工作班次信息
   * @description 员工进行上班打卡，系统自动记录打卡时间并创建新的工作班次
   */
  @Post('clock-in')
  clockIn(
    @Request() req: { user: JwtPayload },
    @Body() clockInDto: ClockInDto,
  ) {
    return this.attendancesService.clockIn(req.user.userId, clockInDto);
  }

  /**
   * 下班打卡
   * @param req 请求对象（包含当前登录用户信息）
   * @param clockOutDto 下班打卡DTO
   * @returns 打卡记录和更新的工作班次信息
   * @description 员工进行下班打卡，系统自动记录打卡时间并更新工作班次
   */
  @Post('clock-out')
  clockOut(
    @Request() req: { user: JwtPayload },
    @Body() clockOutDto: ClockOutDto,
  ) {
    return this.attendancesService.clockOut(req.user.userId, clockOutDto);
  }

  /**
   * 获取当前打卡状态
   * @param req 请求对象（包含当前登录用户信息）
   * @param query 查询参数（可选：latitude, longitude）
   * @returns 打卡状态信息
   * @description 检查当前用户是否可以上班打卡或下班打卡
   */
  @Get('status')
  getClockStatus(
    @Request() req: { user: JwtPayload },
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
  ) {
    const lat = latitude ? parseFloat(latitude) : undefined;
    const lon = longitude ? parseFloat(longitude) : undefined;
    return this.attendancesService.getClockStatus(req.user.userId, lat, lon);
  }

  /**
   * 查询当前员工的月度打卡记录
   * @param req 请求对象（包含当前登录用户信息）
   * @param queryDto 查询DTO（年份、月份）
   * @returns 按天汇总的打卡记录
   * @description 员工可以查看自己每个月的打卡情况，按天汇总显示
   */
  @Get('my')
  getMyAttendanceRecords(
    @Request() req: { user: JwtPayload },
    @Query() queryDto: QueryAttendanceDto,
  ): Promise<DailyAttendanceRecord[]> {
    return this.attendancesService.getMyAttendanceRecords(
      req.user.userId,
      queryDto,
    );
  }

  /**
   * 管理员查询所有员工的打卡记录
   * @param queryDto 查询DTO（年份、月份、用户ID可选）
   * @returns 所有员工或指定员工的打卡记录
   * @description 管理员可以查看所有员工的打卡情况，可按员工筛选
   */
  @Get()
  @UseGuards(AdminGuard)
  getAllAttendanceRecords(
    @Query() queryDto: QueryAttendanceDto,
  ): Promise<AdminDailyAttendanceRecord[]> {
    return this.attendancesService.getAllAttendanceRecords(queryDto);
  }

  /**
   * 查询当前员工指定日期的打卡记录
   * @param req 请求对象（包含当前登录用户信息）
   * @param queryDto 查询DTO（日期）
   * @returns 指定日期的打卡记录
   * @description 员工可以查看指定日期的打卡情况
   */
  @Get('my/by-date')
  getMyAttendanceRecordsByDate(
    @Request() req: { user: JwtPayload },
    @Query() queryDto: QueryAttendanceByDateDto,
  ): Promise<DailyAttendanceRecord | null> {
    return this.attendancesService.getMyAttendanceRecordsByDate(
      req.user.userId,
      queryDto,
    );
  }

  /**
   * 管理员查询指定日期的所有员工打卡记录
   * @param queryDto 查询DTO（日期）
   * @returns 指定日期的所有员工打卡记录
   * @description 管理员可以查看指定日期的所有员工打卡情况
   */
  @Get('by-date')
  @UseGuards(AdminGuard)
  getAllAttendanceRecordsByDate(
    @Query() queryDto: QueryAttendanceByDateDto,
  ): Promise<AdminDailyAttendanceRecord[]> {
    return this.attendancesService.getAllAttendanceRecordsByDate(queryDto);
  }

  /**
   * 获取打卡中心
   * @returns 打卡中心信息
   * @description 获取打卡中心信息
   */
  @Get('center')
  getClockCenter(): Promise<ClockCenter> {
    return Promise.resolve(this.attendancesService.getClockCenter());
  }
}
