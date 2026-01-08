import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class QueryAttendanceByDateDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: '日期格式必须为 YYYY-MM-DD',
  })
  date: string; // 日期（格式：YYYY-MM-DD）
}
